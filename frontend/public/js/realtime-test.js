// Simple Realtime connection test
console.log('[RealtimeTest] Starting Supabase Realtime connection test...');

// Test basic Supabase connection
async function testSupabaseConnection() {
    try {
        console.log('[RealtimeTest] Testing basic Supabase connection...');
        
        // Test basic query
        const { data, error } = await window.supabase
            .from('tokens')
            .select('address, symbol, name')
            .limit(1);

        if (error) {
            console.error('[RealtimeTest] Basic query failed:', error);
            return false;
        }

        console.log('[RealtimeTest] ✓ Basic Supabase connection working:', data);
        return true;
    } catch (error) {
        console.error('[RealtimeTest] Connection test failed:', error);
        return false;
    }
}

// Test Realtime connection
async function testRealtimeConnection() {
    try {
        console.log('[RealtimeTest] Testing Realtime WebSocket connection...');
        
        const testChannel = window.supabase.channel('connection_test', {
            config: {
                broadcast: { self: true }
            }
        })
        .on('postgres_changes', { 
            event: 'INSERT', 
            schema: 'public', 
            table: 'tokens' 
        }, (payload) => {
            console.log('[RealtimeTest] ✓ Received Realtime event:', payload);
        })
        .subscribe((status, err) => {
            console.log(`[RealtimeTest] Subscription status: ${status}`, err);
            
            if (status === 'SUBSCRIBED') {
                console.log('[RealtimeTest] ✓ Realtime connection successful!');
                
                // Clean up test channel after 10 seconds
                setTimeout(() => {
                    testChannel.unsubscribe();
                    console.log('[RealtimeTest] Test channel cleaned up');
                }, 10000);
            } else if (status === 'CHANNEL_ERROR') {
                console.error('[RealtimeTest] ✗ Realtime connection failed:', err);
            }
        });

        // Store for debugging
        window.testChannel = testChannel;
        
    } catch (error) {
        console.error('[RealtimeTest] Realtime test failed:', error);
    }
}

// Run tests
testSupabaseConnection().then(success => {
    if (success) {
        testRealtimeConnection();
    } else {
        console.error('[RealtimeTest] Skipping Realtime test due to basic connection failure');
    }
});

// Also test the manual trigger for new trade
window.testTradeInsert = async function() {
    console.log('[RealtimeTest] Manually testing trade insert...');
    
    try {
        // Insert a test trade (you'll need to have a tracked wallet first)
        const { data: wallet } = await window.supabase
            .from('tracked_wallets')
            .select('address')
            .limit(1)
            .single();

        if (!wallet) {
            console.error('[RealtimeTest] No tracked wallets found for test');
            return;
        }

        const testTrade = {
            wallet_address: wallet.address,
            coin_address: 'So11111111111111111111111111111111111111112', // SOL
            trade_type: 'BUY',
            sol_amount: 1.0,
            transaction_hash: 'test_' + Date.now(),
            trade_timestamp: new Date().toISOString()
        };

        const { data, error } = await window.supabase
            .from('whale_trades')
            .insert(testTrade)
            .select()
            .single();

        if (error) {
            console.error('[RealtimeTest] Test trade insert failed:', error);
        } else {
            console.log('[RealtimeTest] ✓ Test trade inserted:', data);
        }
        
    } catch (error) {
        console.error('[RealtimeTest] Test trade insert error:', error);
    }
};

console.log('[RealtimeTest] Test functions loaded. Run window.testTradeInsert() to manually test trade insertion.');