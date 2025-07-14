-- Database updates for the new UI - Final version that matches actual schema
-- This script safely adds missing columns and tables

-- Add UI-specific fields to existing tables (if they don't exist)
DO $$ 
BEGIN
    -- Add ui_color to tracked_wallets if missing
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                  WHERE table_name = 'tracked_wallets' AND column_name = 'ui_color') THEN
        ALTER TABLE tracked_wallets ADD COLUMN ui_color TEXT DEFAULT '#4338ca';
    END IF;
    
    -- Add user_notes to trade_signals if missing
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                  WHERE table_name = 'trade_signals' AND column_name = 'user_notes') THEN
        ALTER TABLE trade_signals ADD COLUMN user_notes TEXT;
    END IF;
    
    -- Add manual_close to portfolio_trades if missing
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                  WHERE table_name = 'portfolio_trades' AND column_name = 'manual_close') THEN
        ALTER TABLE portfolio_trades ADD COLUMN manual_close BOOLEAN DEFAULT FALSE;
    END IF;
    
    -- Add trade_amount_sol to portfolio_trades if missing (for tracking position size)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                  WHERE table_name = 'portfolio_trades' AND column_name = 'trade_amount_sol') THEN
        ALTER TABLE portfolio_trades ADD COLUMN trade_amount_sol NUMERIC;
    END IF;
    
    -- Add pnl_percentage to portfolio_trades if missing
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                  WHERE table_name = 'portfolio_trades' AND column_name = 'pnl_percentage') THEN
        ALTER TABLE portfolio_trades ADD COLUMN pnl_percentage NUMERIC;
    END IF;
    
    -- Add current_price to portfolio_trades if missing (for live tracking)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                  WHERE table_name = 'portfolio_trades' AND column_name = 'current_price') THEN
        ALTER TABLE portfolio_trades ADD COLUMN current_price NUMERIC;
    END IF;
END $$;

-- Create service heartbeats table for monitoring
CREATE TABLE IF NOT EXISTS service_heartbeats (
    service_name TEXT PRIMARY KEY,
    last_heartbeat TIMESTAMPTZ NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('healthy', 'unhealthy', 'stopped')),
    metadata JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create views for dashboard (drop and recreate to handle column changes)
DROP VIEW IF EXISTS dashboard_stats;
CREATE VIEW dashboard_stats AS
SELECT 
    (SELECT COUNT(*) FROM tracked_wallets WHERE is_active = true) as active_wallets,
    (SELECT COUNT(*) FROM portfolio_trades WHERE status = 'OPEN') as open_positions,
    (SELECT COUNT(*) FROM trade_signals WHERE created_at > NOW() - INTERVAL '24 hours') as signals_today,
    (SELECT 
        CASE 
            WHEN COUNT(*) > 0 THEN 
                ROUND((COUNT(*) FILTER (WHERE pnl_percentage > 0)::NUMERIC / COUNT(*)) * 100, 2)
            ELSE 0 
        END 
     FROM portfolio_trades 
     WHERE status = 'CLOSED' 
       AND pnl_percentage IS NOT NULL) as win_rate,
    (SELECT COALESCE(ROUND(SUM(pnl_percentage), 2), 0) 
     FROM portfolio_trades 
     WHERE status = 'CLOSED'
       AND pnl_percentage IS NOT NULL) as total_pnl;

-- Create view for recent whale trades
DROP VIEW IF EXISTS recent_whale_trades;
CREATE VIEW recent_whale_trades AS
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
DROP VIEW IF EXISTS active_signals_detailed;
CREATE VIEW active_signals_detailed AS
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

-- Enable real-time for new tables (only if not already enabled)
DO $$
BEGIN
    -- Check if service_heartbeats is already in the publication
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' 
        AND tablename = 'service_heartbeats'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE service_heartbeats;
    END IF;
END $$;

-- Create indexes for performance (IF NOT EXISTS)
CREATE INDEX IF NOT EXISTS idx_service_heartbeats_last ON service_heartbeats (last_heartbeat DESC);
CREATE INDEX IF NOT EXISTS idx_portfolio_trades_manual_close ON portfolio_trades (manual_close) WHERE manual_close = true;

-- Update pnl_percentage for existing closed trades based on entry/exit prices
UPDATE portfolio_trades 
SET pnl_percentage = CASE 
    WHEN entry_price > 0 AND exit_price > 0 THEN 
        ROUND(((exit_price - entry_price) / entry_price) * 100, 2)
    ELSE NULL
END
WHERE status = 'CLOSED' 
  AND pnl_percentage IS NULL 
  AND entry_price IS NOT NULL 
  AND exit_price IS NOT NULL;