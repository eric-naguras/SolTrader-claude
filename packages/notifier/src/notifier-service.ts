import { 
  BaseService, 
  CheckResult,
  NotifierConfig,
  TradeSignal,
  NotificationLog,
  subscribeToSignals,
  logNotification,
  ServiceStatus,
  ServiceMetrics,
  NotificationError,
} from '@sonar/shared';
import { createSupabaseClient } from '@sonar/shared';
import { RealtimeChannel } from '@supabase/supabase-js';
import { INotifierService, NotificationChannel as INotificationChannel, NotificationResult } from '../../../api/services/notifier.interface';
import { NotificationChannel } from './channels/base';
import { TelegramChannel } from './channels/telegram';
import { DiscordChannel } from './channels/discord';
import { CLIChannel } from './channels/cli';

export class NotifierService extends BaseService implements INotifierService {
  private channels = new Map<string, NotificationChannel>();
  private signalSubscription: RealtimeChannel | null = null;
  private stats = {
    totalSent: 0,
    totalFailed: 0,
    byChannel: new Map<string, { sent: number; failed: number }>(),
  };

  constructor(config: NotifierConfig) {
    const supabase = createSupabaseClient(config.database);
    super(config.service, supabase);
    
    // Initialize channels based on config
    if (config.channels.telegram) {
      this.channels.set('TELEGRAM', new TelegramChannel(
        config.channels.telegram.bot_token,
        config.channels.telegram.chat_ids,
        this.logger,
        config.channels.telegram.rate_limit
      ));
    }
    
    if (config.channels.discord) {
      this.channels.set('DISCORD', new DiscordChannel(
        config.channels.discord.webhook_url,
        this.logger,
        config.channels.discord.rate_limit
      ));
    }
    
    if (config.channels.cli?.enabled) {
      this.channels.set('CLI', new CLIChannel(this.logger));
    }
  }

  protected async initialize(): Promise<void> {
    // Initialize all channels
    for (const [name, channel] of this.channels) {
      try {
        await channel.initialize();
        this.logger.info(`Initialized ${name} channel`);
        this.stats.byChannel.set(name, { sent: 0, failed: 0 });
      } catch (error) {
        this.logger.error(`Failed to initialize ${name} channel`, error as Error);
        this.channels.delete(name);
      }
    }
    
    if (this.channels.size === 0) {
      throw new Error('No notification channels available');
    }
    
    // Subscribe to new signals
    this.signalSubscription = await subscribeToSignals(
      this.supabase,
      async (payload) => {
        try {
          const signal = payload.new as TradeSignal;
          await this.handleNewSignal(signal);
        } catch (error) {
          this.logger.error('Error handling signal', error as Error);
        }
      }
    );
    
    this.logger.info('Subscribed to trade signals');
  }

  protected async cleanup(): Promise<void> {
    // Unsubscribe from signals
    if (this.signalSubscription) {
      await this.signalSubscription.unsubscribe();
      this.signalSubscription = null;
    }
    
    // Clean up all channels
    for (const [name, channel] of this.channels) {
      try {
        await channel.cleanup();
        this.logger.info(`Cleaned up ${name} channel`);
      } catch (error) {
        this.logger.error(`Error cleaning up ${name} channel`, error as Error);
      }
    }
  }

  protected async performHealthChecks(): Promise<Record<string, CheckResult>> {
    const checks: Record<string, CheckResult> = {};
    
    for (const [name, channel] of this.channels) {
      checks[`channel_${name.toLowerCase()}`] = {
        status: channel.isHealthy() ? 'ok' : 'error',
        message: channel.isHealthy() ? 'Healthy' : 'Unhealthy',
        last_check: new Date(),
      };
    }
    
    return checks;
  }

