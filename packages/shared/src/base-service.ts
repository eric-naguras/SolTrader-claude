import { Logger, createLogger } from './logger';
import { ServiceConfig, ServiceStatus, CheckResult } from './types';
import { SupabaseDatabase, checkDatabaseHealth } from './database';
import { TypedEventEmitter } from './utils';

export interface BaseServiceEvents {
  started: void;
  stopped: void;
  error: Error;
  healthCheck: ServiceStatus;
}

export abstract class BaseService extends TypedEventEmitter<BaseServiceEvents> {
  protected logger: Logger;
  protected config: ServiceConfig;
  protected supabase: SupabaseDatabase;
  protected isRunning = false;
  protected startTime: Date | null = null;
  private healthCheckInterval: NodeJS.Timeout | null = null;

  constructor(config: ServiceConfig, supabase: SupabaseDatabase) {
    super();
    this.config = config;
    this.supabase = supabase;
    this.logger = new Logger(createLogger(config));
  }

  async start(): Promise<void> {
    if (this.isRunning) {
      throw new Error('Service is already running');
    }

    try {
      this.logger.info('Starting service...');
      
      // Check database connection
      const dbHealthy = await checkDatabaseHealth(this.supabase);
      if (!dbHealthy) {
        throw new Error('Database connection failed');
      }
      
      // Call service-specific initialization
      await this.initialize();
      
      this.isRunning = true;
      this.startTime = new Date();
      
      // Start health check monitoring
      this.startHealthChecks();
      
      this.logger.serviceStarted();
      this.emit('started', undefined);
    } catch (error) {
      this.logger.error('Failed to start service', error as Error);
      throw error;
    }
  }

  async stop(): Promise<void> {
    if (!this.isRunning) {
      return;
    }

    try {
      this.logger.serviceStopping();
      
      // Stop health checks
      this.stopHealthChecks();
      
      // Call service-specific cleanup
      await this.cleanup();
      
      this.isRunning = false;
      this.startTime = null;
      
      this.logger.serviceStopped();
      this.emit('stopped', undefined);
    } catch (error) {
      this.logger.error('Error during service shutdown', error as Error);
      throw error;
    }
  }

  async restart(): Promise<void> {
    await this.stop();
    await this.start();
  }

  async getStatus(): Promise<ServiceStatus> {
    const checks: ServiceStatus['checks'] = {
      database: await this.checkDatabase(),
    };

    // Add service-specific health checks
    const additionalChecks = await this.performHealthChecks();
    Object.assign(checks, additionalChecks);

    const allHealthy = Object.values(checks).every(check => check.status === 'ok');

    const status: ServiceStatus = {
      service: this.config.name,
      status: allHealthy ? 'healthy' : 'degraded',
      uptime: this.getUptime(),
      version: this.config.version,
      checks,
    };

    this.emit('healthCheck', status);
    return status;
  }

  protected abstract initialize(): Promise<void>;
  protected abstract cleanup(): Promise<void>;
  protected abstract performHealthChecks(): Promise<Record<string, CheckResult>>;

  private async checkDatabase(): Promise<CheckResult> {
    const start = Date.now();
    try {
      const healthy = await checkDatabaseHealth(this.supabase);
      return {
        status: healthy ? 'ok' : 'error',
        message: healthy ? 'Connected' : 'Connection failed',
        latency_ms: Date.now() - start,
        last_check: new Date(),
      };
    } catch (error) {
      return {
        status: 'error',
        message: (error as Error).message,
        latency_ms: Date.now() - start,
        last_check: new Date(),
      };
    }
  }

  private getUptime(): number {
    if (!this.startTime) return 0;
    return Math.floor((Date.now() - this.startTime.getTime()) / 1000);
  }

  private startHealthChecks(): void {
    const interval = 60000; // 1 minute
    this.healthCheckInterval = setInterval(async () => {
      try {
        await this.getStatus();
      } catch (error) {
        this.logger.error('Health check failed', error as Error);
      }
    }, interval);
  }

  private stopHealthChecks(): void {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = null;
    }
  }

  protected handleError(error: Error, context?: string): void {
    const message = context ? `Error in ${context}` : 'Service error';
    this.logger.error(message, error);
    this.emit('error', error);
  }
}

// Graceful shutdown handler
export function setupGracefulShutdown(services: BaseService[]): void {
  const shutdown = async (signal: string) => {
    console.log(`\nReceived ${signal}, shutting down gracefully...`);
    
    for (const service of services) {
      try {
        await service.stop();
      } catch (error) {
        console.error(`Error stopping service:`, error);
      }
    }
    
    process.exit(0);
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
  
  process.on('uncaughtException', (error) => {
    console.error('Uncaught exception:', error);
    shutdown('uncaughtException');
  });
  
  process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled rejection at:', promise, 'reason:', reason);
    shutdown('unhandledRejection');
  });
}