import { 
  BaseService, 
  CheckResult, 
  WhaleWatcherConfig,
  TrackedWallet,
  WhaleTrade,
  getActiveWallets,
  insertWhaleTrade,
  getOrCreateToken,
  upsertWallet,
  retryWithBackoff,
  isValidSolanaAddress,
  WebSocketError,
  DatabaseError,
  ValidationError,
} from '@sonar/shared';
import { createSupabaseClient } from '@sonar/shared';
import { HeliusWebSocketClient } from './websocket-client';
import { TransactionParser } from './transaction-parser';
import { HeliusTransactionUpdate, TransactionStats, WalletSubscription } from './types';
import { IWhaleWatcherService, ConnectionStatus } from '../../../api/services/whale-watcher.interface';

export class WhaleWatcherService extends BaseService implements IWhaleWatcherService {
  private wsClient: HeliusWebSocketClient | null = null;
  private parser: TransactionParser;
  private walletSubscriptions = new Map<string, WalletSubscription>();
  private stats: TransactionStats = {
    total: 0,
    processed: 0,
    swaps: 0,
    errors: 0,
  };
  private config: WhaleWatcherConfig;

  constructor(config: WhaleWatcherConfig) {
    const supabase = createSupabaseClient(config.database);
    super(config.service, supabase);
    this.config = config;
    this.parser = new TransactionParser(this.logger);
  }

  protected async initialize(): Promise<void> {
    // Initialize WebSocket client
    this.wsClient = new HeliusWebSocketClient({
      url: this.config.helius.websocket_url,
      apiKey: this.config.helius.api_key,
      logger: this.logger,
      onTransaction: this.handleTransaction.bind(this),
      onError: this.handleWebSocketError.bind(this),
      onConnect: this.handleWebSocketConnect.bind(this),
      onDisconnect: this.handleWebSocketDisconnect.bind(this),
      reconnectDelay: this.config.monitoring.reconnect_delay,
      maxReconnectAttempts: this.config.monitoring.max_reconnect_attempts,
    });

    // Connect to WebSocket
    await this.wsClient.connect();

    // Load and subscribe to active wallets
    await this.loadActiveWallets();
  }

  protected async cleanup(): Promise<void> {
    if (this.wsClient) {
      await this.wsClient.disconnect();
      this.wsClient = null;
    }
  }

  protected async performHealthChecks(): Promise<Record<string, CheckResult>> {
    const checks: Record<string, CheckResult> = {};

    // WebSocket health check
    if (this.wsClient) {
      const wsStats = this.wsClient.getStats();
      checks.websocket = {
        status: wsStats.connected ? 'ok' : 'error',
        message: wsStats.connected ? 'Connected' : 'Disconnected',
        last_check: new Date(),
      };
    }

    return checks;
  }

  async addWallet(
    address: string,
    options?: {
      alias?: string;
      tags?: string[];
      metadata?: Record<string, any>;
    }
  ): Promise<TrackedWallet> {
    // Validate address
    if (!isValidSolanaAddress(address)) {
      throw new ValidationError('Invalid Solana wallet address');
    }

    try {
      // Add to database
      const wallet = await upsertWallet(this.supabase, {
        address,
        alias: options?.alias,
        is_active: true,
        tags: options?.tags || [],
        metadata: options?.metadata || {},
      });

      // Subscribe to WebSocket updates
      await this.subscribeToWallet(wallet);

      this.logger.info('Added wallet to tracking', { address, alias: options?.alias });
      return wallet;
    } catch (error) {
      throw new DatabaseError('Failed to add wallet', error);
    }
  }

