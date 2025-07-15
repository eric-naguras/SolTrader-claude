#!/usr/bin/env tsx

import { supabase } from '../lib/supabase.js';

async function testSSE() {
  console.log('[SSE Test] Testing SSE by inserting a test trade...');
  
  try {
    // Get a tracked wallet
    const { data: wallet, error: walletError } = await supabase
      .from('tracked_wallets')
      .select('address')
      .eq('is_active', true)
      .limit(1)
      .single();

    if (walletError || !wallet) {
      console.error('[SSE Test] No active tracked wallets found:', walletError);
      return;
    }

    console.log('[SSE Test] Using wallet:', wallet.address);

    // Insert a test trade that should trigger SSE
    const testTrade = {
      wallet_address: wallet.address,
      coin_address: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v', // USDC
      trade_type: 'BUY',
      sol_amount: 2.5,
      token_amount: 50.0,
      transaction_hash: 'sse_test_' + Date.now(),
      trade_timestamp: new Date().toISOString()
    };

    console.log('[SSE Test] Inserting test trade:', testTrade);

    const { data: insertedTrade, error: insertError } = await supabase
      .from('whale_trades')
      .insert(testTrade)
      .select()
      .single();

    if (insertError) {
      console.error('[SSE Test] Failed to insert test trade:', insertError);
      return;
    }

    console.log('[SSE Test] ✓ Test trade inserted successfully:', insertedTrade);
    console.log('[SSE Test] Check frontend console for SSE events!');
    
  } catch (error) {
    console.error('[SSE Test] Error:', error);
  }
}

// Run the test
if (import.meta.url === `file://${process.argv[1]}`) {
  testSSE().then(() => {
    console.log('[SSE Test] Test completed');
    process.exit(0);
  }).catch((error) => {
    console.error('[SSE Test] Test failed:', error);
    process.exit(1);
  });
}