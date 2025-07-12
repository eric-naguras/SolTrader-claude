import { createClient } from '@supabase/supabase-js';

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