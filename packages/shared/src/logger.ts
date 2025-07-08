import winston from 'winston';
import { ServiceConfig } from './types';

const { combine, timestamp, printf, colorize, errors } = winston.format;

// Custom log format
const logFormat = printf(({ level, message, timestamp, service, ...metadata }) => {
  let msg = `${timestamp} [${service}] ${level}: ${message}`;
  
  // Add metadata if present
  const metadataStr = Object.keys(metadata).length > 0 
    ? ` ${JSON.stringify(metadata)}` 
    : '';
  
  return msg + metadataStr;
});

export function createLogger(config: ServiceConfig): winston.Logger {
  const logger = winston.createLogger({
    level: config.logLevel,
    format: combine(
      errors({ stack: true }),
      timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
      config.environment === 'development' ? colorize() : winston.format.uncolorize(),
      logFormat
    ),
    defaultMeta: { service: config.name },
    transports: [
      new winston.transports.Console({
        stderrLevels: ['error'],
      }),
    ],
  });

  // Add file transport in production
  if (config.environment === 'production') {
    logger.add(new winston.transports.File({
      filename: `logs/${config.name}-error.log`,
      level: 'error',
    }));
    
    logger.add(new winston.transports.File({
      filename: `logs/${config.name}.log`,
    }));
  }

  return logger;
}

// Helper class for structured logging
export class Logger {
  private logger: winston.Logger;

  constructor(logger: winston.Logger) {
    this.logger = logger;
  }

  debug(message: string, meta?: any): void {
    this.logger.debug(message, meta);
  }

  info(message: string, meta?: any): void {
    this.logger.info(message, meta);
  }

  warn(message: string, meta?: any): void {
    this.logger.warn(message, meta);
  }

  error(message: string, error?: Error | any, meta?: any): void {
    if (error instanceof Error) {
      this.logger.error(message, { ...meta, error: error.message, stack: error.stack });
    } else if (error) {
      this.logger.error(message, { ...meta, error });
    } else {
      this.logger.error(message, meta);
    }
  }

  // Specialized logging methods
  serviceStarted(port?: number): void {
    const meta = port ? { port } : undefined;
    this.info('Service started', meta);
  }

  serviceStopping(): void {
    this.info('Service stopping...');
  }

  serviceStopped(): void {
    this.info('Service stopped');
  }

  connectionEstablished(service: string, meta?: any): void {
    this.info(`Connected to ${service}`, meta);
  }

  connectionFailed(service: string, error: Error): void {
    this.error(`Failed to connect to ${service}`, error);
  }

  transactionProcessed(txHash: string, walletAddress: string, meta?: any): void {
    this.debug('Transaction processed', { txHash, walletAddress, ...meta });
  }

  signalGenerated(tokenAddress: string, whaleCount: number, meta?: any): void {
    this.info('Signal generated', { tokenAddress, whaleCount, ...meta });
  }

  notificationSent(channel: string, success: boolean, meta?: any): void {
    const level = success ? 'info' : 'error';
    this.logger.log(level, `Notification ${success ? 'sent' : 'failed'}`, { 
      channel, 
      success, 
      ...meta 
    });
  }

  tradeRecorded(tradeId: string, tokenAddress: string, meta?: any): void {
    this.info('Trade recorded', { tradeId, tokenAddress, ...meta });
  }

  priceUpdated(tokenAddress: string, price: number, meta?: any): void {
    this.debug('Price updated', { tokenAddress, price, ...meta });
  }

  // Performance logging
  startTimer(operation: string): () => void {
    const start = Date.now();
    return () => {
      const duration = Date.now() - start;
      this.debug(`${operation} completed`, { durationMs: duration });
    };
  }
}