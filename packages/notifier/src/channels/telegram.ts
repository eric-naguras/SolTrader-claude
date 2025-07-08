import TelegramBot from 'node-telegram-bot-api';
import { Logger, RateLimiter, NotificationError } from '@sonar/shared';
import { NotificationChannel } from './base';
import { TradeSignal } from '@sonar/shared';

export class TelegramChannel implements NotificationChannel {
  private bot: TelegramBot;
  private chatIds: string[];
  private logger: Logger;
  private rateLimiter: RateLimiter;
  private isConnected = false;

  constructor(
    botToken: string,
    chatIds: string[],
    logger: Logger,
    rateLimit = 30 // messages per minute
  ) {
    this.bot = new TelegramBot(botToken, { polling: false });
    this.chatIds = chatIds;
    this.logger = logger;
    this.rateLimiter = new RateLimiter(rateLimit, rateLimit / 60);
  }

  async initialize(): Promise<void> {
    try {
      // Test bot connection
      const me = await this.bot.getMe();
      this.logger.info('Telegram bot connected', { 
        botName: me.username,
        botId: me.id,
      });
      this.isConnected = true;
    } catch (error) {
      throw new NotificationError('TELEGRAM', 'Failed to connect to Telegram', error);
    }
  }

  async sendNotification(signal: TradeSignal): Promise<void> {
    if (!this.isConnected) {
      throw new NotificationError('TELEGRAM', 'Telegram channel not initialized');
    }

    const message = this.formatMessage(signal);
    
    for (const chatId of this.chatIds) {
      try {
        await this.rateLimiter.acquire();
        
        await this.bot.sendMessage(chatId, message, {
          parse_mode: 'Markdown',
          disable_web_page_preview: false,
        });
        
        this.logger.notificationSent('telegram', true, {
          chatId,
          signalId: signal.id,
        });
      } catch (error) {
        this.logger.notificationSent('telegram', false, {
          chatId,
          signalId: signal.id,
          error: (error as Error).message,
        });
        throw new NotificationError('TELEGRAM', `Failed to send to chat ${chatId}`, error);
      }
    }
  }

  async testChannel(): Promise<boolean> {
    try {
      const testMessage = '🔔 *Test Notification*\\n\\nThis is a test message from Sonar\\.';
      
      for (const chatId of this.chatIds) {
        await this.rateLimiter.acquire();
        await this.bot.sendMessage(chatId, testMessage, {
          parse_mode: 'MarkdownV2',
        });
      }
      
      return true;
    } catch (error) {
      this.logger.error('Telegram test failed', error as Error);
      return false;
    }
  }

  async cleanup(): Promise<void> {
    if (this.bot) {
      await this.bot.stopPolling();
      this.isConnected = false;
    }
  }

  isHealthy(): boolean {
    return this.isConnected;
  }

  getStats() {
    return {
      enabled: true,
      healthy: this.isConnected,
      recipientCount: this.chatIds.length,
      channel: 'TELEGRAM' as const,
    };
  }

  private formatMessage(signal: TradeSignal): string {
    const metadata = signal.metadata || {};
    const tokenSymbol = metadata.token_symbol || 'Unknown';
    const tokenName = metadata.token_name || '';
    const whaleAddresses = metadata.whale_addresses || [];
    
    // Build message
    let message = `🐋 *WHALE ALERT*\n\n`;
    message += `*Token:* ${tokenSymbol}${tokenName ? ` (${tokenName})` : ''}\n`;
    message += `*Address:* \`${signal.token_address}\`\n`;
    message += `*Whales:* ${signal.whale_count} whales\n`;
    message += `*Total SOL:* ${signal.total_sol_amount.toFixed(2)} SOL\n\n`;
    message += `*Reason:* ${signal.trigger_reason}\n\n`;
    
    // Add links
    message += `📊 [DexScreener](https://dexscreener.com/solana/${signal.token_address}) | `;
    message += `🦅 [Birdeye](https://birdeye.so/token/${signal.token_address})\n\n`;
    
    // Add whale list if available
    if (whaleAddresses.length > 0) {
      message += `*Whale Wallets:*\n`;
      whaleAddresses.slice(0, 5).forEach((address: string) => {
        const shortAddr = `${address.slice(0, 4)}...${address.slice(-4)}`;
        message += `• [${shortAddr}](https://solscan.io/account/${address})\n`;
      });
      if (whaleAddresses.length > 5) {
        message += `_...and ${whaleAddresses.length - 5} more_\n`;
      }
    }
    
    message += `\n⏰ _${new Date().toLocaleString()}_`;
    
    return message;
  }
}