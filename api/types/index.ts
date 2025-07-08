// Core Type Definitions for Project Sonar Phase 1

// Database Models
export interface TrackedWallet {
  id: string;
  address: string;
  alias?: string;
  is_active: boolean;
  tags: string[];
  metadata: Record<string, any>;
  created_at: Date;
  updated_at: Date;
}

export interface Token {
  id: string;
  address: string;
  symbol?: string;
  name?: string;
  decimals: number;
  metadata: Record<string, any>;
  last_seen: Date;
  created_at: Date;
}

export interface WhaleTrade {
  id: number;
  wallet_id: string;
  wallet_address: string;
  token_id?: string;
  token_address: string;
  trade_type: 'BUY' | 'SELL';
  sol_amount: number;
  token_amount: number;
  usd_value?: number;
  price_per_token?: number;
  transaction_hash: string;
  block_slot?: number;
  trade_timestamp: Date;
  raw_data?: any;
  created_at: Date;
}

export interface SignalRule {
  id: string;
  name: string;
  min_whales: number;
  time_window_hours: number;
  min_total_sol: number;
  is_active: boolean;
  created_at: Date;
}

export interface TradeSignal {
  id: string;
  token_id?: string;
  token_address: string;
  rule_id?: string;
  status: 'OPEN' | 'EXECUTED' | 'EXPIRED' | 'CANCELLED';
  trigger_reason: string;
  whale_count: number;
  total_sol_amount: number;
  metadata: {
    triggering_trade?: string;
    rule_name?: string;
    whale_addresses?: string[];
    token_symbol?: string;
    token_name?: string;
    confidence?: number;
  };
  created_at: Date;
  closed_at?: Date;
}

export interface PortfolioTrade {
  id: string;
  signal_id?: string;
  token_id?: string;
  token_address: string;
  trade_mode: 'PAPER' | 'LIVE';
  status: 'OPEN' | 'CLOSED';
  entry_price: number;
  entry_sol_amount: number;
  entry_token_amount?: number;
  entry_timestamp: Date;
  current_price?: number;
  high_water_mark?: number;
  exit_price?: number;
  exit_timestamp?: Date;
  pnl_sol?: number;
  pnl_percentage?: number;
  exit_reason?: string;
  created_at: Date;
  updated_at: Date;
}

export interface NotificationLog {
  id: string;
  signal_id?: string;
  channel: 'TELEGRAM' | 'DISCORD' | 'CLI' | 'EMAIL';
  recipient?: string;
  status: 'PENDING' | 'SENT' | 'FAILED';
  message: string;
  error_message?: string;
  sent_at?: Date;
  created_at: Date;
}

// Service Configurations
export interface ServiceConfig {
  service_name: string;
  version: string;
  environment: 'development' | 'staging' | 'production';
  log_level: 'debug' | 'info' | 'warn' | 'error';
}

export interface WhaleWatcherConfig extends ServiceConfig {
  helius: {
    api_key: string;
    websocket_url: string;
    rpc_url: string;
    commitment: 'processed' | 'confirmed' | 'finalized';
  };
  supabase: {
    url: string;
    service_key: string;
  };
  monitoring: {
    batch_size: number;
    reconnect_delay: number;
    max_reconnect_attempts: number;
    health_check_interval: number;
  };
  filters: {
    min_trade_value_sol: number;
    ignored_tokens: string[];
    dex_programs: string[];
  };
}

export interface NotifierConfig extends ServiceConfig {
  supabase: {
    url: string;
    service_key: string;
  };
  channels: {
    telegram?: {
      bot_token: string;
      chat_ids: string[];
      rate_limit: number;
    };
    discord?: {
      webhook_url: string;
      rate_limit: number;
    };
    cli?: {
      enabled: boolean;
    };
  };
  formatting: {
    include_whale_names: boolean;
    include_dex_links: boolean;
    include_price_info: boolean;
  };
}

export interface PaperTraderConfig extends ServiceConfig {
  supabase: {
    url: string;
    service_key: string;
  };
  trading: {
    default_size_sol: number;
    slippage_bps: number;
    price_source: 'jupiter' | 'birdeye' | 'dexscreener';
  };
  jupiter?: {
    api_url: string;
  };
}

// WebSocket Messages
export interface HeliusTransaction {
  signature: string;
  slot: number;
  err: any | null;
  blockTime: number;
  meta: {
    fee: number;
    innerInstructions: any[];
    logMessages: string[];
    postBalances: number[];
    postTokenBalances: any[];
    preBalances: number[];
    preTokenBalances: any[];
    rewards: any[];
  };
  transaction: {
    message: {
      accountKeys: string[];
      instructions: any[];
      recentBlockhash: string;
    };
    signatures: string[];
  };
}

export interface ParsedSwapTransaction {
  signature: string;
  timestamp: number;
  fee: number;
  feePayer: string;
  instructions: ParsedSwapInstruction[];
}

