import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { DatabaseConfig } from './types';
import { Database } from './database.types';

export type SupabaseDatabase = SupabaseClient<Database>;

let supabaseInstance: SupabaseDatabase | null = null;

export function createSupabaseClient(config: DatabaseConfig): SupabaseDatabase {
  if (!supabaseInstance) {
    supabaseInstance = createClient<Database>(
      config.supabaseUrl,
      config.supabaseServiceKey,
      {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
        },
        global: {
          headers: {
            'X-Client-Service': 'sonar-backend',
          },
        },
      }
    );
  }
  return supabaseInstance;
}

export function getSupabaseClient(): SupabaseDatabase {
  if (!supabaseInstance) {
    throw new Error('Supabase client not initialized. Call createSupabaseClient first.');
  }
  return supabaseInstance;
}

// Helper functions for common database operations
export async function upsertWallet(
  supabase: SupabaseDatabase,
  wallet: {
    address: string;
    alias?: string;
    is_active?: boolean;
    tags?: string[];
    metadata?: Record<string, any>;
  }
) {
  const { data, error } = await supabase
    .from('tracked_wallets')
    .upsert(wallet, { onConflict: 'address' })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function getActiveWallets(supabase: SupabaseDatabase) {
  const { data, error } = await supabase
    .from('tracked_wallets')
    .select('*')
    .eq('is_active', true);

  if (error) throw error;
  return data || [];
}

export async function insertWhaleTrade(
  supabase: SupabaseDatabase,
  trade: {
    wallet_id: string;
    wallet_address: string;
    token_id?: string;
    token_address: string;
    trade_type: 'BUY' | 'SELL';
    sol_amount: number;
    token_amount: number;
    usd_value?: number;
    price_per_token?: number;
    transaction_hash: string;
    block_slot?: number;
    trade_timestamp: Date;
    raw_data?: any;
  }
) {
  const { data, error } = await supabase
    .from('whale_trades')
    .insert(trade)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function getOrCreateToken(
  supabase: SupabaseDatabase,
  token: {
    address: string;
    symbol?: string;
    name?: string;
    decimals?: number;
    metadata?: Record<string, any>;
  }
) {
  // Try to get existing token
  const { data: existing } = await supabase
    .from('tokens')
    .select('*')
    .eq('address', token.address)
    .single();

  if (existing) {
    // Update last_seen
    await supabase
      .from('tokens')
      .update({ last_seen: new Date().toISOString() })
      .eq('id', existing.id);
    return existing;
  }

  // Create new token
  const { data, error } = await supabase
    .from('tokens')
    .insert(token)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function subscribeToSignals(
  supabase: SupabaseDatabase,
  callback: (payload: any) => void
) {
  return supabase
    .channel('trade_signals')
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'trade_signals',
      },
      callback
    )
    .subscribe();
}

export async function getSignalRules(supabase: SupabaseDatabase) {
  const { data, error } = await supabase
    .from('signal_rules')
    .select('*')
    .eq('is_active', true);

  if (error) throw error;
  return data || [];
}

export async function insertPortfolioTrade(
  supabase: SupabaseDatabase,
  trade: {
    signal_id?: string;
    token_id?: string;
    token_address: string;
    trade_mode: 'PAPER' | 'LIVE';
    entry_price: number;
    entry_sol_amount: number;
    entry_token_amount: number;
  }
) {
  const { data, error } = await supabase
    .from('portfolio_trades')
    .insert({
      ...trade,
      status: 'OPEN',
      entry_timestamp: new Date().toISOString(),
      current_price: trade.entry_price,
      high_water_mark: trade.entry_price,
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function updatePortfolioPrice(
  supabase: SupabaseDatabase,
  tradeId: string,
  currentPrice: number
) {
  // Get current trade
  const { data: trade, error: fetchError } = await supabase
    .from('portfolio_trades')
    .select('*')
    .eq('id', tradeId)
    .single();

  if (fetchError) throw fetchError;
  if (!trade) throw new Error('Trade not found');

  // Update price and high water mark if needed
  const updates: any = {
    current_price: currentPrice,
    updated_at: new Date().toISOString(),
  };

  if (currentPrice > trade.high_water_mark) {
    updates.high_water_mark = currentPrice;
  }

  // Calculate P&L
  const pnlSol = (currentPrice - trade.entry_price) * trade.entry_token_amount;
  const pnlPercentage = ((currentPrice - trade.entry_price) / trade.entry_price) * 100;

  updates.pnl_sol = pnlSol;
  updates.pnl_percentage = pnlPercentage;

  const { data, error } = await supabase
    .from('portfolio_trades')
    .update(updates)
    .eq('id', tradeId)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function closePortfolioTrade(
  supabase: SupabaseDatabase,
  tradeId: string,
  exitPrice: number,
  exitReason: string
) {
  const { data, error } = await supabase
    .from('portfolio_trades')
    .update({
      status: 'CLOSED',
      exit_price: exitPrice,
      exit_timestamp: new Date().toISOString(),
      exit_reason: exitReason,
      updated_at: new Date().toISOString(),
    })
    .eq('id', tradeId)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function logNotification(
  supabase: SupabaseDatabase,
  notification: {
    signal_id: string;
    channel: 'TELEGRAM' | 'DISCORD' | 'CLI' | 'EMAIL';
    recipient?: string;
    status: 'PENDING' | 'SENT' | 'FAILED';
    message: string;
    error_message?: string;
  }
) {
  const { data, error } = await supabase
    .from('notification_log')
    .insert(notification)
    .select()
    .single();

  if (error) throw error;
  return data;
}

// Health check function
export async function checkDatabaseHealth(supabase: SupabaseDatabase): Promise<boolean> {
  try {
    const { error } = await supabase.from('tracked_wallets').select('id').limit(1);
    return !error;
  } catch {
    return false;
  }
}