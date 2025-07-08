import { 
  TradeSignal, 
  NotificationLog,
  ServiceStatus, 
  ServiceMetrics 
} from '../types';

/**
 * Notifier Service Interface
 * Responsible for delivering alerts across multiple channels
 */
export interface INotifierService {
  // Lifecycle Management
  /**
   * Initialize and start the notification service
   * @throws {ServiceError} If initialization fails
   */
  start(): Promise<void>;

  /**
   * Gracefully stop the service
   */
  stop(): Promise<void>;

  // Core Notification Functions
  /**
   * Send a notification for a trade signal
   * @param signal - The trade signal to notify about
   * @param options - Optional notification settings
   * @returns Array of notification results
   */
  sendNotification(
    signal: TradeSignal,
    options?: NotificationOptions
  ): Promise<NotificationResult[]>;

  /**
   * Send a test notification to verify channel configuration
   * @param channel - Channel to test
   * @param message - Optional test message
   * @returns Success status
   */
  testChannel(
    channel: NotificationChannel,
    message?: string
  ): Promise<boolean>;

  /**
   * Broadcast a custom message to all channels
   * @param message - Message to broadcast
   * @param priority - Message priority level
   */
  broadcast(
    message: string,
    priority?: NotificationPriority
  ): Promise<NotificationResult[]>;

  // Channel Management
  /**
   * Enable or disable a notification channel
   * @param channel - Channel to configure
   * @param enabled - Whether to enable the channel
   */
  setChannelEnabled(
    channel: NotificationChannel,
    enabled: boolean
  ): Promise<void>;

  /**
   * Get status of all configured channels
   */
  getChannelStatus(): Promise<ChannelStatus[]>;

  /**
   * Add a recipient to a channel
   * @param channel - Target channel
   * @param recipient - Recipient identifier (chat ID, webhook URL, etc.)
   */
  addRecipient(
    channel: NotificationChannel,
    recipient: string
  ): Promise<void>;

  /**
   * Remove a recipient from a channel
   * @param channel - Target channel
   * @param recipient - Recipient identifier
   */
  removeRecipient(
    channel: NotificationChannel,
    recipient: string
  ): Promise<void>;

  // Message Formatting
  /**
   * Format a signal for a specific channel
   * @param signal - Trade signal to format
   * @param channel - Target channel
   * @returns Formatted message
   */
  formatMessage(
    signal: TradeSignal,
    channel: NotificationChannel
  ): Promise<FormattedMessage>;

  /**
   * Set custom message template for a channel
   * @param channel - Target channel
   * @param template - Message template
   */
  setMessageTemplate(
    channel: NotificationChannel,
    template: string
  ): Promise<void>;

  // History & Analytics
  /**
   * Get notification history
   * @param filters - Optional filters
   * @returns Array of notification logs
   */
  getNotificationHistory(
    filters?: NotificationHistoryFilters
  ): Promise<NotificationLog[]>;

  /**
   * Get notification statistics
   * @param timeRange - Time range for statistics
   */
  getStatistics(
    timeRange?: TimeRange
  ): Promise<NotificationStatistics>;

  // Health & Monitoring
  /**
   * Get current service status
   */
  getStatus(): Promise<ServiceStatus>;

  /**
   * Get service performance metrics
   */
  getMetrics(): Promise<ServiceMetrics>;

  // Event Subscriptions
  /**
   * Subscribe to notification sent events
   * @param callback - Function to call when notification is sent
   * @returns Unsubscribe function
   */
  onNotificationSent(
    callback: (result: NotificationResult) => void
  ): () => void;

  /**
   * Subscribe to notification error events
   * @param callback - Function to call on errors
   * @returns Unsubscribe function
   */
  onError(
    callback: (error: NotificationError) => void
  ): () => void;
}

/**
 * Supported notification channels
 */
export type NotificationChannel = 'TELEGRAM' | 'DISCORD' | 'CLI' | 'EMAIL' | 'WEBHOOK';

/**
 * Notification priority levels
 */
export type NotificationPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';

/**
 * Notification delivery options
 */
