-- Add missing fields to tracked_wallets table

-- Add is_verified column if it doesn't exist
ALTER TABLE tracked_wallets
ADD COLUMN IF NOT EXISTS is_verified BOOLEAN DEFAULT FALSE;

-- Add price_usd to whale_trades if it doesn't exist
ALTER TABLE whale_trades
ADD COLUMN IF NOT EXISTS price_usd DECIMAL(20, 9);

-- Recreate the recent_whale_trades view to ensure all fields are present
DROP VIEW IF EXISTS recent_whale_trades;
CREATE VIEW recent_whale_trades AS
SELECT 
    wt.*,
    tw.alias as wallet_alias,
    tw.ui_color as wallet_color,
    tw.twitter_handle,
    tw.telegram_channel,
    tw.streaming_channel,
    tw.image_data,
    COALESCE(tw.is_verified, FALSE) as is_verified,
    t.symbol as token_symbol,
    t.name as token_name
FROM whale_trades wt
JOIN tracked_wallets tw ON wt.wallet_address = tw.address
LEFT JOIN tokens t ON wt.coin_address = t.address
ORDER BY wt.trade_timestamp DESC
LIMIT 100;