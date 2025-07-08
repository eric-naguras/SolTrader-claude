import dotenv from 'dotenv';
import { loadConfig, setupGracefulShutdown } from '@sonar/shared';
import { PaperTraderService } from './paper-trader-service';

// Load environment variables
dotenv.config();

async function main() {
  const config = loadConfig('paper-trader', '1.0.0');
  
  // Validate required config
  if (!config.trading) {
    throw new Error('Trading configuration is required for paper-trader service');
  }

  // Create paper trader config
  const paperTraderConfig = {
    service: config.service,
    database: config.database,
    trading: {
      defaultSizeSol: config.trading.paperTradeSize,
      slippageBps: config.trading.slippageBps,
      priceUpdateInterval: config.trading.priceUpdateInterval,
    },
  };

  // Create and start service
  const service = new PaperTraderService(paperTraderConfig);
  
  // Set up graceful shutdown
  setupGracefulShutdown([service]);

  // Start the service
  try {
    await service.start();
    console.log('Paper Trader service started successfully');
    console.log(`Configuration:`);
    console.log(`- Default trade size: ${paperTraderConfig.trading.defaultSizeSol} SOL`);
    console.log(`- Slippage: ${paperTraderConfig.trading.slippageBps / 100}%`);
    console.log(`- Price update interval: ${paperTraderConfig.trading.priceUpdateInterval}s`);
  } catch (error) {
    console.error('Failed to start Paper Trader service:', error);
    process.exit(1);
  }
}

// Run the service
main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});