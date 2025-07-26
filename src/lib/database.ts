import { neon } from '@neondatabase/serverless';
import { ENV } from './env.js';

// Database type definitions based on the migration schema
export interface TrackedWallet {
  id: string;
  address: string;
  alias: string | null;
  is_active: boolean | null;
  tags: string[] | null;
  metadata: Record<string, any> | null;
  created_at: string | null;
  updated_at: string | null;
  ui_color: string | null;
  twitter_handle: string | null;
  telegram_channel: string | null;
  streaming_channel: string | null;
  image_data: string | null;
  notes: string | null;
  sol_balance: number | null;
  last_balance_check: string | null;
}

export interface Token {
  id: string;
  address: string;
  symbol: string;
  name: string;
  metadata: Record<string, any> | null;
  last_seen: string | null;
  created_at: string | null;
  updated_at: string | null;
}

export interface WhaleTrade {
  id: number;
  wallet_address: string;
  coin_address: string;
  trade_type: 'BUY' | 'SELL' | 'TRANSFER_OUT' | 'TRANSFER_IN' | 'OTHER';
  sol_amount: number | null;
  token_amount: number | null;
  transaction_hash: string;
  trade_timestamp: string;
  created_at: string | null;
  updated_at: string | null;
  transaction_type?: string | null;
  counterparty_address?: string | null;
}

export interface TradeSignal {
  id: string;
  coin_address: string;
  status: 'OPEN' | 'EXECUTED' | 'EXPIRED';
  trigger_reason: string | null;
  metadata: Record<string, any> | null;
  created_at: string | null;
  updated_at: string | null;
  closed_at: string | null;
  user_notes: string | null;
}

export interface PortfolioTrade {
  id: string;
  signal_id: string | null;
  trade_mode: 'PAPER' | 'LIVE';
  coin_address: string;
  status: 'OPEN' | 'PARTIALLY_CLOSED' | 'CLOSED';
  entry_price: number | null;
  high_water_mark_price: number | null;
  entry_timestamp: string | null;
  exit_price: number | null;
  exit_timestamp: string | null;
  pnl_usd: number | null;
  exit_reason: string | null;
  manual_close: boolean | null;
  trade_amount_sol: number | null;
  pnl_percentage: number | null;
  current_price: number | null;
  created_at: string | null;
  updated_at: string | null;
}

export interface SignalConfig {
  id: string;
  min_whales: number | null;
  time_window_hours: number | null;
  min_trade_amount_sol: number | null;
  created_at: string | null;
  updated_at: string | null;
}

export interface ServiceHeartbeat {
  service_name: string;
  last_heartbeat: string;
  status: 'healthy' | 'unhealthy' | 'stopped';
  metadata: Record<string, any> | null;
  created_at: string | null;
  updated_at: string | null;
}

export interface ServiceConfig {
  id: string;
  service_name: string;
  log_categories: Record<string, boolean>;
  other_settings: Record<string, any>;
  ui_refresh_config: Record<string, any>;
  enabled: boolean;
  created_at: string | null;
  updated_at: string | null;
}

// View interfaces
export interface RecentWhaleTrade extends WhaleTrade {
  wallet_alias: string | null;
  wallet_color: string | null;
  twitter_handle: string | null;
  telegram_channel: string | null;
  streaming_channel: string | null;
  image_data: string | null;
  token_symbol: string | null;
  token_name: string | null;
}

export interface ActiveSignalDetailed extends TradeSignal {
  token_symbol: string | null;
  token_name: string | null;
  whale_count: number;
  whale_names: string | null;
}

// Database operations class
export class Database {
  private sql;

  constructor() {
    if (!ENV.DATABASE_URL) {
      console.error('DATABASE_URL not found in ENV:', ENV);
      throw new Error('DATABASE_URL environment variable is required');
    }
    console.log('Database initialized with URL:', ENV.DATABASE_URL.substring(0, 30) + '...');
    this.sql = neon(ENV.DATABASE_URL);
    
    // Test database connection
    this.testConnection().catch(error => {
      console.error('Database connection test failed:', error);
    });
  }

  async testConnection() {
    try {
      await this.sql`SELECT 1`;
      console.log('Database connection test successful');
    } catch (error) {
      console.error('Database connection test failed:', error);
      throw error;
    }
  }

