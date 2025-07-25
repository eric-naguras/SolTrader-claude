import { database } from '../lib/database.js';
import { Logger } from '../lib/logger.js';
import { Service, ServiceStatus } from '../lib/service-interface.js';
import { MessageBus } from '../lib/message-bus.js';

export class SignalAnalyzer implements Service {
  readonly name = 'SignalAnalyzer';
  private logger: Logger;
  private isRunning: boolean = false;
  private analysisInterval?: number;
  private lastHeartbeat: Date = new Date();

  constructor(private messageBus: MessageBus) {
    this.logger = new Logger('signal-analyzer');
    this.logger.system('[SignalAnalyzer] Initialized');
  }

  async start() {
    try {
      this.logger.system('[SignalAnalyzer] Starting...');
      this.isRunning = true;
      
      // Run analysis every 5 minutes
      this.analysisInterval = setInterval(() => this.runPeriodicAnalysis(), 5 * 60 * 1000) as any;
      
      // Update heartbeat periodically
      setInterval(() => this.updateHeartbeat(), 30000);
      
      this.logger.system('[SignalAnalyzer] Started successfully');
    } catch (error) {
      this.logger.error('[SignalAnalyzer] Failed to start:', error);
      throw error;
    }
  }

  async stop() {
    this.logger.system('[SignalAnalyzer] Stopping...');
    this.isRunning = false;
    
    if (this.analysisInterval) {
      clearInterval(this.analysisInterval);
      this.analysisInterval = undefined;
    }
    
    await this.logger.cleanup();
  }

  getStatus(): ServiceStatus {
    return {
      running: this.isRunning,
      lastHeartbeat: this.lastHeartbeat.toISOString(),
      metadata: {
        analysisInterval: this.analysisInterval ? 'active' : 'inactive'
      }
    };
  }

  // Event-driven analysis triggered by new trades
  private async runTradeAnalysis(trade: any) {
    if (!this.isRunning) return;

    try {
      this.logger.system(`[SignalAnalyzer] Analyzing new trade: ${trade.trade_type} ${trade.coin_address}`);
      
      // Only analyze BUY trades for signal generation  
      if (trade.trade_type === 'BUY') {
        await this.checkForMultiWhaleSignal(trade.coin_address);
      }
    } catch (error) {
      this.logger.error('[SignalAnalyzer] Error in trade analysis:', error);
    }
  }

  // Check for multi-whale signal on specific token
  private async checkForMultiWhaleSignal(coinAddress: string) {
    try {
      // Get signal configuration
      const config = await database.getSignalConfig();
      const minWhales = config?.min_whales || 3;
      const timeWindowHours = config?.time_window_hours || 1;
      const minTradeAmount = config?.min_trade_amount_sol || 0.5;

      // Check if this token already has a recent signal
      const hasRecent = await this.hasRecentSignal(coinAddress, timeWindowHours);
      if (hasRecent) {
        this.logger.system(`[SignalAnalyzer] Token ${coinAddress} already has recent signal, skipping`);
        return;
      }

      // Get whale activity for this specific token
      const tokenActivity = await this.getTokenWhaleActivity(coinAddress, timeWindowHours, minTradeAmount);
      
      if (tokenActivity && tokenActivity.whale_count >= minWhales) {
        this.logger.system(`[SignalAnalyzer] Creating signal for ${coinAddress}: ${tokenActivity.whale_count} whales`);
        await this.createTradeSignal(tokenActivity, minWhales);
      }
    } catch (error) {
      this.logger.error('[SignalAnalyzer] Error checking for multi-whale signal:', error);
    }
  }

