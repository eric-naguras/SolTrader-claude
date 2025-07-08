import { getSupabaseClient } from './index';
import type { TrackedWallet, Token, WhaleTrade, TradeSignal, PortfolioTrade } from '@sonar/types';

export async function getActiveWallets(): Promise<TrackedWallet[]> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('tracked_wallets')
    .select('*')
    .eq('is_active', true);

  if (error) throw error;
  return data.map(row => ({
    ...row,
    created_at: new Date(row.created_at)
  }));
}

export async function upsertToken(token: Partial<Token> & { address: string }): Promise<void> {
  const supabase = getSupabaseClient();
  const { error } = await supabase
    .from('tokens')
    .upsert({
      address: token.address,
      symbol: token.symbol,
      name: token.name,
      metadata: token.metadata as any,
      last_seen: new Date().toISOString()
    }, {
      onConflict: 'address'
    });

  if (error) throw error;
}

export async function insertWhaleTrade(trade: Omit<WhaleTrade, 'id'>): Promise<void> {
  const supabase = getSupabaseClient();
  const { error } = await supabase
    .from('whale_trades')
    .insert({
      wallet_address: trade.wallet_address,
      coin_address: trade.coin_address,
      trade_type: trade.trade_type,
      sol_amount: trade.sol_amount,
      token_amount: trade.token_amount,
      transaction_hash: trade.transaction_hash,
      trade_timestamp: trade.trade_timestamp.toISOString()
    });

  if (error) throw error;
}

export async function createTradeSignal(signal: Omit<TradeSignal, 'id' | 'created_at'>): Promise<TradeSignal> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('trade_signals')
    .insert({
      coin_address: signal.coin_address,
      status: signal.status,
      trigger_reason: signal.trigger_reason,
      metadata: signal.metadata as any
    })
    .select()
    .single();

  if (error) throw error;
  return {
    ...data,
    created_at: new Date(data.created_at),
    closed_at: data.closed_at ? new Date(data.closed_at) : undefined
  };
}

export async function createPortfolioTrade(trade: Omit<PortfolioTrade, 'id'>): Promise<PortfolioTrade> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('portfolio_trades')
    .insert({
      signal_id: trade.signal_id,
      trade_mode: trade.trade_mode,
      coin_address: trade.coin_address,
      status: trade.status,
      entry_price: trade.entry_price,
      high_water_mark_price: trade.high_water_mark_price,
      entry_timestamp: trade.entry_timestamp?.toISOString(),
      exit_price: trade.exit_price,
      exit_timestamp: trade.exit_timestamp?.toISOString(),
      pnl_usd: trade.pnl_usd,
      exit_reason: trade.exit_reason
    })
    .select()
    .single();

  if (error) throw error;
  return {
    ...data,
    entry_timestamp: data.entry_timestamp ? new Date(data.entry_timestamp) : undefined,
    exit_timestamp: data.exit_timestamp ? new Date(data.exit_timestamp) : undefined
  };
}