import { Logger } from './logger.js';
import { Connection, PublicKey } from '@solana/web3.js';
import { Metaplex } from '@metaplex-foundation/js';
import { ENV } from './env.js';

interface TokenMetadata {
  symbol: string;
  name: string;
  decimals?: number;
  icon?: string;
  website?: string;
  twitter?: string;
}

export class SolscanAPI {
  private logger: Logger;
  private connection: Connection;
  private metaplex: Metaplex;
  
  constructor() {
    this.logger = new Logger('token-metadata');
    // Use Helius RPC for getting token metadata since we already have the key
    this.connection = new Connection(`https://mainnet.helius-rpc.com/?api-key=${ENV.HELIUS_API_KEY}`);
    this.metaplex = Metaplex.make(this.connection);
  }

  async getTokenMetadata(tokenAddress: string): Promise<TokenMetadata | null> {
    try {
      this.logger.debug(`Fetching token metadata for ${tokenAddress.substring(0, 8)}...`);
      
      const mintPubkey = new PublicKey(tokenAddress);
      
      // Try to get metadata using Metaplex
      try {
        const nft = await this.metaplex.nfts().findByMint({ mintAddress: mintPubkey });
        
        if (nft.symbol && nft.name) {
          this.logger.debug(`Metaplex metadata found: ${nft.symbol} - ${nft.name}`);
          
          // Fetch JSON metadata if available
          let icon = undefined;
          if (nft.uri) {
            icon = await this.fetchJsonMetadata(nft.uri);
          }
          
          return {
            symbol: nft.symbol,
            name: nft.name,
            decimals: nft.mint.decimals,
            icon,
            website: undefined,
            twitter: undefined
          };
        }
      } catch (metaplexError) {
        this.logger.debug(`Metaplex metadata not found for ${tokenAddress}`);
      }

      // Fallback: try to find in Jupiter or other token lists
      const knownToken = await this.findInTokenLists(tokenAddress);
      if (knownToken) {
        this.logger.debug(`Token found in token list: ${knownToken.symbol} - ${knownToken.name}`);
        return knownToken;
      }

      this.logger.debug(`No metadata found for ${tokenAddress}`);
      return null;
      
    } catch (error) {
      this.logger.error(`Error fetching token metadata:`, error);
      return null;
    }
  }


  private async fetchJsonMetadata(uri: string): Promise<string | undefined> {
    try {
      if (!uri || (!uri.startsWith('http://') && !uri.startsWith('https://'))) {
        return undefined;
      }

      const response = await fetch(uri, { signal: AbortSignal.timeout(5000) });
      if (!response.ok) return undefined;
      
      const json = await response.json();
      return json.image;
    } catch (error) {
      return undefined;
    }
  }

  private async findInTokenLists(tokenAddress: string): Promise<TokenMetadata | null> {
    try {
      // Try Jupiter token list first
      const jupiterResponse = await fetch('https://tokens.jup.ag/tokens_with_markets', {
        signal: AbortSignal.timeout(10000)
      });
      
      if (jupiterResponse.ok) {
        const tokens = await jupiterResponse.json();
        const found = tokens.find((t: any) => t.address === tokenAddress);
        if (found) {
          return {
            symbol: found.symbol,
            name: found.name,
            decimals: found.decimals,
            icon: found.logoURI
          };
        }
      }
    } catch (error) {
      this.logger.debug('Jupiter API request failed');
    }

    try {
      // Try Solana Labs token list
      const solanaResponse = await fetch('https://raw.githubusercontent.com/solana-labs/token-list/main/src/tokens/solana.tokenlist.json', {
        signal: AbortSignal.timeout(10000)
      });
      
      if (solanaResponse.ok) {
        const tokenList = await solanaResponse.json();
        const found = tokenList.tokens.find((t: any) => t.address === tokenAddress);
        if (found) {
          return {
            symbol: found.symbol,
            name: found.name,
            decimals: found.decimals,
            icon: found.logoURI
          };
        }
      }
    } catch (error) {
      this.logger.debug('Solana token list request failed');
    }

    return null;
  }

  async getTokenInfo(tokenAddress: string): Promise<any | null> {
    // This method is kept for compatibility but now uses the same logic as getTokenMetadata
    const metadata = await this.getTokenMetadata(tokenAddress);
    return metadata;
  }
}

export const solscanAPI = new SolscanAPI();