export interface TrackedWallet {
  id: string;
  address: string;
  alias?: string;
  is_active: boolean;
  tags: string[];
  metadata?: Record<string, any>;
  created_at: Date;
}

export interface Token {
  id: string;
  address: string;
  symbol?: string;
  name?: string;
  metadata?: Record<string, any>;
  last_seen: Date;
}

export interface WhaleTrade {
  id: number;
  wallet_address: string;
  coin_address: string;
  trade_type: 'BUY' | 'SELL';
  sol_amount?: number;
  token_amount?: number;
  transaction_hash: string;
  trade_timestamp: Date;
}

export interface TradeSignal {
  id: string;
  coin_address: string;
  status: 'OPEN' | 'EXECUTED' | 'EXPIRED';
  trigger_reason?: string;
  metadata?: {
    whale_addresses: string[];
    confidence?: number;
    [key: string]: any;
  };
  created_at: Date;
  closed_at?: Date;
}

export interface PortfolioTrade {
  id: string;
  signal_id?: string;
  trade_mode: 'PAPER' | 'LIVE';
  coin_address: string;
  status: 'OPEN' | 'PARTIALLY_CLOSED' | 'CLOSED';
  entry_price?: number;
  high_water_mark_price?: number;
  entry_timestamp?: Date;
  exit_price?: number;
  exit_timestamp?: Date;
  pnl_usd?: number;
  exit_reason?: string;
}

export interface SignalConfig {
  min_whales: number;
  time_window_hours: number;
  min_trade_amount_sol: number;
}

export interface NotificationChannel {
  type: 'TELEGRAM' | 'DISCORD' | 'CLI';
  enabled: boolean;
  config: Record<string, any>;
}