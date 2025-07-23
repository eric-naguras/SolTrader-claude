// Message Bus for inter-service communication
// Replaces database polling with event-driven updates

import { EventEmitter } from 'events';

export type MessageBusEvent = 
  // Configuration events
  | 'config_changed'
  | 'logging_config_changed'
  | 'ui_config_changed'
  // Service events
  | 'service_started'
  | 'service_stopped'
  | 'service_restarted'
  | 'service_error'
  // Trading events
  | 'trading_enabled'
  | 'trading_disabled'
  | 'analysis_triggered'
  // Data events
  | 'new_trade'
  | 'new_signal'
  | 'wallet_updated'
  | 'stats_updated';

export interface MessageBusEventData {
  config_changed: { type: string; config: any };
  logging_config_changed: { log_categories: any };
  ui_config_changed: { ui_refresh_config: any };
  service_started: { serviceName: string };
  service_stopped: { serviceName: string };
  service_restarted: { serviceName: string };
  service_error: { serviceName: string; error: string };
  trading_enabled: {};
  trading_disabled: {};
  analysis_triggered: {};
  new_trade: { trade: any };
  new_signal: { signal: any };
  wallet_updated: { wallet: any };
  stats_updated: { stats: any };
}

class MessageBus extends EventEmitter {
  private static instance: MessageBus;

  private constructor() {
    super();
    this.setMaxListeners(50); // Allow many services to listen
  }

  static getInstance(): MessageBus {
    if (!MessageBus.instance) {
      MessageBus.instance = new MessageBus();
    }
    return MessageBus.instance;
  }

  // Type-safe event emission
  publish<T extends MessageBusEvent>(
    event: T, 
    data: MessageBusEventData[T]
  ): void {
    console.log(`[MessageBus] Publishing event: ${event}`, data);
    this.emit(event, data);
  }

  // Type-safe event subscription
  subscribe<T extends MessageBusEvent>(
    event: T,
    handler: (data: MessageBusEventData[T]) => void
  ): void {
    console.log(`[MessageBus] Subscribing to event: ${event}`);
    this.on(event, handler);
  }

  // Remove subscription
  unsubscribe<T extends MessageBusEvent>(
    event: T,
    handler: (data: MessageBusEventData[T]) => void
  ): void {
    console.log(`[MessageBus] Unsubscribing from event: ${event}`);
    this.off(event, handler);
  }

  // Get subscriber count for debugging
  getSubscriberCount(event: MessageBusEvent): number {
    return this.listenerCount(event);
  }

  // List all active events for debugging
  getActiveEvents(): string[] {
    return this.eventNames() as string[];
  }
}

// Export singleton instance
export const messageBus = MessageBus.getInstance();
export default messageBus;