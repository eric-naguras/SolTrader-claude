import { Service, ServiceStatus } from '../lib/service-interface.js';
import { MessageBus } from '../lib/message-bus.js';
import { database } from '../lib/database.js';
import { Logger } from '../lib/logger.js';
import type { WhaleTrade } from '../lib/database.js';

export class WalletUpdater implements Service {
  readonly name = 'WalletUpdater';
  
  private logger: Logger;
  private messageBus: MessageBus;
  private isRunning: boolean = false;
  private unsubscribers: (() => void)[] = [];
  private heartbeatInterval?: number;
  
  constructor(messageBus: MessageBus) {
    this.messageBus = messageBus;
    this.logger = new Logger('wallet-updater');
    this.logger.system('[WalletUpdater] Initialized');
  }
  
  async start(): Promise<void> {
    try {
      this.logger.system('[WalletUpdater] Starting...');
      
      // Subscribe to new trade events
      const tradeHandler = async (data: { trade: WhaleTrade, tokenInfo: any }) => {
        await this.handleNewTrade(data.trade);
      };
      
      this.messageBus.subscribe('new_trade', tradeHandler);
      this.unsubscribers.push(() => this.messageBus.unsubscribe('new_trade', tradeHandler));
      
      // Set up heartbeat
      this.heartbeatInterval = setInterval(() => this.updateHeartbeat(), 30000) as any;
      
      this.isRunning = true;
      this.logger.system('[WalletUpdater] Started successfully');
      
      // Publish service started event
      this.messageBus.publish('service_started', { serviceName: this.name });
    } catch (error) {
      this.logger.error('[WalletUpdater] Failed to start:', error);
      this.isRunning = false;
      throw error;
    }
  }
  
  async stop(): Promise<void> {
    this.logger.system('[WalletUpdater] Stopping...');
    this.isRunning = false;
    
    // Unsubscribe from all events
    this.unsubscribers.forEach(unsub => unsub());
    this.unsubscribers = [];
    
    // Clear heartbeat interval
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = undefined;
    }
    
    this.logger.system('[WalletUpdater] Stopped');
    
    // Publish service stopped event
    this.messageBus.publish('service_stopped', { serviceName: this.name });
  }
  
  getStatus(): ServiceStatus {
    return {
      running: this.isRunning,
      lastHeartbeat: new Date().toISOString(),
      metadata: {}
    };
  }
  
  private async handleNewTrade(trade: WhaleTrade): Promise<void> {
    try {
      // Only process transfer events
      if (trade.trade_type !== 'TRANSFER_OUT' && trade.trade_type !== 'TRANSFER_IN') {
        return;
      }
      
      // Skip if no counterparty
      if (!trade.counterparty_address) {
        return;
      }
      
      // For TRANSFER_OUT, we want to check if the recipient wallet needs to be added
      if (trade.trade_type === 'TRANSFER_OUT') {
        await this.processTransferOut(trade);
      }
    } catch (error) {
      this.logger.error('[WalletUpdater] Error handling trade:', error);
    }
  }
  
  private async processTransferOut(trade: WhaleTrade): Promise<void> {
    const senderAddress = trade.wallet_address;
    const recipientAddress = trade.counterparty_address!;
    
    this.logger.system(`[WalletUpdater] Processing transfer: ${senderAddress.substring(0, 8)}... -> ${recipientAddress.substring(0, 8)}...`);
    
    // Get the trader who owns the sending wallet
    const senderTrader = await database.getTraderByWalletAddress(senderAddress);
    if (!senderTrader) {
      this.logger.error(`[WalletUpdater] No trader found for sending wallet ${senderAddress}`);
      return;
    }
    
    // Check if recipient wallet exists
    const recipientWallet = await database.getTrackedWallet(recipientAddress);
    
    if (!recipientWallet) {
      // Wallet doesn't exist - create it under the same trader
      this.logger.wallet(`[WalletUpdater] Creating new wallet ${recipientAddress.substring(0, 8)}... for trader ${senderTrader.name}`);
      
      await database.createTrackedWalletWithTrader({
        address: recipientAddress,
        trader_id: senderTrader.id,
        is_active: true,
        metadata: {
          created_by: 'wallet-updater',
          created_from_transfer: trade.transaction_hash,
          source_wallet: senderAddress
        },
        sol_balance: null,
        last_balance_check: null
      });
      
      // Update trader balance
      await database.updateTraderBalance(senderTrader.id);
      
      // Publish event for new wallet created
      this.messageBus.publish('wallet_created', {
        wallet_address: recipientAddress,
        trader_id: senderTrader.id,
        reason: 'transfer_detected'
      });
      
      this.logger.wallet(`[WalletUpdater] Successfully created wallet ${recipientAddress.substring(0, 8)}...`);
    } else {
      // Wallet exists - check if it belongs to the same trader
      const recipientTrader = await database.getTraderByWalletAddress(recipientAddress);
      
      if (!recipientTrader) {
        this.logger.error(`[WalletUpdater] Wallet ${recipientAddress} exists but has no trader`);
        return;
      }
      
      if (recipientTrader.id !== senderTrader.id) {
        // Different traders - log a conflict
        this.logger.wallet(`[WalletUpdater] CONFLICT: Wallet ${recipientAddress.substring(0, 8)}... belongs to ${recipientTrader.name} but ${senderTrader.name} sent funds to it`);
        
        await database.logOwnershipConflict({
          wallet_address: recipientAddress,
          existing_trader_id: recipientTrader.id,
          conflicting_trader_id: senderTrader.id,
          conflict_reason: `Transfer detected from ${senderTrader.name}'s wallet to ${recipientTrader.name}'s wallet`,
          transaction_hash: trade.transaction_hash,
          transfer_direction: 'FROM_EXISTING',
          transfer_amount: trade.sol_amount,
          detected_at: new Date().toISOString(),
          resolved: false,
          resolution_notes: null,
          resolved_at: null
        });
        
        // Publish conflict event
        this.messageBus.publish('wallet_conflict_detected', {
          wallet_address: recipientAddress,
          existing_trader: recipientTrader,
          conflicting_trader: senderTrader,
          transaction_hash: trade.transaction_hash
        });
        
        this.logger.wallet(`[WalletUpdater] Conflict logged for wallet ${recipientAddress.substring(0, 8)}...`);
      }
      // If same trader, no action needed
    }
  }
  
  private async updateHeartbeat(): Promise<void> {
    try {
      await database.upsertServiceHeartbeat({
        service_name: 'wallet-updater',
        last_heartbeat: new Date().toISOString(),
        status: 'healthy',
        metadata: {}
      });
    } catch (error) {
      this.logger.debug(`[WalletUpdater] Heartbeat update skipped: ${error}`);
    }
  }
}