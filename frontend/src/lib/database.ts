import { createClient } from '@supabase/supabase-js';
// import { config } from 'dotenv';
// import { fileURLToPath } from 'node:url';
// import { dirname, join } from 'node:path';
import { ENV } from './env';


// Load environment variables
// const __filename = fileURLToPath(import.meta.url);
// const __dirname = dirname(__filename);
// config({ path: join(__dirname, '../.env') });

const supabaseUrl = ENV.SUPABASE_URL;
const supabaseAnonKey = ENV.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export interface TradeSignal {
  id: string;
  coin_address: string;
  status: 'OPEN' | 'EXECUTED' | 'EXPIRED';
  trigger_reason?: string;
  metadata?: Record<string, any>;
  created_at: string;
  updated_at: string;
  user_notes?: string;
  // Relations
  tokens?: {
    symbol?: string;
    name?: string;
  };
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
  price_usd?: number;
  // Flattened fields from view
  wallet_alias?: string;
  wallet_color?: string;
  twitter_handle?: string;
  telegram_channel?: string;
  streaming_channel?: string;
  image_data?: string;
  is_verified?: boolean;
  token_symbol?: string;
  token_name?: string;
}

export async function getActiveSignals(): Promise<TradeSignal[]> {
  const { data, error } = await supabase
    .from('trade_signals')
    .select(`
      *,
      tokens (
        symbol,
        name
      )
    `)
    .eq('status', 'OPEN')
    .order('created_at', { ascending: false })
    .limit(10);

  if (error) {
    console.error('Error fetching active signals:', error);
    return [];
  }

  return data || [];
}

export async function getRecentTrades(limit: number = 20): Promise<WhaleTrade[]> {
  const { data, error } = await supabase
    .from('recent_whale_trades')
    .select('*')
    .limit(limit);

  if (error) {
    console.error('Error fetching recent trades:', error);
    return [];
  }

  return data || [];
}

export async function getStats() {
  const [signalsResult, tradesResult, walletsResult] = await Promise.all([
    supabase.from('trade_signals').select('id', { count: 'exact' }).eq('status', 'OPEN'),
    supabase.from('whale_trades').select('id', { count: 'exact' }),
    supabase.from('tracked_wallets').select('id', { count: 'exact' }).eq('is_active', true)
  ]);

  return {
    activeSignals: signalsResult.count || 0,
    totalTrades: tradesResult.count || 0,
    activeWallets: walletsResult.count || 0
  };
}