  async removeWallet(address: string): Promise<void> {
    if (!isValidSolanaAddress(address)) {
      throw new ValidationError('Invalid Solana wallet address');
    }

    try {
      // Update database
      await this.supabase
        .from('tracked_wallets')
        .update({ is_active: false })
        .eq('address', address);

      // Unsubscribe from WebSocket
      if (this.wsClient) {
        await this.wsClient.unsubscribeFromWallet(address);
      }

      this.walletSubscriptions.delete(address);
      this.logger.info('Removed wallet from tracking', { address });
    } catch (error) {
      throw new DatabaseError('Failed to remove wallet', error);
    }
  }

  async setWalletActive(address: string, isActive: boolean): Promise<void> {
    if (!isValidSolanaAddress(address)) {
      throw new ValidationError('Invalid Solana wallet address');
    }

    try {
      await this.supabase
        .from('tracked_wallets')
        .update({ is_active: isActive })
        .eq('address', address);

      if (isActive) {
        const wallet = await this.supabase
          .from('tracked_wallets')
          .select('*')
          .eq('address', address)
          .single();
        
        if (wallet.data) {
          await this.subscribeToWallet(wallet.data);
        }
      } else {
        if (this.wsClient) {
          await this.wsClient.unsubscribeFromWallet(address);
        }
        this.walletSubscriptions.delete(address);
      }

      this.logger.info('Updated wallet active status', { address, isActive });
    } catch (error) {
      throw new DatabaseError('Failed to update wallet status', error);
    }
  }

  async getActiveWallets(): Promise<TrackedWallet[]> {
    try {
      return await getActiveWallets(this.supabase);
    } catch (error) {
      throw new DatabaseError('Failed to get active wallets', error);
    }
  }

  async refreshWalletList(): Promise<void> {
    await this.loadActiveWallets();
  }

  async processTransaction(transaction: HeliusTransactionUpdate): Promise<WhaleTrade | null> {
    const startTime = Date.now();
    
    try {
      this.stats.total++;

      // Parse the transaction
      const swapInfo = this.parser.parseSwapTransaction(transaction);
      if (!swapInfo) {
        return null;
      }

      // Check if it's a relevant trade
      if (!this.parser.isRelevantSwap(swapInfo, this.config.filters.min_trade_value_sol)) {
        return null;
      }

      // Check if token is in ignore list
      if (this.config.filters.ignored_tokens.includes(swapInfo.to.mint)) {
        return null;
      }

      // Get or create token
      const token = await getOrCreateToken(this.supabase, {
        address: swapInfo.to.mint,
        // Token metadata would be fetched from chain here
      });

      // Get wallet info
      const wallet = this.walletSubscriptions.get(swapInfo.from.owner);
      if (!wallet) {
        this.logger.warn('Transaction from unknown wallet', { 
          wallet: swapInfo.from.owner,
          tx: transaction.signature,
        });
        return null;
      }

      // Calculate SOL amount
      let solAmount = 0;
      if (swapInfo.from.mint === 'So11111111111111111111111111111111111111112') {
        solAmount = parseFloat(swapInfo.from.amount) / 1e9;
      }

      // Insert trade
      const trade = await insertWhaleTrade(this.supabase, {
        wallet_id: wallet.address, // This should be the wallet ID from DB
        wallet_address: wallet.address,
        token_id: token.id,
        token_address: token.address,
        trade_type: this.parser.getTradeType(swapInfo),
        sol_amount: solAmount,
        token_amount: parseFloat(swapInfo.to.amount) / Math.pow(10, swapInfo.to.decimals),
        transaction_hash: transaction.signature,
        block_slot: transaction.slot,
        trade_timestamp: new Date(transaction.timestamp * 1000),
        raw_data: transaction,
      });

      this.stats.processed++;
      this.stats.swaps++;
      this.stats.lastProcessedAt = new Date();

      const processingTime = Date.now() - startTime;
      this.logger.transactionProcessed(transaction.signature, wallet.address, {
        processingTimeMs: processingTime,
        tokenAddress: token.address,
        tradeType: trade.trade_type,
      });

      this.emit('newTrade', trade);
      return trade;
    } catch (error) {
      this.stats.errors++;
      this.logger.error('Failed to process transaction', error as Error, {
        signature: transaction.signature,
      });
      return null;
    }
  }

