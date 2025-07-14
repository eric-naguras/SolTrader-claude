import { createClient } from '@supabase/supabase-js';
import { Helius } from 'helius-sdk';
import dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_ANON_KEY!
);

const helius = new Helius(process.env.HELIUS_API_KEY!);

async function testWebSocket() {
  console.log('🔍 Testing WebSocket connection...\n');

  // Get active wallets
  const { data: wallets } = await supabase
    .from('tracked_wallets')
    .select('*')
    .eq('is_active', true);

  if (!wallets || wallets.length === 0) {
    console.log('No active wallets found');
    return;
  }

  console.log(`Found ${wallets.length} active wallets`);
  console.log('Testing with first wallet:', wallets[0].address.substring(0, 8) + '...\n');

  // Test WebSocket subscription
  console.log('Setting up WebSocket subscription...');
  
  let messageCount = 0;
  const ws = helius.connection._rpcWebSocket;
  
  ws.on('open', () => {
    console.log('✓ WebSocket connected\n');
    
    // Subscribe to logs for the first wallet
    const subscribeMessage = {
      jsonrpc: '2.0',
      id: 1,
      method: 'logsSubscribe',
      params: [
        {
          mentions: [wallets[0].address]
        },
        {
          commitment: 'confirmed'
        }
      ]
    };
    
    console.log('Subscribing to wallet logs...');
    ws.send(JSON.stringify(subscribeMessage));
  });

  ws.on('message', (data: any) => {
    messageCount++;
    const message = JSON.parse(data.toString());
    
    if (message.method === 'logsNotification') {
      console.log('\n📨 Received log notification!');
      console.log('Signature:', message.params.result.value.signature);
      console.log('Logs preview:', message.params.result.value.logs.slice(0, 3));
    } else if (message.result) {
      console.log('✓ Subscription confirmed, ID:', message.result);
      console.log('\nWaiting for wallet activity... (will timeout in 30 seconds)');
    }
  });

  ws.on('error', (error: any) => {
    console.error('❌ WebSocket error:', error);
  });

  // Wait for 30 seconds
  await new Promise(resolve => setTimeout(resolve, 30000));
  
  console.log(`\nTest complete. Received ${messageCount} messages.`);
  
  // Check if whale-watcher is using the correct subscription method
  console.log('\n🔧 Checking whale-watcher configuration:');
  console.log('1. Make sure whale-watcher-stream.ts is using logsSubscribe with "mentions" filter');
  console.log('2. Verify all wallet addresses are being subscribed to');
  console.log('3. Check that the WebSocket connection is stable');
  
  process.exit(0);
}

testWebSocket().catch(console.error);