import { Helius } from 'helius-sdk';
import { supabase, type TrackedWallet, type WhaleTrade } from '../lib/supabase.js';
import WebSocket from 'ws';

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
    try {
      console.log('[WhaleWatcher] Starting service...');
      
      // Load tracked wallets
      await this.loadTrackedWallets();
      
      // Only set up WebSocket if we have wallets to track
      if (this.trackedWallets.size > 0) {
        await this.setupWebSocketSubscriptions();
      } else {
        console.log('[WhaleWatcher] No active wallets to track. Waiting for wallets to be added...');
      }
      
      // Reload wallets periodically
      setInterval(async () => {
        const previousSize = this.trackedWallets.size;
        await this.loadTrackedWallets();
        
        // If we now have wallets and didn't before, start WebSocket
        if (previousSize === 0 && this.trackedWallets.size > 0) {
          await this.setupWebSocketSubscriptions();
        }
      }, 60000); // Every minute
      
      // Update heartbeat
      setInterval(() => this.updateHeartbeat(), 30000); // Every 30 seconds
      
      console.log('[WhaleWatcher] Service started successfully');
    } catch (error) {
      console.error('[WhaleWatcher] Failed to start service:', error);
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
        
        // Subscribe to account changes for all tracked wallets
        // Using standard Solana accountSubscribe which works with Helius
        const subscriptions = addresses.map((address, index) => ({
          jsonrpc: "2.0",
          id: index + 1,
          method: "accountSubscribe",
          params: [
            address,
            {
              encoding: "jsonParsed",
              commitment: "confirmed"
            }
          ]
        }));
        
        // Send all subscriptions
        subscriptions.forEach(sub => {
          this.ws!.send(JSON.stringify(sub));
        });
        
        console.log(`[WhaleWatcher] Subscribed to ${addresses.length} wallets`);
        
        // Set up ping interval to keep connection alive
        const pingInterval = setInterval(() => {
          if (this.ws?.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify({ 
              jsonrpc: "2.0", 
              id: 999, 
              method: "ping" 
            }));
          } else {
            clearInterval(pingInterval);
          }
        }, 30000); // Ping every 30 seconds
      };

      this.ws.onmessage = async (event) => {
        try {
          const data = event.data.toString();
          const message = JSON.parse(data);
          
          // Handle subscription confirmations
          if (message.result && typeof message.id === 'number' && message.id <= this.trackedWallets.size) {
            console.log(`[WhaleWatcher] Wallet ${message.id} subscription confirmed:`, message.result);
            return;
          }
          
          // Handle ping response
          if (message.id === 999) {
            // Ping response received
            return;
          }
          
          // Handle error responses
          if (message.error) {
            console.error('[WhaleWatcher] RPC Error:', message.error);
            return;
          }
          
          // Handle account notifications
          if (message.method === 'accountNotification' && message.params) {
            // For account subscriptions, we need to fetch transactions differently
            console.log('[WhaleWatcher] Account notification received for subscription:', message.params.subscription);
            // We'll need to fetch recent transactions for this account
            await this.checkAccountTransactions(message.params);
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
    try {
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
        // Only log if it's not a missing table error
        if (!error.message?.includes('relation') && !error.message?.includes('does not exist')) {
          console.error('[WhaleWatcher] Error updating heartbeat:', error);
        }
      }
    } catch (error) {
      // Silently ignore heartbeat errors to prevent service crashes
      console.debug('[WhaleWatcher] Heartbeat update skipped:', error);
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