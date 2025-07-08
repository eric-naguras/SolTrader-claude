import { 
  BaseService,
  CheckResult,
  ServiceStatus,
  ServiceMetrics,
  TradeSignal,
  PortfolioTrade,
  subscribeToSignals,
  insertPortfolioTrade,
  updatePortfolioPrice,
  closePortfolioTrade,
  DatabaseError,
  ServiceError,
} from '@sonar/shared';
import { createSupabaseClient } from '@sonar/shared';
import { RealtimeChannel } from '@supabase/supabase-js';
import { 
  IPaperTraderService,
  TradeOptions,
  CloseOptions,
  TradeCloseReason,
  PortfolioSummary,
  PriceUpdate,
} from '../../../api/services/paper-trader.interface';
import { PriceFetcher, JupiterPriceFetcher, TokenPrice } from './price-fetcher';

interface PaperTraderConfig {
  service: any;
  database: any;
  trading: {
    defaultSizeSol: number;
    slippageBps: number;
    priceUpdateInterval: number;
  };
}

export class PaperTraderService extends BaseService implements IPaperTraderService {
  private priceFetcher: PriceFetcher;
  private signalSubscription: RealtimeChannel | null = null;
  private priceUpdateInterval: NodeJS.Timeout | null = null;
  private config: PaperTraderConfig;
  private stats = {
    tradesRecorded: 0,
    pricesUpdated: 0,
    tradesClosed: 0,
    errors: 0,
  };

  constructor(config: PaperTraderConfig) {
    const supabase = createSupabaseClient(config.database);
    super(config.service, supabase);
    this.config = config;
    this.priceFetcher = new JupiterPriceFetcher(this.logger);
  }

  protected async initialize(): Promise<void> {
    // Subscribe to new signals
    this.signalSubscription = await subscribeToSignals(
      this.supabase,
      async (payload) => {
        try {
          const signal = payload.new as TradeSignal;
          await this.handleNewSignal(signal);
        } catch (error) {
          this.logger.error('Error handling signal', error as Error);
          this.stats.errors++;
        }
      }
    );
    
    this.logger.info('Subscribed to trade signals for paper trading');
    
    // Start price update loop
    this.startPriceUpdates();
  }

  protected async cleanup(): Promise<void> {
    // Stop price updates
    this.stopPriceUpdates();
    
    // Unsubscribe from signals
    if (this.signalSubscription) {
      await this.signalSubscription.unsubscribe();
      this.signalSubscription = null;
    }
  }

  protected async performHealthChecks(): Promise<Record<string, CheckResult>> {
    const checks: Record<string, CheckResult> = {};
    
    // Check price fetcher
    try {
      const testPrice = await this.priceFetcher.getPrice('So11111111111111111111111111111111111111112');
      checks.price_fetcher = {
        status: testPrice ? 'ok' : 'error',
        message: testPrice ? 'Working' : 'Failed to fetch price',
        last_check: new Date(),
      };
    } catch (error) {
      checks.price_fetcher = {
        status: 'error',
        message: (error as Error).message,
        last_check: new Date(),
      };
    }
    
    return checks;
  }

  async recordTrade(
    signal: TradeSignal,
    options?: TradeOptions
  ): Promise<PortfolioTrade> {
    try {
      // Get current price
      const price = await this.priceFetcher.getPrice(signal.token_address);
      if (!price) {
        throw new ServiceError('paper-trader', 'Failed to fetch token price');
      }
      
      const sizeSol = options?.sizeSol || this.config.trading.defaultSizeSol;
      const entryPrice = options?.customEntryPrice || price.priceInSol;
      
      // Calculate token amount (including slippage)
      const slippageMultiplier = 1 + (options?.slippageBps || this.config.trading.slippageBps) / 10000;
      const effectivePrice = entryPrice * slippageMultiplier;
      const tokenAmount = sizeSol / effectivePrice;
      
      // Insert trade
      const trade = await insertPortfolioTrade(this.supabase, {
        signal_id: signal.id,
        token_address: signal.token_address,
        trade_mode: 'PAPER',
        entry_price: entryPrice,
        entry_sol_amount: sizeSol,
        entry_token_amount: tokenAmount,
      });
      
      this.stats.tradesRecorded++;
      this.logger.tradeRecorded(trade.id, signal.token_address, {
        entryPrice,
        sizeSol,
        tokenAmount,
      });
      
      this.emit('tradeOpened', trade);
      return trade;
    } catch (error) {
      this.stats.errors++;
      throw new DatabaseError('Failed to record trade', error);
    }
  }