  // Get whale activity for a specific token
  private async getTokenWhaleActivity(coinAddress: string, timeWindowHours: number, minTradeAmount: number) {
    try {
      const since = new Date();
      since.setHours(since.getHours() - timeWindowHours);

      const query = `
        SELECT 
          coin_address,
          COUNT(DISTINCT wallet_address) as whale_count,
          SUM(sol_amount) as total_volume,
          MIN(trade_timestamp) as first_trade,
          MAX(trade_timestamp) as last_trade,
          string_agg(DISTINCT wallet_address, ',') as wallets
        FROM whale_trades 
        WHERE trade_type = 'BUY' 
          AND coin_address = $1
          AND trade_timestamp >= $2 
          AND sol_amount >= $3
        GROUP BY coin_address
      `;

      const results = await database.query(query, [coinAddress, since.toISOString(), minTradeAmount]);
      return results.length > 0 ? results[0] : null;
    } catch (error) {
      this.logger.error('[SignalAnalyzer] Error getting token whale activity:', error);
      return null;
    }
  }

  // Analyze recent trades for signal generation (periodic fallback)
  async runPeriodicAnalysis() {
    if (!this.isRunning) return;

    try {
      this.logger.system('[SignalAnalyzer] Running periodic trade analysis...');
      
      // Get signal configuration
      const config = await database.getSignalConfig();
      const minWhales = config?.min_whales || 3;
      const timeWindowHours = config?.time_window_hours || 1;
      const minTradeAmount = config?.min_trade_amount_sol || 0.5;

      // Find tokens with multiple whale activity
      const multiWhaleTokens = await this.findMultiWhaleActivity(minWhales, timeWindowHours, minTradeAmount);
      
      // Create signals for qualifying tokens
      for (const token of multiWhaleTokens) {
        await this.createTradeSignal(token, minWhales);
      }
      
      this.logger.system(`[SignalAnalyzer] Analysis complete. Found ${multiWhaleTokens.length} potential signals`);
    } catch (error) {
      this.logger.error('Error during periodic analysis:', error);
    }
  }

  // Find tokens with coordinated whale activity
  private async findMultiWhaleActivity(minWhales: number, timeWindowHours: number, minTradeAmount: number) {
    try {
      const since = new Date();
      since.setHours(since.getHours() - timeWindowHours);

      // Query for tokens with multiple whale buys in the time window
      const query = `
        SELECT 
          coin_address,
          COUNT(DISTINCT wallet_address) as whale_count,
          SUM(sol_amount) as total_volume,
          MIN(trade_timestamp) as first_trade,
          MAX(trade_timestamp) as last_trade,
          string_agg(DISTINCT wallet_address, ',') as wallets
        FROM whale_trades 
        WHERE trade_type = 'BUY' 
          AND trade_timestamp >= $1 
          AND sol_amount >= $2
        GROUP BY coin_address 
        HAVING COUNT(DISTINCT wallet_address) >= $3
        ORDER BY whale_count DESC, total_volume DESC
      `;

      const results = await database.query(query, [since.toISOString(), minTradeAmount, minWhales]);
      
      // Filter out tokens that already have recent open signals
      const filteredResults = [];
      for (const result of results) {
        const existingSignal = await this.hasRecentSignal(result.coin_address, timeWindowHours);
        if (!existingSignal) {
          filteredResults.push(result);
        }
      }

      return filteredResults;
    } catch (error) {
      this.logger.error('Error finding multi-whale activity:', error);
      return [];
    }
  }

  // Check if token already has a recent signal
  private async hasRecentSignal(coinAddress: string, timeWindowHours: number): Promise<boolean> {
    try {
      const since = new Date();
      since.setHours(since.getHours() - timeWindowHours);

      const query = `
        SELECT id FROM trade_signals 
        WHERE coin_address = $1 
          AND created_at >= $2 
          AND status = 'OPEN'
        LIMIT 1
      `;

      const result = await database.query(query, [coinAddress, since.toISOString()]);
      return result.length > 0;
    } catch (error) {
      this.logger.error('Error checking for recent signals:', error);
      return false;
    }
  }

