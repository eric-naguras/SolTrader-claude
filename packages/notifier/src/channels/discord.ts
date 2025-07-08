import axios from 'axios';
import { Logger, RateLimiter, NotificationError } from '@sonar/shared';
import { NotificationChannel } from './base';
import { TradeSignal } from '@sonar/shared';

interface DiscordEmbed {
  title: string;
  description: string;
  color: number;
  fields: Array<{
    name: string;
    value: string;
    inline: boolean;
  }>;
  footer: {
    text: string;
  };
  timestamp: string;
}

export class DiscordChannel implements NotificationChannel {
  private webhookUrl: string;
  private logger: Logger;
  private rateLimiter: RateLimiter;
  private isHealthy = true;

  constructor(
    webhookUrl: string,
    logger: Logger,
    rateLimit = 30 // messages per minute
  ) {
    this.webhookUrl = webhookUrl;
    this.logger = logger;
    this.rateLimiter = new RateLimiter(rateLimit, rateLimit / 60);
  }

  async initialize(): Promise<void> {
    // Test webhook by sending a test message (then delete it)
    try {
      await this.testChannel();
      this.logger.info('Discord webhook connected');
    } catch (error) {
      throw new NotificationError('DISCORD', 'Failed to connect to Discord webhook', error);
    }
  }

  async sendNotification(signal: TradeSignal): Promise<void> {
    const embed = this.createEmbed(signal);
    
    try {
      await this.rateLimiter.acquire();
      
      await axios.post(this.webhookUrl, {
        username: 'Sonar Alerts',
        avatar_url: 'https://example.com/sonar-logo.png', // Replace with actual logo
        embeds: [embed],
      });
      
      this.logger.notificationSent('discord', true, {
        signalId: signal.id,
      });
    } catch (error) {
      this.isHealthy = false;
      this.logger.notificationSent('discord', false, {
        signalId: signal.id,
        error: (error as Error).message,
      });
      throw new NotificationError('DISCORD', 'Failed to send Discord notification', error);
    }
  }

  async testChannel(): Promise<boolean> {
    try {
      const testEmbed: DiscordEmbed = {
        title: '🔔 Test Notification',
        description: 'This is a test message from Sonar',
        color: 0x00ff00, // Green
        fields: [],
        footer: {
          text: 'Sonar Whale Tracker',
        },
        timestamp: new Date().toISOString(),
      };
      
      await this.rateLimiter.acquire();
      
      const response = await axios.post(this.webhookUrl + '?wait=true', {
        username: 'Sonar Alerts',
        embeds: [testEmbed],
      });
      
      // Delete the test message
      if (response.data && response.data.id) {
        await axios.delete(`${this.webhookUrl}/messages/${response.data.id}`);
      }
      
      this.isHealthy = true;
      return true;
    } catch (error) {
      this.logger.error('Discord test failed', error as Error);
      this.isHealthy = false;
      return false;
    }
  }

  async cleanup(): Promise<void> {
    // Nothing to clean up for Discord webhooks
  }

  isHealthy(): boolean {
    return this.isHealthy;
  }

  getStats() {
    return {
      enabled: true,
      healthy: this.isHealthy,
      recipientCount: 1, // One webhook URL
      channel: 'DISCORD' as const,
    };
  }

  private createEmbed(signal: TradeSignal): DiscordEmbed {
    const metadata = signal.metadata || {};
    const tokenSymbol = metadata.token_symbol || 'Unknown';
    const tokenName = metadata.token_name || '';
    const whaleAddresses = metadata.whale_addresses || [];
    
    const embed: DiscordEmbed = {
      title: `🐋 WHALE ALERT: ${tokenSymbol}`,
      description: tokenName || 'New whale activity detected',
      color: 0x1e88e5, // Blue color
      fields: [
        {
          name: '📍 Token Address',
          value: `\`${signal.token_address}\``,
          inline: false,
        },
        {
          name: '🐋 Whale Count',
          value: signal.whale_count.toString(),
          inline: true,
        },
        {
          name: '💰 Total SOL',
          value: `${signal.total_sol_amount.toFixed(2)} SOL`,
          inline: true,
        },
        {
          name: '📝 Trigger',
          value: signal.trigger_reason || 'Multiple whales buying',
          inline: false,
        },
        {
          name: '🔗 Quick Links',
          value: `[DexScreener](https://dexscreener.com/solana/${signal.token_address}) | [Birdeye](https://birdeye.so/token/${signal.token_address}) | [Solscan](https://solscan.io/token/${signal.token_address})`,
          inline: false,
        },
      ],
      footer: {
        text: 'Sonar Whale Tracker',
      },
      timestamp: new Date().toISOString(),
    };
    
    // Add whale wallets if available
    if (whaleAddresses.length > 0) {
      const walletList = whaleAddresses.slice(0, 5).map((address: string) => {
        const shortAddr = `${address.slice(0, 4)}...${address.slice(-4)}`;
        return `[${shortAddr}](https://solscan.io/account/${address})`;
      }).join(' • ');
      
      embed.fields.push({
        name: '🔍 Whale Wallets',
        value: walletList + (whaleAddresses.length > 5 ? ` +${whaleAddresses.length - 5} more` : ''),
        inline: false,
      });
    }
    
    return embed;
  }
}