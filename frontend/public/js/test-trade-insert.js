// Test function to manually insert a trade and see if Realtime picks it up
window.testTradeInsert = async function() {
    console.log('[Test] Starting manual trade insert test...');
    
    try {
        // First, get a tracked wallet
        const { data: wallet, error: walletError } = await window.supabase
            .from('tracked_wallets')
            .select('address')
            .eq('is_active', true)
            .limit(1)
            .single();

        if (walletError || !wallet) {
            console.error('[Test] No active tracked wallets found:', walletError);
            return;
        }

        console.log('[Test] Using wallet:', wallet.address);

        // Create a test trade
        const testTrade = {
            wallet_address: wallet.address,
            coin_address: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v', // USDC (we know this has metadata)
            trade_type: 'BUY',
            sol_amount: 5.0,
            token_amount: 100.0,
            transaction_hash: 'test_realtime_' + Date.now(),
            trade_timestamp: new Date().toISOString()
        };

        console.log('[Test] Inserting test trade:', testTrade);

        // Insert the trade - this should trigger Realtime
        const { data: insertedTrade, error: insertError } = await window.supabase
            .from('whale_trades')
            .insert(testTrade)
            .select()
            .single();

        if (insertError) {
            console.error('[Test] Failed to insert test trade:', insertError);
            return;
        }

        console.log('[Test] ✓ Test trade inserted successfully:', insertedTrade);
        console.log('[Test] Watch for Realtime events in console...');
        
        return insertedTrade;
        
    } catch (error) {
        console.error('[Test] Error in test trade insert:', error);
    }
};

console.log('[Test] Test function loaded. Run window.testTradeInsert() to test Realtime.');