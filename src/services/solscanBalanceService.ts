import { Service, ServiceStatus } from '../lib/service-manager.js';
import { messageBus } from '../lib/message-bus.js';

interface WalletBalance {
  wallet: string;
  balance: number;
  timestamp: Date;
}

interface SolscanAccountDetail {
  data: {
    lamports: number;
    owner: string;
    executable: boolean;
    rent_epoch: number;
    space: number;
  };
}

export class SolscanBalanceService implements Service {
  name = 'SolscanBalanceService';
  private running = false;
  private unsubscribers: (() => void)[] = [];
  private updateInterval?: number;
  private updateFrequency = 5 * 60 * 1000; // 5 minutes default

  constructor() {
    console.log('[SolscanBalanceService] Initialized');
  }

  async start(): Promise<void> {
    console.log('[SolscanBalanceService] Starting...');
    
    // Subscribe to wallet events
    this.unsubscribers.push(
      messageBus.subscribe('wallet.balance.update_requested', (data) => {
        this.handleBalanceUpdateRequest(data);
      })
    );
    
    this.unsubscribers.push(
      messageBus.subscribe('config.balance_interval.changed', (data) => {
        this.updateFrequency = data.interval * 60 * 1000;
        this.restartInterval();
      })
    );

    this.startBalanceUpdates();
    this.running = true;
    console.log('[SolscanBalanceService] Started');
  }

  async stop(): Promise<void> {
    console.log('[SolscanBalanceService] Stopping...');
    this.unsubscribers.forEach(unsub => unsub());
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
    }
    this.running = false;
    console.log('[SolscanBalanceService] Stopped');
  }

  getStatus(): ServiceStatus {
    return {
      running: this.running,
      metadata: {
        updateFrequency: this.updateFrequency,
        lastUpdate: new Date().toISOString()
      }
    };
  }

  private async handleBalanceUpdateRequest(data: { wallet: string; type?: string }): Promise<void> {
    const updateType = data.type || 'manual';
    console.log(`[SolscanBalanceService] Fetching balance for wallet: ${data.wallet} (${updateType} request)`);
    try {
      const balance = await this.fetchWalletBalance(data.wallet);
      messageBus.publish('wallet.balance.updated', {
        wallet: data.wallet,
        balance,
        type: updateType,
        timestamp: new Date()
      });
    } catch (error) {
      console.error(`[SolscanBalanceService] Failed to fetch balance for ${data.wallet}:`, error);
    }
  }

  private startBalanceUpdates(): void {
    this.updateInterval = setInterval(() => {
      this.updateAllBalances();
    }, this.updateFrequency);
  }

  private restartInterval(): void {
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
    }
    this.startBalanceUpdates();
    console.log(`[SolscanBalanceService] Update interval changed to ${this.updateFrequency}ms`);
  }

  private async updateAllBalances(): Promise<void> {
    console.log('[SolscanBalanceService] Starting scheduled balance update');
    
    try {
      // Get all tracked wallets from database
      const wallets = await this.getTrackedWallets();
      
      // Fetch balances sequentially to avoid rate limiting
      const balances: WalletBalance[] = [];
      
      for (const wallet of wallets) {
        try {
          const balance = await this.fetchWalletBalance(wallet);
          balances.push({
            wallet,
            balance,
            timestamp: new Date()
          });
          
          // Update database with new balance
          await this.updateWalletBalance(wallet, balance);
          
          // Small delay between requests to avoid rate limiting
          await new Promise(resolve => setTimeout(resolve, 100));
        } catch (error) {
          console.error(`[SolscanBalanceService] Failed to fetch balance for ${wallet}:`, error);
        }
      }
      
      console.log(`[SolscanBalanceService] Updated ${balances.length} wallet balances`);
      
      // Publish bulk update
      messageBus.publish('wallet.balances.scheduled_updated', { balances });
      
    } catch (error) {
      console.error('[SolscanBalanceService] Failed to update all balances:', error);
    }
  }

  private async updateWalletBalance(wallet: string, balance: number): Promise<void> {
    try {
      const { getDatabase } = await import('../src/lib/database.js');
      const db = getDatabase();
      await db.query(
        'UPDATE tracked_wallets SET sol_balance = $1, last_balance_check = NOW() WHERE address = $2',
        [balance, wallet]
      );
    } catch (error) {
      console.error('[SolscanBalanceService] Error updating wallet balance in database:', error);
    }
  }

  private async fetchWalletBalance(wallet: string): Promise<number> {
    // Use Solana native RPC instead of Solscan API to avoid 403 errors
    const rpcUrl = 'https://api.mainnet-beta.solana.com';
    
    try {
      const response = await fetch(rpcUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 1,
          method: 'getBalance',
          params: [wallet, { commitment: 'confirmed' }]
        })
      });

      if (!response.ok) {
        throw new Error(`RPC error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      
      // Convert lamports to SOL
      const lamports = data?.result?.value || 0;
      return lamports / 1_000_000_000;
    } catch (error) {
      console.error(`[SolscanBalanceService] Failed to fetch balance for ${wallet}:`, error);
      return 0; // Return 0 if API fails
    }
  }

  private async getTrackedWallets(): Promise<string[]> {
    try {
      const { getDatabase } = await import('../src/lib/database.js');
      const db = getDatabase();
      const result = await db.query(
        'SELECT address FROM tracked_wallets WHERE is_active = true'
      );
      return result.rows.map(row => row.address);
    } catch (error) {
      console.error('[SolscanBalanceService] Error fetching tracked wallets:', error);
      return [];
    }
  }

  // Public method for manual balance updates
  async updateBalance(wallet: string): Promise<number> {
    const balance = await this.fetchWalletBalance(wallet);
    messageBus.publish('wallet.balance.updated', {
      wallet,
      balance,
      timestamp: new Date()
    });
    return balance;
  }
}