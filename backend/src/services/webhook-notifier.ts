import { supabase, type TradeSignal } from '../lib/supabase.js';

interface NotificationChannels {
  telegram?: {
    sendMessage: (chatId: string, text: string) => Promise<void>;
    chatId: string;
  };
  discord?: {
    sendMessage: (content: string) => Promise<void>;
  };
}

export class WebhookNotifierService {
  private channels: NotificationChannels = {};

  constructor() {
    this.initializeChannels();
  }

  private initializeChannels() {
    // Initialize Telegram if configured
    if (process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_CHAT_ID) {
      this.channels.telegram = {
        chatId: process.env.TELEGRAM_CHAT_ID,
        sendMessage: async (chatId: string, text: string) => {
          const url = `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendMessage`;
          await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'HTML' })
          });
        }
      };
      console.log('[WebhookNotifier] Telegram channel initialized');
    }

    // Initialize Discord if configured
    if (process.env.DISCORD_WEBHOOK_URL) {
      this.channels.discord = {
        sendMessage: async (content: string) => {
          await fetch(process.env.DISCORD_WEBHOOK_URL!, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ content })
          });
        }
      };
      console.log('[WebhookNotifier] Discord channel initialized');
    }

    console.log('[WebhookNotifier] CLI channel active');
  }

  // Process webhook signal data
  async processSignalWebhook(signal: TradeSignal) {
    try {
      console.log('[WebhookNotifier] Processing signal webhook:', signal.coin_address);

      // Get signal details with whale information
      const { data: signalDetails } = await supabase
        .from('trade_signals')
        .select(`
          *,
          tokens!trade_signals_coin_address_fkey (
            symbol,
            name
          )
        `)
        .eq('id', signal.id)
        .single();

      if (!signalDetails) {
        console.log('[WebhookNotifier] Signal details not found');
        return;
      }

      // Get the whale trades that triggered this signal
      const { data: whaleTrades } = await supabase
        .from('recent_whale_trades')
        .select('*')
        .eq('coin_address', signal.coin_address)
        .gte('trade_timestamp', new Date(Date.now() - 3600000).toISOString()) // Last hour
        .order('trade_timestamp', { ascending: false })
        .limit(10);

      // Format the notification message
      const tokenInfo = signalDetails.tokens || {};
      const whaleCount = new Set(whaleTrades?.map(t => t.wallet_address)).size || 0;
      const whaleNames = whaleTrades?.map(t => 
        t.wallet_alias || `${t.wallet_address.slice(0, 4)}...${t.wallet_address.slice(-4)}`
      ).join(', ') || '';

      const message = this.formatSignalMessage({
        coin: signal.coin_address,
        symbol: tokenInfo.symbol || 'Unknown',
        whaleCount,
        whaleNames,
        reason: signal.trigger_reason || 'Multiple whale buys detected'
      });

      // Send to all channels
      await this.broadcast(message);

    } catch (error) {
      console.error('[WebhookNotifier] Error processing signal webhook:', error);
    }
  }

  private formatSignalMessage(data: {
    coin: string;
    symbol: string;
    whaleCount: number;
    whaleNames: string;
    reason: string;
  }): string {
    const dexScreenerUrl = `https://dexscreener.com/solana/${data.coin}`;
    
    // HTML format for Telegram
    const htmlMessage = `<b>🚨 NEW SIGNAL: ${data.symbol}</b>\n\n` +
      `<b>Token:</b> <code>${data.coin}</code>\n` +
      `<b>Whales:</b> ${data.whaleCount} (${data.whaleNames})\n` +
      `<b>Reason:</b> ${data.reason}\n\n` +
      `<a href="${dexScreenerUrl}">View on DexScreener</a>`;

    // Plain text for Discord/CLI
    const plainMessage = `🚨 **NEW SIGNAL: ${data.symbol}**\n\n` +
      `**Token:** \`${data.coin}\`\n` +
      `**Whales:** ${data.whaleCount} (${data.whaleNames})\n` +
      `**Reason:** ${data.reason}\n\n` +
      `View on DexScreener: ${dexScreenerUrl}`;

    return process.env.TELEGRAM_BOT_TOKEN ? htmlMessage : plainMessage;
  }

  private async broadcast(message: string) {
    // CLI notification
    console.log('\n' + '='.repeat(60));
    console.log(message.replace(/<[^>]*>/g, '')); // Strip HTML
    console.log('='.repeat(60) + '\n');

    // Telegram
    if (this.channels.telegram) {
      try {
        await this.channels.telegram.sendMessage(
          this.channels.telegram.chatId,
          message
        );
      } catch (error) {
        console.error('[WebhookNotifier] Telegram send failed:', error);
      }
    }

    // Discord
    if (this.channels.discord) {
      try {
        await this.channels.discord.sendMessage(message);
      } catch (error) {
        console.error('[WebhookNotifier] Discord send failed:', error);
      }
    }
  }

  // Health check endpoint data
  getStatus() {
    return {
      service: 'webhook-notifier',
      channels: Object.keys(this.channels),
      status: 'healthy',
      timestamp: new Date().toISOString()
    };
  }
}