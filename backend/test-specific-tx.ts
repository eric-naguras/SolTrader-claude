import { Helius } from 'helius-sdk';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const helius = new Helius(process.env.HELIUS_API_KEY!);
const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_ANON_KEY!
);

async function testSpecificTransaction() {
  // Get a recent swap transaction from our diagnostic
  const testSignature = '4MkpJr5sGRYGfJJ9Mtp66FPdKJrUYdvnAZZ8jWUvJhCm'; // From wallet 3pZ59YEN...
  
  console.log(`🔍 Testing transaction processing for: ${testSignature}\n`);

  try {
    // Fetch enhanced transaction using Helius
    const tx = await helius.connection.getParsedTransaction(testSignature, {
      maxSupportedTransactionVersion: 0
    });
    
    if (!tx) {
      console.log('❌ Could not fetch transaction');
      return;
    }

    console.log('Transaction details:');
    console.log('- Type:', tx.type);
    console.log('- Description:', tx.description);
    console.log('- Timestamp:', new Date(tx.timestamp * 1000).toLocaleString());
    console.log('- Fee payer:', tx.feePayer);
    
    console.log('\nToken transfers:');
    if (tx.tokenTransfers && tx.tokenTransfers.length > 0) {
      tx.tokenTransfers.forEach((transfer: any) => {
        console.log(`- ${transfer.tokenAmount} ${transfer.mint}`);
        console.log(`  From: ${transfer.fromAddress}`);
        console.log(`  To: ${transfer.toAddress}`);
      });
    } else {
      console.log('- No token transfers found');
    }

    console.log('\nNative transfers:');
    if (tx.nativeTransfers && tx.nativeTransfers.length > 0) {
      tx.nativeTransfers.forEach((transfer: any) => {
        console.log(`- ${transfer.amount / 1e9} SOL`);
        console.log(`  From: ${transfer.fromAddress}`);
        console.log(`  To: ${transfer.toAddress}`);
      });
    }

    // Check what the whale-watcher would do with this transaction
    console.log('\n🤔 Whale-watcher analysis:');
    console.log('- Transaction type check:', tx.type === 'SWAP' || tx.type === 'UNKNOWN' ? '✓ Would process' : '❌ Would skip');
    
    // Check if wallet is involved
    const walletAddress = '3pZ59YENxDAcjaKa3sahZJBcgER4rGYi4v6BpPurmsGj';
    let isWalletInvolved = false;
    
    // Check account data
    if (tx.accountData) {
      for (const account of tx.accountData) {
        if (account.account === walletAddress) {
          isWalletInvolved = true;
          break;
        }
      }
    }
    
    // Check transfers
    if (!isWalletInvolved && tx.nativeTransfers) {
      for (const transfer of tx.nativeTransfers) {
        if (transfer.fromAddress === walletAddress || transfer.toAddress === walletAddress) {
          isWalletInvolved = true;
          break;
        }
      }
    }
    
    if (!isWalletInvolved && tx.tokenTransfers) {
      for (const transfer of tx.tokenTransfers) {
        if (transfer.fromAddress === walletAddress || transfer.toAddress === walletAddress) {
          isWalletInvolved = true;
          break;
        }
      }
    }
    
    console.log('- Wallet involvement:', isWalletInvolved ? '✓ Wallet is involved' : '❌ Wallet not found');
    
    // Try to manually insert this trade
    if (isWalletInvolved && (tx.type === 'SWAP' || tx.type === 'UNKNOWN')) {
      console.log('\n📝 This transaction should be recorded. Checking database...');
      
      const { data: existingTrade } = await supabase
        .from('whale_trades')
        .select('id')
        .eq('signature', testSignature)
        .single();
      
      if (existingTrade) {
        console.log('✓ Trade already in database');
      } else {
        console.log('❌ Trade NOT in database - whale-watcher missed it!');
        
        // Show what the trade record would look like
        console.log('\nMissed trade details:');
        const tokenTransfer = tx.tokenTransfers?.[0];
        if (tokenTransfer) {
          console.log('- Token:', tokenTransfer.mint);
          console.log('- Amount:', tokenTransfer.tokenAmount);
          console.log('- Trade type:', tokenTransfer.fromAddress === walletAddress ? 'SELL' : 'BUY');
        }
      }
    }

  } catch (error) {
    console.error('Error:', error);
  }
}

testSpecificTransaction().catch(console.error);