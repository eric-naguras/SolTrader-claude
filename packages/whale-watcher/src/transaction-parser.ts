import { PublicKey } from '@solana/web3.js';
import { Logger } from '@sonar/shared';
import { 
  ParsedSwapInfo, 
  DEX_PROGRAMS, 
  SOL_MINT, 
  USDC_MINT, 
  USDT_MINT,
  HeliusTransactionUpdate 
} from './types';

export class TransactionParser {
  private logger: Logger;

  constructor(logger: Logger) {
    this.logger = logger;
  }

  parseSwapTransaction(tx: HeliusTransactionUpdate): ParsedSwapInfo | null {
    try {
      // Check if transaction was successful
      if (tx.transaction.meta?.err !== null) {
        return null;
      }

      const instructions = tx.transaction.transaction.message.instructions || [];
      
      // Look for DEX program interactions
      for (const instruction of instructions) {
        const programId = instruction.programId;
        
        if (DEX_PROGRAMS[programId]) {
          const swapInfo = this.extractSwapInfo(instruction, tx);
          if (swapInfo) {
            return swapInfo;
          }
        }
      }

      // Check for inner instructions (common in aggregators like Jupiter)
      const innerInstructions = tx.transaction.meta?.innerInstructions || [];
      for (const inner of innerInstructions) {
        for (const instruction of inner.instructions) {
          const programId = instruction.programId;
          
          if (DEX_PROGRAMS[programId]) {
            const swapInfo = this.extractSwapInfo(instruction, tx);
            if (swapInfo) {
              return swapInfo;
            }
          }
        }
      }

      return null;
    } catch (error) {
      this.logger.error('Error parsing swap transaction', error as Error, {
        signature: tx.signature,
      });
      return null;
    }
  }

  private extractSwapInfo(instruction: any, tx: HeliusTransactionUpdate): ParsedSwapInfo | null {
    try {
      // For parsed instructions
      if (instruction.parsed && instruction.program === 'spl-token') {
        return this.parseSplTokenSwap(instruction, tx);
      }

      // For Jupiter and other aggregators
      if (instruction.programId && DEX_PROGRAMS[instruction.programId]) {
        return this.parseAggregatorSwap(instruction, tx);
      }

      return null;
    } catch (error) {
      this.logger.debug('Failed to extract swap info from instruction', {
        error: (error as Error).message,
      });
      return null;
    }
  }

  private parseSplTokenSwap(instruction: any, tx: HeliusTransactionUpdate): ParsedSwapInfo | null {
    const type = instruction.parsed?.type;
    
    if (type === 'transfer' || type === 'transferChecked') {
      const info = instruction.parsed.info;
      
      // Need to correlate with other instructions to determine if it's a swap
      // This is simplified - real implementation would need more context
      return null;
    }

    return null;
  }

  private parseAggregatorSwap(instruction: any, tx: HeliusTransactionUpdate): ParsedSwapInfo | null {
    // Analyze pre and post token balances to determine swap
    const preBalances = tx.transaction.meta?.preTokenBalances || [];
    const postBalances = tx.transaction.meta?.postTokenBalances || [];
    
    // Find balance changes
    const balanceChanges = this.calculateBalanceChanges(preBalances, postBalances);
    
    // Identify swap based on balance changes
    const fromToken = balanceChanges.find(change => change.delta < 0);
    const toToken = balanceChanges.find(change => change.delta > 0);
    
    if (!fromToken || !toToken) {
      return null;
    }

    // Get the owner (whale wallet)
    const owner = fromToken.owner || toToken.owner;
    if (!owner) {
      return null;
    }

    const dexProgram = DEX_PROGRAMS[instruction.programId];
    
    return {
      programId: instruction.programId,
      type: 'swap',
      from: {
        owner,
        mint: fromToken.mint,
        amount: Math.abs(fromToken.delta).toString(),
        decimals: fromToken.decimals,
      },
      to: {
        owner,
        mint: toToken.mint,
        amount: toToken.delta.toString(),
        decimals: toToken.decimals,
      },
      source: this.identifyDexSource(instruction.programId),
    };
  }