export interface NotificationOptions {
  /**
   * Channels to send to (defaults to all enabled)
   */
  channels?: NotificationChannel[];

  /**
   * Message priority
   */
  priority?: NotificationPriority;

  /**
   * Whether to retry on failure
   */
  retry?: boolean;

  /**
   * Maximum retry attempts
   */
  maxRetries?: number;

  /**
   * Custom message overrides per channel
   */
  customMessages?: Partial<Record<NotificationChannel, string>>;

  /**
   * Additional metadata to include
   */
  metadata?: Record<string, any>;
}

/**
 * Result of a notification attempt
 */
export interface NotificationResult {
  channel: NotificationChannel;
  success: boolean;
  recipients: string[];
  messageId?: string;
  error?: string;
  timestamp: Date;
  retryCount: number;
}

/**
 * Channel status information
 */
export interface ChannelStatus {
  channel: NotificationChannel;
  enabled: boolean;
  healthy: boolean;
  recipientCount: number;
  lastMessageTime?: Date;
  successRate: number;
  averageDeliveryTimeMs: number;
  error?: string;
}

/**
 * Formatted message for a specific channel
 */
export interface FormattedMessage {
  channel: NotificationChannel;
  content: string;
  format: 'text' | 'markdown' | 'html' | 'embed';
  attachments?: MessageAttachment[];
  metadata?: Record<string, any>;
}

/**
 * Message attachment
 */
export interface MessageAttachment {
  type: 'image' | 'file' | 'link';
  url?: string;
  data?: Buffer;
  filename?: string;
  mimeType?: string;
}

/**
 * Filters for notification history
 */
export interface NotificationHistoryFilters {
  channels?: NotificationChannel[];
  status?: 'PENDING' | 'SENT' | 'FAILED';
  signalId?: string;
  startDate?: Date;
  endDate?: Date;
  limit?: number;
  offset?: number;
}

/**
 * Notification statistics
 */
export interface NotificationStatistics {
  totalSent: number;
  successRate: number;
  failureRate: number;
  averageDeliveryTimeMs: number;
  byChannel: Record<NotificationChannel, ChannelStatistics>;
  byHour: Record<number, number>;
  topErrors: ErrorStatistic[];
}

/**
 * Per-channel statistics
 */
export interface ChannelStatistics {
  sent: number;
  delivered: number;
  failed: number;
  averageDeliveryTimeMs: number;
}

/**
 * Error statistics
 */
export interface ErrorStatistic {
  error: string;
  count: number;
  lastOccurrence: Date;
  channels: NotificationChannel[];
}

/**
 * Time range specification
 */
export interface TimeRange {
  start: Date;
  end: Date;
}

/**
 * Notification-specific error
 */
export interface NotificationError {
  channel: NotificationChannel;
  error: Error;
  signalId?: string;
  recipients?: string[];
  timestamp: Date;
}

/**
 * Channel-specific configuration
 */
export interface ChannelConfig {
  enabled: boolean;
  recipients: string[];
  rateLimit?: number;
  retryPolicy?: RetryPolicy;
  customTemplate?: string;
  metadata?: Record<string, any>;
}

/**
 * Retry policy configuration
 */
export interface RetryPolicy {
  maxAttempts: number;
  backoffMultiplier: number;
  initialDelayMs: number;
  maxDelayMs: number;
}

/**
 * Telegram-specific configuration
 */
export interface TelegramConfig extends ChannelConfig {
  botToken: string;
  chatIds: string[];
  parseMode?: 'Markdown' | 'HTML';
  disableNotification?: boolean;
  disableWebPagePreview?: boolean;
}

/**
 * Discord-specific configuration
 */
export interface DiscordConfig extends ChannelConfig {
  webhookUrl: string;
  username?: string;
  avatarUrl?: string;
  embedColor?: number;
}

/**
 * Email-specific configuration
 */
export interface EmailConfig extends ChannelConfig {
  smtpHost: string;
  smtpPort: number;
  smtpUser: string;
  smtpPassword: string;
  fromAddress: string;
  toAddresses: string[];
}