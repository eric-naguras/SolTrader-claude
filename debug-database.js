const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

async function debugDatabase() {
  console.log('🔍 Debugging database structure and data...\n');

  // 1. Check tracked_wallets table structure and data
  console.log('1. TRACKED_WALLETS TABLE:');
  console.log('=' .repeat(50));
  
  // Get table structure by querying information_schema
  const { data: columns, error: columnsError } = await supabase.rpc('get_table_columns', {
    table_name: 'tracked_wallets'
  });

  if (columnsError) {
    console.log('⚠️  Could not get column info via RPC, trying direct query...');
    
    // Try direct query to see what columns exist
    const { data: walletData, error: walletError } = await supabase
      .from('tracked_wallets')
      .select('*')
      .limit(1);
    
    if (walletData && walletData.length > 0) {
      console.log('Available columns in tracked_wallets:');
      console.log(Object.keys(walletData[0]));
    }
  }

  // Get sample data from tracked_wallets
  const { data: wallets, error: walletsError } = await supabase
    .from('tracked_wallets')
    .select('*')
    .limit(5);

  if (walletsError) {
    console.log('❌ Error fetching tracked_wallets:', walletsError);
  } else {
    console.log(`📊 Total records: ${wallets.length}`);
    if (wallets.length > 0) {
      console.log('Sample data:');
      wallets.forEach((wallet, index) => {
        console.log(`  ${index + 1}. ${wallet.alias || 'No alias'} (${wallet.address?.slice(0, 8)}...)`);
        console.log(`     - UI Color: ${wallet.ui_color || 'Not set'}`);
        console.log(`     - Verified: ${wallet.is_verified || false}`);
        console.log(`     - Twitter: ${wallet.twitter_handle || 'Not set'}`);
        console.log(`     - Active: ${wallet.is_active}`);
      });
    } else {
      console.log('❌ No records found in tracked_wallets table');
    }
  }

  console.log('\n2. RECENT_WHALE_TRADES VIEW:');
  console.log('=' .repeat(50));

  // Check if the view exists and get sample data
  const { data: recentTrades, error: tradesError } = await supabase
    .from('recent_whale_trades')
    .select('*')
    .limit(5);

  if (tradesError) {
    console.log('❌ Error fetching recent_whale_trades:', tradesError);
    console.log('This might mean the view doesn\'t exist or there are permission issues.');
  } else {
    console.log(`📊 Total records: ${recentTrades.length}`);
    if (recentTrades.length > 0) {
      console.log('Available columns in recent_whale_trades view:');
      console.log(Object.keys(recentTrades[0]));
      console.log('\nSample data:');
      recentTrades.forEach((trade, index) => {
        console.log(`  ${index + 1}. ${trade.wallet_alias || 'No alias'} - ${trade.token_symbol || trade.coin_address?.slice(0, 8)}`);
        console.log(`     - Type: ${trade.trade_type}`);
        console.log(`     - Amount: ${trade.sol_amount} SOL`);
        console.log(`     - Time: ${trade.trade_timestamp}`);
        console.log(`     - Color: ${trade.wallet_color}`);
        console.log(`     - Verified: ${trade.is_verified}`);
      });
    } else {
      console.log('❌ No records found in recent_whale_trades view');
    }
  }

  console.log('\n3. TOKENS TABLE:');
  console.log('=' .repeat(50));

  const { data: tokens, error: tokensError } = await supabase
    .from('tokens')
    .select('*')
    .limit(5);

  if (tokensError) {
    console.log('❌ Error fetching tokens:', tokensError);
  } else {
    console.log(`📊 Total records: ${tokens.length}`);
    if (tokens.length > 0) {
      console.log('Sample tokens:');
      tokens.forEach((token, index) => {
        console.log(`  ${index + 1}. ${token.symbol || 'No symbol'} (${token.name || 'No name'})`);
        console.log(`     - Address: ${token.address?.slice(0, 8)}...`);
      });
    } else {
      console.log('❌ No records found in tokens table');
    }
  }

  console.log('\n4. WHALE_TRADES TABLE:');
  console.log('=' .repeat(50));

  const { data: whaleTrades, error: whaleTradesError } = await supabase
    .from('whale_trades')
    .select('*')
    .limit(5);

  if (whaleTradesError) {
    console.log('❌ Error fetching whale_trades:', whaleTradesError);
  } else {
    console.log(`📊 Total records: ${whaleTrades.length}`);
    if (whaleTrades.length > 0) {
      console.log('Sample whale trades:');
      whaleTrades.forEach((trade, index) => {
        console.log(`  ${index + 1}. ${trade.wallet_address?.slice(0, 8)}... - ${trade.trade_type}`);
        console.log(`     - Amount: ${trade.sol_amount} SOL`);
        console.log(`     - Token: ${trade.coin_address?.slice(0, 8)}...`);
        console.log(`     - Time: ${trade.trade_timestamp}`);
      });
    } else {
      console.log('❌ No records found in whale_trades table');
    }
  }

  console.log('\n5. CHECKING FOR MISSING FIELDS:');
  console.log('=' .repeat(50));

  // Check specific fields that frontend might expect
  const expectedFields = [
    'twitter_handle',
    'telegram_channel', 
    'streaming_channel',
    'image_data',
    'is_verified'
  ];

  if (wallets && wallets.length > 0) {
    const availableFields = Object.keys(wallets[0]);
    console.log('Expected fields in tracked_wallets:');
    expectedFields.forEach(field => {
      const exists = availableFields.includes(field);
      console.log(`  ${exists ? '✅' : '❌'} ${field}`);
    });
  }

  console.log('\n🔍 Debug complete!');
}

debugDatabase().catch(console.error);