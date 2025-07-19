-- Test Database Schema for SolTrader Platform
-- Run this in your Neon test branch

-- Drop existing tables if they exist (for clean testing)
DROP TABLE IF EXISTS tracked_wallets CASCADE;
DROP TABLE IF EXISTS trade_signals CASCADE;
DROP TABLE IF EXISTS whale_trades CASCADE;

-- Create tracked_wallets table
CREATE TABLE tracked_wallets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  address TEXT UNIQUE NOT NULL,
  alias TEXT NOT NULL,
  tags TEXT[] DEFAULT '{}',
  ui_color TEXT DEFAULT '#4338ca',
  twitter_handle TEXT,
  telegram_channel TEXT,
  streaming_channel TEXT,
  image_data TEXT,
  notes TEXT,
  sol_balance DECIMAL(20,9),
  last_balance_check TIMESTAMP WITH TIME ZONE,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create trade_signals table (for stats testing)
CREATE TABLE trade_signals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create whale_trades table (for stats testing)
CREATE TABLE whale_trades (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX idx_tracked_wallets_address ON tracked_wallets(address);
CREATE INDEX idx_tracked_wallets_is_active ON tracked_wallets(is_active);
CREATE INDEX idx_tracked_wallets_created_at ON tracked_wallets(created_at);
CREATE INDEX idx_trade_signals_created_at ON trade_signals(created_at);
CREATE INDEX idx_whale_trades_created_at ON whale_trades(created_at);

-- Insert some sample data for testing (optional)
INSERT INTO trade_signals (created_at) VALUES 
  (NOW() - INTERVAL '1 hour'),
  (NOW() - INTERVAL '2 hours'),
  (NOW() - INTERVAL '25 hours'); -- This one is older than 24h

INSERT INTO whale_trades (created_at) VALUES 
  (NOW() - INTERVAL '30 minutes'),
  (NOW() - INTERVAL '1 hour'),
  (NOW() - INTERVAL '26 hours'); -- This one is older than 24h

-- Verify tables were created successfully
SELECT 'tracked_wallets' as table_name, COUNT(*) as row_count FROM tracked_wallets
UNION ALL
SELECT 'trade_signals', COUNT(*) FROM trade_signals
UNION ALL  
SELECT 'whale_trades', COUNT(*) FROM whale_trades;