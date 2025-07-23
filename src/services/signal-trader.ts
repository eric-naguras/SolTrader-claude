import { database } from '../lib/database.js';
import { Logger } from '../lib/logger.js';
import { Service, ServiceStatus } from '../lib/service-interface.js';
import { MessageBus } from '../lib/message-bus.js';

export class SignalTrader implements Service {
  readonly name = 'SignalTrader';
  
  private logger: Logger;
  private messageBus: MessageBus;
  private isRunning: boolean = false;
  private liveTradingEnabled: boolean = false;
  private tradingInterval?: number;
  private unsubscribers: (() => void)[] = [];

  constructor(messageBus: MessageBus) {
    this.messageBus = messageBus;
    this.logger = new Logger('signal-trader');
    this.logger.system('[SignalTrader] Initialized (LIVE TRADING - DISABLED BY DEFAULT)');
  }

  async start(): Promise<void> {
    try {
      this.logger.system('[SignalTrader] Starting...');
      this.isRunning = true;
      
      // Subscribe to message bus events
      this.setupMessageBusListeners();
      
      // Live trading is disabled by default for safety
      this.liveTradingEnabled = false;
      this.logger.system('[SignalTrader] Live trading is DISABLED - Use enableTrading() to activate');
      
      // Monitor signals every 30 seconds (fallback)
      this.tradingInterval = setInterval(() => this.processSignals(), 30000) as any;
      
      // Update heartbeat periodically
      setInterval(() => this.updateHeartbeat(), 30000);
      
      this.logger.system('[SignalTrader] Started successfully');
      
      // Publish service started event
      this.messageBus.publish('service_started', { serviceName: this.name });
    } catch (error) {
      this.logger.error('[SignalTrader] Failed to start:', error);
      this.isRunning = false;
      throw error;
    }
  }

  async stop(): Promise<void> {
    this.logger.system('[SignalTrader] Stopping...');
    this.isRunning = false;
    this.liveTradingEnabled = false;
    
    if (this.tradingInterval) {
      clearInterval(this.tradingInterval);
      this.tradingInterval = undefined;
    }
    
    // Unsubscribe from message bus events
    this.unsubscribers.forEach(unsub => unsub());
    this.unsubscribers = [];
    
    this.logger.system('[SignalTrader] Stopped');
    
    // Publish service stopped event
    this.messageBus.publish('service_stopped', { serviceName: this.name });
  }

  getStatus(): ServiceStatus {
    return {
      running: this.isRunning,
      lastHeartbeat: new Date().toISOString(),
      metadata: {
        liveTradingEnabled: this.liveTradingEnabled,
        tradingInterval: this.tradingInterval ? 'active' : 'inactive'
      }
    };
  }

  private setupMessageBusListeners(): void {
    // Listen for new signals from SignalAnalyzer
    const newSignalHandler = async (data: any) => {
      this.logger.system('[SignalTrader] Received new_signal event');
      if (this.liveTradingEnabled) {
        await this.handleNewSignal(data.signal);
      } else {
        this.logger.system('[SignalTrader] Live trading disabled, ignoring signal');
      }
    };

    this.messageBus.subscribe('new_signal', newSignalHandler);
    this.unsubscribers.push(() => this.messageBus.unsubscribe('new_signal', newSignalHandler));
  }

  // Handle new signal by creating real trade (if enabled)
  private async handleNewSignal(signal: any) {
    try {
      this.logger.system(`[SignalTrader] Processing signal for real trade: ${signal.coin_address}`);
      
      // Default real trade amount (should be configurable)
      const tradeAmountSol = 0.1; // Much smaller for real trading
      
      const trade = await this.createLiveTrade(signal.id, signal.coin_address, 1.0, tradeAmountSol);
      
      if (trade) {
        this.logger.system(`[SignalTrader] Created live trade: ${trade.id}`);
        
        // Publish real trade event
        this.messageBus.publish('real_trade_executed', { trade });
      }
    } catch (error) {
      this.logger.error('[SignalTrader] Error handling new signal:', error);
    }
  }

  // Enable live trading (must be called explicitly)
  async enableTrading() {
    this.liveTradingEnabled = true;
    this.logger.system('[SignalTrader] 🚨 LIVE TRADING ENABLED - Real trades will be executed!');
    
    // Publish trading enabled event
    this.messageBus.publish('trading_enabled', {});
  }

  // Disable live trading
  async disableTrading() {
    this.liveTradingEnabled = false;
    this.logger.system('[SignalTrader] Live trading disabled - Only paper trades will be executed');
    
    // Publish trading disabled event
    this.messageBus.publish('trading_disabled', {});
  }

  // Process open signals
  private async processSignals() {
    if (!this.isRunning) return;

    try {
      const openSignals = await database.getActiveSignals();
      
      for (const signal of openSignals) {
        await this.evaluateSignal(signal);
      }
    } catch (error) {
      this.logger.error('Error processing signals:', error);
    }
  }

  // Evaluate whether to act on a signal
  private async evaluateSignal(signal: any) {
    try {
      // Check if signal is still valid (not too old)
      const signalAge = Date.now() - new Date(signal.created_at).getTime();
      const maxSignalAge = 4 * 60 * 60 * 1000; // 4 hours
      
      if (signalAge > maxSignalAge) {
        await this.expireSignal(signal.id, 'Signal too old');
        return;
      }

      // Simple trading logic (this would be more sophisticated in production)
      const shouldTrade = this.shouldExecuteTrade(signal);
      
      if (shouldTrade) {
        await this.executeTrade(signal);
      }
    } catch (error) {
      this.logger.error(`Error evaluating signal ${signal.id}:`, error);
    }
  }

