-- Database updates for the new UI
-- Run these in your Supabase SQL editor

-- Add UI-specific fields to existing tables
ALTER TABLE tracked_wallets ADD COLUMN IF NOT EXISTS ui_color TEXT DEFAULT '#4338ca';
ALTER TABLE trade_signals ADD COLUMN IF NOT EXISTS user_notes TEXT;
ALTER TABLE portfolio_trades ADD COLUMN IF NOT EXISTS manual_close BOOLEAN DEFAULT FALSE;

-- Create service heartbeats table for monitoring
CREATE TABLE IF NOT EXISTS service_heartbeats (
    service_name TEXT PRIMARY KEY,
    last_heartbeat TIMESTAMPTZ NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('healthy', 'unhealthy', 'stopped')),
    metadata JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create views for dashboard
CREATE OR REPLACE VIEW dashboard_stats AS
SELECT 
    (SELECT COUNT(*) FROM tracked_wallets WHERE is_active = true) as active_wallets,
    (SELECT COUNT(*) FROM portfolio_trades WHERE status = 'OPEN') as open_positions,
    (SELECT COUNT(*) FROM trade_signals WHERE created_at > NOW() - INTERVAL '24 hours') as signals_today,
    (SELECT 
        CASE 
            WHEN COUNT(*) > 0 THEN ROUND((COUNT(*) FILTER (WHERE pnl_percentage > 0)::NUMERIC / COUNT(*)) * 100, 2)
            ELSE 0 
        END 
     FROM portfolio_trades WHERE status = 'CLOSED') as win_rate,
    (SELECT COALESCE(ROUND(SUM(pnl_percentage), 2), 0) FROM portfolio_trades WHERE status = 'CLOSED') as total_pnl;

-- Create view for recent whale trades
CREATE OR REPLACE VIEW recent_whale_trades AS
SELECT 
    wt.*,
    tw.alias as wallet_alias,
    tw.ui_color as wallet_color,
    t.symbol as token_symbol,
    t.name as token_name
FROM whale_trades wt
JOIN tracked_wallets tw ON wt.wallet_address = tw.address
LEFT JOIN tokens t ON wt.coin_address = t.address
ORDER BY wt.trade_timestamp DESC
LIMIT 100;

-- Create view for active signals with details
CREATE OR REPLACE VIEW active_signals_detailed AS
SELECT 
    ts.*,
    t.symbol as token_symbol,
    t.name as token_name,
    (
        SELECT COUNT(DISTINCT wallet_address) 
        FROM whale_trades wt 
        WHERE wt.coin_address = ts.coin_address 
        AND wt.trade_timestamp >= ts.created_at - INTERVAL '1 hour'
        AND wt.trade_type = 'BUY'
    ) as whale_count,
    (
        SELECT STRING_AGG(DISTINCT COALESCE(tw.alias, wt.wallet_address), ', ')
        FROM whale_trades wt
        JOIN tracked_wallets tw ON wt.wallet_address = tw.address
        WHERE wt.coin_address = ts.coin_address 
        AND wt.trade_timestamp >= ts.created_at - INTERVAL '1 hour'
        AND wt.trade_type = 'BUY'
    ) as whale_names
FROM trade_signals ts
LEFT JOIN tokens t ON ts.coin_address = t.address
WHERE ts.status = 'OPEN'
ORDER BY ts.created_at DESC;

-- Enable real-time for new tables
ALTER PUBLICATION supabase_realtime ADD TABLE service_heartbeats;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_service_heartbeats_last ON service_heartbeats (last_heartbeat DESC);
CREATE INDEX IF NOT EXISTS idx_portfolio_trades_manual_close ON portfolio_trades (manual_close) WHERE manual_close = true;