#!/usr/bin/env bun
import { database } from '../lib/database.js';

const migrationSql = `
-- Migration: Expand transaction types in whale_trades table

-- Drop the existing constraint
ALTER TABLE whale_trades DROP CONSTRAINT IF EXISTS whale_trades_trade_type_check;

-- Add the new constraint with expanded transaction types
ALTER TABLE whale_trades ADD CONSTRAINT whale_trades_trade_type_check 
CHECK ((trade_type = ANY (ARRAY[
    'BUY'::text,           -- Swap: SOL -> meme token  
    'SELL'::text,          -- Swap: meme token -> SOL
    'TRANSFER_OUT'::text,  -- Sending SOL/tokens to another wallet
    'TRANSFER_IN'::text,   -- Receiving SOL/tokens from another wallet
    'OTHER'::text          -- Other transaction types
])));

-- Add a new column for more detailed transaction information
ALTER TABLE whale_trades ADD COLUMN IF NOT EXISTS transaction_type text;
ALTER TABLE whale_trades ADD COLUMN IF NOT EXISTS counterparty_address text;

-- Add comments to explain the columns
COMMENT ON COLUMN whale_trades.trade_type IS 'High-level transaction category: BUY, SELL, TRANSFER_OUT, TRANSFER_IN, OTHER';
COMMENT ON COLUMN whale_trades.transaction_type IS 'Detailed transaction type: swap, transfer, etc.';
COMMENT ON COLUMN whale_trades.counterparty_address IS 'Address of the other party in transfers (null for swaps)';

-- Add indexes for the new columns
CREATE INDEX IF NOT EXISTS idx_whale_trades_transaction_type ON whale_trades USING btree (transaction_type);
CREATE INDEX IF NOT EXISTS idx_whale_trades_counterparty ON whale_trades USING btree (counterparty_address);
`;

async function runMigration() {
  try {
    console.log('Running migration to expand transaction types...');
    
    // Run each migration step
    console.log('1. Dropping existing constraint...');
    await (database as any).sql`ALTER TABLE whale_trades DROP CONSTRAINT IF EXISTS whale_trades_trade_type_check`;
    
    console.log('2. Adding new constraint with expanded types...');
    await (database as any).sql`
      ALTER TABLE whale_trades ADD CONSTRAINT whale_trades_trade_type_check 
      CHECK ((trade_type = ANY (ARRAY[
          'BUY'::text,
          'SELL'::text,
          'TRANSFER_OUT'::text,
          'TRANSFER_IN'::text,
          'OTHER'::text
      ])))
    `;
    
    console.log('3. Adding transaction_type column...');
    await (database as any).sql`ALTER TABLE whale_trades ADD COLUMN IF NOT EXISTS transaction_type text`;
    
    console.log('4. Adding counterparty_address column...');
    await (database as any).sql`ALTER TABLE whale_trades ADD COLUMN IF NOT EXISTS counterparty_address text`;
    
    console.log('5. Adding column comments...');
    await (database as any).sql`COMMENT ON COLUMN whale_trades.trade_type IS 'High-level transaction category: BUY, SELL, TRANSFER_OUT, TRANSFER_IN, OTHER'`;
    await (database as any).sql`COMMENT ON COLUMN whale_trades.transaction_type IS 'Detailed transaction type: swap, transfer, etc.'`;
    await (database as any).sql`COMMENT ON COLUMN whale_trades.counterparty_address IS 'Address of the other party in transfers (null for swaps)'`;
    
    console.log('6. Adding indexes...');
    await (database as any).sql`CREATE INDEX IF NOT EXISTS idx_whale_trades_transaction_type ON whale_trades USING btree (transaction_type)`;
    await (database as any).sql`CREATE INDEX IF NOT EXISTS idx_whale_trades_counterparty ON whale_trades USING btree (counterparty_address)`;
    
    console.log('✅ Migration completed successfully!');
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
}

runMigration();