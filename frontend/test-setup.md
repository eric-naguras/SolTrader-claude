# Database Testing Setup

## Prerequisites

1. **Create a Neon test branch:**
   ```bash
   neon branches create --name db-test
   ```

2. **Get the test branch connection string:**
   ```bash
   neon connection-string db-test
   ```

3. **Update your `.env` file:**
   ```bash
   # Replace the existing DATABASE_URL with the test branch connection string
   DATABASE_URL=<paste_the_connection_string_from_step_2>
   ```

## Create Database Schema

You'll need to create the `tracked_wallets` table in your test branch. Connect to your test branch and run:

```sql
CREATE TABLE IF NOT EXISTS tracked_wallets (
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

-- Create other required tables for full testing
CREATE TABLE IF NOT EXISTS trade_signals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS whale_trades (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

## Running Tests

1. **Run all tests:**
   ```bash
   npm run test
   ```

2. **Run tests in watch mode:**
   ```bash
   npm run test:watch
   ```

3. **Run specific test file:**
   ```bash
   bun test src/lib/database.test.ts
   ```

## What the Tests Cover

- ✅ Creating tracked wallets
- ✅ Reading wallets (all and by address)
- ✅ Updating wallet data
- ✅ Deleting wallets
- ✅ Toggling wallet status
- ✅ Duplicate address prevention
- ✅ Stats and analytics functions
- ✅ Edge cases and error handling
- ✅ Data validation

## After Testing

Once you've verified the database functions work correctly, you can:

1. **Switch back to your main branch:**
   ```bash
   # Update .env to use your main database
   DATABASE_URL=<your_main_database_url>
   ```

2. **Delete the test branch (optional):**
   ```bash
   neon branches delete db-test
   ```

## Expected Results

All tests should pass if your database functions are working correctly. If any tests fail, it indicates there are issues with:
- Database connection
- Schema structure
- Function implementations
- Environment configuration

Fix any failing tests before proceeding with frontend debugging.