export interface ParsedSwapInstruction {
  programId: string;
  type: string;
  info: {
    tokenA?: string;
    tokenB?: string;
    amountA?: number;
    amountB?: number;
    source?: string;
    destination?: string;
    owner?: string;
  };
}

// API Request/Response Types
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: any;
  };
  metadata?: {
    timestamp: Date;
    request_id: string;
    version: string;
  };
}

export interface PaginatedResponse<T> extends ApiResponse<T[]> {
  pagination: {
    page: number;
    limit: number;
    total: number;
    has_more: boolean;
  };
}

export interface WalletCreateRequest {
  address: string;
  alias?: string;
  tags?: string[];
  metadata?: Record<string, any>;
}

export interface WalletUpdateRequest {
  alias?: string;
  is_active?: boolean;
  tags?: string[];
  metadata?: Record<string, any>;
}

export interface SignalFilterParams {
  status?: 'OPEN' | 'EXECUTED' | 'EXPIRED' | 'CANCELLED';
  token_address?: string;
  created_after?: Date;
  created_before?: Date;
  min_whale_count?: number;
  limit?: number;
  offset?: number;
}

export interface PortfolioFilterParams {
  status?: 'OPEN' | 'CLOSED';
  trade_mode?: 'PAPER' | 'LIVE';
  signal_id?: string;
  token_address?: string;
  limit?: number;
  offset?: number;
}

// Event Types
export interface SignalGeneratedEvent {
  signal: TradeSignal;
  triggering_trades: WhaleTrade[];
  matched_rule: SignalRule;
}

export interface NotificationSentEvent {
  notification_id: string;
  signal_id: string;
  channel: string;
  success: boolean;
  error?: string;
}

export interface PortfolioUpdateEvent {
  trade_id: string;
  type: 'OPENED' | 'UPDATED' | 'CLOSED';
  trade: PortfolioTrade;
  price_change?: number;
}

// Service Interfaces
export interface IWhaleWatcherService {
  start(): Promise<void>;
  stop(): Promise<void>;
  addWallet(address: string): Promise<void>;
  removeWallet(address: string): Promise<void>;
  getStatus(): Promise<ServiceStatus>;
  getMetrics(): Promise<ServiceMetrics>;
}

export interface INotifierService {
  start(): Promise<void>;
  stop(): Promise<void>;
  sendNotification(signal: TradeSignal): Promise<void>;
  testChannel(channel: string): Promise<boolean>;
  getStatus(): Promise<ServiceStatus>;
}

export interface IPaperTraderService {
  start(): Promise<void>;
  stop(): Promise<void>;
  recordTrade(signal: TradeSignal): Promise<PortfolioTrade>;
  updatePrices(): Promise<void>;
  closeTrade(tradeId: string, reason: string): Promise<void>;
  getStatus(): Promise<ServiceStatus>;
}

// Service Health & Metrics
export interface ServiceStatus {
  service: string;
  status: 'healthy' | 'degraded' | 'unhealthy';
  uptime: number;
  version: string;
  checks: {
    database: CheckResult;
    websocket?: CheckResult;
    external_apis?: CheckResult;
  };
}

export interface CheckResult {
  status: 'ok' | 'error';
  message?: string;
  latency_ms?: number;
  last_check: Date;
}

export interface ServiceMetrics {
  transactions_processed: number;
  signals_generated: number;
  notifications_sent: number;
  errors_count: number;
  average_latency_ms: number;
  memory_usage_mb: number;
  cpu_usage_percent: number;
}

// Utility Types
export type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};

export type RequireAtLeastOne<T, Keys extends keyof T = keyof T> =
  Pick<T, Exclude<keyof T, Keys>> &
  {
    [K in Keys]-?: Required<Pick<T, K>> & Partial<Pick<T, Exclude<Keys, K>>>;
  }[Keys];

// Error Types
export class SonarError extends Error {
  constructor(
    public code: string,
    message: string,
    public details?: any
  ) {
    super(message);
    this.name = 'SonarError';
  }
}

export class ValidationError extends SonarError {
  constructor(message: string, details?: any) {
    super('VALIDATION_ERROR', message, details);
  }
}

export class ServiceError extends SonarError {
  constructor(service: string, message: string, details?: any) {
    super(`SERVICE_ERROR_${service.toUpperCase()}`, message, details);
  }
}

export class DatabaseError extends SonarError {
  constructor(message: string, details?: any) {
    super('DATABASE_ERROR', message, details);
  }
}

export class WebSocketError extends SonarError {
  constructor(message: string, details?: any) {
    super('WEBSOCKET_ERROR', message, details);
  }
}

export class NotificationError extends SonarError {
  constructor(channel: string, message: string, details?: any) {
    super(`NOTIFICATION_ERROR_${channel.toUpperCase()}`, message, details);
  }
}