import dotenv from 'dotenv';
import { createSupabaseClient, upsertWallet } from '@sonar/shared';

// Load environment variables
dotenv.config();

async function seedDatabase() {
  const supabase = createSupabaseClient({
    supabaseUrl: process.env.SUPABASE_URL!,
    supabaseServiceKey: process.env.SUPABASE_SERVICE_KEY!,
  });

  console.log('Starting database seeding...');

  try {
    // Seed whale wallets
    const testWallets = [
      {
        address: '5xoBq7f3bLZzC1SUAo9GiTBJyDoku8C5WvFWJRgKTYCr',
        alias: 'Test Whale 1',
        is_active: true,
        tags: ['test', 'whale', 'high-volume'],
        metadata: { test: true, volume: 'high' },
      },
      {
        address: '8AKJHSLJf3JfkDJ39fjJSDFjksjdf93jfJFKDJ39fSD',
        alias: 'Test Whale 2',
        is_active: true,
        tags: ['test', 'whale', 'medium-volume'],
        metadata: { test: true, volume: 'medium' },
      },
      {
        address: '9BKJHSLJf3JfkDJ39fjJSDFjksjdf93jfJFKDJ39fTE',
        alias: 'Test Whale 3',
        is_active: true,
        tags: ['test', 'whale', 'degen'],
        metadata: { test: true, style: 'degen' },
      },
    ];

    for (const wallet of testWallets) {
      await upsertWallet(supabase, wallet);
      console.log(`✓ Created wallet: ${wallet.alias}`);
    }

    // Seed common tokens
    const tokens = [
      {
        address: 'So11111111111111111111111111111111111111112',
        symbol: 'SOL',
        name: 'Wrapped SOL',
        decimals: 9,
        metadata: { type: 'native' },
      },
      {
        address: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
        symbol: 'USDC',
        name: 'USD Coin',
        decimals: 6,
        metadata: { type: 'stablecoin' },
      },
      {
        address: 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB',
        symbol: 'USDT',
        name: 'Tether USD',
        decimals: 6,
        metadata: { type: 'stablecoin' },
      },
      {
        address: 'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263',
        symbol: 'BONK',
        name: 'Bonk',
        decimals: 5,
        metadata: { type: 'memecoin' },
      },
    ];

    for (const token of tokens) {
      const { error } = await supabase
        .from('tokens')
        .upsert(token, { onConflict: 'address' });
      
      if (!error) {
        console.log(`✓ Created token: ${token.symbol}`);
      }
    }

    // Seed signal rules
    const rules = [
      {
        name: 'Default Rule',
        min_whales: 3,
        time_window_hours: 1,
        min_total_sol: 10.0,
        is_active: true,
      },
      {
        name: 'Aggressive Signal',
        min_whales: 2,
        time_window_hours: 1,
        min_total_sol: 5.0,
        is_active: true,
      },
      {
        name: 'Conservative Signal',
        min_whales: 5,
        time_window_hours: 2,
        min_total_sol: 50.0,
        is_active: true,
      },
      {
        name: 'Quick Scalp',
        min_whales: 2,
        time_window_hours: 0.5,
        min_total_sol: 3.0,
        is_active: false,
      },
    ];

    for (const rule of rules) {
      const { error } = await supabase
        .from('signal_rules')
        .upsert(rule, { onConflict: 'name' });
      
      if (!error) {
        console.log(`✓ Created rule: ${rule.name}`);
      }
    }

    console.log('\nDatabase seeding completed successfully!');
  } catch (error) {
    console.error('Seeding failed:', error);
    process.exit(1);
  }
}

// Run seeding
seedDatabase().catch(console.error);