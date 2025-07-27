-- Migration: Create trader-wallet relationship structure
-- This migration separates traders from wallets, allowing one trader to own multiple wallets

-- 1. Create traders table
CREATE TABLE IF NOT EXISTS traders (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    name text NOT NULL,
    alias text,
    total_balance numeric DEFAULT 0,
    tags text[],
    ui_color text DEFAULT '#4338ca',
    twitter_handle text,
    telegram_channel text,
    streaming_channel text,
    image_data text,
    notes text,
    is_active boolean DEFAULT true,
    metadata jsonb DEFAULT '{}',
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);

-- Create indexes for traders
CREATE INDEX IF NOT EXISTS idx_traders_name ON traders USING btree (name);
CREATE INDEX IF NOT EXISTS idx_traders_alias ON traders USING btree (alias);
CREATE INDEX IF NOT EXISTS idx_traders_active ON traders USING btree (is_active);
CREATE INDEX IF NOT EXISTS idx_traders_created_at ON traders USING btree (created_at DESC);

-- 2. Create temporary column for migration
ALTER TABLE tracked_wallets ADD COLUMN IF NOT EXISTS trader_id uuid;

-- 3. Create traders from existing wallets (1 trader per wallet initially)
INSERT INTO traders (
    name,
    alias,
    tags,
    ui_color,
    twitter_handle,
    telegram_channel,
    streaming_channel,
    image_data,
    notes,
    is_active,
    total_balance
)
SELECT 
    COALESCE(alias, 'Trader ' || substring(address, 1, 8)),  -- Use alias as name, or create from address
    alias,
    tags,
    ui_color,
    twitter_handle,
    telegram_channel,
    streaming_channel,
    image_data,
    notes,
    is_active,
    COALESCE(sol_balance, 0)
FROM tracked_wallets;

-- 4. Update tracked_wallets with trader_id
UPDATE tracked_wallets tw
SET trader_id = t.id
FROM traders t
WHERE tw.alias = t.alias 
   OR (tw.alias IS NULL AND t.name = 'Trader ' || substring(tw.address, 1, 8));

-- 5. Make trader_id NOT NULL and add foreign key
ALTER TABLE tracked_wallets ALTER COLUMN trader_id SET NOT NULL;
ALTER TABLE tracked_wallets ADD CONSTRAINT fk_trader_id FOREIGN KEY (trader_id) REFERENCES traders(id);

-- 6. Create index on trader_id
CREATE INDEX IF NOT EXISTS idx_tracked_wallets_trader_id ON tracked_wallets USING btree (trader_id);

-- 7. Drop columns that moved to traders table
ALTER TABLE tracked_wallets DROP COLUMN IF EXISTS alias;
ALTER TABLE tracked_wallets DROP COLUMN IF EXISTS tags;
ALTER TABLE tracked_wallets DROP COLUMN IF EXISTS ui_color;
ALTER TABLE tracked_wallets DROP COLUMN IF EXISTS twitter_handle;
ALTER TABLE tracked_wallets DROP COLUMN IF EXISTS telegram_channel;
ALTER TABLE tracked_wallets DROP COLUMN IF EXISTS streaming_channel;
ALTER TABLE tracked_wallets DROP COLUMN IF EXISTS image_data;
ALTER TABLE tracked_wallets DROP COLUMN IF EXISTS notes;

-- 8. Create wallet_ownership_conflicts table for tracking potential issues
CREATE TABLE IF NOT EXISTS wallet_ownership_conflicts (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    wallet_address text NOT NULL,
    existing_trader_id uuid NOT NULL,
    conflicting_trader_id uuid NOT NULL,
    conflict_reason text NOT NULL,
    transaction_hash text,
    transfer_direction text CHECK (transfer_direction IN ('FROM_EXISTING', 'TO_EXISTING')),
    transfer_amount numeric,
    detected_at timestamp with time zone DEFAULT now(),
    resolved boolean DEFAULT false,
    resolution_notes text,
    resolved_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT fk_existing_trader FOREIGN KEY (existing_trader_id) REFERENCES traders(id),
    CONSTRAINT fk_conflicting_trader FOREIGN KEY (conflicting_trader_id) REFERENCES traders(id)
);

