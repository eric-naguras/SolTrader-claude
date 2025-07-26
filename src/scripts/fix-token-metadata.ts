#!/usr/bin/env bun
import { database } from '../lib/database.js';
import { solscanAPI } from '../lib/solscan-api.js';
import { Logger } from '../lib/logger.js';

const logger = new Logger('fix-token-metadata');

async function fixTokenMetadata() {
  try {
    logger.system('Starting token metadata fix...');
    
    // Get all tokens with placeholder data
    const tokens = await database.sql`
      SELECT * FROM tokens 
      WHERE symbol LIKE '%' || UPPER(SUBSTRING(address, 1, 8)) || '%'
         OR name LIKE 'Token %'
         OR symbol = 'UNKNOWN'
      ORDER BY created_at DESC
    `;
    
    logger.system(`Found ${tokens.length} tokens with placeholder data`);
    
    let fixed = 0;
    let failed = 0;
    
    for (const token of tokens) {
      logger.debug(`Checking token ${token.address.substring(0, 8)}... (current: ${token.symbol})`);
      
      // Fetch metadata from Solscan
      const metadata = await solscanAPI.getTokenMetadata(token.address);
      
      if (metadata && metadata.symbol !== 'UNKNOWN') {
        // Update token with proper metadata
        await database.upsertToken({
          address: token.address,
          symbol: metadata.symbol,
          name: metadata.name,
          metadata: {
            ...token.metadata,
            decimals: metadata.decimals,
            icon: metadata.icon,
            website: metadata.website,
            twitter: metadata.twitter
          }
        });
        
        logger.system(`Fixed: ${token.address.substring(0, 8)}... -> ${metadata.symbol} (${metadata.name})`);
        fixed++;
      } else {
        logger.debug(`No metadata found for ${token.address.substring(0, 8)}...`);
        failed++;
      }
      
      // Rate limit to avoid hitting API limits
      await new Promise(resolve => setTimeout(resolve, 500));
    }
    
    logger.system(`Token metadata fix complete: ${fixed} fixed, ${failed} failed`);
    
  } catch (error) {
    logger.error('Error fixing token metadata:', error);
  }
}

// Run the fix
fixTokenMetadata();