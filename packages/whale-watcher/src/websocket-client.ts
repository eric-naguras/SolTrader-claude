import WebSocket from 'ws';
import { Logger } from '@sonar/shared';
import { HeliusWebSocketMessage, HeliusTransactionUpdate } from './types';

export interface WebSocketClientOptions {
  url: string;
  apiKey: string;
  logger: Logger;
  onTransaction: (tx: HeliusTransactionUpdate) => void;
  onError?: (error: Error) => void;
  onConnect?: () => void;
  onDisconnect?: () => void;
  reconnectDelay?: number;
  maxReconnectAttempts?: number;
}

export class HeliusWebSocketClient {
  private ws: WebSocket | null = null;
  private options: WebSocketClientOptions;
  private reconnectAttempts = 0;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private pingInterval: NodeJS.Timeout | null = null;
  private isClosing = false;
  private subscriptions = new Map<string, number>();

  constructor(options: WebSocketClientOptions) {
    this.options = {
      reconnectDelay: 5000,
      maxReconnectAttempts: 10,
      ...options,
    };
  }

  async connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        const wsUrl = `${this.options.url}${this.options.apiKey}`;
        this.ws = new WebSocket(wsUrl);

        this.ws.on('open', () => {
          this.options.logger.info('WebSocket connected to Helius');
          this.reconnectAttempts = 0;
          this.setupPingInterval();
          
          if (this.options.onConnect) {
            this.options.onConnect();
          }
          
          resolve();
        });

        this.ws.on('message', (data: WebSocket.Data) => {
          try {
            const message = JSON.parse(data.toString()) as HeliusWebSocketMessage;
            this.handleMessage(message);
          } catch (error) {
            this.options.logger.error('Failed to parse WebSocket message', error as Error);
          }
        });

        this.ws.on('error', (error: Error) => {
          this.options.logger.error('WebSocket error', error);
          if (this.options.onError) {
            this.options.onError(error);
          }
        });

        this.ws.on('close', (code: number, reason: string) => {
          this.options.logger.info('WebSocket disconnected', { code, reason });
          this.cleanup();
          
          if (this.options.onDisconnect) {
            this.options.onDisconnect();
          }
          
          if (!this.isClosing) {
            this.scheduleReconnect();
          }
        });

      } catch (error) {
        reject(error);
      }
    });
  }

  async disconnect(): Promise<void> {
    this.isClosing = true;
    this.cleanup();
    
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.close(1000, 'Client disconnect');
    }
  }

  async subscribeToWallet(address: string): Promise<void> {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      throw new Error('WebSocket not connected');
    }

    const message = {
      jsonrpc: '2.0',
      id: Date.now(),
      method: 'transactionSubscribe',
      params: [
        {
          accountInclude: [address],
          commitment: 'confirmed',
          encoding: 'jsonParsed',
          transactionDetails: 'full',
          showRewards: false,
          maxSupportedTransactionVersion: 0,
        },
      ],
    };

    this.ws.send(JSON.stringify(message));
    this.options.logger.debug('Subscribed to wallet', { address });
  }

  async unsubscribeFromWallet(address: string): Promise<void> {
    const subscriptionId = this.subscriptions.get(address);
    if (!subscriptionId || !this.ws || this.ws.readyState !== WebSocket.OPEN) {
      return;
    }

    const message = {
      jsonrpc: '2.0',
      id: Date.now(),
      method: 'transactionUnsubscribe',
      params: [subscriptionId],
    };

    this.ws.send(JSON.stringify(message));
    this.subscriptions.delete(address);
    this.options.logger.debug('Unsubscribed from wallet', { address });
  }

  private handleMessage(message: HeliusWebSocketMessage): void {
    if (message.type === 'transaction') {
      const txUpdate = message.data as HeliusTransactionUpdate;
      this.options.onTransaction(txUpdate);
    } else if (message.error) {
      this.options.logger.error('WebSocket error message', { error: message.error });
    }
  }

  private setupPingInterval(): void {
    this.pingInterval = setInterval(() => {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        this.ws.ping();
      }
    }, 30000); // Ping every 30 seconds
  }

  private cleanup(): void {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }
    
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    
    this.ws = null;
  }

  private scheduleReconnect(): void {
    if (this.reconnectAttempts >= this.options.maxReconnectAttempts!) {
      this.options.logger.error('Max reconnection attempts reached');
      return;
    }

    this.reconnectAttempts++;
    const delay = this.options.reconnectDelay! * Math.pow(2, this.reconnectAttempts - 1);
    
    this.options.logger.info(`Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts})`);
    
    this.reconnectTimer = setTimeout(async () => {
      try {
        await this.connect();
        // Re-subscribe to all wallets after reconnection
        for (const address of this.subscriptions.keys()) {
          await this.subscribeToWallet(address);
        }
      } catch (error) {
        this.options.logger.error('Reconnection failed', error as Error);
      }
    }, delay);
  }

  isConnected(): boolean {
    return this.ws !== null && this.ws.readyState === WebSocket.OPEN;
  }

  getStats(): {
    connected: boolean;
    subscriptions: number;
    reconnectAttempts: number;
  } {
    return {
      connected: this.isConnected(),
      subscriptions: this.subscriptions.size,
      reconnectAttempts: this.reconnectAttempts,
    };
  }
}