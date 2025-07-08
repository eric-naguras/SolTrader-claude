import { Logger } from '@sonar/shared';
import { NotificationChannel } from './base';
import { TradeSignal } from '@sonar/shared';

export class CLIChannel implements NotificationChannel {
  private logger: Logger;
  private enabled: boolean;

  constructor(logger: Logger, enabled = true) {
    this.logger = logger;
    this.enabled = enabled;
  }

  async initialize(): Promise<void> {
    this.logger.info('CLI channel initialized');
  }

  async sendNotification(signal: TradeSignal): Promise<void> {
    if (!this.enabled) return;

    const metadata = signal.metadata || {};
    const tokenSymbol = metadata.token_symbol || 'Unknown';
    const tokenName = metadata.token_name || '';
    
    console.log('\n' + '='.repeat(60));
    console.log('🐋 WHALE ALERT');
    console.log('='.repeat(60));
    console.log(`Token: ${tokenSymbol}${tokenName ? ` (${tokenName})` : ''}`);
    console.log(`Address: ${signal.token_address}`);
    console.log(`Whales: ${signal.whale_count}`);
    console.log(`Total SOL: ${signal.total_sol_amount.toFixed(2)}`);
    console.log(`Trigger: ${signal.trigger_reason}`);
    console.log('-'.repeat(60));
    console.log(`DexScreener: https://dexscreener.com/solana/${signal.token_address}`);
    console.log(`Birdeye: https://birdeye.so/token/${signal.token_address}`);
    console.log('='.repeat(60) + '\n');
    
    this.logger.notificationSent('cli', true, {
      signalId: signal.id,
    });
  }

  async testChannel(): Promise<boolean> {
    console.log('\n🔔 TEST NOTIFICATION - CLI channel is working!\n');
    return true;
  }

  async cleanup(): Promise<void> {
    // Nothing to clean up
  }

  isHealthy(): boolean {
    return this.enabled;
  }

  getStats() {
    return {
      enabled: this.enabled,
      healthy: this.enabled,
      recipientCount: 1,
      channel: 'CLI' as const,
    };
  }
}