  async sendNotification(
    signal: TradeSignal,
    options?: any
  ): Promise<NotificationResult[]> {
    const results: NotificationResult[] = [];
    const channelsToUse = options?.channels || Array.from(this.channels.keys());
    
    for (const channelName of channelsToUse) {
      const channel = this.channels.get(channelName);
      if (!channel) continue;
      
      const result: NotificationResult = {
        channel: channelName as any,
        success: false,
        recipients: [],
        timestamp: new Date(),
        retryCount: 0,
      };
      
      try {
        await channel.sendNotification(signal);
        result.success = true;
        this.stats.totalSent++;
        this.stats.byChannel.get(channelName)!.sent++;
        
        // Log successful notification
        await logNotification(this.supabase, {
          signal_id: signal.id,
          channel: channelName as any,
          status: 'SENT',
          message: `Signal ${signal.id} sent successfully`,
        });
        
      } catch (error) {
        result.success = false;
        result.error = (error as Error).message;
        this.stats.totalFailed++;
        this.stats.byChannel.get(channelName)!.failed++;
        
        // Log failed notification
        await logNotification(this.supabase, {
          signal_id: signal.id,
          channel: channelName as any,
          status: 'FAILED',
          message: `Failed to send signal ${signal.id}`,
          error_message: (error as Error).message,
        });
        
        this.logger.error(`Failed to send notification via ${channelName}`, error as Error);
      }
      
      results.push(result);
    }
    
    this.emit('notificationSent', results[0]);
    return results;
  }

  async testChannel(channel: string, message?: string): Promise<boolean> {
    const notificationChannel = this.channels.get(channel);
    if (!notificationChannel) {
      throw new NotificationError(channel, 'Channel not configured');
    }
    
    try {
      return await notificationChannel.testChannel();
    } catch (error) {
      this.logger.error(`Test failed for ${channel}`, error as Error);
      return false;
    }
  }

  async broadcast(message: string, priority?: any): Promise<NotificationResult[]> {
    // Create a mock signal for broadcasting
    const mockSignal: TradeSignal = {
      id: 'broadcast',
      token_address: 'N/A',
      status: 'OPEN',
      trigger_reason: message,
      whale_count: 0,
      total_sol_amount: 0,
      metadata: {
        broadcast: true,
        priority,
      },
      created_at: new Date(),
    };
    
    return this.sendNotification(mockSignal);
  }

  async setChannelEnabled(channel: string, enabled: boolean): Promise<void> {
    if (enabled && !this.channels.has(channel)) {
      throw new NotificationError(channel, 'Channel not configured');
    }
    
    // This would typically update a database setting
    this.logger.info(`Channel ${channel} ${enabled ? 'enabled' : 'disabled'}`);
  }

  async getChannelStatus(): Promise<any[]> {
    const statuses = [];
    
    for (const [name, channel] of this.channels) {
      const stats = channel.getStats();
      const channelStats = this.stats.byChannel.get(name);
      
      statuses.push({
        channel: name,
        enabled: stats.enabled,
        healthy: stats.healthy,
        recipientCount: stats.recipientCount,
        lastMessageTime: new Date(), // Would track this in production
        successRate: channelStats 
          ? (channelStats.sent / (channelStats.sent + channelStats.failed)) * 100 
          : 0,
        averageDeliveryTimeMs: 0, // Would track this in production
      });
    }
    
    return statuses;
  }

  async addRecipient(channel: string, recipient: string): Promise<void> {
    // This would typically update channel configuration
    this.logger.info(`Added recipient ${recipient} to ${channel}`);
  }

  async removeRecipient(channel: string, recipient: string): Promise<void> {
    // This would typically update channel configuration
    this.logger.info(`Removed recipient ${recipient} from ${channel}`);
  }

  async formatMessage(signal: TradeSignal, channel: string): Promise<any> {
    // Channel-specific formatting is handled by each channel
    return { channel, content: signal.trigger_reason, format: 'text' };
  }

  async setMessageTemplate(channel: string, template: string): Promise<void> {
    // This would typically update channel configuration
    this.logger.info(`Updated template for ${channel}`);
  }

