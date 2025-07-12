import { Helius } from 'helius-sdk';
import { supabase, type TrackedWallet, type WhaleTrade } from '../lib/supabase.js';

interface ParsedSwap {
  source: string;
  destination: string;
  amount: number;
  tokenAddress?: string;
}

export class WhaleWatcher {
  private helius: Helius;
  private trackedWallets: Map<string, TrackedWallet> = new Map();
  private ws: WebSocket | null = null;
  private reconnectInterval: number = 5000;
  private maxReconnectAttempts: number = 10;
  private reconnectAttempts: number = 0;

  constructor() {
    const heliusApiKey = process.env.HELIUS_API_KEY;
    if (!heliusApiKey) {
      throw new Error('HELIUS_API_KEY environment variable is required');
    }

    this.helius = new Helius(heliusApiKey);
    console.log('[WhaleWatcher] Initialized');
  }

  async start() {
    console.log('[WhaleWatcher] Starting service...');
    
    // Load tracked wallets
    await this.loadTrackedWallets();
    
    // Set up WebSocket subscriptions
    await this.setupWebSocketSubscriptions();
    
    // Reload wallets periodically
    setInterval(() => this.loadTrackedWallets(), 60000); // Every minute
    
    // Update heartbeat
    setInterval(() => this.updateHeartbeat(), 30000); // Every 30 seconds
    
    console.log('[WhaleWatcher] Service started successfully');
  }

  private async loadTrackedWallets() {
    try {
      const { data, error } = await supabase
        .from('tracked_wallets')
        .select('*')
        .eq('is_active', true);

      if (error) {
        console.error('[WhaleWatcher] Error loading wallets:', error);
        return;
      }

      this.trackedWallets.clear();
      data?.forEach(wallet => {
        this.trackedWallets.set(wallet.address, wallet);
      });

      console.log(`[WhaleWatcher] Loaded ${this.trackedWallets.size} active wallets`);
      
      // Restart WebSocket if wallets changed
      if (this.ws) {
        await this.setupWebSocketSubscriptions();
      }
    } catch (error) {
      console.error('[WhaleWatcher] Failed to load wallets:', error);
    }
  }

  private async setupWebSocketSubscriptions() {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }

    if (this.trackedWallets.size === 0) {
      console.log('[WhaleWatcher] No active wallets to track');
      return;
    }

    const addresses = Array.from(this.trackedWallets.keys());
    
