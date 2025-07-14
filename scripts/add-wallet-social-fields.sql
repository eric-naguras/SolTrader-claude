-- Add social media and additional fields to tracked_wallets table

-- Add new columns
ALTER TABLE tracked_wallets
ADD COLUMN IF NOT EXISTS twitter_handle TEXT,
ADD COLUMN IF NOT EXISTS telegram_channel TEXT,
ADD COLUMN IF NOT EXISTS streaming_channel TEXT,
ADD COLUMN IF NOT EXISTS image_data TEXT, -- Base64 encoded image data
ADD COLUMN IF NOT EXISTS notes TEXT,
ADD COLUMN IF NOT EXISTS sol_balance DECIMAL(20, 9) DEFAULT 0,
ADD COLUMN IF NOT EXISTS last_balance_check TIMESTAMP WITH TIME ZONE;

-- Add indexes for searching
CREATE INDEX IF NOT EXISTS idx_tracked_wallets_twitter ON tracked_wallets(twitter_handle) WHERE twitter_handle IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_tracked_wallets_telegram ON tracked_wallets(telegram_channel) WHERE telegram_channel IS NOT NULL;