// Service Interface for the event-driven architecture
// All services must implement this interface

export interface ServiceStatus {
  running: boolean;
  error?: string;
  lastHeartbeat?: string;
  metadata?: Record<string, any>;
}

export interface Service {
  readonly name: string;
  start(): Promise<void>;
  stop(): Promise<void>;
  getStatus(): ServiceStatus;
}

// Helper type for service constructors
export type ServiceConstructor<T extends Service = Service> = new (messageBus: MessageBus) => T;

// Import MessageBus type for constructor constraint
import type { MessageBus } from './message-bus.js';