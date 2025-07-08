import dotenv from 'dotenv';
import { loadConfig, setupGracefulShutdown } from '@sonar/shared';
import { NotifierService } from './notifier-service';

// Load environment variables
dotenv.config();

async function main() {
  const config = loadConfig('notifier', '1.0.0');
  
  // Validate required config
  if (!config.notifications || Object.keys(config.notifications).length === 0) {
    throw new Error('At least one notification channel must be configured');
  }

  // Create extended config for notifier
  const notifierConfig = {
    ...config,
    channels: {
      telegram: config.notifications.telegram ? {
        bot_token: config.notifications.telegram.botToken,
        chat_ids: config.notifications.telegram.chatIds,
        rate_limit: 30, // messages per minute
      } : undefined,
      discord: config.notifications.discord ? {
        webhook_url: config.notifications.discord.webhookUrl,
        rate_limit: 30,
      } : undefined,
      cli: {
        enabled: true, // Always enable CLI notifications
      },
    },
    formatting: {
      include_whale_names: true,
      include_dex_links: true,
      include_price_info: true,
    },
  };

  // Create and start service
  const service = new NotifierService(notifierConfig);
  
  // Set up graceful shutdown
  setupGracefulShutdown([service]);

  // Start the service
  try {
    await service.start();
    console.log('Notifier service started successfully');
    
    // Log active channels
    const channels = await service.getChannelStatus();
    console.log('Active notification channels:');
    channels.forEach(ch => {
      console.log(`- ${ch.channel}: ${ch.healthy ? '✓' : '✗'} (${ch.recipientCount} recipients)`);
    });
  } catch (error) {
    console.error('Failed to start Notifier service:', error);
    process.exit(1);
  }
}

// Run the service
main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});