    try {
      // Create WebSocket connection using Helius enhanced transactions
      const wsUrl = `wss://mainnet.helius-rpc.com/?api-key=${process.env.HELIUS_API_KEY}`;
      this.ws = new WebSocket(wsUrl);

      this.ws.onopen = () => {
        console.log('[WhaleWatcher] WebSocket connected');
        this.reconnectAttempts = 0;
        
        // Subscribe to transactions for all tracked wallets
        const subscribeMessage = {
          jsonrpc: "2.0",
          id: 1,
          method: "transactionSubscribe",
          params: [
            {
              accountInclude: addresses,
            },
            {
              commitment: "confirmed",
              encoding: "jsonParsed",
              transactionDetails: "full",
              showRewards: false,
              maxSupportedTransactionVersion: 0
            }
          ]
        };
        
        this.ws!.send(JSON.stringify(subscribeMessage));
        console.log(`[WhaleWatcher] Subscribed to ${addresses.length} wallets`);
      };

      this.ws.onmessage = async (event) => {
        try {
          const message = JSON.parse(event.data);
          
          // Handle subscription confirmation
          if (message.result) {
            console.log('[WhaleWatcher] Subscription confirmed:', message.result);
            return;
          }
          
          // Handle transaction notifications
          if (message.method === 'transactionNotification') {
            await this.processTransaction(message.params);
          }
        } catch (error) {
          console.error('[WhaleWatcher] Error processing message:', error);
        }
      };

      this.ws.onerror = (error) => {
        console.error('[WhaleWatcher] WebSocket error:', error);
      };

      this.ws.onclose = () => {
        console.log('[WhaleWatcher] WebSocket disconnected');
        this.handleReconnect();
      };

    } catch (error) {
      console.error('[WhaleWatcher] Failed to setup WebSocket:', error);
      this.handleReconnect();
    }
  }

  private handleReconnect() {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      console.log(`[WhaleWatcher] Reconnecting in ${this.reconnectInterval}ms... (Attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})`);
      
      setTimeout(() => {
        this.setupWebSocketSubscriptions();
      }, this.reconnectInterval);
      
      // Exponential backoff
      this.reconnectInterval = Math.min(this.reconnectInterval * 1.5, 60000);
    } else {
      console.error('[WhaleWatcher] Max reconnection attempts reached. Service stopped.');
    }
  }

  private async processTransaction(params: any) {
    try {
      const { transaction, signature } = params.result;
      
      if (!transaction?.message) {
        return;
      }

      // Parse transaction to find swaps
      const swaps = this.parseSwapsFromTransaction(transaction);
      
      for (const swap of swaps) {
        // Check if this is a relevant trade from one of our tracked wallets
        const wallet = this.trackedWallets.get(swap.source);
        if (!wallet) continue;

        // Determine if this is a buy or sell
        const isBuy = swap.destination !== 'So11111111111111111111111111111111111112' && // Not selling to SOL
                     swap.source !== swap.tokenAddress; // Source is not the token itself

        if (!swap.tokenAddress) continue;

        // Ensure token exists in database
        await this.ensureTokenExists(swap.tokenAddress);

        // Insert whale trade
        const trade: Partial<WhaleTrade> = {
          wallet_address: wallet.address,
          coin_address: swap.tokenAddress,
          trade_type: isBuy ? 'BUY' : 'SELL',
          sol_amount: swap.amount / 1e9, // Convert lamports to SOL
          transaction_hash: signature,
          trade_timestamp: new Date().toISOString()
        };

        const { error } = await supabase
          .from('whale_trades')
          .insert(trade);

        if (error) {
          console.error('[WhaleWatcher] Error inserting trade:', error);
        } else {
          console.log(`[WhaleWatcher] Recorded ${trade.trade_type} trade from ${wallet.alias || wallet.address}`);
        }
      }
    } catch (error) {
      console.error('[WhaleWatcher] Error processing transaction:', error);
    }
  }

  private parseSwapsFromTransaction(transaction: any): ParsedSwap[] {
    const swaps: ParsedSwap[] = [];
    
    // Look for swap instructions in parsed instructions
    const instructions = transaction.message.instructions || [];
    
    for (const instruction of instructions) {
      if (instruction.parsed?.type === 'swap' || 
          instruction.program === 'JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4') { // Jupiter
        
        // Extract swap details from instruction
        const accounts = instruction.accounts || [];
        if (accounts.length >= 2) {
          swaps.push({
            source: accounts[0],
            destination: accounts[1],
            amount: instruction.parsed?.info?.amount || 0,
            tokenAddress: instruction.parsed?.info?.mint || accounts[1]
          });
        }
      }
    }
    
    return swaps;
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
      console.error('[WhaleWatcher] Error upserting token:', error);
    }
  }

  private async updateHeartbeat() {
    // Update a heartbeat timestamp in the database to show service is alive
    const { error } = await supabase
      .from('service_heartbeats')
      .upsert({
        service_name: 'whale-watcher',
        last_heartbeat: new Date().toISOString(),
        status: 'healthy',
        metadata: {
          tracked_wallets: this.trackedWallets.size,
          websocket_connected: this.ws?.readyState === WebSocket.OPEN
        }
      }, {
        onConflict: 'service_name'
      });

    if (error) {
      console.error('[WhaleWatcher] Error updating heartbeat:', error);
    }
  }

  async stop() {
    console.log('[WhaleWatcher] Stopping service...');
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }
}