  // Determine if we should trade on this signal
  private shouldExecuteTrade(signal: any): boolean {
    // Simple rules (would be more sophisticated with ML/AI)
    const whaleCount = signal.metadata?.whale_count || 0;
    const totalVolume = signal.metadata?.total_volume || 0;
    
    // Require at least 3 whales and 5 SOL total volume
    return whaleCount >= 3 && totalVolume >= 5;
  }

  // Execute trade on signal
  private async executeTrade(signal: any) {
    try {
      const tradeAmount = this.calculateTradeAmount(signal);
      const entryPrice = this.getCurrentPrice(signal.coin_address); // Mock price
      
      let tradeMode: 'PAPER' | 'LIVE' = 'PAPER';
      
      // Only execute live trades if explicitly enabled
      if (this.liveTradingEnabled) {
        // In production, this would integrate with Jupiter or another DEX
        const success = await this.executeLiveTrade(signal.coin_address, tradeAmount, entryPrice);
        if (success) {
          tradeMode = 'LIVE';
          this.logger.system(`🚨 LIVE TRADE EXECUTED: ${signal.coin_address.substring(0, 8)}... for ${tradeAmount} SOL`);
        } else {
          this.logger.error('Live trade failed, falling back to paper trade');
        }
      }

      // Create portfolio trade record
      await database.insertPortfolioTrade({
        signal_id: signal.id,
        trade_mode: tradeMode,
        coin_address: signal.coin_address,
        status: 'OPEN',
        entry_price: entryPrice,
        high_water_mark_price: entryPrice,
        entry_timestamp: new Date().toISOString(),
        exit_price: null,
        exit_timestamp: null,
        pnl_usd: null,
        exit_reason: null,
        manual_close: false,
        trade_amount_sol: tradeAmount,
        pnl_percentage: null,
        current_price: entryPrice
      });

      // Mark signal as executed
      await database.updateSignalStatus(signal.id, 'EXECUTED');
      
      this.logger.system(`Executed ${tradeMode.toLowerCase()} trade for signal ${signal.id.substring(0, 8)}...`);
    } catch (error) {
      this.logger.error(`Error executing trade for signal ${signal.id}:`, error);
    }
  }

  // Calculate trade amount based on signal strength
  private calculateTradeAmount(signal: any): number {
    const whaleCount = signal.metadata?.whale_count || 0;
    const totalVolume = signal.metadata?.total_volume || 0;
    
    // Base amount of 1 SOL, increased by whale count and volume
    let amount = 1.0;
    amount += (whaleCount - 3) * 0.5; // 0.5 SOL per whale above 3
    amount += Math.min(totalVolume / 10, 2); // Up to 2 SOL based on volume
    
    return Math.min(amount, 5); // Cap at 5 SOL
  }

  // Get current price (mock - would integrate with real price feeds)
  private getCurrentPrice(coinAddress: string): number {
    // Mock price between 0.1 and 10 based on coin address hash
    const hash = this.simpleHash(coinAddress);
    return 0.1 + (hash % 100) / 10;
  }

  private simpleHash(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return Math.abs(hash);
  }

  // Execute live trade (placeholder - would integrate with Jupiter SDK)
  private async executeLiveTrade(coinAddress: string, amount: number, expectedPrice: number): Promise<boolean> {
    // This is a placeholder - in production would integrate with Jupiter SDK
    this.logger.system(`Would execute live trade: ${amount} SOL for ${coinAddress.substring(0, 8)}... at $${expectedPrice}`);
    
    // For safety, always return false in this demo
    return false;
  }

  // Expire old signal
  private async expireSignal(signalId: string, reason: string) {
    try {
      await database.updateSignalStatus(signalId, 'EXPIRED');
      this.logger.system(`Expired signal ${signalId.substring(0, 8)}...: ${reason}`);
    } catch (error) {
      this.logger.error(`Error expiring signal ${signalId}:`, error);
    }
  }

  // Manual trade execution (for testing)
  async manualTrade(coinAddress: string, amount: number, tradeMode: 'PAPER' | 'LIVE' = 'PAPER') {
    const entryPrice = this.getCurrentPrice(coinAddress);
    
    const trade = await database.insertPortfolioTrade({
      signal_id: null, // Manual trade
      trade_mode: tradeMode,
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
      trade_amount_sol: amount,
      pnl_percentage: null,
      current_price: entryPrice
    });

    this.logger.system(`Manual ${tradeMode.toLowerCase()} trade created: ${amount} SOL for ${coinAddress.substring(0, 8)}...`);
    return trade;
  }

  private async updateHeartbeat() {
    try {
      await database.upsertServiceHeartbeat({
        service_name: 'signal-trader',
        last_heartbeat: new Date().toISOString(),
        status: 'healthy',
        metadata: {
          is_running: this.isRunning,
          live_trading_enabled: this.liveTradingEnabled
        }
      });
    } catch (error) {
      this.logger.debug(`Heartbeat update skipped: ${error}`);
    }
  }
}