import dotenv from 'dotenv';
import { Client } from 'pg';
import { createSupabaseClient } from '@sonar/shared';

// Load environment variables
dotenv.config();

async function resetDatabase() {
  const databaseUrl = process.env.SUPABASE_URL?.replace('https://', 'postgresql://postgres:')
    .replace('.supabase.co', '.supabase.co:5432/postgres');
  
  if (!databaseUrl) {
    throw new Error('SUPABASE_URL not set');
  }

  const client = new Client({
    connectionString: databaseUrl,
    ssl: { rejectUnauthorized: false },
  });

  console.log('WARNING: This will delete all data in the database!');
  console.log('Press Ctrl+C to cancel, or wait 5 seconds to continue...');
  
  await new Promise(resolve => setTimeout(resolve, 5000));

  try {
    await client.connect();
    console.log('Connected to database');

    // Drop all tables in reverse order of dependencies
    const tables = [
      'notification_log',
      'portfolio_trades',
      'trade_signals',
      'whale_trades',
      'signal_rules',
      'tokens',
      'tracked_wallets',
      'migrations',
    ];

    for (const table of tables) {
      try {
        await client.query(`DROP TABLE IF EXISTS ${table} CASCADE`);
        console.log(`✓ Dropped table: ${table}`);
      } catch (error) {
        console.error(`Failed to drop ${table}:`, error);
      }
    }

    // Drop functions
    try {
      await client.query('DROP FUNCTION IF EXISTS process_whale_trade() CASCADE');
      console.log('✓ Dropped function: process_whale_trade');
    } catch (error) {
      console.error('Failed to drop function:', error);
    }

    try {
      await client.query('DROP FUNCTION IF EXISTS update_updated_at_column() CASCADE');
      console.log('✓ Dropped function: update_updated_at_column');
    } catch (error) {
      console.error('Failed to drop function:', error);
    }

    console.log('\nDatabase reset completed. Run migrations to recreate schema.');
  } catch (error) {
    console.error('Reset failed:', error);
    process.exit(1);
  } finally {
    await client.end();
  }
}

// Run reset
resetDatabase().catch(console.error);