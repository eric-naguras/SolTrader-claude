import { Helius } from 'helius-sdk';
import { supabase, type TrackedWallet, type WhaleTrade } from '../lib/supabase.js';
import { ConfigurableLogger } from '../lib/logger.js';
import WebSocket from 'ws';

export class WhaleWatcherStream {
  private helius: Helius;
  private logger: ConfigurableLogger;
  private trackedWallets: Map<string, TrackedWallet> = new Map();
  private ws: WebSocket | null = null;
  private reconnectInterval: number = 1000; // Start with 1 second
  private reconnectAttempts: number = 0;
  private maxReconnectAttempts: number = 50; // More attempts
  private pingInterval?: NodeJS.Timeout;
  private subscriptionId?: number;
  private isShuttingDown: boolean = false;
  private reconnectTimeout?: NodeJS.Timeout;
  private multiWhalePositions: Map<string, Set<string>> = new Map(); // token -> wallets
  private walletSubscription: any;

  constructor() {
    const heliusApiKey = process.env.HELIUS_API_KEY;
    if (!heliusApiKey) {
      throw new Error('HELIUS_API_KEY environment variable is required');
    }

    this.helius = new Helius(heliusApiKey);
    this.logger = new ConfigurableLogger('whale-watcher');
    this.logger.system('Initialized with streaming strategy');
  }

  async start() {
    try {
      this.logger.system('Starting service...');
      
      // Load tracked wallets
      await this.loadTrackedWallets();
      
      // Set up WebSocket connection
      if (this.trackedWallets.size > 0) {
        await this.setupWebSocket();
      } else {
        this.logger.wallet('No active wallets to track. Waiting for wallets to be added...');
      }
      
      // Set up real-time subscription for wallet changes
      this.setupWalletSubscription();
      
      // Update heartbeat
      setInterval(() => this.updateHeartbeat(), 30000); // Every 30 seconds
      
      this.logger.system('Service started successfully');
    } catch (error) {
      this.logger.error('Failed to start service:', error);
      throw error;
    }
  }

  private async loadTrackedWallets() {
    try {
      const { data, error } = await supabase
        .from('tracked_wallets')
        .select('*')
        .eq('is_active', true);

      if (error) {
        this.logger.error('Error loading wallets:', error);
        return;
      }

      this.trackedWallets.clear();
      data?.forEach(wallet => {
        this.trackedWallets.set(wallet.address, wallet);
      });

      this.logger.wallet(`Loaded ${this.trackedWallets.size} active wallets`);
    } catch (error) {
      this.logger.error('Failed to load wallets:', error);
    }
  }

