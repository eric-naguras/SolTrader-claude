import { 
  TradeSignal, 
  PortfolioTrade,
  ServiceStatus, 
  ServiceMetrics 
} from '../types';

/**
 * Paper Trader Service Interface
 * Responsible for managing paper trades and tracking performance
 */
export interface IPaperTraderService {
  // Lifecycle Management
  /**
   * Initialize and start the paper trading service
   * @throws {ServiceError} If initialization fails
   */
  start(): Promise<void>;

  /**
   * Gracefully stop the service
   */
  stop(): Promise<void>;

  // Trade Management
  /**
   * Record a new paper trade from a signal
   * @param signal - Trade signal to execute
   * @param options - Optional trade configuration
   * @returns Created portfolio trade
   */
  recordTrade(
    signal: TradeSignal,
    options?: TradeOptions
  ): Promise<PortfolioTrade>;

  /**
   * Close an open trade
   * @param tradeId - ID of the trade to close
   * @param reason - Reason for closing
   * @param options - Optional close configuration
   * @returns Updated portfolio trade
   */
  closeTrade(
    tradeId: string,
    reason: TradeCloseReason,
    options?: CloseOptions
  ): Promise<PortfolioTrade>;

  /**
   * Update all open trade prices
   * @returns Number of trades updated
   */
  updatePrices(): Promise<number>;

  /**
   * Update price for a specific trade
   * @param tradeId - ID of the trade to update
   * @returns Updated portfolio trade
   */
  updateTradePrice(tradeId: string): Promise<PortfolioTrade>;

  /**
   * Get all open trades
   * @param filters - Optional filters
   */
  getOpenTrades(filters?: TradeFilters): Promise<PortfolioTrade[]>;

  /**
   * Get trade by ID
   * @param tradeId - Trade ID
   */
  getTrade(tradeId: string): Promise<PortfolioTrade | null>;

  /**
   * Get trades by signal ID
   * @param signalId - Signal ID
   */
  getTradesBySignal(signalId: string): Promise<PortfolioTrade[]>;

  // Portfolio Analytics
  /**
   * Get current portfolio summary
   */
  getPortfolioSummary(): Promise<PortfolioSummary>;

  /**
   * Get performance metrics
   * @param timeRange - Optional time range
   */
  getPerformanceMetrics(
    timeRange?: TimeRange
  ): Promise<PerformanceMetrics>;

  /**
   * Get trade history
   * @param filters - Optional filters
   */
  getTradeHistory(
    filters?: HistoryFilters
  ): Promise<TradeHistory>;

  /**
   * Get P&L report
   * @param groupBy - Grouping option
   * @param timeRange - Optional time range
   */
  getPnLReport(
    groupBy: PnLGrouping,
    timeRange?: TimeRange
  ): Promise<PnLReport>;

  // Price Management
  /**
   * Get current price for a token
   * @param tokenAddress - Token address
   * @returns Current price in SOL
   */
  getTokenPrice(tokenAddress: string): Promise<number>;

  /**
   * Subscribe to price updates for a token
   * @param tokenAddress - Token address
   * @param callback - Price update callback
   * @returns Unsubscribe function
   */
  subscribeToPriceUpdates(
    tokenAddress: string,
    callback: (price: PriceUpdate) => void
  ): () => void;

  /**
   * Set price source configuration
   * @param source - Price source to use
   * @param config - Source-specific configuration
   */
  setPriceSource(
    source: PriceSource,
    config?: PriceSourceConfig
  ): Promise<void>;

  // Exit Strategy Management
  /**
   * Set trailing stop for a trade
   * @param tradeId - Trade ID
   * @param percentage - Trailing stop percentage
   */
  setTrailingStop(
    tradeId: string,
    percentage: number
  ): Promise<void>;

  /**
   * Set take profit target
   * @param tradeId - Trade ID
   * @param target - Target price or percentage
   */
  setTakeProfit(
    tradeId: string,
    target: number | PercentageTarget
  ): Promise<void>;

  /**
   * Set stop loss
   * @param tradeId - Trade ID
   * @param stopLoss - Stop loss price or percentage
   */
  setStopLoss(
    tradeId: string,
    stopLoss: number | PercentageTarget
  ): Promise<void>;

  /**
   * Check and execute exit conditions
   * @returns Number of trades closed
   */
  checkExitConditions(): Promise<number>;

  // Health & Monitoring
  /**
   * Get current service status
   */
  getStatus(): Promise<ServiceStatus>;

  /**
   * Get service performance metrics
   */
  getMetrics(): Promise<ServiceMetrics>;

  // Event Subscriptions
  /**
   * Subscribe to trade opened events
   * @param callback - Function to call when trade opens
   * @returns Unsubscribe function
   */
  onTradeOpened(
    callback: (trade: PortfolioTrade) => void
  ): () => void;

  /**
   * Subscribe to trade closed events
   * @param callback - Function to call when trade closes
   * @returns Unsubscribe function
   */
  onTradeClosed(
    callback: (trade: PortfolioTrade, reason: string) => void
  ): () => void;