-- Create indexes for conflicts table
CREATE INDEX IF NOT EXISTS idx_conflicts_wallet ON wallet_ownership_conflicts USING btree (wallet_address);
CREATE INDEX IF NOT EXISTS idx_conflicts_resolved ON wallet_ownership_conflicts USING btree (resolved);
CREATE INDEX IF NOT EXISTS idx_conflicts_detected_at ON wallet_ownership_conflicts USING btree (detected_at DESC);

-- 9. Update recent_whale_trades view to use trader information
DROP VIEW IF EXISTS recent_whale_trades;
CREATE VIEW recent_whale_trades AS
SELECT wt.id,
    wt.wallet_address,
    wt.coin_address,
    wt.trade_type,
    wt.sol_amount,
    wt.token_amount,
    wt.transaction_hash,
    wt.trade_timestamp,
    wt.transaction_type,
    wt.counterparty_address,
    tr.alias AS wallet_alias,
    tr.ui_color AS wallet_color,
    tr.twitter_handle,
    tr.telegram_channel,
    tr.streaming_channel,
    tr.image_data,
    tw.is_active AS wallet_is_active,
    t.symbol AS token_symbol,
    t.name AS token_name
FROM whale_trades wt
    JOIN tracked_wallets tw ON wt.wallet_address = tw.address
    JOIN traders tr ON tw.trader_id = tr.id
    LEFT JOIN tokens t ON wt.coin_address = t.address
ORDER BY wt.trade_timestamp DESC
LIMIT 100;

-- 10. Create function to update trader total balance
CREATE OR REPLACE FUNCTION update_trader_balance(trader_id_param uuid)
RETURNS void AS $$
BEGIN
    UPDATE traders
    SET total_balance = (
        SELECT COALESCE(SUM(sol_balance), 0)
        FROM tracked_wallets
        WHERE trader_id = trader_id_param
    ),
    updated_at = now()
    WHERE id = trader_id_param;
END;
$$ LANGUAGE plpgsql;

-- 11. Create trigger to update trader balance when wallet balance changes
CREATE OR REPLACE FUNCTION update_trader_balance_trigger()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'UPDATE' AND OLD.sol_balance IS DISTINCT FROM NEW.sol_balance THEN
        PERFORM update_trader_balance(NEW.trader_id);
    ELSIF TG_OP = 'INSERT' THEN
        PERFORM update_trader_balance(NEW.trader_id);
    ELSIF TG_OP = 'DELETE' THEN
        PERFORM update_trader_balance(OLD.trader_id);
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_trader_balance
AFTER INSERT OR UPDATE OR DELETE ON tracked_wallets
FOR EACH ROW
EXECUTE FUNCTION update_trader_balance_trigger();

-- Add comments
COMMENT ON TABLE traders IS 'Traders who own one or more wallets';
COMMENT ON TABLE wallet_ownership_conflicts IS 'Log of conflicts when a wallet appears to belong to multiple traders';
COMMENT ON COLUMN wallet_ownership_conflicts.transfer_direction IS 'FROM_EXISTING: existing trader sent to conflicting trader, TO_EXISTING: conflicting trader sent to existing trader';

-- 12. Add WalletUpdater service to service_configs
INSERT INTO service_configs (service_name, enabled, log_categories)
VALUES ('WalletUpdater', true, '{"debug": false, "wallet": true, "system": true}'::jsonb)
ON CONFLICT (service_name) DO NOTHING;

-- 13. Create view for wallets with trader information
CREATE OR REPLACE VIEW wallets_with_traders AS
SELECT 
  tw.id,
  tw.address,
  tw.is_active,
  tw.sol_balance,
  tw.last_balance_check,
  tw.created_at,
  tw.updated_at,
  tw.metadata,
  tw.trader_id,
  t.name as trader_name,
  t.alias as trader_alias,
  t.ui_color as trader_color,
  t.twitter_handle,
  t.telegram_channel,
  t.streaming_channel,
  t.image_data,
  t.notes as trader_notes,
  t.tags as trader_tags,
  t.is_active as trader_is_active,
  t.total_balance as trader_total_balance,
  EXISTS (
    SELECT 1 FROM wallet_ownership_conflicts woc
    WHERE (woc.existing_trader_id = t.id OR woc.conflicting_trader_id = t.id)
    AND woc.resolved = false
  ) as has_conflicts
FROM tracked_wallets tw
JOIN traders t ON tw.trader_id = t.id;