  // Tracked Wallets
  async getTrackedWallets(
    sortBy?: string, 
    sortOrder: 'asc' | 'desc' = 'desc', 
    tagFilter?: string[]
  ): Promise<TrackedWallet[]> {
    try {
      console.log('getTrackedWallets called with:', { sortBy, sortOrder, tagFilter });
      
      // Build safe query based on parameters
      const validColumns = ['created_at', 'alias', 'is_active', 'sol_balance'];
      const safeSort = (sortBy && validColumns.includes(sortBy)) ? sortBy : 'created_at';
      const safeOrder = sortOrder === 'asc' ? 'ASC' : 'DESC';
      
      let result;
      if (!tagFilter || tagFilter.length === 0) {
        // Use sql directly with template literal
        console.log('Executing query without tag filter');
        // For dynamic sorting, we need to use a workaround since Neon doesn't support sql.unsafe
        if (safeSort === 'alias') {
          result = safeOrder === 'ASC' 
            ? await this.sql`SELECT * FROM tracked_wallets ORDER BY alias ASC`
            : await this.sql`SELECT * FROM tracked_wallets ORDER BY alias DESC`;
        } else if (safeSort === 'is_active') {
          result = safeOrder === 'ASC'
            ? await this.sql`SELECT * FROM tracked_wallets ORDER BY is_active ASC`
            : await this.sql`SELECT * FROM tracked_wallets ORDER BY is_active DESC`;
        } else if (safeSort === 'sol_balance') {
          result = safeOrder === 'ASC'
            ? await this.sql`SELECT * FROM tracked_wallets ORDER BY sol_balance ASC`
            : await this.sql`SELECT * FROM tracked_wallets ORDER BY sol_balance DESC`;
        } else {
          // Default to created_at
          result = safeOrder === 'ASC'
            ? await this.sql`SELECT * FROM tracked_wallets ORDER BY created_at ASC`
            : await this.sql`SELECT * FROM tracked_wallets ORDER BY created_at DESC`;
        }
      } else {
        // With tag filter
        console.log('Executing query with tag filter:', tagFilter);
        if (safeSort === 'alias') {
          result = safeOrder === 'ASC'
            ? await this.sql`SELECT * FROM tracked_wallets WHERE tags && ${tagFilter} ORDER BY alias ASC`
            : await this.sql`SELECT * FROM tracked_wallets WHERE tags && ${tagFilter} ORDER BY alias DESC`;
        } else if (safeSort === 'is_active') {
          result = safeOrder === 'ASC'
            ? await this.sql`SELECT * FROM tracked_wallets WHERE tags && ${tagFilter} ORDER BY is_active ASC`
            : await this.sql`SELECT * FROM tracked_wallets WHERE tags && ${tagFilter} ORDER BY is_active DESC`;
        } else if (safeSort === 'sol_balance') {
          result = safeOrder === 'ASC'
            ? await this.sql`SELECT * FROM tracked_wallets WHERE tags && ${tagFilter} ORDER BY sol_balance ASC`
            : await this.sql`SELECT * FROM tracked_wallets WHERE tags && ${tagFilter} ORDER BY sol_balance DESC`;
        } else {
          // Default to created_at
          result = safeOrder === 'ASC'
            ? await this.sql`SELECT * FROM tracked_wallets WHERE tags && ${tagFilter} ORDER BY created_at ASC`
            : await this.sql`SELECT * FROM tracked_wallets WHERE tags && ${tagFilter} ORDER BY created_at DESC`;
        }
      }
      
      console.log('Query result:', result?.length, 'wallets found');
      
      // Ensure we always return an array
      return Array.isArray(result) ? result : [];
    } catch (error) {
      console.error('Error in getTrackedWallets:', error);
      return []; // Return empty array on error
    }
  }

  async getActiveTrackedWallets(): Promise<TrackedWallet[]> {
    return await this.sql`SELECT * FROM tracked_wallets WHERE is_active = true ORDER BY created_at DESC`;
  }

  async getTrackedWallet(address: string): Promise<TrackedWallet | null> {
    const result = await this.sql`SELECT * FROM tracked_wallets WHERE address = ${address}`;
    return result[0] || null;
  }

  async createTrackedWallet(walletData: Omit<TrackedWallet, 'id' | 'created_at' | 'updated_at'>): Promise<TrackedWallet> {
    const result = await this.sql`
      INSERT INTO tracked_wallets (address, alias, is_active, tags, metadata, ui_color, twitter_handle, telegram_channel, streaming_channel, image_data, notes)
      VALUES (${walletData.address}, ${walletData.alias}, ${walletData.is_active ?? true}, ${walletData.tags}, ${JSON.stringify(walletData.metadata)}, ${walletData.ui_color}, ${walletData.twitter_handle}, ${walletData.telegram_channel}, ${walletData.streaming_channel}, ${walletData.image_data}, ${walletData.notes})
      RETURNING *
    `;
    return result[0];
  }