  async closeTrade(
    tradeId: string,
    reason: TradeCloseReason,
    options?: CloseOptions
  ): Promise<PortfolioTrade> {
    try {
      // Get current trade
      const { data: trade, error: fetchError } = await this.supabase
        .from('portfolio_trades')
        .select('*')
        .eq('id', tradeId)
        .single();
      
      if (fetchError || !trade) {
        throw new Error('Trade not found');
      }
      
      if (trade.status === 'CLOSED') {
        throw new Error('Trade already closed');
      }
      
      // Get current price or use custom price
      let exitPrice = options?.customExitPrice;
      if (!exitPrice) {
        const price = await this.priceFetcher.getPrice(trade.token_address);
        if (!price) {
          throw new Error('Failed to fetch exit price');
        }
        exitPrice = price.priceInSol;
      }
      
      // Close the trade
      const closedTrade = await closePortfolioTrade(
        this.supabase,
        tradeId,
        exitPrice,
        `${reason}${options?.notes ? `: ${options.notes}` : ''}`
      );
      
      this.stats.tradesClosed++;
      this.logger.info('Trade closed', {
        tradeId,
        reason,
        exitPrice,
        pnl: closedTrade.pnl_sol,
      });
      
      this.emit('tradeClosed', { ...closedTrade, reason });
      return closedTrade;
    } catch (error) {
      this.stats.errors++;
      throw new DatabaseError('Failed to close trade', error);
    }
  }

  async updatePrices(): Promise<number> {
    try {
      // Get all open trades
      const { data: trades, error } = await this.supabase
        .from('portfolio_trades')
        .select('*')
        .eq('status', 'OPEN')
        .eq('trade_mode', 'PAPER');
      
      if (error) throw error;
      if (!trades || trades.length === 0) return 0;
      
      // Get unique token addresses
      const tokenAddresses = [...new Set(trades.map(t => t.token_address))];
      
      // Fetch prices in batch
      const prices = await this.priceFetcher.getBatchPrices(tokenAddresses);
      
      // Update each trade
      let updated = 0;
      for (const trade of trades) {
        const price = prices.get(trade.token_address);
        if (price) {
          await updatePortfolioPrice(
            this.supabase,
            trade.id,
            price.priceInSol
          );
          updated++;
          this.stats.pricesUpdated++;
          
          this.emit('priceUpdate', {
            tokenAddress: trade.token_address,
            price: price.priceInSol,
            previousPrice: trade.current_price || trade.entry_price,
            changePercent: ((price.priceInSol - (trade.current_price || trade.entry_price)) / (trade.current_price || trade.entry_price)) * 100,
            source: price.source,
            timestamp: new Date(),
          });
        }
      }
      
      this.logger.debug('Updated prices for trades', { count: updated });
      return updated;
    } catch (error) {
      this.stats.errors++;
      this.logger.error('Failed to update prices', error as Error);
      return 0;
    }
  }

  async updateTradePrice(tradeId: string): Promise<PortfolioTrade> {
    try {
      // Get trade
      const { data: trade, error: fetchError } = await this.supabase
        .from('portfolio_trades')
        .select('*')
        .eq('id', tradeId)
        .single();
      
      if (fetchError || !trade) {
        throw new Error('Trade not found');
      }
      
      // Get current price
      const price = await this.priceFetcher.getPrice(trade.token_address);
      if (!price) {
        throw new Error('Failed to fetch price');
      }
      
      // Update price
      const updatedTrade = await updatePortfolioPrice(
        this.supabase,
        tradeId,
        price.priceInSol
      );
      
      this.stats.pricesUpdated++;
      return updatedTrade;
    } catch (error) {
      this.stats.errors++;
      throw new ServiceError('paper-trader', 'Failed to update trade price', error);
    }
  }

  async getOpenTrades(filters?: any): Promise<PortfolioTrade[]> {
    try {
      let query = this.supabase
        .from('portfolio_trades')
        .select('*')
        .eq('status', 'OPEN')
        .eq('trade_mode', 'PAPER');
      
      if (filters?.tokenAddress) {
        query = query.eq('token_address', filters.tokenAddress);
      }
      if (filters?.signalId) {
        query = query.eq('signal_id', filters.signalId);
      }
      
      const { data, error } = await query.order('created_at', { ascending: false });
      
      if (error) throw error;
      return data || [];
    } catch (error) {
      throw new DatabaseError('Failed to get open trades', error);
    }
  }