  async getNotificationHistory(filters?: any): Promise<NotificationLog[]> {
    let query = this.supabase.from('notification_log').select('*');
    
    if (filters?.channels) {
      query = query.in('channel', filters.channels);
    }
    if (filters?.status) {
      query = query.eq('status', filters.status);
    }
    if (filters?.signalId) {
      query = query.eq('signal_id', filters.signalId);
    }
    if (filters?.startDate) {
      query = query.gte('created_at', filters.startDate.toISOString());
    }
    if (filters?.endDate) {
      query = query.lte('created_at', filters.endDate.toISOString());
    }
    
    query = query.order('created_at', { ascending: false });
    
    if (filters?.limit) {
      query = query.limit(filters.limit);
    }
    if (filters?.offset) {
      query = query.range(filters.offset, filters.offset + (filters.limit || 50) - 1);
    }
    
    const { data, error } = await query;
    
    if (error) throw error;
    return data || [];
  }

  async getStatistics(timeRange?: any): Promise<any> {
    const history = await this.getNotificationHistory(timeRange ? {
      startDate: timeRange.start,
      endDate: timeRange.end,
    } : undefined);
    
    const byChannel: Record<string, any> = {};
    const byHour: Record<number, number> = {};
    const errorCounts = new Map<string, number>();
    
    for (const log of history) {
      // By channel stats
      if (!byChannel[log.channel]) {
        byChannel[log.channel] = { sent: 0, delivered: 0, failed: 0 };
      }
      
      if (log.status === 'SENT') {
        byChannel[log.channel].sent++;
        byChannel[log.channel].delivered++;
      } else if (log.status === 'FAILED') {
        byChannel[log.channel].failed++;
        
        // Track errors
        const error = log.error_message || 'Unknown error';
        errorCounts.set(error, (errorCounts.get(error) || 0) + 1);
      }
      
      // By hour stats
      const hour = new Date(log.created_at).getHours();
      byHour[hour] = (byHour[hour] || 0) + 1;
    }
    
    // Calculate success rate
    const totalSent = Object.values(byChannel).reduce((sum: number, ch: any) => sum + ch.sent, 0);
    const totalFailed = Object.values(byChannel).reduce((sum: number, ch: any) => sum + ch.failed, 0);
    const total = totalSent + totalFailed;
    
    // Get top errors
    const topErrors = Array.from(errorCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([error, count]) => ({
        error,
        count,
        lastOccurrence: new Date(), // Would track this properly
        channels: [], // Would track which channels had this error
      }));
    
    return {
      totalSent,
      successRate: total > 0 ? (totalSent / total) * 100 : 0,
      failureRate: total > 0 ? (totalFailed / total) * 100 : 0,
      averageDeliveryTimeMs: 0, // Would calculate from actual delivery times
      byChannel,
      byHour,
      topErrors,
    };
  }

  async getMetrics(): Promise<ServiceMetrics> {
    return {
      transactions_processed: 0, // N/A for notifier
      signals_generated: 0, // N/A for notifier
      notifications_sent: this.stats.totalSent,
      errors_count: this.stats.totalFailed,
      average_latency_ms: 0, // Would track actual latency
      memory_usage_mb: process.memoryUsage().heapUsed / 1024 / 1024,
      cpu_usage_percent: 0, // Would track CPU usage
    };
  }

  onNotificationSent(callback: (result: NotificationResult) => void): () => void {
    return this.on('notificationSent', callback);
  }

  onError(callback: (error: any) => void): () => void {
    return this.on('error', callback);
  }

  private async handleNewSignal(signal: TradeSignal): Promise<void> {
    this.logger.info('New signal received', {
      signalId: signal.id,
      tokenAddress: signal.token_address,
      whaleCount: signal.whale_count,
    });
    
    await this.sendNotification(signal);
  }
}