  async updateTrackedWallet(address: string, updates: Partial<TrackedWallet>): Promise<TrackedWallet | null> {
    const setClauses = [];
    const values = [];
    let paramIndex = 1;

    for (const [key, value] of Object.entries(updates)) {
      if (key === 'metadata' && value) {
        setClauses.push(`${key} = $${paramIndex}`);
        values.push(JSON.stringify(value));
      } else {
        setClauses.push(`${key} = $${paramIndex}`);
        values.push(value);
      }
      paramIndex++;
    }

    if (setClauses.length === 0) return null;

    const query = `UPDATE tracked_wallets SET ${setClauses.join(', ')}, updated_at = NOW() WHERE address = $${paramIndex} RETURNING *`;
    values.push(address);

    const result = await this.sql.unsafe(query, values);
    return result[0] || null;
  }

  async deleteTrackedWallet(address: string): Promise<boolean> {
    const result = await this.sql`DELETE FROM tracked_wallets WHERE address = ${address}`;
    return result.count > 0;
  }

  async toggleWalletStatus(address: string): Promise<TrackedWallet | null> {
    const result = await this.sql`
      UPDATE tracked_wallets 
      SET is_active = NOT is_active, updated_at = NOW() 
      WHERE address = ${address}
      RETURNING *
    `;
    return result[0] || null;
  }

  async updateWalletBalance(address: string, balance: number): Promise<void> {
    await this.sql`
      UPDATE tracked_wallets 
      SET sol_balance = ${balance}, last_balance_check = NOW() 
      WHERE address = ${address}
    `;
  }

  // Tokens
  async upsertToken(token: Omit<Token, 'id' | 'created_at' | 'updated_at'>): Promise<Token> {
    const result = await this.sql`
      INSERT INTO tokens (address, symbol, name, metadata, last_seen)
      VALUES (${token.address}, ${token.symbol}, ${token.name}, ${JSON.stringify(token.metadata)}, NOW())
      ON CONFLICT (address) 
      DO UPDATE SET 
        symbol = EXCLUDED.symbol,
        name = EXCLUDED.name,
        metadata = EXCLUDED.metadata,
        last_seen = NOW(),
        updated_at = NOW()
      RETURNING *
    `;
    return result[0];
  }

  async getToken(address: string): Promise<Token | null> {
    const result = await this.sql`SELECT * FROM tokens WHERE address = ${address}`;
    return result[0] || null;
  }

  // Whale Trades
  async insertWhaleTrade(trade: Omit<WhaleTrade, 'id' | 'created_at' | 'updated_at'>): Promise<WhaleTrade> {
    const result = await this.sql`
      INSERT INTO whale_trades (wallet_address, coin_address, trade_type, sol_amount, token_amount, transaction_hash, trade_timestamp, transaction_type, counterparty_address)
      VALUES (${trade.wallet_address}, ${trade.coin_address}, ${trade.trade_type}, ${trade.sol_amount}, ${trade.token_amount}, ${trade.transaction_hash}, ${trade.trade_timestamp}, ${trade.transaction_type || null}, ${trade.counterparty_address || null})
      ON CONFLICT (transaction_hash) DO NOTHING
      RETURNING *
    `;
    return result[0];
  }

  async getRecentWhaleTrades(limit = 100): Promise<RecentWhaleTrade[]> {
    return await this.sql`SELECT * FROM recent_whale_trades LIMIT ${limit}`;
  }

  async getWhaleTradesForCoin(coinAddress: string, since: Date): Promise<WhaleTrade[]> {
    return await this.sql`
      SELECT * FROM whale_trades 
      WHERE coin_address = ${coinAddress} 
        AND trade_timestamp >= ${since.toISOString()}
      ORDER BY trade_timestamp DESC
    `;
  }

  // Trade Signals  
  async insertTradeSignal(signal: Omit<TradeSignal, 'id' | 'created_at' | 'updated_at'>): Promise<TradeSignal> {
    const result = await this.sql`
      INSERT INTO trade_signals (coin_address, status, trigger_reason, metadata)
      VALUES (${signal.coin_address}, ${signal.status}, ${signal.trigger_reason}, ${JSON.stringify(signal.metadata)})
      RETURNING *
    `;
    return result[0];
  }

  async getActiveSignals(): Promise<ActiveSignalDetailed[]> {
    return await this.sql`SELECT * FROM active_signals_detailed`;
  }

  async updateSignalStatus(id: string, status: 'OPEN' | 'EXECUTED' | 'EXPIRED'): Promise<void> {
    await this.sql`
      UPDATE trade_signals 
      SET status = ${status}, updated_at = NOW()
      WHERE id = ${id}
    `;
  }