  async parseSwapTransaction(transaction: HeliusTransactionUpdate): Promise<any> {
    return this.parser.parseSwapTransaction(transaction);
  }

  isRelevantTrade(transaction: any): boolean {
    return this.parser.isRelevantSwap(transaction, this.config.filters.min_trade_value_sol);
  }

  async testConnection(): Promise<boolean> {
    return this.wsClient?.isConnected() || false;
  }

  async getConnectionStats(): Promise<any> {
    return {
      connected: this.wsClient?.isConnected() || false,
      connectionStartTime: this.startTime,
      lastMessageTime: this.stats.lastProcessedAt,
      messagesReceived: this.stats.total,
      reconnectAttempts: this.wsClient?.getStats().reconnectAttempts || 0,
      errors: this.stats.errors,
    };
  }

  onNewTrade(callback: (trade: WhaleTrade) => void): () => void {
    return this.on('newTrade', callback);
  }

  onConnectionChange(callback: (status: ConnectionStatus) => void): () => void {
    return this.on('connectionChange', callback);
  }

  onError(callback: (error: Error) => void): () => void {
    return this.on('error', callback);
  }

  async getMetrics(): Promise<any> {
    return {
      transactions_processed: this.stats.processed,
      signals_generated: 0, // This will be tracked by signal processor
      notifications_sent: 0, // This will be tracked by notifier
      errors_count: this.stats.errors,
      average_latency_ms: 0, // TODO: Implement latency tracking
      memory_usage_mb: process.memoryUsage().heapUsed / 1024 / 1024,
      cpu_usage_percent: 0, // TODO: Implement CPU tracking
    };
  }

  private async loadActiveWallets(): Promise<void> {
    try {
      const wallets = await getActiveWallets(this.supabase);
      
      // Subscribe to new wallets
      for (const wallet of wallets) {
        if (!this.walletSubscriptions.has(wallet.address)) {
          await this.subscribeToWallet(wallet);
        }
      }

      // Unsubscribe from removed wallets
      const activeAddresses = new Set(wallets.map(w => w.address));
      for (const [address] of this.walletSubscriptions) {
        if (!activeAddresses.has(address)) {
          await this.wsClient?.unsubscribeFromWallet(address);
          this.walletSubscriptions.delete(address);
        }
      }

      this.logger.info('Loaded active wallets', { count: wallets.length });
    } catch (error) {
      throw new DatabaseError('Failed to load active wallets', error);
    }
  }

  private async subscribeToWallet(wallet: TrackedWallet): Promise<void> {
    if (!this.wsClient) {
      throw new WebSocketError('WebSocket client not initialized');
    }

    await retryWithBackoff(
      async () => {
        await this.wsClient!.subscribeToWallet(wallet.address);
        this.walletSubscriptions.set(wallet.address, {
          address: wallet.address,
          alias: wallet.alias || undefined,
          lastActivity: new Date(),
        });
      },
      {
        maxAttempts: 3,
        onRetry: (attempt, error) => {
          this.logger.warn(`Retrying wallet subscription (attempt ${attempt})`, {
            wallet: wallet.address,
            error: error.message,
          });
        },
      }
    );
  }

  private async handleTransaction(tx: HeliusTransactionUpdate): Promise<void> {
    await this.processTransaction(tx);
  }

  private handleWebSocketError(error: Error): void {
    this.handleError(error, 'WebSocket');
  }

  private handleWebSocketConnect(): void {
    this.logger.connectionEstablished('Helius WebSocket');
    this.emit('connectionChange', {
      status: 'connected',
      timestamp: new Date(),
    });
  }

  private handleWebSocketDisconnect(): void {
    this.logger.info('WebSocket disconnected');
    this.emit('connectionChange', {
      status: 'disconnected',
      timestamp: new Date(),
    });
  }
}