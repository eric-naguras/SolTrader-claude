import dotenv from 'dotenv';
import winston from 'winston';
import TelegramBot from 'node-telegram-bot-api';
import { Client, GatewayIntentBits, WebhookClient } from 'discord.js';
import { getSupabaseClient } from '@sonar/database';
import type { TradeSignal } from '@sonar/types';

dotenv.config();

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console({
      format: winston.format.simple()
    })
  ]
});

interface NotificationChannels {
  telegram?: TelegramBot;
  discord?: WebhookClient;
  telegramChatId?: string;
}

class NotifierService {
  private channels: NotificationChannels = {};
  private supabase = getSupabaseClient();
  private isRunning = false;

  constructor() {
    this.initializeChannels();
  }

  private initializeChannels() {
    // Initialize Telegram
    if (process.env.TELEGRAM_BOT_TOKEN) {
      this.channels.telegram = new TelegramBot(process.env.TELEGRAM_BOT_TOKEN, { polling: false });
      this.channels.telegramChatId = process.env.TELEGRAM_CHAT_ID;
      logger.info('Telegram channel initialized');
    }

    // Initialize Discord
    if (process.env.DISCORD_WEBHOOK_URL) {
      const webhookUrl = process.env.DISCORD_WEBHOOK_URL;
      const match = webhookUrl.match(/discord\.com\/api\/webhooks\/(\d+)\/(.+)/);
      if (match) {
        this.channels.discord = new WebhookClient({ id: match[1], token: match[2] });
        logger.info('Discord webhook channel initialized');
      }
    }

    if (Object.keys(this.channels).length === 0) {
      logger.warn('No notification channels configured');
    }
  }

  async start() {
    try {
      this.isRunning = true;
      logger.info('Starting Notifier service...');

      // Subscribe to new trade signals
      const subscription = this.supabase
        .channel('trade_signals_changes')
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'trade_signals'
          },
          async (payload) => {
            await this.handleNewSignal(payload.new as any);
          }
        )
        .subscribe();

      logger.info('Notifier service started successfully');
      logger.info('Listening for new trade signals...');
    } catch (error) {
      logger.error('Failed to start Notifier service:', error);
      throw error;
    }
  }

  async stop() {
    this.isRunning = false;
    await this.supabase.removeAllChannels();
    logger.info('Notifier service stopped');
  }

  private async handleNewSignal(signal: any) {
    try {
      logger.info('New trade signal received:', signal);

      // Fetch additional data if needed
      const { data: tokenData } = await this.supabase
        .from('tokens')
        .select('symbol, name')
        .eq('address', signal.coin_address)
        .single();

      const message = this.formatSignalMessage(signal, tokenData);

      // Send to all configured channels
      await this.sendNotifications(message, signal);
    } catch (error) {
      logger.error('Failed to handle new signal:', error);
    }
  }

  private formatSignalMessage(signal: any, tokenData: any): string {
    const tokenSymbol = tokenData?.symbol || 'Unknown';
    const tokenName = tokenData?.name || '';
    const whaleCount = signal.metadata?.whale_count || 0;
    const confidence = (signal.metadata?.confidence || 0) * 100;
    
    const dexScreenerUrl = `https://dexscreener.com/solana/${signal.coin_address}`;
    const birdeyeUrl = `https://birdeye.so/token/${signal.coin_address}`;

    return `🚨 **NEW SIGNAL DETECTED** 🚨

📊 **Token**: ${tokenSymbol} ${tokenName ? `(${tokenName})` : ''}
🐋 **Whale Activity**: ${whaleCount} whales bought
🎯 **Confidence**: ${confidence.toFixed(0)}%
📝 **Reason**: ${signal.trigger_reason}

🔗 **Links**:
• [DexScreener](${dexScreenerUrl})
• [Birdeye](${birdeyeUrl})

💡 **Contract**: \`${signal.coin_address}\`

⚠️ *Always DYOR before trading*`;
  }

  private async sendNotifications(message: string, signal: any) {
    const promises: Promise<any>[] = [];

    // Send to Telegram
    if (this.channels.telegram && this.channels.telegramChatId) {
      promises.push(
        this.channels.telegram.sendMessage(this.channels.telegramChatId, message, {
          parse_mode: 'Markdown',
          disable_web_page_preview: true
        }).catch(error => {
          logger.error('Failed to send Telegram notification:', error);
        })
      );
    }

    // Send to Discord
    if (this.channels.discord) {
      promises.push(
        this.channels.discord.send({
          content: message.replace(/\*\*/g, '**').replace(/\*/g, '*'), // Discord markdown is slightly different
          username: 'Sonar Alert',
          avatarURL: 'https://img.icons8.com/color/96/000000/whale.png'
        }).catch(error => {
          logger.error('Failed to send Discord notification:', error);
        })
      );
    }

    // Log to console
    console.log('\n' + '='.repeat(60));
    console.log(message);
    console.log('='.repeat(60) + '\n');

    await Promise.all(promises);
    logger.info(`Notifications sent for signal ${signal.id}`);
  }
}

// Start the service
const notifier = new NotifierService();

async function main() {
  try {
    await notifier.start();

    // Keep the process running
    process.on('SIGINT', async () => {
      logger.info('Received SIGINT, shutting down gracefully...');
      await notifier.stop();
      process.exit(0);
    });

    process.on('SIGTERM', async () => {
      logger.info('Received SIGTERM, shutting down gracefully...');
      await notifier.stop();
      process.exit(0);
    });
  } catch (error) {
    logger.error('Fatal error:', error);
    process.exit(1);
  }
}

main();