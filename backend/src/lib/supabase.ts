import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

// Load environment variables if not already loaded
if (!process.env.SUPABASE_URL) {
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = dirname(__filename);
  config({ path: join(__dirname, '../../.env') });
}

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export interface TrackedWallet {
  id: string;
  address: string;
  alias?: string;
  is_active: boolean;
  tags?: string[];
  metadata?: Record<string, any>;
  created_at: string;
  ui_color?: string;
  twitter_handle?: string;
  telegram_channel?: string;
  streaming_channel?: string;
  image_data?: string; // Base64 encoded image
  notes?: string;
  sol_balance?: number;
  last_balance_check?: string;
}

export interface Token {
  id: string;
  address: string;
  symbol?: string;
  name?: string;
  metadata?: Record<string, any>;
  last_seen: string;
}

export interface WhaleTrade {
  id: number;
  wallet_address: string;
  coin_address: string;
  trade_type: 'BUY' | 'SELL';
  sol_amount?: number;
  token_amount?: number;
  transaction_hash: string;
  trade_timestamp: string;
}

export interface TradeSignal {
  id: string;
  coin_address: string;
  status: 'OPEN' | 'EXECUTED' | 'EXPIRED';
  trigger_reason?: string;
  metadata?: Record<string, any>;
  created_at: string;
  updated_at: string;
  user_notes?: string;
}

export interface ServiceConfig {
  id: string;
  service_name: string;
  log_categories: {
    connection: boolean;
    wallet: boolean;
    trade: boolean;
    multiWhale: boolean;
    transaction: boolean;
    dataFlow: boolean;
    health: boolean;
    debug: boolean;
  };
  other_settings?: Record<string, any>;
  updated_at: string;
}