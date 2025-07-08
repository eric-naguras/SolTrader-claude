import { WhaleWatcherConfig as BaseConfig } from '@sonar/shared';

export interface HeliusWebSocketMessage {
  type: string;
  data?: any;
  error?: string;
}

export interface HeliusTransactionUpdate {
  signature: string;
  slot: number;
  type: 'TRANSACTION';
  transaction: any;
  timestamp: number;
}

export interface ParsedSwapInfo {
  programId: string;
  type: 'swap';
  from: {
    owner: string;
    mint: string;
    amount: string;
    decimals: number;
  };
  to: {
    owner: string;
    mint: string;
    amount: string;
    decimals: number;
  };
  source: 'raydium' | 'orca' | 'jupiter' | 'unknown';
}

export interface DexPrograms {
  [key: string]: {
    name: string;
    programId: string;
  };
}

export const DEX_PROGRAMS: DexPrograms = {
  // Raydium
  '675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8': {
    name: 'Raydium V4',
    programId: '675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8',
  },
  // Orca
  '9W959DqEETiGZocYWCQPaJ6sBmUzgfxXfqGeTEdp3aQP': {
    name: 'Orca',
    programId: '9W959DqEETiGZocYWCQPaJ6sBmUzgfxXfqGeTEdp3aQP',
  },
  // Jupiter Aggregator
  'JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4': {
    name: 'Jupiter V6',
    programId: 'JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4',
  },
  'JUP4Fb2cqiRUcaTHdrPC8h2gNsA2ETXiPDD33WcGuJB': {
    name: 'Jupiter V4',
    programId: 'JUP4Fb2cqiRUcaTHdrPC8h2gNsA2ETXiPDD33WcGuJB',
  },
};

export const SOL_MINT = 'So11111111111111111111111111111111111111112';
export const USDC_MINT = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';
export const USDT_MINT = 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB';

export interface TransactionStats {
  total: number;
  processed: number;
  swaps: number;
  errors: number;
  lastProcessedAt?: Date;
}

export interface WalletSubscription {
  address: string;
  alias?: string;
  subscriptionId?: number;
  lastActivity?: Date;
}