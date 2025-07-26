#!/usr/bin/env bun
import { solscanAPI } from '../lib/solscan-api.js';
import { Logger } from '../lib/logger.js';

const logger = new Logger('test-metadata');

async function testTokenMetadata() {
  // Test with token address from command line
  const tokenAddress = process.argv[2];
  
  if (!tokenAddress) {
    logger.error('Please provide a token address as argument');
    logger.system('Usage: bun run src/scripts/test-token-metadata.ts <token-address>');
    process.exit(1);
  }
  
  logger.system(`Testing token: ${tokenAddress}\n`);
  
  try {
    const solscanData = await solscanAPI.getTokenMetadata(tokenAddress);
    if (solscanData) {
      logger.system(`✅ Solscan returned:`);
      logger.system(`  Symbol: ${solscanData.symbol}`);
      logger.system(`  Name: ${solscanData.name}`);
      logger.system(`  Decimals: ${solscanData.decimals}`);
      logger.system(`  Icon: ${solscanData.icon || 'Not available'}`);
    } else {
      logger.system(`❌ Solscan: No data found`);
    }
  } catch (error) {
    logger.error(`❌ Solscan error:`, error);
  }
}

testTokenMetadata();