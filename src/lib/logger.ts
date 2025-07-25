// Runtime-agnostic logger with configurable categories
import { ENV } from './env.js';

// Bit flags for ultra-fast category checking
export enum LogCategory {
  CONNECTION = 1 << 0,   // 1
  WALLET = 1 << 1,       // 2
  TRADE = 1 << 2,        // 4
  MULTI_WHALE = 1 << 3,  // 8
  TRANSACTION = 1 << 4,  // 16
  DATA_FLOW = 1 << 5,    // 32
  HEALTH = 1 << 6,       // 64
  DEBUG = 1 << 7,        // 128
}

// Category metadata for display
const CATEGORY_INFO = {
  [LogCategory.CONNECTION]: { name: 'connection', emoji: '🔌', color: '\x1b[36m' },
  [LogCategory.WALLET]: { name: 'wallet', emoji: '👛', color: '\x1b[35m' },
  [LogCategory.TRADE]: { name: 'trade', emoji: '📊', color: '\x1b[32m' },
  [LogCategory.MULTI_WHALE]: { name: 'multiWhale', emoji: '🎯', color: '\x1b[33m' },
  [LogCategory.TRANSACTION]: { name: 'transaction', emoji: '💾', color: '\x1b[34m' },
  [LogCategory.DATA_FLOW]: { name: 'dataFlow', emoji: '📡', color: '\x1b[36m' },
  [LogCategory.HEALTH]: { name: 'health', emoji: '❤️', color: '\x1b[35m' },
  [LogCategory.DEBUG]: { name: 'debug', emoji: '🐛', color: '\x1b[90m' },
};

export interface LoggerConfig {
  connection: boolean;
  wallet: boolean;
  trade: boolean;
  multiWhale: boolean;
  transaction: boolean;
  dataFlow: boolean;
  health: boolean;
  debug: boolean;
}

export class Logger {
  private serviceName: string;
  private enabledCategories: number = 0;
  public config: LoggerConfig | null = null;

  constructor(serviceName: string) {
    this.serviceName = serviceName;
    this.loadConfigFromEnv();
  }

  private loadConfigFromEnv() {
    try {
      const config = {
        connection: ENV.LOG_CONNECTION === 'true',
        wallet: ENV.LOG_WALLET === 'true',
        trade: ENV.LOG_TRADE !== 'false', // Default true
        multiWhale: ENV.LOG_MULTI_WHALE !== 'false', // Default true
        transaction: ENV.LOG_TRANSACTION === 'true',
        dataFlow: ENV.LOG_DATA_FLOW === 'true',
        health: ENV.LOG_HEALTH !== 'false', // Default true
        debug: ENV.LOG_DEBUG === 'true',
      };
      
      this.config = config;
      this.updateEnabledCategories(config);
    } catch (error) {
      console.error('[Logger] Failed to load config from env:', error);
      // Default to basic logging
      this.enabledCategories = LogCategory.CONNECTION | LogCategory.WALLET | LogCategory.TRADE | LogCategory.MULTI_WHALE | LogCategory.HEALTH;
    }
  }

  private updateEnabledCategories(config: LoggerConfig) {
    this.enabledCategories = 0;
    if (config.connection) this.enabledCategories |= LogCategory.CONNECTION;
    if (config.wallet) this.enabledCategories |= LogCategory.WALLET;
    if (config.trade) this.enabledCategories |= LogCategory.TRADE;
    if (config.multiWhale) this.enabledCategories |= LogCategory.MULTI_WHALE;
    if (config.transaction) this.enabledCategories |= LogCategory.TRANSACTION;
    if (config.dataFlow) this.enabledCategories |= LogCategory.DATA_FLOW;
    if (config.health) this.enabledCategories |= LogCategory.HEALTH;
    if (config.debug) this.enabledCategories |= LogCategory.DEBUG;
  }

  // Allow runtime configuration updates
  updateConfig(config: Partial<LoggerConfig>) {
    const fullConfig: LoggerConfig = {
      connection: config.connection ?? !!(this.enabledCategories & LogCategory.CONNECTION),
      wallet: config.wallet ?? !!(this.enabledCategories & LogCategory.WALLET),
      trade: config.trade ?? !!(this.enabledCategories & LogCategory.TRADE),
      multiWhale: config.multiWhale ?? !!(this.enabledCategories & LogCategory.MULTI_WHALE),
      transaction: config.transaction ?? !!(this.enabledCategories & LogCategory.TRANSACTION),
      dataFlow: config.dataFlow ?? !!(this.enabledCategories & LogCategory.DATA_FLOW),
      health: config.health ?? !!(this.enabledCategories & LogCategory.HEALTH),
      debug: config.debug ?? !!(this.enabledCategories & LogCategory.DEBUG),
    };
    this.config = fullConfig;
    this.updateEnabledCategories(fullConfig);
  }

  private log(category: LogCategory, message: string | (() => string)) {
    // Ultra-fast check using bit operation
    if (!(this.enabledCategories & category)) return;

    const info = CATEGORY_INFO[category];
    const timestamp = new Date().toTimeString().split(' ')[0];
    const msg = typeof message === 'function' ? message() : message;
    
    console.log(
      `${info.color}[${info.emoji} ${info.name.toUpperCase()}] ${timestamp} - ${msg}\x1b[0m`
    );
  }

  // System messages (always shown)
  system(message: string) {
    const timestamp = new Date().toTimeString().split(' ')[0];
    console.log(`\x1b[95m[🖥️ SYSTEM] ${timestamp} - ${message}\x1b[0m`);
  }

  // Connection events
  connection(message: string | (() => string)) {
    this.log(LogCategory.CONNECTION, message);
  }

  // Wallet activity
  wallet(message: string | (() => string)) {
    this.log(LogCategory.WALLET, message);
  }

  // Trade events with special formatting
  trade = {
    enter: (wallet: string, token: string, amount: number) => {
      this.log(LogCategory.TRADE, () => `🟢 ${wallet} BOUGHT ${amount.toLocaleString()} SOL of ${token}`);
    },
    exit: (wallet: string, token: string, amount: number) => {
      this.log(LogCategory.TRADE, () => `🔴 ${wallet} SOLD ${amount.toLocaleString()} SOL of ${token}`);
    },
    generic: (message: string | (() => string)) => {
      this.log(LogCategory.TRADE, message);
    }
  };

  // Multi-whale coordination alerts
  multiWhale(whaleCount: number, token: string, whaleNames: string[]) {
    this.log(LogCategory.MULTI_WHALE, 
      () => `⚠️ ${whaleCount} whales in ${token}: ${whaleNames.join(', ')}`
    );
  }

  // Transaction processing
  transaction(message: string | (() => string)) {
    this.log(LogCategory.TRANSACTION, message);
  }

  // Data flow events
  dataFlow(message: string | (() => string)) {
    this.log(LogCategory.DATA_FLOW, message);
  }

  // Health monitoring
  health(message: string | (() => string)) {
    this.log(LogCategory.HEALTH, message);
  }

  // Debug information
  debug(message: string | (() => string)) {
    this.log(LogCategory.DEBUG, message);
  }

  // Error logging (always enabled)
  error(message: string, error?: any) {
    const timestamp = new Date().toTimeString().split(' ')[0];
    console.error(`\x1b[31m[❌ ERROR] ${timestamp} - ${message}\x1b[0m`, error || '');
  }

  // Cleanup - no-op for simple logger
  async cleanup() {
    // Nothing to clean up
  }
}

// Default logger instance
export const logger = new Logger('sonar-platform');