  // Portfolio Trades
  async insertPortfolioTrade(trade: Omit<PortfolioTrade, 'id' | 'created_at' | 'updated_at'>): Promise<PortfolioTrade> {
    const result = await this.sql`
      INSERT INTO portfolio_trades (signal_id, trade_mode, coin_address, status, entry_price, entry_timestamp, trade_amount_sol)
      VALUES (${trade.signal_id}, ${trade.trade_mode}, ${trade.coin_address}, ${trade.status}, ${trade.entry_price}, ${trade.entry_timestamp}, ${trade.trade_amount_sol})
      RETURNING *
    `;
    return result[0];
  }

  async getOpenPortfolioTrades(): Promise<PortfolioTrade[]> {
    return await this.sql`
      SELECT * FROM portfolio_trades 
      WHERE status IN ('OPEN', 'PARTIALLY_CLOSED')
      ORDER BY created_at DESC
    `;
  }

  async updatePortfolioTrade(id: string, updates: Partial<PortfolioTrade>): Promise<void> {
    const setClauses = [];
    const values = [];
    let paramIndex = 1;

    for (const [key, value] of Object.entries(updates)) {
      setClauses.push(`${key} = $${paramIndex}`);
      values.push(value);
      paramIndex++;
    }

    if (setClauses.length === 0) return;

    const query = `UPDATE portfolio_trades SET ${setClauses.join(', ')}, updated_at = NOW() WHERE id = $${paramIndex}`;
    values.push(id);
    
    await this.sql.unsafe(query, values);
  }

  // Service Heartbeats
  async upsertServiceHeartbeat(heartbeat: Omit<ServiceHeartbeat, 'created_at' | 'updated_at'>): Promise<void> {
    await this.sql`
      INSERT INTO service_heartbeats (service_name, last_heartbeat, status, metadata)
      VALUES (${heartbeat.service_name}, ${heartbeat.last_heartbeat}, ${heartbeat.status}, ${JSON.stringify(heartbeat.metadata)})
      ON CONFLICT (service_name)
      DO UPDATE SET 
        last_heartbeat = EXCLUDED.last_heartbeat,
        status = EXCLUDED.status,
        metadata = EXCLUDED.metadata,
        updated_at = NOW()
    `;
  }

  // Service Config
  async getServiceConfig(serviceName: string): Promise<ServiceConfig | null> {
    const result = await this.sql`SELECT * FROM service_configs WHERE service_name = ${serviceName}`;
    return result[0] || null;
  }

  async getAllServiceConfigs(): Promise<ServiceConfig[]> {
    try {
      const result = await this.sql`SELECT * FROM service_configs ORDER BY service_name ASC`;
      return result;
    } catch (error) {
      console.error('Error getting service configs:', error);
      return []; // Return empty array on error
    }
  }

  async updateServiceEnabled(serviceName: string, enabled: boolean): Promise<void> {
    await this.sql`
      UPDATE service_configs 
      SET enabled = ${enabled}, updated_at = NOW() 
      WHERE service_name = ${serviceName}
    `;
  }

  async getSignalConfig(): Promise<SignalConfig | null> {
    const result = await this.sql`SELECT * FROM signal_config ORDER BY created_at DESC LIMIT 1`;
    return result[0] || null;
  }

  // Dashboard stats
  async getDashboardStats(): Promise<any> {
    const result = await this.sql`SELECT * FROM dashboard_stats`;
    return result[0] || null;
  }

  // Generic query method for custom operations
  async query(queryString: string, params: any[] = []): Promise<{ rows: any[] }> {
    const rows = await this.sql.unsafe(queryString, params);
    return { rows };
  }
}

// Export database instance
export const database = new Database();

// Export getDatabase function for compatibility
export const getDatabase = () => database;

// Export all database functions for compatibility with frontend
export const getTrackedWallets = (sortBy?: string, sortOrder?: 'asc' | 'desc', tagFilter?: string[]) => 
  database.getTrackedWallets(sortBy || undefined, sortOrder || 'desc', tagFilter || undefined);

export const getTrackedWalletByAddress = (address: string) => 
  database.getTrackedWallet(address);

export const createTrackedWallet = (walletData: Omit<TrackedWallet, 'id' | 'created_at' | 'updated_at'>) => 
  database.createTrackedWallet(walletData);

export const updateTrackedWallet = (address: string, updates: Partial<TrackedWallet>) => 
  database.updateTrackedWallet(address, updates);

export const deleteTrackedWallet = (address: string) => 
  database.deleteTrackedWallet(address);

export const toggleWalletStatus = (address: string) => 
  database.toggleWalletStatus(address);

export const getActiveSignals = () => 
  database.getActiveSignals();

export const getRecentTrades = (limit?: number) => 
  database.getRecentWhaleTrades(limit);

export const getStats = () => 
  database.getDashboardStats();