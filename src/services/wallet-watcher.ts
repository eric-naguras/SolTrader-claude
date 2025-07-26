import { Helius } from 'helius-sdk';
import { database } from '../lib/database.js';
import { Logger } from '../lib/logger.js';
import { ENV } from '../lib/env.js';
import { Service, ServiceStatus } from '../lib/service-interface.js';
import { MessageBus } from '../lib/message-bus.js';
import { solscanAPI } from '../lib/solscan-api.js';
import WebSocket from 'ws';
import { getMultipleWalletBalances } from '../lib/solscan.js';

export class WalletWatcher implements Service {
  readonly name = 'WalletWatcher';
  
  private static readonly SOL_MINT = 'So11111111111111111111111111111111111112';
  
  private helius: Helius;
  private logger: Logger;
  private messageBus: MessageBus;
  private trackedWallets: Map<string, any> = new Map();
  private ws: WebSocket | null = null;
  private reconnectInterval: number = 1000;
  private reconnectAttempts: number = 0;
  private maxReconnectAttempts: number = 50;
  private pingInterval?: number;
  private isShuttingDown: boolean = false;
  private reconnectTimeout?: number;
  private multiWhalePositions: Map<string, Set<string>> = new Map();
  private isRunning: boolean = false;
  private unsubscribers: (() => void)[] = [];
  private balanceUpdateInterval?: number;
  private uiRefreshConfig: any = {
    balance_interval_minutes: 5,
    auto_refresh_enabled: true,
    pause_on_activity: true,
    show_refresh_indicators: true
  };

  constructor(messageBus: MessageBus) {
    const heliusApiKey = ENV.HELIUS_API_KEY;
    if (!heliusApiKey) {
      throw new Error('HELIUS_API_KEY environment variable is required');
    }

    this.messageBus = messageBus;
    this.helius = new Helius(heliusApiKey);
    this.logger = new Logger('wallet-watcher');
    this.logger.system('[WalletWatcher] Initialized');
  }

  async start(): Promise<void> {
    try {
      this.logger.system('[WalletWatcher] Starting...');
      this.isShuttingDown = false;
      
      // Subscribe to message bus events
      this.setupMessageBusListeners();
      
      // Load tracked wallets
      await this.loadTrackedWallets();
      
      // Set up WebSocket connection
      if (this.trackedWallets.size > 0) {
        await this.setupWebSocket();
      } else {
        this.logger.wallet('[WalletWatcher] No active wallets to track. Waiting for wallets to be added...');
      }
      
      // Set up periodic balance updates
      this.setupBalanceUpdates();
      
      // Update heartbeat periodically
      setInterval(() => this.updateHeartbeat(), 30000);
      
      this.isRunning = true;
      this.logger.system('[WalletWatcher] Started successfully');
      
      // Publish service started event
      this.messageBus.publish('service_started', { serviceName: this.name });
    } catch (error) {
      this.logger.error('[WalletWatcher] Failed to start:', error);
      this.isRunning = false;
      throw error;
    }
  }

