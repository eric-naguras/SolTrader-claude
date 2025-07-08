import dotenv from 'dotenv';
import { loadConfig, setupGracefulShutdown } from '@sonar/shared';
import { WhaleWatcherService } from './whale-watcher-service';

// Load environment variables
dotenv.config();

async function main() {
  const config = loadConfig('whale-watcher', '1.0.0');
  
  // Validate required config
  if (!config.helius) {
    throw new Error('Helius configuration is required for whale-watcher service');
  }

  // Create extended config for whale watcher
  const whaleWatcherConfig = {
    ...config,
    helius: config.helius,
    monitoring: {
      batch_size: 10,
      reconnect_delay: 5000,
      max_reconnect_attempts: 10,
      health_check_interval: 60000,
    },
    filters: {
      min_trade_value_sol: parseFloat(process.env.MIN_TRADE_VALUE_SOL || '1'),
      ignored_tokens: (process.env.IGNORED_TOKENS || '').split(',').filter(t => t),
      dex_programs: [], // Will use defaults from types.ts
    },
  };

  // Create and start service
  const service = new WhaleWatcherService(whaleWatcherConfig);
  
  // Set up graceful shutdown
  setupGracefulShutdown([service]);

  // Start the service
  try {
    await service.start();
    console.log('Whale Watcher service started successfully');
  } catch (error) {
    console.error('Failed to start Whale Watcher service:', error);
    process.exit(1);
  }
}

// Run the service
main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});