import { 
  TrackedWallet, 
  WhaleTrade, 
  ServiceStatus, 
  ServiceMetrics,
  HeliusTransaction,
  ParsedSwapTransaction 
} from '../types';

/**
 * WhaleWatcher Service Interface
 * Responsible for monitoring blockchain transactions from tracked wallets
 */
export interface IWhaleWatcherService {
  // Lifecycle Management
  /**
   * Initialize and start the whale watching service
   * @throws {ServiceError} If initialization fails
   */
  start(): Promise<void>;

  /**
   * Gracefully stop the service and cleanup resources
   */
  stop(): Promise<void>;

  /**
   * Restart the service (stop and start)
   */
  restart(): Promise<void>;

  // Wallet Management
  /**
   * Add a new wallet to active monitoring
   * @param address - Solana wallet address
   * @param options - Optional wallet configuration
   * @throws {ValidationError} If address is invalid
   * @throws {DatabaseError} If wallet cannot be saved
   */
  addWallet(
    address: string, 
    options?: {
      alias?: string;
      tags?: string[];
      metadata?: Record<string, any>;
    }
  ): Promise<TrackedWallet>;

  /**
   * Remove a wallet from active monitoring
   * @param address - Solana wallet address
   * @throws {ValidationError} If wallet not found
   */
  removeWallet(address: string): Promise<void>;

  /**
   * Update wallet monitoring status
   * @param address - Solana wallet address
   * @param isActive - Whether to actively monitor the wallet
   */
  setWalletActive(address: string, isActive: boolean): Promise<void>;

  /**
   * Get all actively monitored wallets
   */
  getActiveWallets(): Promise<TrackedWallet[]>;

  /**
   * Refresh the wallet list from database
   */
  refreshWalletList(): Promise<void>;

  // Transaction Processing
  /**
   * Process a raw transaction from Helius
   * @param transaction - Raw transaction data
   * @returns Processed trade if relevant, null otherwise
   */
  processTransaction(transaction: HeliusTransaction): Promise<WhaleTrade | null>;

  /**
   * Parse swap details from a transaction
   * @param transaction - Transaction to parse
   * @returns Parsed swap details or null
   */
  parseSwapTransaction(transaction: HeliusTransaction): Promise<ParsedSwapTransaction | null>;

  /**
   * Check if a transaction is a relevant DEX trade
   * @param transaction - Transaction to check
   */
  isRelevantTrade(transaction: ParsedSwapTransaction): boolean;

  // Health & Monitoring
  /**
   * Get current service status
   */
  getStatus(): Promise<ServiceStatus>;

  /**
   * Get service performance metrics
   */
  getMetrics(): Promise<ServiceMetrics>;

  /**
   * Test WebSocket connection health
   */
  testConnection(): Promise<boolean>;

  /**
   * Get WebSocket connection statistics
   */
  getConnectionStats(): Promise<WebSocketStats>;

  // Event Emitters
  /**
   * Subscribe to new trade events
   * @param callback - Function to call when new trade is detected
   * @returns Unsubscribe function
   */
  onNewTrade(callback: (trade: WhaleTrade) => void): () => void;

  /**
   * Subscribe to connection status changes
   * @param callback - Function to call on connection change
   * @returns Unsubscribe function
   */
  onConnectionChange(callback: (status: ConnectionStatus) => void): () => void;

  /**
   * Subscribe to error events
   * @param callback - Function to call on errors
   * @returns Unsubscribe function
   */
  onError(callback: (error: Error) => void): () => void;
}

/**
 * WebSocket connection statistics
 */
export interface WebSocketStats {
  connected: boolean;
  connectionStartTime?: Date;
  lastMessageTime?: Date;
  messagesReceived: number;
  reconnectAttempts: number;
  errors: number;
  latencyMs?: number;
}

/**
 * Connection status information
 */
export interface ConnectionStatus {
  status: 'connecting' | 'connected' | 'disconnected' | 'error';
  message?: string;
  timestamp: Date;
}

/**
 * Whale watcher specific configuration
 */
export interface WhaleWatcherOptions {
  // Helius configuration
  heliusApiKey: string;
  heliusWebsocketUrl?: string;
  heliusRpcUrl?: string;
  commitment?: 'processed' | 'confirmed' | 'finalized';

  // Monitoring settings
  batchSize?: number;
  reconnectDelay?: number;
  maxReconnectAttempts?: number;
  healthCheckInterval?: number;

  // Transaction filters
  minTradeValueSol?: number;
  ignoredTokens?: string[];
  dexPrograms?: string[];

  // Performance tuning
  maxConcurrentProcessing?: number;
  transactionQueueSize?: number;
  processingTimeout?: number;
}

/**
 * Transaction filter configuration
 */
export interface TransactionFilter {
  /**
   * Minimum trade value in SOL to process
   */
  minValueSol: number;

  /**
   * List of token addresses to ignore
   */
  ignoredTokens: string[];

  /**
   * List of DEX program IDs to monitor
   */
  dexPrograms: string[];

  /**
   * Whether to include failed transactions
   */
  includeFailedTx: boolean;
}

/**
 * Internal transaction processing result
 */
export interface ProcessingResult {
  success: boolean;
  trade?: WhaleTrade;
  error?: Error;
  processingTimeMs: number;
}

/**
 * Batch processing statistics
 */
export interface BatchStats {
  batchId: string;
  startTime: Date;
  endTime?: Date;
  transactionsProcessed: number;
  tradesFound: number;
  errors: number;
  averageProcessingTimeMs: number;
}