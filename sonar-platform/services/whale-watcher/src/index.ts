import dotenv from 'dotenv';
import { Helius } from 'helius-sdk';
import { Connection, PublicKey } from '@solana/web3.js';
import winston from 'winston';
import { getActiveWallets, insertWhaleTrade, upsertToken } from '@sonar/database';
import type { TrackedWallet } from '@sonar/types';

dotenv.config();

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console({
      format: winston.format.simple()
    })
  ]
});

class WhaleWatcher {
  private helius: Helius;
  private connection: Connection;
  private trackedWallets: Map<string, TrackedWallet> = new Map();
  private isRunning = false;

  constructor() {
    const heliusApiKey = process.env.HELIUS_API_KEY;
    if (!heliusApiKey) {
      throw new Error('HELIUS_API_KEY environment variable is required');
    }

    this.helius = new Helius(heliusApiKey);
    this.connection = new Connection(
      `https://mainnet.helius-rpc.com/?api-key=${heliusApiKey}`
    );

    logger.info('WhaleWatcher initialized');
  }

  async start() {
    try {
      this.isRunning = true;
      logger.info('Starting WhaleWatcher service...');

      // Load tracked wallets
      await this.loadTrackedWallets();

      // Set up WebSocket subscriptions
      await this.setupWebSocketSubscriptions();

      logger.info('WhaleWatcher service started successfully');

      // Reload wallets periodically
      setInterval(() => this.loadTrackedWallets(), 60000); // Every minute
    } catch (error) {
      logger.error('Failed to start WhaleWatcher:', error);
      throw error;
    }
  }

  async stop() {
    this.isRunning = false;
    logger.info('WhaleWatcher service stopped');
  }

  private async loadTrackedWallets() {
    try {
      const wallets = await getActiveWallets();
      this.trackedWallets.clear();
      
      for (const wallet of wallets) {
        this.trackedWallets.set(wallet.address, wallet);
      }

      logger.info(`Loaded ${wallets.length} active wallets for tracking`);
    } catch (error) {
      logger.error('Failed to load tracked wallets:', error);
    }
  }

  private async setupWebSocketSubscriptions() {
    const addresses = Array.from(this.trackedWallets.keys());
    
    if (addresses.length === 0) {
      logger.warn('No wallets to track');
      return;
    }

    // Subscribe to parsed transactions for all tracked wallets
    this.helius.connection.onLogs(
      addresses.map(addr => new PublicKey(addr)),
      async (logs, context) => {
        try {
          await this.processTransaction(logs.signature);
        } catch (error) {
          logger.error('Error processing transaction:', error);
        }
      }
    );

    logger.info(`Subscribed to ${addresses.length} wallet addresses`);
  }

  private async processTransaction(signature: string) {
    try {
      // Use Helius parsed transaction API
      const parsedTransaction = await this.helius.getEnhancedTransaction({
        signature
      });

      if (!parsedTransaction) {
        return;
      }

      // Look for token swap events
      const swapEvents = parsedTransaction.events?.filter(
        event => event.type === 'SWAP'
      ) || [];

      for (const swap of swapEvents) {
        await this.processSwapEvent(swap, parsedTransaction);
      }
    } catch (error) {
      logger.error(`Failed to process transaction ${signature}:`, error);
    }
  }

  private async processSwapEvent(swap: any, transaction: any) {
    try {
      const walletAddress = transaction.feePayer;
      
      if (!this.trackedWallets.has(walletAddress)) {
        return;
      }

      // Determine if this is a buy or sell
      const isBuy = swap.nativeInput && swap.tokenOutputs?.length > 0;
      const isSell = swap.tokenInputs?.length > 0 && swap.nativeOutput;

      if (!isBuy && !isSell) {
        return;
      }

      const tradeType = isBuy ? 'BUY' : 'SELL';
      const tokenMint = isBuy 
        ? swap.tokenOutputs[0].mint 
        : swap.tokenInputs[0].mint;
      
      const solAmount = isBuy 
        ? swap.nativeInput?.amount / 1e9 
        : swap.nativeOutput?.amount / 1e9;
      
      const tokenAmount = isBuy
        ? swap.tokenOutputs[0].rawTokenAmount.tokenAmount
        : swap.tokenInputs[0].rawTokenAmount.tokenAmount;

      // Get token info
      const tokenInfo = isBuy 
        ? swap.tokenOutputs[0].tokenAccount
        : swap.tokenInputs[0].tokenAccount;

      // Upsert token
      await upsertToken({
        address: tokenMint,
        symbol: tokenInfo?.symbol,
        name: tokenInfo?.name
      });

      // Insert whale trade
      await insertWhaleTrade({
        wallet_address: walletAddress,
        coin_address: tokenMint,
        trade_type: tradeType,
        sol_amount: solAmount,
        token_amount: Number(tokenAmount),
        transaction_hash: transaction.signature,
        trade_timestamp: new Date(transaction.timestamp * 1000)
      });

      logger.info(`Processed ${tradeType} trade:`, {
        wallet: this.trackedWallets.get(walletAddress)?.alias || walletAddress,
        token: tokenInfo?.symbol || tokenMint,
        solAmount,
        tokenAmount
      });
    } catch (error) {
      logger.error('Failed to process swap event:', error);
    }
  }
}

// Start the service
const whaleWatcher = new WhaleWatcher();

async function main() {
  try {
    await whaleWatcher.start();

    // Keep the process running
    process.on('SIGINT', async () => {
      logger.info('Received SIGINT, shutting down gracefully...');
      await whaleWatcher.stop();
      process.exit(0);
    });

    process.on('SIGTERM', async () => {
      logger.info('Received SIGTERM, shutting down gracefully...');
      await whaleWatcher.stop();
      process.exit(0);
    });
  } catch (error) {
    logger.error('Fatal error:', error);
    process.exit(1);
  }
}

main();