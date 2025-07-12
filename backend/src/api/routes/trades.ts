import { Hono } from 'hono';
import { supabase } from '../../lib/supabase.js';

export const tradeRoutes = new Hono();

// Get active positions
tradeRoutes.get('/positions', async (c) => {
  const { data, error } = await supabase
    .from('portfolio_trades')
    .select(`
      *,
      trade_signal:signal_id (
        coin_address,
        trigger_reason,
        metadata
      ),
      token:tokens!portfolio_trades_coin_address_fkey (
        symbol,
        name
      )
    `)
    .eq('status', 'OPEN')
    .order('entry_timestamp', { ascending: false });

  if (error) {
    return c.json({ error: error.message }, 500);
  }

  return c.json({ positions: data });
});

// Close a position
tradeRoutes.post('/:id/close', async (c) => {
  const id = c.req.param('id');
  const body = await c.req.json();
  const { exitPrice, exitReason } = body;

  // Get current position
  const { data: position } = await supabase
    .from('portfolio_trades')
    .select('*')
    .eq('id', id)
    .single();

  if (!position) {
    return c.json({ error: 'Position not found' }, 404);
  }

  if (position.status !== 'OPEN') {
    return c.json({ error: 'Position already closed' }, 400);
  }

  // Calculate PnL
  const pnl_percentage = exitPrice && position.entry_price 
    ? ((exitPrice - position.entry_price) / position.entry_price) * 100
    : null;

  // Update position
  const { data, error } = await supabase
    .from('portfolio_trades')
    .update({
      status: 'CLOSED',
      exit_price: exitPrice,
      exit_timestamp: new Date().toISOString(),
      pnl_percentage,
      manual_close: true,
      metadata: {
        ...position.metadata,
        exit_reason: exitReason || 'Manual close via UI'
      }
    })
    .eq('id', id)
    .select()
    .single();

  if (error) {
    return c.json({ error: error.message }, 500);
  }

  return c.json({ position: data });
});

// Get trade history
tradeRoutes.get('/history', async (c) => {
  const limit = Number(c.req.query('limit')) || 50;
  const offset = Number(c.req.query('offset')) || 0;

  const { data, error, count } = await supabase
    .from('portfolio_trades')
    .select(`
      *,
      trade_signal:signal_id (
        coin_address,
        trigger_reason
      ),
      token:tokens!portfolio_trades_coin_address_fkey (
        symbol,
        name
      )
    `, { count: 'exact' })
    .order('entry_timestamp', { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) {
    return c.json({ error: error.message }, 500);
  }

  return c.json({ 
    trades: data,
    total: count,
    limit,
    offset
  });
});

// Get performance stats
tradeRoutes.get('/stats', async (c) => {
  const { data: trades, error } = await supabase
    .from('portfolio_trades')
    .select('status, pnl_percentage, trade_amount_sol')
    .eq('status', 'CLOSED');

  if (error) {
    return c.json({ error: error.message }, 500);
  }

  const stats = {
    totalTrades: trades.length,
    winningTrades: trades.filter(t => t.pnl_percentage && t.pnl_percentage > 0).length,
    losingTrades: trades.filter(t => t.pnl_percentage && t.pnl_percentage < 0).length,
    winRate: 0,
    totalPnL: 0,
    avgWin: 0,
    avgLoss: 0
  };

  if (stats.totalTrades > 0) {
    stats.winRate = (stats.winningTrades / stats.totalTrades) * 100;
    
    const wins = trades.filter(t => t.pnl_percentage && t.pnl_percentage > 0);
    const losses = trades.filter(t => t.pnl_percentage && t.pnl_percentage < 0);
    
    if (wins.length > 0) {
      stats.avgWin = wins.reduce((sum, t) => sum + (t.pnl_percentage || 0), 0) / wins.length;
    }
    
    if (losses.length > 0) {
      stats.avgLoss = losses.reduce((sum, t) => sum + (t.pnl_percentage || 0), 0) / losses.length;
    }
    
    stats.totalPnL = trades.reduce((sum, t) => sum + (t.pnl_percentage || 0), 0);
  }

  return c.json({ stats });
});