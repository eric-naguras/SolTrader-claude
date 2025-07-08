-- Migration: 001_initial_schema.sql
-- Description: Initial database schema for Project Sonar Phase 1
-- Date: 2025-01-07

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "timescaledb";

-- Tracked whale wallets
CREATE TABLE IF NOT EXISTS tracked_wallets (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    address TEXT NOT NULL UNIQUE,
    alias TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    tags TEXT[] DEFAULT '{}',
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_tracked_wallets_active ON tracked_wallets(is_active);
CREATE INDEX IF NOT EXISTS idx_tracked_wallets_tags ON tracked_wallets USING GIN(tags);

-- Token metadata cache
CREATE TABLE IF NOT EXISTS tokens (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    address TEXT NOT NULL UNIQUE,
    symbol TEXT,
    name TEXT,
    decimals INTEGER DEFAULT 9,
    metadata JSONB DEFAULT '{}',
    last_seen TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tokens_address ON tokens(address);

-- Whale trade logs (TimescaleDB hypertable)
CREATE TABLE IF NOT EXISTS whale_trades (
    id BIGSERIAL,
    wallet_id UUID NOT NULL REFERENCES tracked_wallets(id),
    wallet_address TEXT NOT NULL,
    token_id UUID REFERENCES tokens(id),
    token_address TEXT NOT NULL,
    trade_type TEXT NOT NULL CHECK (trade_type IN ('BUY', 'SELL')),
    sol_amount NUMERIC(20, 9),
    token_amount NUMERIC(40, 9),
    usd_value NUMERIC(20, 2),
    price_per_token NUMERIC(40, 18),
    transaction_hash TEXT NOT NULL UNIQUE,
    block_slot BIGINT,
    trade_timestamp TIMESTAMPTZ NOT NULL,
    raw_data JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (id, trade_timestamp)
);

-- Convert to hypertable for time-series optimization
SELECT create_hypertable('whale_trades', 'trade_timestamp', if_not_exists => TRUE);

-- Create composite indexes for common queries
CREATE INDEX IF NOT EXISTS idx_whale_trades_wallet_time ON whale_trades(wallet_address, trade_timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_whale_trades_token_time ON whale_trades(token_address, trade_timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_whale_trades_type_time ON whale_trades(trade_type, trade_timestamp DESC);

-- Signal configuration
CREATE TABLE IF NOT EXISTS signal_rules (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    min_whales INTEGER DEFAULT 3,
    time_window_hours INTEGER DEFAULT 1,
    min_total_sol NUMERIC(20, 9) DEFAULT 10,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Generated trading signals
CREATE TABLE IF NOT EXISTS trade_signals (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    token_id UUID REFERENCES tokens(id),
    token_address TEXT NOT NULL,
    rule_id UUID REFERENCES signal_rules(id),
    status TEXT DEFAULT 'OPEN' CHECK (status IN ('OPEN', 'EXECUTED', 'EXPIRED', 'CANCELLED')),
    trigger_reason TEXT,
    whale_count INTEGER,
    total_sol_amount NUMERIC(20, 9),
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    closed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_trade_signals_status ON trade_signals(status);
CREATE INDEX IF NOT EXISTS idx_trade_signals_created ON trade_signals(created_at DESC);

-- Paper trading portfolio
CREATE TABLE IF NOT EXISTS portfolio_trades (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    signal_id UUID REFERENCES trade_signals(id),
    token_id UUID REFERENCES tokens(id),
    token_address TEXT NOT NULL,
    trade_mode TEXT DEFAULT 'PAPER' CHECK (trade_mode IN ('PAPER', 'LIVE')),
    status TEXT DEFAULT 'OPEN' CHECK (status IN ('OPEN', 'CLOSED')),
    entry_price NUMERIC(40, 18),
    entry_sol_amount NUMERIC(20, 9) DEFAULT 1.0,
    entry_token_amount NUMERIC(40, 9),
    entry_timestamp TIMESTAMPTZ DEFAULT NOW(),
    current_price NUMERIC(40, 18),
    high_water_mark NUMERIC(40, 18),
    exit_price NUMERIC(40, 18),
    exit_timestamp TIMESTAMPTZ,
    pnl_sol NUMERIC(20, 9),
    pnl_percentage NUMERIC(10, 2),
    exit_reason TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_portfolio_trades_status ON portfolio_trades(status);
CREATE INDEX IF NOT EXISTS idx_portfolio_trades_signal ON portfolio_trades(signal_id);

-- Notification log
CREATE TABLE IF NOT EXISTS notification_log (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    signal_id UUID REFERENCES trade_signals(id),
    channel TEXT NOT NULL CHECK (channel IN ('TELEGRAM', 'DISCORD', 'CLI', 'EMAIL')),
    recipient TEXT,
    status TEXT DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'SENT', 'FAILED')),
    message TEXT,
    error_message TEXT,
    sent_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create update trigger for updated_at columns
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_tracked_wallets_updated_at BEFORE UPDATE ON tracked_wallets
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_portfolio_trades_updated_at BEFORE UPDATE ON portfolio_trades
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();