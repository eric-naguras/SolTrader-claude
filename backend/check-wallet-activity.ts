import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { Connection } from '@solana/web3.js';
import { Helius } from 'helius-sdk';

dotenv.config();

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_ANON_KEY!
);

const helius = new Helius(process.env.HELIUS_API_KEY!);

async function checkWalletActivity() {
  console.log('🔍 Checking wallet activity...\n');

  // Get all active wallets
  const { data: wallets, error } = await supabase
    .from('tracked_wallets')
    .select('*')
    .eq('is_active', true);

  if (error) {
    console.error('Error fetching wallets:', error);
    return;
  }

  console.log(`Found ${wallets?.length || 0} active wallets\n`);

  // Check recent trades in database
  const { data: recentTrades, error: tradesError } = await supabase
    .from('whale_trades')
    .select('*')
    .order('timestamp', { ascending: false })
    .limit(10);

  console.log(`Recent trades in database: ${recentTrades?.length || 0}`);
  if (recentTrades && recentTrades.length > 0) {
    console.log('Latest trade:', new Date(recentTrades[0].timestamp).toLocaleString());
  }

  // Check each wallet's recent transactions
  console.log('\n📊 Checking recent transactions for each wallet:\n');

  for (const wallet of wallets || []) {
    console.log(`\nWallet: ${wallet.label || 'Unnamed'} (${wallet.address.substring(0, 8)}...)`);
    
    try {
      // Get recent transactions using Helius
      const signatures = await helius.connection.getSignaturesForAddress(
        new PublicKey(wallet.address),
        { limit: 10 }
      );

      console.log(`  Found ${signatures.length} recent transactions`);

      // Check first few transactions for swaps
      let swapCount = 0;
      for (const sig of signatures.slice(0, 5)) {
        try {
          // Use getTransaction from Helius RPC connection
          const tx = await helius.connection.getParsedTransaction(
            sig.signature,
            { maxSupportedTransactionVersion: 0 }
          );
          
          // Check transaction logs for swap keywords
          const logs = tx?.meta?.logMessages || [];
          const hasSwapLog = logs.some((log: string) => 
            log.toLowerCase().includes('swap') || 
            log.includes('ray_log') ||
            log.toLowerCase().includes('jupiter') ||
            log.toLowerCase().includes('trade')
          );
          
          if (hasSwapLog) {
            swapCount++;
            console.log(`  ✓ Potential swap transaction: ${sig.signature.substring(0, 8)}...`);
            
            // Check if this trade is in our database
            const { data: dbTrade } = await supabase
              .from('whale_trades')
              .select('id')
              .eq('signature', sig.signature)
              .single();
            
            if (!dbTrade) {
              console.log(`    ⚠️  This trade is NOT in the database!`);
              console.log(`    📝 Sample logs: ${logs.slice(0, 3).map(l => l.substring(0, 50)).join(' | ')}`);
            }
          }
        } catch (err) {
          console.log(`  Error checking transaction ${sig.signature.substring(0, 8)}...`);
        }
      }
      
      if (swapCount === 0) {
        console.log(`  No swaps found in recent transactions`);
      }

    } catch (error) {
      console.error(`  Error checking wallet: ${error.message}`);
    }
  }

  // Check if whale-watcher service has been running
  console.log('\n🔧 Service Status Check:\n');
  
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const { data: recentActivity } = await supabase
    .from('whale_trades')
    .select('count')
    .gte('timestamp', oneHourAgo);

  console.log(`Trades recorded in last hour: ${recentActivity?.[0]?.count || 0}`);
  
  // Check for any errors in logs
  console.log('\n⚠️  Common issues to check:');
  console.log('1. Is the whale-watcher service running? (npm run dev in backend/)');
  console.log('2. Are SUPABASE_URL, SUPABASE_ANON_KEY, and HELIUS_API_KEY set correctly?');
  console.log('3. Check backend logs for WebSocket connection errors');
  console.log('4. The service only detects swaps with specific keywords in logs');
  console.log('5. Some DEXs might use different terminology than "swap"');
}

// Add missing import
import { PublicKey } from '@solana/web3.js';

checkWalletActivity().catch(console.error);