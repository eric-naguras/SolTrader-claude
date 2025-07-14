import { readFile, writeFile } from 'fs/promises';
import { join } from 'path';

async function fixWhaleWatcher() {
  const filePath = join(__dirname, 'src/services/whale-watcher-stream.ts');
  let content = await readFile(filePath, 'utf-8');

  console.log('🔧 Applying fixes to whale-watcher-stream.ts...\n');

  // Fix 1: Add more detailed logging for subscription
  const subscriptionLoggingFix = `
          if (message.id === 1 && message.result) {
            this.subscriptionId = message.result;
            this.logger.connection(\`Subscription confirmed: \${this.subscriptionId}\`);
            this.logger.success('✅ WebSocket fully operational - monitoring \${this.trackedWallets.size} wallets');
            return;
          }
          
          // Add error handling for subscription failures
          if (message.id === 1 && message.error) {
            this.logger.error('Subscription failed:', message.error);
            this.handleReconnect();
            return;
          }`;

  // Fix 2: Expand transaction type filtering to be more inclusive
  const transactionFilterFix = `
      // Check if this is a potential trade (be more inclusive)
      // Many DEX transactions are marked as UNKNOWN or other types
      if (tx.type !== 'SWAP' && tx.type !== 'UNKNOWN' && tx.type !== 'TRANSFER') {
        // Still check if it involves token transfers which could be trades
        if (!tx.tokenTransfers || tx.tokenTransfers.length === 0) {
          return;
        }
      }`;

  // Fix 3: Add retry logic for getEnhancedTransaction
  const enhancedTransactionFix = `
      // Use Helius to get enhanced transaction details with retry
      let tx = null;
      let retries = 3;
      
      while (retries > 0 && !tx) {
        try {
          tx = await this.helius.getEnhancedTransaction(signature);
          if (!tx && retries > 1) {
            this.logger.warning(\`Transaction \${signature} not found, retrying...\`);
            await new Promise(resolve => setTimeout(resolve, 1000));
          }
        } catch (error) {
          this.logger.error(\`Error fetching transaction \${signature}:\`, error);
          if (retries === 1) throw error;
        }
        retries--;
      }
      
      if (!tx) {
        this.logger.error(\`Could not fetch transaction after retries: \${signature}\`);
        return;
      }`;

  // Fix 4: Add more comprehensive trade detection
  const tradeDetectionFix = `
    // Also check if this looks like a trade based on transfers
    const hasTokenTransfer = tokenTransfers.length > 0;
    const hasSolTransfer = nativeTransfers.length > 0;
    const hasMultipleTransfers = tokenTransfers.length > 1 || 
                                 (tokenTransfers.length === 1 && nativeTransfers.length > 0);
    
    // More lenient trade detection
    if (!hasTokenTransfer && !hasMultipleTransfers) {
      this.logger.debug(\`Skipping non-trade transaction: \${tx.signature}\`);
      return;
    }`;

  console.log('Fixes to apply:');
  console.log('1. ✓ Enhanced subscription logging and error handling');
  console.log('2. ✓ More inclusive transaction type filtering');
  console.log('3. ✓ Retry logic for fetching transactions');
  console.log('4. ✓ Better trade detection logic');
  
  console.log('\n📝 Note: These fixes will:');
  console.log('- Capture more types of trades (not just SWAP type)');
  console.log('- Add better error handling and retry logic');
  console.log('- Provide clearer logging for debugging');
  console.log('- Handle edge cases where Helius API might be slow');
  
  console.log('\n💡 To apply these fixes:');
  console.log('1. Stop the current whale-watcher service');
  console.log('2. Edit src/services/whale-watcher-stream.ts with the fixes above');
  console.log('3. Restart the service with npm run dev');
  console.log('4. Monitor the logs for "WebSocket fully operational" message');
}

fixWhaleWatcher().catch(console.error);