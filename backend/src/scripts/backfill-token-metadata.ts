#!/usr/bin/env tsx

import { supabase } from '../lib/supabase.js';
import { tokenMetadataService } from '../services/token-metadata.js';

async function backfillTokenMetadata() {
  try {
    console.log('[TokenBackfill] Starting token metadata backfill...');

    // Get all tokens that are missing symbol or name
    const { data: tokens, error } = await supabase
      .from('tokens')
      .select('address, symbol, name')
      .or('symbol.is.null,name.is.null');

    if (error) {
      console.error('[TokenBackfill] Error fetching tokens:', error);
      return;
    }

    if (!tokens || tokens.length === 0) {
      console.log('[TokenBackfill] No tokens need metadata backfill');
      return;
    }

    console.log(`[TokenBackfill] Found ${tokens.length} tokens without metadata`);

    // Filter out SOL token (already has metadata)
    const tokensToProcess = tokens.filter(token => 
      token.address !== 'So11111111111111111111111111111111111111112'
    );

    console.log(`[TokenBackfill] Processing ${tokensToProcess.length} tokens...`);

    let processed = 0;
    let successful = 0;
    let failed = 0;

    // Process in batches to avoid overwhelming APIs
    const batchSize = 5;
    for (let i = 0; i < tokensToProcess.length; i += batchSize) {
      const batch = tokensToProcess.slice(i, i + batchSize);
      
      console.log(`[TokenBackfill] Processing batch ${Math.floor(i/batchSize) + 1}/${Math.ceil(tokensToProcess.length/batchSize)}...`);

      const promises = batch.map(async (token) => {
        try {
          const metadata = await tokenMetadataService.getTokenMetadata(token.address);
          
          if (metadata && (metadata.symbol || metadata.name)) {
            // Update token with metadata
            const { error: updateError } = await supabase
              .from('tokens')
              .update({
                symbol: metadata.symbol || token.symbol,
                name: metadata.name || token.name || metadata.symbol,
                metadata: {
                  logoURI: metadata.logoURI,
                  decimals: metadata.decimals
                },
                last_seen: new Date().toISOString()
              })
              .eq('address', token.address);

            if (updateError) {
              console.error(`[TokenBackfill] Error updating ${token.address}:`, updateError);
              failed++;
            } else {
              console.log(`[TokenBackfill] ✓ Updated ${token.address.slice(0, 8)}... -> ${metadata.symbol} - ${metadata.name}`);
              successful++;
            }
          } else {
            console.log(`[TokenBackfill] ✗ No metadata found for ${token.address.slice(0, 8)}...`);
            failed++;
          }
          
          processed++;
        } catch (error) {
          console.error(`[TokenBackfill] Error processing ${token.address}:`, error);
          failed++;
          processed++;
        }
      });

      await Promise.all(promises);

      // Small delay between batches to be respectful to APIs
      if (i + batchSize < tokensToProcess.length) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    console.log(`[TokenBackfill] Completed! Processed: ${processed}, Successful: ${successful}, Failed: ${failed}`);

  } catch (error) {
    console.error('[TokenBackfill] Fatal error:', error);
    process.exit(1);
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  backfillTokenMetadata().then(() => {
    console.log('[TokenBackfill] Script completed');
    process.exit(0);
  }).catch((error) => {
    console.error('[TokenBackfill] Script failed:', error);
    process.exit(1);
  });
}