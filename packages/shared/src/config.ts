import { z } from 'zod';
import { AppConfig } from './types';

// Environment variable schemas
const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'staging', 'production']).default('development'),
  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
  
  // Supabase
  SUPABASE_URL: z.string().url(),
  SUPABASE_SERVICE_KEY: z.string().min(1),
  
  // Helius
  HELIUS_API_KEY: z.string().min(1).optional(),
  HELIUS_WEBSOCKET_URL: z.string().url().optional(),
  HELIUS_RPC_URL: z.string().url().optional(),
  
  // Notifications
  TELEGRAM_BOT_TOKEN: z.string().optional(),
  TELEGRAM_CHAT_IDS: z.string().optional(),
  DISCORD_WEBHOOK_URL: z.string().url().optional(),
  
  // Trading
  PAPER_TRADE_SIZE_SOL: z.string().transform(Number).default('1.0'),
  PRICE_UPDATE_INTERVAL_SECONDS: z.string().transform(Number).default('30'),
  
  // Service specific
  API_PORT: z.string().transform(Number).default('3000'),
  API_KEY: z.string().optional(),
});

export function loadConfig(serviceName: string, version: string): AppConfig {
  // Parse and validate environment variables
  const env = envSchema.parse(process.env);
  
  const config: AppConfig = {
    service: {
      name: serviceName,
      version,
      environment: env.NODE_ENV,
      logLevel: env.LOG_LEVEL,
    },
    database: {
      supabaseUrl: env.SUPABASE_URL,
      supabaseServiceKey: env.SUPABASE_SERVICE_KEY,
    },
  };
  
  // Add Helius config if available
  if (env.HELIUS_API_KEY) {
    config.helius = {
      apiKey: env.HELIUS_API_KEY,
      websocketUrl: env.HELIUS_WEBSOCKET_URL || `wss://atlas-mainnet.helius-rpc.com/?api-key=${env.HELIUS_API_KEY}`,
      rpcUrl: env.HELIUS_RPC_URL || `https://mainnet.helius-rpc.com/?api-key=${env.HELIUS_API_KEY}`,
      commitment: 'confirmed',
    };
  }
  
  // Add notification config if available
  const notifications: any = {};
  if (env.TELEGRAM_BOT_TOKEN) {
    notifications.telegram = {
      botToken: env.TELEGRAM_BOT_TOKEN,
      chatIds: env.TELEGRAM_CHAT_IDS?.split(',').filter(id => id.trim()) || [],
    };
  }
  if (env.DISCORD_WEBHOOK_URL) {
    notifications.discord = {
      webhookUrl: env.DISCORD_WEBHOOK_URL,
    };
  }
  if (Object.keys(notifications).length > 0) {
    config.notifications = notifications;
  }
  
  // Add trading config
  config.trading = {
    paperTradeSize: env.PAPER_TRADE_SIZE_SOL,
    slippageBps: 100, // 1% default
    priceUpdateInterval: env.PRICE_UPDATE_INTERVAL_SECONDS,
  };
  
  return config;
}

export function getEnvVar(key: string, defaultValue?: string): string {
  const value = process.env[key];
  if (!value && !defaultValue) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value || defaultValue!;
}

export function getEnvVarAsNumber(key: string, defaultValue?: number): number {
  const value = process.env[key];
  if (!value && defaultValue === undefined) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  const parsed = Number(value || defaultValue);
  if (isNaN(parsed)) {
    throw new Error(`Environment variable ${key} must be a number`);
  }
  return parsed;
}

export function getEnvVarAsBoolean(key: string, defaultValue = false): boolean {
  const value = process.env[key];
  if (!value) return defaultValue;
  return value.toLowerCase() === 'true' || value === '1';
}