  async getTrade(tradeId: string): Promise<PortfolioTrade | null> {
    try {
      const { data, error } = await this.supabase
        .from('portfolio_trades')
        .select('*')
        .eq('id', tradeId)
        .single();
      
      if (error) throw error;
      return data;
    } catch (error) {
      throw new DatabaseError('Failed to get trade', error);
    }
  }

  async getTradesBySignal(signalId: string): Promise<PortfolioTrade[]> {
    try {
      const { data, error } = await this.supabase
        .from('portfolio_trades')
        .select('*')
        .eq('signal_id', signalId);
      
      if (error) throw error;
      return data || [];
    } catch (error) {
      throw new DatabaseError('Failed to get trades by signal', error);
    }
  }

  async getPortfolioSummary(): Promise<PortfolioSummary> {
    try {
      const { data: trades, error } = await this.supabase
        .from('portfolio_trades')
        .select('*')
        .eq('trade_mode', 'PAPER');
      
      if (error) throw error;
      
      const openTrades = trades?.filter(t => t.status === 'OPEN') || [];
      const closedTrades = trades?.filter(t => t.status === 'CLOSED') || [];
      
      // Calculate metrics
      let totalValue = 0;
      let totalInvested = 0;
      let totalPnL = 0;
      const winningTrades = closedTrades.filter(t => (t.pnl_sol || 0) > 0);
      const losingTrades = closedTrades.filter(t => (t.pnl_sol || 0) < 0);
      
      // Open positions value
      for (const trade of openTrades) {
        totalInvested += trade.entry_sol_amount;
        const currentValue = (trade.current_price || trade.entry_price) * trade.entry_token_amount;
        totalValue += currentValue;
        totalPnL += currentValue - trade.entry_sol_amount;
      }
      
      // Closed positions P&L
      for (const trade of closedTrades) {
        totalPnL += trade.pnl_sol || 0;
      }
      
      const winRate = closedTrades.length > 0 
        ? (winningTrades.length / closedTrades.length) * 100 
        : 0;
      
      const averageWin = winningTrades.length > 0
        ? winningTrades.reduce((sum, t) => sum + (t.pnl_percentage || 0), 0) / winningTrades.length
        : 0;
      
      const averageLoss = losingTrades.length > 0
        ? losingTrades.reduce((sum, t) => sum + (t.pnl_percentage || 0), 0) / losingTrades.length
        : 0;
      
      // Find best and worst trades
      const allTrades = [...trades || []].sort((a, b) => (b.pnl_percentage || 0) - (a.pnl_percentage || 0));
      const bestTrade = allTrades[0] || null;
      const worstTrade = allTrades[allTrades.length - 1] || null;
      
      // Group by token
      const tokenMap = new Map<string, any>();
      for (const trade of trades || []) {
        const existing = tokenMap.get(trade.token_address) || {
          tokenAddress: trade.token_address,
          positions: 0,
          totalInvested: 0,
          totalPnL: 0,
        };
        
        existing.positions++;
        existing.totalInvested += trade.entry_sol_amount;
        existing.totalPnL += trade.pnl_sol || 0;
        
        tokenMap.set(trade.token_address, existing);
      }
      
      const byToken = Array.from(tokenMap.values()).map(token => ({
        ...token,
        averagePnLPercent: token.totalInvested > 0 
          ? (token.totalPnL / token.totalInvested) * 100 
          : 0,
      }));
      
      return {
        totalValue,
        openPositions: openTrades.length,
        totalInvested,
        totalPnL,
        totalPnLPercent: totalInvested > 0 ? (totalPnL / totalInvested) * 100 : 0,
        winRate,
        averageWin,
        averageLoss,
        bestTrade,
        worstTrade,
        byToken,
      };
    } catch (error) {
      throw new DatabaseError('Failed to get portfolio summary', error);
    }
  }