  private calculateBalanceChanges(preBalances: any[], postBalances: any[]): any[] {
    const changes: any[] = [];
    
    // Create maps for easier lookup
    const preMap = new Map();
    const postMap = new Map();
    
    for (const balance of preBalances) {
      const key = `${balance.mint}-${balance.owner}`;
      preMap.set(key, balance);
    }
    
    for (const balance of postBalances) {
      const key = `${balance.mint}-${balance.owner}`;
      postMap.set(key, balance);
    }
    
    // Check all post balances for changes
    for (const [key, postBalance] of postMap) {
      const preBalance = preMap.get(key);
      const preAmount = preBalance ? parseFloat(preBalance.uiTokenAmount.amount) : 0;
      const postAmount = parseFloat(postBalance.uiTokenAmount.amount);
      const delta = postAmount - preAmount;
      
      if (delta !== 0) {
        changes.push({
          mint: postBalance.mint,
          owner: postBalance.owner,
          decimals: postBalance.uiTokenAmount.decimals,
          delta,
        });
      }
    }
    
    // Check for tokens that existed in pre but not in post (complete sell)
    for (const [key, preBalance] of preMap) {
      if (!postMap.has(key)) {
        changes.push({
          mint: preBalance.mint,
          owner: preBalance.owner,
          decimals: preBalance.uiTokenAmount.decimals,
          delta: -parseFloat(preBalance.uiTokenAmount.amount),
        });
      }
    }
    
    return changes;
  }

  private identifyDexSource(programId: string): 'raydium' | 'orca' | 'jupiter' | 'unknown' {
    const dex = DEX_PROGRAMS[programId];
    if (!dex) return 'unknown';
    
    const name = dex.name.toLowerCase();
    if (name.includes('raydium')) return 'raydium';
    if (name.includes('orca')) return 'orca';
    if (name.includes('jupiter')) return 'jupiter';
    
    return 'unknown';
  }

  isRelevantSwap(swapInfo: ParsedSwapInfo, minValueSol: number): boolean {
    // Check if it's a buy (SOL/USDC -> Token) or sell (Token -> SOL/USDC)
    const isBuy = [SOL_MINT, USDC_MINT, USDT_MINT].includes(swapInfo.from.mint);
    const isSell = [SOL_MINT, USDC_MINT, USDT_MINT].includes(swapInfo.to.mint);
    
    if (!isBuy && !isSell) {
      return false; // Token-to-token swap, ignore
    }
    
    // Calculate value in SOL
    let solValue = 0;
    
    if (swapInfo.from.mint === SOL_MINT) {
      solValue = parseFloat(swapInfo.from.amount) / Math.pow(10, swapInfo.from.decimals);
    } else if (swapInfo.to.mint === SOL_MINT) {
      solValue = parseFloat(swapInfo.to.amount) / Math.pow(10, swapInfo.to.decimals);
    }
    
    // For USDC/USDT trades, we'd need price data to convert to SOL
    // For now, assume 1 USDC ≈ 0.02 SOL (this should be fetched from an oracle)
    if ([USDC_MINT, USDT_MINT].includes(swapInfo.from.mint)) {
      const usdValue = parseFloat(swapInfo.from.amount) / Math.pow(10, swapInfo.from.decimals);
      solValue = usdValue * 0.02; // Rough approximation
    }
    
    return solValue >= minValueSol;
  }

  getTradeType(swapInfo: ParsedSwapInfo): 'BUY' | 'SELL' {
    const isBuy = [SOL_MINT, USDC_MINT, USDT_MINT].includes(swapInfo.from.mint);
    return isBuy ? 'BUY' : 'SELL';
  }
}