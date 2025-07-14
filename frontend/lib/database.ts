import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

// Load environment variables
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
config({ path: join(__dirname, '../.env') });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;

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
  // Relations
  tokens?: {
    symbol?: string;
    name?: string;
  };
  tracked_wallets?: {
    alias?: string;
    ui_color?: string;
  };
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

export async function getRecentTrades(): Promise<WhaleTrade[]> {
  const { data, error } = await supabase
    .from('whale_trades')
    .select(`
      *,
      tokens (
        symbol,
        name
      ),
      tracked_wallets (
        alias,
        ui_color
      )
    `)
    .order('trade_timestamp', { ascending: false })
    .limit(20);

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