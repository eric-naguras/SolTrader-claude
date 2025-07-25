import { Helius } from 'helius-sdk';
import { database } from '../lib/database.js';
import { Logger } from '../lib/logger.js';
import { ENV } from '../lib/env.js';
import { Service, ServiceStatus } from '../lib/service-interface.js';
import { MessageBus } from '../lib/message-bus.js';
import WebSocket from 'ws';
import { getMultipleWalletBalances } from '../lib/solscan.js';

export class WalletWatcher implements Service {
  readonly name = 'WalletWatcher';
  
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
            
            // Check if logs indicate a swap
            const isSwap = this.isPotentialSwap(message.params.result.value.logs);
            
            if (isSwap) {
              this.logger.transaction(`Potential swap detected: ${signature}`);
              setTimeout(async () => {
                await this.processTransaction(signature);
              }, 2000);
            }
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

  private isPotentialSwap(logs: string[]): boolean {
    return logs.some((log: string) => {
      const lowerLog = log.toLowerCase();
      return lowerLog.includes('swap') || 
             lowerLog.includes('trade') ||
             lowerLog.includes('exchange') ||
             lowerLog.includes('jupiter') ||
             lowerLog.includes('raydium') ||
             lowerLog.includes('orca') ||
             lowerLog.includes('meteora');
    });
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
      this.logger.debug(`Processing trade for wallet ${wallet.address.substring(0, 8)}...`);
      
      // Extract token and SOL balance changes
      const tokenChanges = this.extractTokenChanges(tx);
      const solChange = this.extractSolChange(tx, wallet.address);

      // Find the relevant token trade
      const tradeData = this.identifyTrade(tokenChanges, solChange);
      if (!tradeData) {
        return;
      }

      // Ensure token exists
      await this.ensureTokenExists(tradeData.tokenAddress);

      // Record the trade
      await this.recordTrade(wallet, tradeData, signature);
      
    } catch (error) {
      this.logger.error('Error processing trade:', error);
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

  private identifyTrade(tokenChanges: Array<{mint: string, change: number, decimals: number}>, solChange: number) {
    const SOL_MINT = 'So11111111111111111111111111111111111112';
    
    // Find the token with the largest change
    let targetToken: string | null = null;
    let tradeType: 'BUY' | 'SELL' | null = null;
    let solAmount = Math.abs(solChange) / 1e9; // Convert to SOL

    // Look for SOL-token swaps
    for (const change of tokenChanges) {
      if (change.mint === SOL_MINT) continue;
      
      // Check if this is a swap with SOL
      if (Math.abs(solChange) > 0.001 * 1e9) { // At least 0.001 SOL
        if (solChange < 0 && change.change > 0) {
          targetToken = change.mint;
          tradeType = 'BUY';
          break;
        } else if (solChange > 0 && change.change < 0) {
          targetToken = change.mint;
          tradeType = 'SELL';
          break;
        }
      }
    }

    if (!targetToken && tokenChanges.length > 0) {
      // Fallback: use the first token change
      const change = tokenChanges[0];
      targetToken = change.mint;
      tradeType = change.change > 0 ? 'BUY' : 'SELL';
    }

    return targetToken && tradeType ? { tokenAddress: targetToken, tradeType, solAmount } : null;
  }

  private async ensureTokenExists(address: string) {
    try {
      const existingToken = await database.getToken(address);
      
      if (existingToken?.symbol && existingToken?.name) {
        // Token already exists, just update last_seen
        await database.upsertToken({
          address,
          symbol: existingToken.symbol,
          name: existingToken.name,
          metadata: existingToken.metadata
        });
        return;
      }

      // Fetch token metadata (placeholder - could be enhanced)
      const tokenData = {
        address,
        symbol: address.substring(0, 8).toUpperCase(),
        name: `Token ${address.substring(0, 8)}`,
        metadata: {}
      };

      await database.upsertToken(tokenData);
      
    } catch (error) {
      this.logger.error('Error ensuring token exists:', error);
    }
  }

  private async recordTrade(wallet: any, tradeData: any, signature: string) {
    try {
      const trade = await database.insertWhaleTrade({
        wallet_address: wallet.address,
        coin_address: tradeData.tokenAddress,
        trade_type: tradeData.tradeType,
        sol_amount: tradeData.solAmount,
        token_amount: null, // Could be calculated from transaction
        transaction_hash: signature,
        trade_timestamp: new Date().toISOString()
      });

      if (trade) {
        const walletName = wallet.alias || wallet.address.slice(0, 8) + '...';
        const tokenDisplay = tradeData.tokenAddress.substring(0, 8) + '...';
        
        this.logger.trade.generic(`[WalletWatcher] Recorded ${tradeData.tradeType} trade: ${walletName} -> ${tokenDisplay} (${tradeData.solAmount} SOL)`);
        
        // Publish new trade event to message bus
        this.messageBus.publish('new_trade', { trade });
        
        if (tradeData.tradeType === 'BUY') {
          this.logger.trade.enter(walletName, tokenDisplay, tradeData.solAmount);
          
          // Track multi-whale positions
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
        } else {
          this.logger.trade.exit(walletName, tokenDisplay, tradeData.solAmount);
          
          // Remove from multi-whale tracking
          this.multiWhalePositions.get(tradeData.tokenAddress)?.delete(wallet.address);
          if (this.multiWhalePositions.get(tradeData.tokenAddress)?.size === 0) {
            this.multiWhalePositions.delete(tradeData.tokenAddress);
          }
        }
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