  // Create a trade signal
  private async createTradeSignal(tokenData: any, minWhales: number) {
    try {
      const signal = await database.insertTradeSignal({
        coin_address: tokenData.coin_address,
        status: 'OPEN',
        trigger_reason: `${tokenData.whale_count} whales coordinated buy (min: ${minWhales})`,
        metadata: {
          whale_count: tokenData.whale_count,
          total_volume: tokenData.total_volume,
          first_trade: tokenData.first_trade,
          last_trade: tokenData.last_trade,
          wallets: tokenData.wallets.split(','),
          signal_type: 'multi_whale_coordination'
        }
      });

      this.logger.system(`[SignalAnalyzer] Created signal for ${tokenData.coin_address.substring(0, 8)}... (${tokenData.whale_count} whales, ${tokenData.total_volume} SOL)`);
      
      // Publish new signal event to message bus
      this.messageBus.publish('new_signal', { signal });
      
      return signal;
    } catch (error) {
      this.logger.error('Error creating trade signal:', error);
      return null;
    }
  }

  // Manual trigger for analysis (called from service manager)
  async triggerAnalysis() {
    this.logger.system('[SignalAnalyzer] Manual analysis triggered...');
    await this.runPeriodicAnalysis();
  }

  // Analyze historical performance (for LLM analysis preparation)
  async analyzeHistoricalPerformance() {
    try {
      // Get completed trades with their signal data
      const query = `
        SELECT 
          pt.*,
          ts.trigger_reason,
          ts.metadata,
          t.symbol,
          t.name
        FROM portfolio_trades pt
        LEFT JOIN trade_signals ts ON pt.signal_id = ts.id
        LEFT JOIN tokens t ON pt.coin_address = t.address
        WHERE pt.status = 'CLOSED' 
          AND pt.pnl_percentage IS NOT NULL
        ORDER BY pt.created_at DESC
        LIMIT 100
      `;

      const trades = await database.query(query);
      
      // Analyze patterns
      const analysis = this.analyzeTradePatterns(trades);
      
      this.logger.system(`[SignalAnalyzer] Historical analysis: ${analysis.totalTrades} trades, ${analysis.winRate}% win rate`);
      return analysis;
    } catch (error) {
      this.logger.error('Error analyzing historical performance:', error);
      return null;
    }
  }

  private analyzeTradePatterns(trades: any[]) {
    const totalTrades = trades.length;
    const winningTrades = trades.filter(t => t.pnl_percentage > 0).length;
    const winRate = totalTrades > 0 ? (winningTrades / totalTrades * 100).toFixed(2) : '0';
    
    // Analyze by whale count
    const whaleCountAnalysis = new Map();
    trades.forEach(trade => {
      if (trade.metadata?.whale_count) {
        const count = trade.metadata.whale_count;
        if (!whaleCountAnalysis.has(count)) {
          whaleCountAnalysis.set(count, { total: 0, winning: 0 });
        }
        const stats = whaleCountAnalysis.get(count);
        stats.total++;
        if (trade.pnl_percentage > 0) stats.winning++;
      }
    });

    // Analyze by time of day
    const hourAnalysis = new Map();
    trades.forEach(trade => {
      if (trade.entry_timestamp) {
        const hour = new Date(trade.entry_timestamp).getHours();
        if (!hourAnalysis.has(hour)) {
          hourAnalysis.set(hour, { total: 0, winning: 0 });
        }
        const stats = hourAnalysis.get(hour);
        stats.total++;
        if (trade.pnl_percentage > 0) stats.winning++;
      }
    });

    return {
      totalTrades,
      winningTrades,
      winRate: parseFloat(winRate),
      whaleCountAnalysis: Object.fromEntries(whaleCountAnalysis),
      hourAnalysis: Object.fromEntries(hourAnalysis),
      averagePnl: trades.reduce((sum, t) => sum + (t.pnl_percentage || 0), 0) / totalTrades
    };
  }

  private async updateHeartbeat() {
    try {
      this.lastHeartbeat = new Date();
      await database.upsertServiceHeartbeat({
        service_name: 'signal-analyzer',
        last_heartbeat: this.lastHeartbeat.toISOString(),
        status: 'healthy',
        metadata: {
          is_running: this.isRunning
        }
      });
    } catch (error) {
      this.logger.debug(`Heartbeat update skipped: ${error}`);
    }
  }
}