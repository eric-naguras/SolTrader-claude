import { TradeSignal } from '@sonar/shared';

export interface NotificationChannel {
  initialize(): Promise<void>;
  sendNotification(signal: TradeSignal): Promise<void>;
  testChannel(): Promise<boolean>;
  cleanup(): Promise<void>;
  isHealthy(): boolean;
  getStats(): {
    enabled: boolean;
    healthy: boolean;
    recipientCount: number;
    channel: string;
  };
}