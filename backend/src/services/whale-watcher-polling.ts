import { Helius } from 'helius-sdk';
import { supabase, type TrackedWallet, type WhaleTrade } from '../lib/supabase.js';

export class WhaleWatcherPolling {
  private helius: Helius;
  private trackedWallets: Map<string, TrackedWallet> = new Map();
  private lastChecked: Map<string, Date> = new Map();
  private pollingInterval?: NodeJS.Timeout;
  private isRunning = false;

  constructor() {
    const heliusApiKey = process.env.HELIUS_API_KEY;
    if (!heliusApiKey) {
      throw new Error('HELIUS_API_KEY environment variable is required');
    }

    this.helius = new Helius(heliusApiKey);
    console.log('[WhaleWatcher] Initialized with polling strategy');
  }

  async start() {
    try {
      console.log('[WhaleWatcher] Starting service...');
      
      this.isRunning = true;
      
      // Load tracked wallets
      await this.loadTrackedWallets();
      
      // Start polling for transactions
      this.startPolling();
      
      // Reload wallets periodically
      setInterval(async () => {
        await this.loadTrackedWallets();
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
        // Initialize last checked time if not set
        if (!this.lastChecked.has(wallet.address)) {
          this.lastChecked.set(wallet.address, new Date(Date.now() - 60000)); // Start from 1 minute ago
        }
      });

      console.log(`[WhaleWatcher] Loaded ${this.trackedWallets.size} active wallets`);
    } catch (error) {
      console.error('[WhaleWatcher] Failed to load wallets:', error);
    }
  }

  private startPolling() {
    // Clear existing interval if any
    if (this.pollingInterval) {
      clearInterval(this.pollingInterval);
    }

    // Poll every 5 seconds
    this.pollingInterval = setInterval(async () => {
      if (!this.isRunning) return;
      
      for (const [address, wallet] of this.trackedWallets) {
        try {
          await this.checkWalletTransactions(address, wallet);
        } catch (error) {
          console.error(`[WhaleWatcher] Error checking wallet ${address}:`, error);
        }
      }
    }, 5000); // 5 seconds

    console.log('[WhaleWatcher] Started polling for transactions');
  }

  private async checkWalletTransactions(address: string, wallet: TrackedWallet) {
    try {
      const lastCheck = this.lastChecked.get(address) || new Date(Date.now() - 60000);
      
      // Get recent transactions using Helius Enhanced Transactions API
      const response = await this.helius.rpc.getSignaturesForAddress(address, {
        limit: 10,
        before: undefined,
        until: lastCheck.toISOString()
      });

      if (response.length === 0) {
        return;
      }

      console.log(`[WhaleWatcher] Found ${response.length} new transactions for ${wallet.alias || address}`);

      // Process each transaction
      for (const sig of response) {
        try {
          // Get enhanced transaction details
          const tx = await this.helius.getEnhancedTransaction(sig.signature);
          
          if (tx && this.isRelevantTrade(tx)) {
            await this.processTrade(tx, wallet);
          }
        } catch (error) {
          console.error(`[WhaleWatcher] Error processing transaction ${sig.signature}:`, error);
        }
      }

      // Update last checked time
      this.lastChecked.set(address, new Date());
    } catch (error) {
      console.error(`[WhaleWatcher] Error fetching transactions for ${address}:`, error);
    }
  }

  private isRelevantTrade(tx: any): boolean {
    // Check if this is a swap transaction
    if (!tx.type || tx.type !== 'SWAP') {
      return false;
    }

    // Check if it involves a token swap
    if (!tx.tokenTransfers || tx.tokenTransfers.length === 0) {
      return false;
    }

    return true;
  }

  private async processTrade(tx: any, wallet: TrackedWallet) {
    try {
      console.log(`[WhaleWatcher] Processing trade from ${wallet.alias || wallet.address}`);

      // Extract trade details from enhanced transaction
      const tokenTransfers = tx.tokenTransfers || [];
      const nativeTransfers = tx.nativeTransfers || [];

      // Find the main swap
      let tokenAddress: string | null = null;
      let tradeType: 'BUY' | 'SELL' = 'BUY';
      let solAmount = 0;

      // Analyze transfers to determine trade type and amounts
      for (const transfer of tokenTransfers) {
        if (transfer.fromAddress === wallet.address) {
          // Wallet is sending tokens - might be a sell
          if (transfer.tokenAddress !== 'So11111111111111111111111111111111111112') {
            tokenAddress = transfer.tokenAddress;
            tradeType = 'SELL';
          }
        } else if (transfer.toAddress === wallet.address) {
          // Wallet is receiving tokens - might be a buy
          if (transfer.tokenAddress !== 'So11111111111111111111111111111111111112') {
            tokenAddress = transfer.tokenAddress;
            tradeType = 'BUY';
          }
        }
      }

      // Calculate SOL amount from native transfers
      for (const transfer of nativeTransfers) {
        if (transfer.fromAddress === wallet.address || transfer.toAddress === wallet.address) {
          solAmount += transfer.amount / 1e9; // Convert lamports to SOL
        }
      }

      if (!tokenAddress || solAmount === 0) {
        return;
      }

      // Ensure token exists in database
      await this.ensureTokenExists(tokenAddress);

      // Insert whale trade
      const trade: Partial<WhaleTrade> = {
        wallet_address: wallet.address,
        coin_address: tokenAddress,
        trade_type: tradeType,
        sol_amount: solAmount,
        transaction_hash: tx.signature,
        trade_timestamp: new Date(tx.timestamp * 1000).toISOString()
      };

      const { error } = await supabase
        .from('whale_trades')
        .insert(trade);

      if (error) {
        if (error.code === '23505') {
          // Duplicate transaction, ignore
          return;
        }
        console.error('[WhaleWatcher] Error inserting trade:', error);
      } else {
        console.log(`[WhaleWatcher] Recorded ${trade.trade_type} trade: ${solAmount} SOL for token ${tokenAddress}`);
      }
    } catch (error) {
      console.error('[WhaleWatcher] Error processing trade:', error);
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
      console.error('[WhaleWatcher] Error upserting token:', error);
    }
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
            polling_active: this.isRunning,
            strategy: 'polling'
          }
        }, {
          onConflict: 'service_name'
        });

      if (error && !error.message?.includes('relation') && !error.message?.includes('does not exist')) {
        console.error('[WhaleWatcher] Error updating heartbeat:', error);
      }
    } catch (error) {
      console.debug('[WhaleWatcher] Heartbeat update skipped:', error);
    }
  }

  async stop() {
    console.log('[WhaleWatcher] Stopping service...');
    this.isRunning = false;
    
    if (this.pollingInterval) {
      clearInterval(this.pollingInterval);
      this.pollingInterval = undefined;
    }
  }
}