  async stop(): Promise<void> {
    this.logger.system('[WalletWatcher] Stopping...');
    this.isShuttingDown = true;
    this.isRunning = false;

    // Clean up WebSocket connection
    if (this.ws) {
      this.ws.removeAllListeners();
      this.ws.close();
      this.ws = null;
    }

    // Clear intervals
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = undefined;
    }

    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = undefined;
    }

    // Unsubscribe from message bus events
    this.unsubscribers.forEach(unsub => unsub());
    this.unsubscribers = [];

    this.logger.system('[WalletWatcher] Stopped');
    
    // Publish service stopped event
    this.messageBus.publish('service_stopped', { serviceName: this.name });
  }

  getStatus(): ServiceStatus {
    return {
      running: this.isRunning,
      lastHeartbeat: new Date().toISOString(),
      metadata: {
        trackedWallets: this.trackedWallets.size,
        websocketConnected: this.ws?.readyState === WebSocket.OPEN,
        reconnectAttempts: this.reconnectAttempts
      }
    };
  }

  private setupMessageBusListeners(): void {
    // Listen for wallet updates from the frontend
    const walletUpdatedHandler = async (data: any) => {
      this.logger.wallet('[WalletWatcher] Received wallet_updated event');
      await this.loadTrackedWallets();
      
      // Reconnect WebSocket with new wallet list
      if (this.isRunning && !this.isShuttingDown) {
        await this.setupWebSocket();
      }
    };

    this.messageBus.subscribe('wallet_updated', walletUpdatedHandler);
    this.unsubscribers.push(() => this.messageBus.unsubscribe('wallet_updated', walletUpdatedHandler));
    
    // Listen for UI config changes
    const uiConfigChangedHandler = (data: any) => {
      this.logger.system('[WalletWatcher] Received ui_config_changed event');
      this.uiRefreshConfig = data.ui_refresh_config;
      
      // Clear existing interval and set up new one with updated config
      if (this.balanceUpdateInterval) {
        clearInterval(this.balanceUpdateInterval);
      }
      this.setupBalanceUpdates();
    };

    this.messageBus.subscribe('ui_config_changed', uiConfigChangedHandler);
    this.unsubscribers.push(() => this.messageBus.unsubscribe('ui_config_changed', uiConfigChangedHandler));
  }

  private setupBalanceUpdates(): void {
    // Clear existing interval if any
    if (this.balanceUpdateInterval) {
      clearInterval(this.balanceUpdateInterval);
      this.balanceUpdateInterval = undefined;
    }
    
    // Set up new interval based on UI config
    if (this.uiRefreshConfig.auto_refresh_enabled) {
      const intervalMinutes = Math.max(1, Math.min(60, this.uiRefreshConfig.balance_interval_minutes || 5));
      const intervalMs = intervalMinutes * 60 * 1000;
      
      this.balanceUpdateInterval = setInterval(() => {
        if (this.isRunning && !this.isShuttingDown) {
          this.updateWalletBalances();
        }
      }, intervalMs);
      
      this.logger.system(`[WalletWatcher] Balance updates scheduled every ${intervalMinutes} minutes`);
    } else {
      this.logger.system('[WalletWatcher] Balance updates disabled by UI config');
    }
  }

  private async updateWalletBalances(): Promise<void> {
    if (this.trackedWallets.size === 0) {
      return;
    }
    
    try {
      this.logger.system(`[WalletWatcher] Updating balances for ${this.trackedWallets.size} wallets`);
      
      // Get all wallet addresses
      const addresses = Array.from(this.trackedWallets.keys());
      
      // Fetch balances from Solscan
      const balances = await getMultipleWalletBalances(addresses);
      
      // Update database with new balances
      for (const [address, balance] of Object.entries(balances)) {
        if (balance !== null) {
          await database.updateWalletBalance(address, balance);
          
          // Update in-memory wallet data
          const wallet = this.trackedWallets.get(address);
          if (wallet) {
            wallet.sol_balance = balance;
            wallet.last_balance_check = new Date().toISOString();
          }
        }
      }
      
      this.logger.system(`[WalletWatcher] Updated balances for ${Object.keys(balances).length} wallets`);
      
      // Publish update event to refresh UI
      this.messageBus.publish('wallet_balances_updated', { 
        timestamp: new Date().toISOString(),
        updatedCount: Object.keys(balances).length
      });
    } catch (error) {
      this.logger.error('[WalletWatcher] Error updating wallet balances:', error);
    }
  }

  private async loadTrackedWallets() {
    try {
      const wallets = await database.getActiveTrackedWallets();
      
      this.trackedWallets.clear();
      wallets.forEach(wallet => {
        this.trackedWallets.set(wallet.address, wallet);
      });

      this.logger.wallet(`Loaded ${this.trackedWallets.size} active wallets`);
    } catch (error) {
      this.logger.error('Failed to load wallets:', error);
    }
  }

  private async setupWebSocket() {
    // Clean up existing connection
    if (this.ws) {
      if (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING) {
        this.ws.removeAllListeners();
        this.ws.close();
      }
      this.ws = null;
    }

    if (this.trackedWallets.size === 0) {
      this.logger.wallet('No active wallets to track');
      return;
    }

    const addresses = Array.from(this.trackedWallets.keys());
    
    try {
      const wsUrl = `wss://mainnet.helius-rpc.com/?api-key=${ENV.HELIUS_API_KEY}`;
      this.ws = new WebSocket(wsUrl);

      this.ws.on('open', () => {
        this.logger.connection('WebSocket connected');
        this.reconnectAttempts = 0;
        this.reconnectInterval = 1000;
        
        // Subscribe to logs for each address
        addresses.forEach((address, index) => {
          const subscribeMessage = {
            jsonrpc: "2.0",
            id: index + 1,
            method: "logsSubscribe",
            params: [
              { mentions: [address] },
              { commitment: "confirmed" }
            ]
          };
          
          this.ws!.send(JSON.stringify(subscribeMessage));
          this.logger.connection(`Subscribing to wallet ${index + 1}/${addresses.length}: ${address.substring(0, 8)}...`);
          
          // Small delay between subscriptions
          setTimeout(() => {}, 50 * index);
        });
        
        // Set up ping to keep connection alive using runtime-agnostic timer
        if (this.pingInterval) {
          clearInterval(this.pingInterval);
        }
        
        this.pingInterval = setInterval(() => {
          if (this.ws?.readyState === WebSocket.OPEN) {
            this.ws.ping();
          }
        }, 20000) as any; // Cast to any for runtime compatibility
      });

      this.ws.on('message', async (data) => {
        try {
          const message = JSON.parse(data.toString());
          
          // Handle subscription confirmations
          if (message.id && message.result) {
            this.logger.connection(`Subscription ${message.id} confirmed`);
            return;
          }
          
          // Handle log notifications
          if (message.method === 'logsNotification' && message.params) {
            const { signature } = message.params.result.value;
            
            // Process ALL transactions, not just swaps
            this.logger.transaction(`Transaction detected: ${signature}`);
            setTimeout(async () => {
              await this.processTransaction(signature);
            }, 2000);
          }
        } catch (error) {
          this.logger.error('Error processing message:', error);
        }
      });

      this.ws.on('error', (error) => {
        this.logger.error('WebSocket error:', error);
      });

      this.ws.on('close', (code, reason) => {
        this.logger.connection(`WebSocket disconnected (code: ${code}, reason: ${reason})`);
        if (this.pingInterval) {
          clearInterval(this.pingInterval);
          this.pingInterval = undefined;
        }
        if (code !== 1000 && !this.isShuttingDown) {
          this.handleReconnect();
        }
      });

    } catch (error) {
      this.logger.error('Failed to setup WebSocket:', error);
      this.handleReconnect();
    }
  }


  private async processTransaction(signature: string) {
    try {
      const tx = await this.helius.connection.getParsedTransaction(
        signature,
        {
          maxSupportedTransactionVersion: 0,
          commitment: 'confirmed'
        }
      );
      
      if (!tx || !tx.meta) {
        this.logger.error(`Could not fetch transaction: ${signature}`);
        return;
      }

      // Find which tracked wallet is involved
      let involvedWallet: any = null;
      
      // Check account keys
      const accountKeys = tx.transaction.message.accountKeys.map(key => key.pubkey.toString());
      for (const address of accountKeys) {
        if (this.trackedWallets.has(address)) {
          involvedWallet = this.trackedWallets.get(address);
          break;
        }
      }

      if (!involvedWallet) {
        return;
      }

      // Process the trade
      await this.processTrade(tx, involvedWallet, signature);
      
    } catch (error) {
      this.logger.error(`Error processing transaction ${signature}:`, error);
    }
  }

  private async processTrade(tx: any, wallet: any, signature: string) {
    try {
      this.logger.debug(`Processing transaction for wallet ${wallet.address.substring(0, 8)}...`);
      
      // Extract token and SOL balance changes
      const tokenChanges = this.extractTokenChanges(tx);
      const solChange = this.extractSolChange(tx, wallet.address);

      // Determine transaction type and details
      const transactionData = this.analyzeTransaction(tx, tokenChanges, solChange, wallet.address);
      if (!transactionData) {
        this.logger.debug(`No relevant activity found for wallet ${wallet.address.substring(0, 8)}`);
        return;
      }

      // Ensure token exists (if applicable)
      if (transactionData.tokenAddress && transactionData.tokenAddress !== WalletWatcher.SOL_MINT) {
        await this.ensureTokenExists(transactionData.tokenAddress);
      }

      // Record the transaction
      await this.recordTrade(wallet, transactionData, signature);
      
    } catch (error) {
      this.logger.error('Error processing transaction:', error);
    }
  }

  private extractTokenChanges(tx: any): Array<{mint: string, change: number, decimals: number}> {
    const changes: Array<{mint: string, change: number, decimals: number}> = [];
    
    if (tx.meta.preTokenBalances && tx.meta.postTokenBalances) {
      for (const postBalance of tx.meta.postTokenBalances) {
        const preBalance = tx.meta.preTokenBalances.find(
          (pre: any) => pre.accountIndex === postBalance.accountIndex && pre.mint === postBalance.mint
        );
        
        if (preBalance) {
          const diff = Number(postBalance.uiTokenAmount.amount) - Number(preBalance.uiTokenAmount.amount);
          if (diff !== 0) {
            changes.push({
              mint: postBalance.mint,
              change: diff,
              decimals: postBalance.uiTokenAmount.decimals
            });
          }
        }
      }
    }
    
    return changes;
  }

  private extractSolChange(tx: any, walletAddress: string): number {
    const accountIndex = tx.transaction.message.accountKeys.findIndex(
      (key: any) => key.pubkey.toString() === walletAddress
    );
    
    if (accountIndex === -1) return 0;
    
    const preBalance = tx.meta.preBalances[accountIndex];
    const postBalance = tx.meta.postBalances[accountIndex];
    const fee = accountIndex === 0 ? (tx.meta.fee || 0) : 0;
    
    return postBalance - preBalance - fee;
  }

  private analyzeTransaction(tx: any, tokenChanges: Array<{mint: string, change: number, decimals: number}>, solChange: number, walletAddress: string) {
    // Debug logging
    this.logger.debug(`[WalletWatcher] Analyzing transaction for ${walletAddress.substring(0, 8)}...`);
    this.logger.debug(`[WalletWatcher] SOL change: ${solChange / 1e9} SOL`);
    this.logger.debug(`[WalletWatcher] Token changes: ${tokenChanges.map(c => `${c.mint.substring(0, 8)}... (${c.change})`).join(', ')}`);
    
    // Check if this is a swap transaction
    const swapData = this.identifyTrade(tokenChanges, solChange);
    if (swapData && swapData.tokenAddress !== WalletWatcher.SOL_MINT) {
      this.logger.debug(`[WalletWatcher] Identified as swap: ${swapData.tradeType} ${swapData.tokenAddress.substring(0, 8)}...`);
      return {
        ...swapData,
        transactionType: 'swap',
        counterpartyAddress: null
      };
    }
    
    if (swapData && swapData.tokenAddress === WalletWatcher.SOL_MINT) {
      this.logger.debug(`[WalletWatcher] Swap detected but with SOL address - treating as SOL transfer instead`);
    }
    
    this.logger.debug(`[WalletWatcher] Not identified as swap, checking other transaction types...`);

    // Check for SOL transfers
    if (Math.abs(solChange) > 0.001 * 1e9) { // At least 0.001 SOL
      const solAmount = Math.abs(solChange) / 1e9;
      const tradeType = solChange > 0 ? 'TRANSFER_IN' : 'TRANSFER_OUT';
      
      // Try to find the counterparty from instruction data
      const counterparty = this.findCounterpartyAddress(tx, walletAddress);
      
      return {
        tokenAddress: WalletWatcher.SOL_MINT,
        tradeType,
        solAmount,
        transactionType: 'sol_transfer',
        counterpartyAddress: counterparty
      };
    }

    // Check for token transfers (no SOL change)
    for (const change of tokenChanges) {
      if (change.mint === WalletWatcher.SOL_MINT) continue;
      
      if (Math.abs(change.change) > 0) {
        const tradeType = change.change > 0 ? 'TRANSFER_IN' : 'TRANSFER_OUT';
        const counterparty = this.findCounterpartyAddress(tx, walletAddress);
        
        return {
          tokenAddress: change.mint,
          tradeType,
          solAmount: 0,
          transactionType: 'token_transfer',
          counterpartyAddress: counterparty
        };
      }
    }

    // Other transaction types
    if (tokenChanges.length > 0 || Math.abs(solChange) > 0) {
      return {
        tokenAddress: WalletWatcher.SOL_MINT,
        tradeType: 'OTHER' as const,
        solAmount: Math.abs(solChange) / 1e9,
        transactionType: 'other',
        counterpartyAddress: null
      };
    }

    return null;
  }

  private findCounterpartyAddress(tx: any, walletAddress: string): string | null {
    try {
      // Look for simple transfers in instruction data
      const accountKeys = tx.transaction.message.accountKeys.map((key: any) => key.pubkey.toString());
      
      // Find addresses that aren't the wallet and aren't system programs
      const systemPrograms = [
        '11111111111111111111111111111111', // System Program
        'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA', // Token Program
        'ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL', // Associated Token Program
      ];
      
      for (const address of accountKeys) {
        if (address !== walletAddress && !systemPrograms.includes(address)) {
          // This could be the counterparty - we'll use the first non-system address
          return address;
        }
      }
      
      return null;
    } catch (error) {
      return null;
    }
  }

  private identifyTrade(tokenChanges: Array<{mint: string, change: number, decimals: number}>, solChange: number) {
    this.logger.debug(`[WalletWatcher] identifyTrade called with ${tokenChanges.length} token changes, SOL change: ${solChange / 1e9}`);
    
    // Find the meme coin (non-SOL token) that changed
    let targetToken: string | null = null;
    let tradeType: 'BUY' | 'SELL' | null = null;
    let solAmount = Math.abs(solChange) / 1e9; // Convert to SOL

    // Look for non-SOL token changes - we always want the meme coin, never SOL
    for (const change of tokenChanges) {
      this.logger.debug(`[WalletWatcher] Checking token change: ${change.mint.substring(0, 8)}... change: ${change.change}`);
      
      if (change.mint === WalletWatcher.SOL_MINT) {
        this.logger.debug(`[WalletWatcher] Skipping SOL token change`);
        continue; // Skip SOL
      }
      
      // Check if this is a swap with SOL
      if (Math.abs(solChange) > 0.001 * 1e9) { // At least 0.001 SOL
        if (solChange < 0 && change.change > 0) {
          // SOL decreased, token increased = BUY
          this.logger.debug(`[WalletWatcher] Detected BUY: SOL decreased (${solChange / 1e9}), token ${change.mint.substring(0, 8)}... increased (${change.change})`);
          targetToken = change.mint;
          tradeType = 'BUY';
          break;
        } else if (solChange > 0 && change.change < 0) {
          // SOL increased, token decreased = SELL
          this.logger.debug(`[WalletWatcher] Detected SELL: SOL increased (${solChange / 1e9}), token ${change.mint.substring(0, 8)}... decreased (${change.change})`);
          targetToken = change.mint;
          tradeType = 'SELL';
          break;
        }
      }
    }

    // Fallback: find any non-SOL token change
    if (!targetToken) {
      for (const change of tokenChanges) {
        if (change.mint === WalletWatcher.SOL_MINT) continue; // Never use SOL as target token
        
        targetToken = change.mint;
        tradeType = change.change > 0 ? 'BUY' : 'SELL';
        break;
      }
    }

    // Only return if we found a non-SOL token
    if (targetToken && tradeType && targetToken !== WalletWatcher.SOL_MINT) {
      this.logger.debug(`[WalletWatcher] identifyTrade returning: ${tradeType} ${targetToken.substring(0, 8)}... (${solAmount} SOL)`);
      return { tokenAddress: targetToken, tradeType, solAmount };
    }
    
    this.logger.debug(`[WalletWatcher] identifyTrade returning null - no valid non-SOL token found`);
    return null;
  }

  private async ensureTokenExists(address: string) {
    try {
      // Skip SOL - we never need to store it as a token
      if (address === WalletWatcher.SOL_MINT) {
        return;
      }

      const existingToken = await database.getToken(address);
      
      // Check if token exists with proper data (not placeholder)
      if (existingToken?.symbol && existingToken?.name) {
        const isPlaceholder = existingToken.symbol === address.substring(0, 8).toUpperCase() ||
                            existingToken.name === `Token ${address.substring(0, 8)}` ||
                            existingToken.symbol === 'UNKNOWN';
        
        if (!isPlaceholder) {
          // Token already exists with proper metadata, just update last_seen
          await database.upsertToken({
            address,
            symbol: existingToken.symbol,
            name: existingToken.name,
            metadata: existingToken.metadata
          });
          this.logger.debug(`Token already in database: ${existingToken.symbol} (${existingToken.name})`);
          return;
        }
        
        // Token has placeholder data, try to fetch real metadata
        this.logger.debug(`Token has placeholder data, fetching real metadata for ${address.substring(0, 8)}...`);
      }

      // Token not in database or has placeholder data, fetch metadata
      this.logger.debug(`Fetching token metadata for ${address.substring(0, 8)}...`);
      const metadata = await solscanAPI.getTokenMetadata(address);
      
      let tokenData;
      if (metadata && metadata.symbol !== 'UNKNOWN') {
        // Successfully fetched metadata
        tokenData = {
          address,
          symbol: metadata.symbol,
          name: metadata.name,
          metadata: {
            decimals: metadata.decimals,
            icon: metadata.icon,
            website: metadata.website,
            twitter: metadata.twitter
          }
        };
        this.logger.wallet(`Token metadata fetched: ${metadata.symbol} - ${metadata.name}`);
      } else {
        // Fallback to placeholder data
        tokenData = {
          address,
          symbol: address.substring(0, 8).toUpperCase(),
          name: `Token ${address.substring(0, 8)}`,
          metadata: {}
        };
        this.logger.debug(`Using placeholder data for token ${address.substring(0, 8)}...`);
      }

      await database.upsertToken(tokenData);
      
    } catch (error) {
      this.logger.error('Error ensuring token exists:', error);
    }
  }

  private async recordTrade(wallet: any, tradeData: any, signature: string) {
    try {
      // Get token info from database (should be available after ensureTokenExists)
      // For SOL transfers, we'll use SOL as the "token"
      const tokenInfo = tradeData.tokenAddress !== WalletWatcher.SOL_MINT 
        ? await database.getToken(tradeData.tokenAddress)
        : { symbol: 'SOL', name: 'Solana' };
      
      const trade = await database.insertWhaleTrade({
        wallet_address: wallet.address,
        coin_address: tradeData.tokenAddress,
        trade_type: tradeData.tradeType,
        sol_amount: tradeData.solAmount,
        token_amount: null, // Could be calculated from transaction
        transaction_hash: signature,
        trade_timestamp: new Date().toISOString(),
        transaction_type: tradeData.transactionType,
        counterparty_address: tradeData.counterpartyAddress
      });

      if (trade) {
        const walletName = wallet.alias || wallet.address.slice(0, 8) + '...';
        const tokenDisplay = tokenInfo ? `${tokenInfo.symbol} (${tokenInfo.name})` : tradeData.tokenAddress.substring(0, 8) + '...';
        
        // Log different transaction types appropriately
        switch (tradeData.transactionType) {
          case 'swap':
            this.logger.trade.generic(`[WalletWatcher] Recorded ${tradeData.tradeType} swap: ${walletName} -> ${tokenDisplay} (${tradeData.solAmount} SOL)`);
            break;
          case 'sol_transfer':
            const direction = tradeData.tradeType === 'TRANSFER_IN' ? 'received' : 'sent';
            const counterparty = tradeData.counterpartyAddress ? tradeData.counterpartyAddress.substring(0, 8) + '...' : 'unknown';
            this.logger.trade.generic(`[WalletWatcher] Recorded SOL transfer: ${walletName} ${direction} ${tradeData.solAmount} SOL ${tradeData.tradeType === 'TRANSFER_IN' ? 'from' : 'to'} ${counterparty}`);
            break;
          case 'token_transfer':
            const tokenDirection = tradeData.tradeType === 'TRANSFER_IN' ? 'received' : 'sent';
            const tokenCounterparty = tradeData.counterpartyAddress ? tradeData.counterpartyAddress.substring(0, 8) + '...' : 'unknown';
            this.logger.trade.generic(`[WalletWatcher] Recorded token transfer: ${walletName} ${tokenDirection} ${tokenDisplay} ${tradeData.tradeType === 'TRANSFER_IN' ? 'from' : 'to'} ${tokenCounterparty}`);
            break;
          default:
            this.logger.trade.generic(`[WalletWatcher] Recorded ${tradeData.transactionType}: ${walletName} -> ${tokenDisplay} (${tradeData.solAmount} SOL)`);
        }
        
        // Publish new trade event to message bus with token info
        this.messageBus.publish('new_trade', { 
          trade,
          tokenInfo: tokenInfo ? {
            symbol: tokenInfo.symbol,
            name: tokenInfo.name,
            address: tokenInfo.address,
            metadata: tokenInfo.metadata
          } : null
        });
        
        // Only track multi-whale positions for swaps (BUY/SELL)
        if (tradeData.tradeType === 'BUY') {
          this.logger.trade.enter(walletName, tokenDisplay, tradeData.solAmount);
          
          // Track multi-whale positions for signal generation
          if (!this.multiWhalePositions.has(tradeData.tokenAddress)) {
            this.multiWhalePositions.set(tradeData.tokenAddress, new Set());
          }
          this.multiWhalePositions.get(tradeData.tokenAddress)!.add(wallet.address);
          
          // Check for multi-whale coordination
          const whalesInToken = this.multiWhalePositions.get(tradeData.tokenAddress)!;
          if (whalesInToken.size > 1) {
            const whaleNames = Array.from(whalesInToken).map(addr => {
              const w = this.trackedWallets.get(addr);
              return w?.alias || addr.slice(0, 8) + '...';
            });
            this.logger.multiWhale(whalesInToken.size, tokenDisplay, whaleNames);
          }
        } else if (tradeData.tradeType === 'SELL') {
          this.logger.trade.exit(walletName, tokenDisplay, tradeData.solAmount);
          
          // Remove from multi-whale tracking
          this.multiWhalePositions.get(tradeData.tokenAddress)?.delete(wallet.address);
          if (this.multiWhalePositions.get(tradeData.tokenAddress)?.size === 0) {
            this.multiWhalePositions.delete(tradeData.tokenAddress);
          }
        }
        // Note: Transfers don't affect multi-whale signal generation
      }
      
    } catch (error) {
      this.logger.error('Error recording trade:', error);
    }
  }

  private handleReconnect() {
    if (this.isShuttingDown || this.reconnectTimeout) {
      return;
    }
    
    if (this.ws && (this.ws.readyState === WebSocket.CONNECTING || this.ws.readyState === WebSocket.OPEN)) {
      return;
    }
    
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      this.logger.connection(`Reconnecting in ${this.reconnectInterval}ms... (Attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})`);
      
      this.reconnectTimeout = setTimeout(() => {
        this.reconnectTimeout = undefined;
        if (!this.isShuttingDown && (!this.ws || this.ws.readyState === WebSocket.CLOSED)) {
          this.setupWebSocket();
        }
      }, this.reconnectInterval) as any; // Cast for runtime compatibility
      
      this.reconnectInterval = Math.min(this.reconnectInterval * 1.5, 30000);
    } else {
      this.logger.error('Max reconnection attempts reached. Service stopped.');
    }
  }

  private async updateHeartbeat() {
    try {
      await database.upsertServiceHeartbeat({
        service_name: 'wallet-watcher',
        last_heartbeat: new Date().toISOString(),
        status: 'healthy',
        metadata: {
          tracked_wallets: this.trackedWallets.size,
          websocket_connected: this.ws?.readyState === WebSocket.OPEN
        }
      });
    } catch (error) {
      this.logger.debug(`Heartbeat update skipped: ${error}`);
    }
  }

  async stop() {
    this.logger.system('Stopping wallet watcher...');
    this.isShuttingDown = true;
    
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = undefined;
    }
    
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = undefined;
    }
    
    if (this.ws) {
      this.ws.removeAllListeners();
      if (this.ws.readyState === WebSocket.OPEN) {
        this.ws.close(1000, 'Service stopping');
      }
      this.ws = null;
    }
    
    await this.logger.cleanup();
  }
}