  async getPerformanceMetrics(timeRange?: any): Promise<any> {
    // This would implement detailed performance metrics
    // For now, return basic metrics
    const summary = await this.getPortfolioSummary();
    
    return {
      timeRange: timeRange || { start: new Date(0), end: new Date() },
      totalTrades: 0, // Would calculate from trades
      winningTrades: 0,
      losingTrades: 0,
      winRate: summary.winRate,
      profitFactor: 0, // Would calculate
      sharpeRatio: 0, // Would calculate
      maxDrawdown: 0, // Would calculate
      maxDrawdownPercent: 0,
      averageHoldTime: 0, // Would calculate
      roi: summary.totalPnLPercent,
      dailyStats: [], // Would calculate
    };
  }

  async getTradeHistory(filters?: any): Promise<any> {
    const trades = await this.getOpenTrades(filters);
    
    return {
      trades,
      summary: {
        totalTrades: trades.length,
        totalPnL: trades.reduce((sum, t) => sum + (t.pnl_sol || 0), 0),
        avgPnLPercent: 0, // Would calculate
        bestDay: new Date(), // Would calculate
        worstDay: new Date(), // Would calculate
      },
    };
  }

  async getPnLReport(groupBy: any, timeRange?: any): Promise<any> {
    // Simplified implementation
    const summary = await this.getPortfolioSummary();
    
    return {
      grouping: groupBy,
      entries: [],
      total: {
        realized: 0, // Would calculate from closed trades
        unrealized: summary.totalPnL,
        total: summary.totalPnL,
      },
    };
  }

  async getTokenPrice(tokenAddress: string): Promise<number> {
    const price = await this.priceFetcher.getPrice(tokenAddress);
    if (!price) {
      throw new Error('Failed to fetch token price');
    }
    return price.priceInSol;
  }

  subscribeToPriceUpdates(
    tokenAddress: string,
    callback: (price: PriceUpdate) => void
  ): () => void {
    // This would implement real-time price subscriptions
    // For now, return a no-op unsubscribe function
    return () => {};
  }

  async setPriceSource(source: any, config?: any): Promise<void> {
    // This would switch between different price sources
    this.logger.info('Price source updated', { source });
  }

  async setTrailingStop(tradeId: string, percentage: number): Promise<void> {
    // This would implement trailing stop logic
    this.logger.info('Trailing stop set', { tradeId, percentage });
  }

  async setTakeProfit(tradeId: string, target: number | any): Promise<void> {
    // This would implement take profit logic
    this.logger.info('Take profit set', { tradeId, target });
  }

  async setStopLoss(tradeId: string, stopLoss: number | any): Promise<void> {
    // This would implement stop loss logic
    this.logger.info('Stop loss set', { tradeId, stopLoss });
  }

  async checkExitConditions(): Promise<number> {
    // This would check all exit conditions and close trades accordingly
    // For now, return 0
    return 0;
  }

  async getMetrics(): Promise<ServiceMetrics> {
    return {
      transactions_processed: 0,
      signals_generated: 0,
      notifications_sent: 0,
      errors_count: this.stats.errors,
      average_latency_ms: 0,
      memory_usage_mb: process.memoryUsage().heapUsed / 1024 / 1024,
      cpu_usage_percent: 0,
    };
  }

  onTradeOpened(callback: (trade: PortfolioTrade) => void): () => void {
    return this.on('tradeOpened', callback);
  }

  onTradeClosed(callback: (trade: PortfolioTrade, reason: string) => void): () => void {
    return this.on('tradeClosed', ({ trade, reason }: any) => callback(trade, reason));
  }

  onPriceUpdate(callback: (update: PriceUpdate) => void): () => void {
    return this.on('priceUpdate', callback);
  }

  private async handleNewSignal(signal: TradeSignal): Promise<void> {
    this.logger.info('New signal received for paper trading', {
      signalId: signal.id,
      tokenAddress: signal.token_address,
    });
    
    try {
      await this.recordTrade(signal);
    } catch (error) {
      this.logger.error('Failed to record paper trade', error as Error);
    }
  }

  private startPriceUpdates(): void {
    const interval = this.config.trading.priceUpdateInterval * 1000;
    
    this.priceUpdateInterval = setInterval(async () => {
      try {
        await this.updatePrices();
      } catch (error) {
        this.logger.error('Price update cycle failed', error as Error);
      }
    }, interval);
    
    this.logger.info('Started price update cycle', { intervalSeconds: this.config.trading.priceUpdateInterval });
  }

  private stopPriceUpdates(): void {
    if (this.priceUpdateInterval) {
      clearInterval(this.priceUpdateInterval);
      this.priceUpdateInterval = null;
      this.logger.info('Stopped price update cycle');
    }
  }
}