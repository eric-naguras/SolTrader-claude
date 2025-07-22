import { database } from '../lib/database.js';
import { Logger } from '../lib/logger.js';

export class PaperTrader {
  private logger: Logger;
  private isRunning: boolean = false;

  constructor() {
    this.logger = new Logger('paper-trader');
    this.logger.system('Initialized paper trader');
  }

  async start() {
    try {
      this.logger.system('Starting paper trader...');
      this.isRunning = true;
      
      // Set up periodic portfolio updates
      setInterval(() => this.updatePortfolioValues(), 60000); // Every minute
      
      // Update heartbeat periodically
      setInterval(() => this.updateHeartbeat(), 30000);
      
      this.logger.system('Paper trader started successfully');
    } catch (error) {
      this.logger.error('Failed to start paper trader:', error);
      throw error;
    }
  }

  async stop() {
    this.logger.system('Stopping paper trader...');
    this.isRunning = false;
    await this.logger.cleanup();
  }

  // Create paper trade from signal
  async createPaperTrade(signalId: string, coinAddress: string, entryPrice: number, tradeAmountSol: number) {
    try {
      const trade = await database.insertPortfolioTrade({
        signal_id: signalId,
        trade_mode: 'PAPER',
        coin_address: coinAddress,
        status: 'OPEN',
        entry_price: entryPrice,
        high_water_mark_price: entryPrice,
        entry_timestamp: new Date().toISOString(),
        exit_price: null,
        exit_timestamp: null,
        pnl_usd: null,
        exit_reason: null,
        manual_close: false,
        trade_amount_sol: tradeAmountSol,
        pnl_percentage: null,
        current_price: entryPrice
      });

      this.logger.system(`Created paper trade for ${coinAddress.substring(0, 8)}... with ${tradeAmountSol} SOL`);
      return trade;
    } catch (error) {
      this.logger.error('Error creating paper trade:', error);
      return null;
    }
  }

  // Close paper trade
  async closePaperTrade(tradeId: string, exitPrice: number, exitReason: string = 'manual') {
    try {
      const trade = await database.getOpenPortfolioTrades();
      const targetTrade = trade.find(t => t.id === tradeId);
      
      if (!targetTrade) {
        this.logger.error(`Trade ${tradeId} not found`);
        return null;
      }

      // Calculate PnL
      const entryPrice = targetTrade.entry_price || 0;
      const pnlPercentage = entryPrice > 0 ? ((exitPrice - entryPrice) / entryPrice) * 100 : 0;
      const pnlUsd = (targetTrade.trade_amount_sol || 0) * (exitPrice - entryPrice);

      await database.updatePortfolioTrade(tradeId, {
        status: 'CLOSED',
        exit_price: exitPrice,
        exit_timestamp: new Date().toISOString(),
        exit_reason: exitReason,
        pnl_percentage: pnlPercentage,
        pnl_usd: pnlUsd,
        current_price: exitPrice
      });

      this.logger.system(`Closed paper trade ${tradeId.substring(0, 8)}... with ${pnlPercentage.toFixed(2)}% PnL`);
      return { tradeId, pnlPercentage, pnlUsd };
    } catch (error) {
      this.logger.error('Error closing paper trade:', error);
      return null;
    }
  }

  // Update current portfolio values (mock price updates)
  private async updatePortfolioValues() {
    if (!this.isRunning) return;

    try {
      const openTrades = await database.getOpenPortfolioTrades();
      
      for (const trade of openTrades) {
        // Mock price update (in real implementation, would fetch from price API)
        const currentPrice = this.generateMockPrice(trade.entry_price || 1, trade.id);
        const highWaterMark = Math.max(trade.high_water_mark_price || 0, currentPrice);
        
        // Calculate current PnL
        const entryPrice = trade.entry_price || 0;
        const pnlPercentage = entryPrice > 0 ? ((currentPrice - entryPrice) / entryPrice) * 100 : 0;

        await database.updatePortfolioTrade(trade.id, {
          current_price: currentPrice,
          high_water_mark_price: highWaterMark,
          pnl_percentage: pnlPercentage
        });
      }
    } catch (error) {
      this.logger.debug(`Error updating portfolio values: ${error}`);
    }
  }

  // Generate mock price movements (replace with real price feeds)
  private generateMockPrice(entryPrice: number, tradeId: string): number {
    // Simple random walk with slight upward bias
    const randomFactor = 0.95 + (Math.random() * 0.1); // -5% to +5% change
    const hash = this.simpleHash(tradeId);
    const trendFactor = 1 + (hash % 10 - 5) * 0.001; // Small trend based on trade ID
    
    return entryPrice * randomFactor * trendFactor;
  }

  private simpleHash(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return Math.abs(hash);
  }

  // Get portfolio statistics
  async getPortfolioStats() {
    try {
      const stats = await database.getDashboardStats();
      return stats;
    } catch (error) {
      this.logger.error('Error getting portfolio stats:', error);
      return null;
    }
  }

  private async updateHeartbeat() {
    try {
      await database.upsertServiceHeartbeat({
        service_name: 'paper-trader',
        last_heartbeat: new Date().toISOString(),
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