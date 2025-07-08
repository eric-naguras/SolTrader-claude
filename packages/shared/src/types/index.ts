// Re-export types from the API design
export * from '../../../../api/types';

// Additional shared types
export interface ServiceConfig {
  name: string;
  version: string;
  environment: 'development' | 'staging' | 'production';
  logLevel: 'debug' | 'info' | 'warn' | 'error';
}

export interface DatabaseConfig {
  supabaseUrl: string;
  supabaseServiceKey: string;
}

export interface HeliusConfig {
  apiKey: string;
  websocketUrl: string;
  rpcUrl: string;
  commitment?: 'processed' | 'confirmed' | 'finalized';
}

export interface NotificationConfig {
  telegram?: {
    botToken: string;
    chatIds: string[];
  };
  discord?: {
    webhookUrl: string;
  };
}

export interface TradingConfig {
  paperTradeSize: number;
  slippageBps: number;
  priceUpdateInterval: number;
}

export interface AppConfig {
  service: ServiceConfig;
  database: DatabaseConfig;
  helius?: HeliusConfig;
  notifications?: NotificationConfig;
  trading?: TradingConfig;
}