  private async setupWebSocket() {
    // Clean up existing connection properly
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
      // Use Helius mainnet RPC WebSocket
      const wsUrl = `wss://mainnet.helius-rpc.com/?api-key=${process.env.HELIUS_API_KEY}`;
      this.ws = new WebSocket(wsUrl);

      this.ws.on('open', () => {
        this.logger.connection('WebSocket connected');
        this.reconnectAttempts = 0;
        this.reconnectInterval = 1000; // Reset interval
        
        // Wait a bit before subscribing to ensure connection is stable
        setTimeout(() => {
          if (this.ws?.readyState === WebSocket.OPEN) {
            // Subscribe to logs for each address individually
            // Helius only supports one address per subscription
            addresses.forEach((address, index) => {
              const subscribeMessage = {
                jsonrpc: "2.0",
                id: index + 1, // Unique ID for each subscription
                method: "logsSubscribe",
                params: [
                  {
                    mentions: [address] // Single address
                  },
                  {
                    commitment: "confirmed"
                  }
                ]
              };
              
              this.ws!.send(JSON.stringify(subscribeMessage));
              this.logger.connection(`Subscribing to wallet ${index + 1}/${addresses.length}: ${address.substring(0, 8)}...`);
              
              // Small delay between subscriptions to avoid rate limiting
              setTimeout(() => {}, 50 * index);
            });
          }
        }, 1000);
        
        // Set up ping to keep connection alive
        if (this.pingInterval) {
          clearInterval(this.pingInterval);
        }
        
        this.pingInterval = setInterval(() => {
          if (this.ws?.readyState === WebSocket.OPEN) {
            this.ws.ping();
          }
        }, 20000); // Ping every 20 seconds
      });

      this.ws.on('message', async (data) => {
        try {
          const message = JSON.parse(data.toString());
          
          // Handle subscription confirmations (multiple IDs)
          if (message.id && message.result) {
            this.logger.connection(`Subscription ${message.id} confirmed: ${message.result}`);
            
            // Check if all subscriptions are confirmed
            if (message.id === this.trackedWallets.size) {
              this.logger.system(`✅ WebSocket fully operational - monitoring ${this.trackedWallets.size} wallets for trades`);
            }
            return;
          }
          
          // Handle subscription errors
          if (message.id && message.error) {
            this.logger.error(`❌ Subscription ${message.id} failed:`, message.error);
            // Don't reconnect on partial failures, just log
            return;
          }
          
          // Handle log notifications
          if (message.method === 'logsNotification' && message.params) {
            const { signature, logs } = message.params.result.value;
            
            // Check if logs indicate this might be a swap or trade
            // Expanded to catch more DEX transactions
            const isSwap = logs.some((log: string) => {
              const lowerLog = log.toLowerCase();
              return lowerLog.includes('swap') || 
                     lowerLog.includes('trade') ||
                     lowerLog.includes('exchange') ||
                     lowerLog.includes('jupiter') ||
                     lowerLog.includes('raydium') ||
                     lowerLog.includes('orca') ||
                     lowerLog.includes('meteora') ||
                     log.includes('Program log: ray_log') ||
                     log.includes('Program log: Instruction:') // Common pattern
            });
            
            if (isSwap) {
              this.logger.transaction(() => `Potential swap detected: ${signature}`);
              // Small delay to ensure transaction is fully propagated
              setTimeout(async () => {
                await this.processTransaction(signature);
              }, 2000); // 2 second delay
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
        // Only reconnect if not manually closed and not shutting down
        if (code !== 1000 && !this.isShuttingDown) {
          this.handleReconnect();
        }
      });

      this.ws.on('pong', () => {
        // Connection is alive
      });

    } catch (error) {
      this.logger.error('Failed to setup WebSocket:', error);
      this.handleReconnect();
    }
  }

  private async processTransaction(signature: string) {
    try {
      // Use Helius connection to get transaction details
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
      
      // Convert to enhanced format with proper address extraction
      const enhancedTx = {
        signature: signature,
        type: 'UNKNOWN',
        tokenTransfers: [] as any[],
        nativeTransfers: [] as any[],
        accountData: tx.transaction.message.accountKeys.map(key => ({ account: key.pubkey.toString() })),
        timestamp: tx.blockTime
      };
      
      // Extract token transfers with proper from/to addresses
      if (tx.meta.preTokenBalances && tx.meta.postTokenBalances) {
        for (const postBalance of tx.meta.postTokenBalances) {
          const preBalance = tx.meta.preTokenBalances.find(
            (pre: any) => pre.accountIndex === postBalance.accountIndex && pre.mint === postBalance.mint
          );
          
          if (preBalance && postBalance.uiTokenAmount.amount !== preBalance.uiTokenAmount.amount) {
            const diff = Number(postBalance.uiTokenAmount.amount) - Number(preBalance.uiTokenAmount.amount);
            if (diff !== 0) {
              // Get the actual account address for this token account
              const tokenAccountAddress = tx.transaction.message.accountKeys[postBalance.accountIndex].pubkey.toString();
              
              // For token transfers, we need to find the owner of the token account
              // This is more complex, but for now let's use a simpler approach
              enhancedTx.tokenTransfers.push({
                mint: postBalance.mint,
                tokenAmount: Math.abs(diff),
                fromAddress: diff < 0 ? tokenAccountAddress : null,
                toAddress: diff > 0 ? tokenAccountAddress : null,
                tokenAccountAddress: tokenAccountAddress
              });
            }
          }
        }
      }
      
      // Extract SOL transfers with proper addresses
      if (tx.meta.preBalances && tx.meta.postBalances) {
        for (let i = 0; i < tx.meta.postBalances.length; i++) {
          const postBalance = tx.meta.postBalances[i];
          const preBalance = tx.meta.preBalances[i];
          const diff = postBalance - preBalance - (i === 0 ? tx.meta.fee || 0 : 0);
          
          if (Math.abs(diff) > 0) {
            const accountAddress = tx.transaction.message.accountKeys[i].pubkey.toString();
            enhancedTx.nativeTransfers.push({
              amount: Math.abs(diff),
              fromAddress: diff < 0 ? accountAddress : null,
              toAddress: diff > 0 ? accountAddress : null
            });
          }
        }
      }
      
      this.logger.transaction(() => `Processing ${enhancedTx.type} transaction: ${signature.substring(0, 8)}...`);

      // Check if this is a potential trade - be more inclusive
      // Many DEX transactions show up as different types
      if (enhancedTx.type !== 'SWAP' && enhancedTx.type !== 'UNKNOWN' && enhancedTx.type !== 'TRANSFER') {
        // Still check if it has token transfers (could be a trade)
        if (!enhancedTx.tokenTransfers || enhancedTx.tokenTransfers.length === 0) {
          this.logger.debug(`Skipping non-trade transaction ${signature} (type: ${enhancedTx.type})`);
          return;
        }
      }

      // Find which tracked wallet is involved by checking account data
      let involvedWallet: TrackedWallet | null = null;
      
      // Check all accounts in transaction
      if (enhancedTx.accountData) {
        for (const account of enhancedTx.accountData) {
          if (this.trackedWallets.has(account.account)) {
            involvedWallet = this.trackedWallets.get(account.account)!;
            break;
          }
        }
      }

      if (!involvedWallet) {
        // Check native transfers
        for (const transfer of enhancedTx.nativeTransfers || []) {
          if (this.trackedWallets.has(transfer.fromAddress)) {
            involvedWallet = this.trackedWallets.get(transfer.fromAddress)!;
            break;
          }
          if (this.trackedWallets.has(transfer.toAddress)) {
            involvedWallet = this.trackedWallets.get(transfer.toAddress)!;
            break;
          }
        }
      }

      if (!involvedWallet) {
        this.logger.debug(`No tracked wallet involved in transaction ${signature}`);
        return;
      }

      // Process the trade
      await this.processTrade(enhancedTx, involvedWallet);
      
    } catch (error) {
      this.logger.error(`Error processing transaction ${signature}:`, error);
    }
  }

  private async processTrade(tx: any, wallet: TrackedWallet) {
    try {
      this.logger.debug(`Processing trade for wallet ${wallet.address.substring(0, 8)}...`);
      
      // Extract trade details
      const tokenTransfers = tx.tokenTransfers || [];
      const nativeTransfers = tx.nativeTransfers || [];

      this.logger.debug(`Found ${tokenTransfers.length} token transfers, ${nativeTransfers.length} native transfers`);

      let tokenAddress: string | null = null;
      let tradeType: 'BUY' | 'SELL' = 'BUY';
      let solAmount = 0;

      // Analyze transfers
      for (const transfer of tokenTransfers) {
        // Skip SOL transfers
        if (transfer.mint === 'So11111111111111111111111111111111111112') continue;
        
        this.logger.debug(`Token transfer: ${transfer.mint?.substring(0, 8)}... from ${transfer.fromAddress?.substring(0, 8) || 'null'}... to ${transfer.toAddress?.substring(0, 8) || 'null'}...`);
        
        // For token transfers, we need to check if the wallet is involved in the transaction
        // Since we have token account addresses, we check if the wallet is in the transaction accounts
        const isWalletInTransaction = tx.accountData?.some(account => account.account === wallet.address);
        
        if (isWalletInTransaction) {
          // Determine trade type based on token balance change direction
          if (transfer.fromAddress && transfer.tokenAmount > 0) {
            // Token balance decreased - SELL
            tokenAddress = transfer.mint;
            tradeType = 'SELL';
            this.logger.debug(`Detected SELL of token ${tokenAddress?.substring(0, 8)}...`);
          } else if (transfer.toAddress && transfer.tokenAmount > 0) {
            // Token balance increased - BUY
            tokenAddress = transfer.mint;
            tradeType = 'BUY';
            this.logger.debug(`Detected BUY of token ${tokenAddress?.substring(0, 8)}...`);
          }
        }
      }

      // Calculate SOL amount
      for (const transfer of nativeTransfers) {
        this.logger.debug(`SOL transfer: ${transfer.amount} from ${transfer.fromAddress?.substring(0, 8) || 'null'}... to ${transfer.toAddress?.substring(0, 8) || 'null'}...`);
        
        if (transfer.fromAddress === wallet.address || transfer.toAddress === wallet.address) {
          solAmount += transfer.amount;
        }
      }

      this.logger.debug(`Analysis result: tokenAddress=${tokenAddress?.substring(0, 8)}..., solAmount=${solAmount}, tradeType=${tradeType}`);

      if (!tokenAddress || solAmount === 0) {
        this.logger.debug(`Skipping trade: tokenAddress=${!!tokenAddress}, solAmount=${solAmount}`);
        return;
      }

      // Ensure token exists
      await this.ensureTokenExists(tokenAddress);

      // Record trade
      const trade: Partial<WhaleTrade> = {
        wallet_address: wallet.address,
        coin_address: tokenAddress,
        trade_type: tradeType,
        sol_amount: solAmount / 1e9, // Convert lamports to SOL
        transaction_hash: tx.signature,
        trade_timestamp: new Date((tx.timestamp || Date.now() / 1000) * 1000).toISOString()
      };

      const { error } = await supabase
        .from('whale_trades')
        .insert(trade);

      if (error) {
        if (error.code !== '23505') { // Ignore duplicates
          this.logger.error('Error inserting trade:', error);
        }
      } else {
        // Log trade entry/exit
        const walletName = wallet.alias || wallet.address.slice(0, 8) + '...';
        if (tradeType === 'BUY') {
          this.logger.trade.enter(walletName, tokenAddress, trade.sol_amount!);
          // Track multi-whale positions
          if (!this.multiWhalePositions.has(tokenAddress)) {
            this.multiWhalePositions.set(tokenAddress, new Set());
          }
          this.multiWhalePositions.get(tokenAddress)!.add(wallet.address);
          
          // Check for multi-whale coordination
          const whalesInToken = this.multiWhalePositions.get(tokenAddress)!;
          if (whalesInToken.size > 1) {
            const whaleNames = Array.from(whalesInToken).map(addr => {
              const w = this.trackedWallets.get(addr);
              return w?.alias || addr.slice(0, 8) + '...';
            });
            this.logger.multiWhale(whalesInToken.size, tokenAddress, whaleNames);
          }
        } else {
          this.logger.trade.exit(walletName, tokenAddress, trade.sol_amount!);
          // Remove from multi-whale tracking
          this.multiWhalePositions.get(tokenAddress)?.delete(wallet.address);
          if (this.multiWhalePositions.get(tokenAddress)?.size === 0) {
            this.multiWhalePositions.delete(tokenAddress);
          }
        }
      }
    } catch (error) {
      this.logger.error('Error processing trade:', error);
    }
  }

  private async ensureTokenExists(address: string) {
    const { error } = await supabase
      .from('tokens')
      .upsert({
        address,
        last_seen: new Date().toISOString()
      }, {
        onConflict: 'address'
      });

    if (error) {
      this.logger.error('Error upserting token:', error);
    }
  }

  private handleReconnect() {
    // Prevent multiple reconnection attempts
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
      }, this.reconnectInterval);
      
      // Exponential backoff with max of 30 seconds
      this.reconnectInterval = Math.min(this.reconnectInterval * 1.5, 30000);
    } else {
      this.logger.error('Max reconnection attempts reached. Service stopped.');
    }
  }

  private async reconnect() {
    this.logger.wallet('Reconnecting with updated wallet list...');
    if (this.ws) {
      this.ws.close();
    }
    await this.setupWebSocket();
  }

  private setupWalletSubscription() {
    // Subscribe to changes in tracked_wallets table
    this.walletSubscription = supabase
      .channel('wallet-changes')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'tracked_wallets'
      }, async (payload) => {
        this.logger.wallet(`Wallet ${payload.eventType}: ${payload.new?.alias || payload.old?.alias || 'unknown'}`);
        
        const previousSize = this.trackedWallets.size;
        await this.loadTrackedWallets();
        
        // If we now have wallets and didn't before, start WebSocket
        if (previousSize === 0 && this.trackedWallets.size > 0) {
          await this.setupWebSocket();
        } else if (previousSize > 0 && this.trackedWallets.size === 0) {
          // All wallets removed, close WebSocket
          if (this.ws) {
            this.ws.close();
          }
        } else if (previousSize !== this.trackedWallets.size) {
          // Wallet list changed, reconnect
          await this.reconnect();
        }
      })
      .subscribe();
  }

  private async updateHeartbeat() {
    try {
      const { error } = await supabase
        .from('service_heartbeats')
        .upsert({
          service_name: 'whale-watcher',
          last_heartbeat: new Date().toISOString(),
          status: 'healthy',
          metadata: {
            tracked_wallets: this.trackedWallets.size,
            websocket_connected: this.ws?.readyState === WebSocket.OPEN,
            strategy: 'streaming'
          }
        }, {
          onConflict: 'service_name'
        });

      if (error && !error.message?.includes('relation') && !error.message?.includes('does not exist')) {
        this.logger.error('Error updating heartbeat:', error);
      }
    } catch (error) {
      this.logger.debug(() => `Heartbeat update skipped: ${error}`);
    }
  }

  async stop() {
    this.logger.system('Stopping service...');
    this.isShuttingDown = true;
    
    // Clear any pending reconnect
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = undefined;
    }
    
    // Clear ping interval
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = undefined;
    }
    
    // Close WebSocket
    if (this.ws) {
      this.ws.removeAllListeners();
      if (this.ws.readyState === WebSocket.OPEN) {
        this.ws.close(1000, 'Service stopping');
      }
      this.ws = null;
    }
    
    // Cleanup subscriptions
    if (this.walletSubscription) {
      await this.walletSubscription.unsubscribe();
    }
    
    // Cleanup logger
    await this.logger.cleanup();
  }
}