  /**
   * Subscribe to price update events
   * @param callback - Function to call on price updates
   * @returns Unsubscribe function
   */
  onPriceUpdate(
    callback: (update: PriceUpdate) => void
  ): () => void;
}

/**
 * Trade execution options
 */
export interface TradeOptions {
  /**
   * Trade size in SOL (defaults to configured amount)
   */
  sizeSol?: number;

  /**
   * Slippage tolerance in basis points
   */
  slippageBps?: number;

  /**
   * Custom entry price (for backtesting)
   */
  customEntryPrice?: number;

  /**
   * Exit strategy configuration
   */
  exitStrategy?: ExitStrategy;

  /**
   * Trade metadata
   */
  metadata?: Record<string, any>;
}

/**
 * Trade close options
 */
export interface CloseOptions {
  /**
   * Custom exit price (for backtesting)
   */
  customExitPrice?: number;

  /**
   * Additional notes about the close
   */
  notes?: string;
}

/**
 * Exit strategy configuration
 */
export interface ExitStrategy {
  trailingStopPercent?: number;
  takeProfitPercent?: number;
  stopLossPercent?: number;
  timeBasedExit?: {
    hours: number;
  };
  whaleExitTracking?: boolean;
}

/**
 * Trade close reasons
 */
export type TradeCloseReason = 
  | 'MANUAL'
  | 'TRAILING_STOP'
  | 'TAKE_PROFIT'
  | 'STOP_LOSS'
  | 'WHALE_EXIT'
  | 'TIME_BASED'
  | 'SIGNAL_EXPIRED'
  | 'ERROR';

/**
 * Trade filters
 */
export interface TradeFilters {
  status?: 'OPEN' | 'CLOSED';
  tokenAddress?: string;
  signalId?: string;
  minPnlPercent?: number;
  maxPnlPercent?: number;
}

/**
 * History filters
 */
export interface HistoryFilters extends TradeFilters {
  startDate?: Date;
  endDate?: Date;
  limit?: number;
  offset?: number;
  sortBy?: 'created_at' | 'closed_at' | 'pnl_percentage';
  sortOrder?: 'asc' | 'desc';
}

/**
 * Portfolio summary
 */
export interface PortfolioSummary {
  totalValue: number;
  openPositions: number;
  totalInvested: number;
  totalPnL: number;
  totalPnLPercent: number;
  winRate: number;
  averageWin: number;
  averageLoss: number;
  bestTrade: PortfolioTrade | null;
  worstTrade: PortfolioTrade | null;
  byToken: TokenSummary[];
}

/**
 * Token-specific summary
 */
export interface TokenSummary {
  tokenAddress: string;
  tokenSymbol?: string;
  positions: number;
  totalInvested: number;
  totalPnL: number;
  averagePnLPercent: number;
}

/**
 * Performance metrics
 */
export interface PerformanceMetrics {
  timeRange: TimeRange;
  totalTrades: number;
  winningTrades: number;
  losingTrades: number;
  winRate: number;
  profitFactor: number;
  sharpeRatio: number;
  maxDrawdown: number;
  maxDrawdownPercent: number;
  averageHoldTime: number;
  roi: number;
  dailyStats: DailyStats[];
}

/**
 * Daily statistics
 */
export interface DailyStats {
  date: Date;
  trades: number;
  pnl: number;
  winRate: number;
  volume: number;
}

/**
 * Trade history entry
 */
export interface TradeHistory {
  trades: PortfolioTrade[];
  summary: {
    totalTrades: number;
    totalPnL: number;
    avgPnLPercent: number;
    bestDay: Date;
    worstDay: Date;
  };
}

/**
 * P&L report
 */
export interface PnLReport {
  grouping: PnLGrouping;
  entries: PnLEntry[];
  total: {
    realized: number;
    unrealized: number;
    total: number;
  };
}

/**
 * P&L grouping options
 */
export type PnLGrouping = 'daily' | 'weekly' | 'monthly' | 'token' | 'signal';

/**
 * P&L entry
 */
export interface PnLEntry {
  key: string;
  realized: number;
  unrealized: number;
  total: number;
  tradeCount: number;
  winRate: number;
}

/**
 * Price update event
 */
export interface PriceUpdate {
  tokenAddress: string;
  price: number;
  previousPrice: number;
  changePercent: number;
  source: PriceSource;
  timestamp: Date;
}

/**
 * Price sources
 */
export type PriceSource = 'jupiter' | 'birdeye' | 'dexscreener' | 'coingecko';

/**
 * Price source configuration
 */
export interface PriceSourceConfig {
  apiKey?: string;
  endpoint?: string;
  rateLimit?: number;
  timeout?: number;
}

/**
 * Percentage-based target
 */
export interface PercentageTarget {
  type: 'percentage';
  value: number;
  fromPrice?: 'entry' | 'current' | 'high';
}

/**
 * Time range specification
 */
export interface TimeRange {
  start: Date;
  end: Date;
}