interface TokenMetadata {
  address: string;
  symbol?: string;
  name?: string;
  logoURI?: string;
  decimals?: number;
}

interface TokenMetadataProvider {
  name: string;
  fetchMetadata(address: string): Promise<TokenMetadata | null>;
}

class HeliusProvider implements TokenMetadataProvider {
  name = 'Helius';

  async fetchMetadata(address: string): Promise<TokenMetadata | null> {
    try {
      // Try the DAS (Digital Asset Standard) API first
      const response = await fetch(`https://api.helius.xyz/v0/token-metadata?address=${address}`, {
        headers: {
          'Authorization': `Bearer ${process.env.HELIUS_API_KEY}`
        }
      });

      if (response.ok) {
        const data: any = await response.json();
        if (data && (data.symbol || data.name)) {
          return {
            address,
            symbol: data.symbol || data.name,
            name: data.name || data.symbol,
            logoURI: data.logoURI,
            decimals: data.decimals
          };
        }
      }
    } catch (error) {
      console.log(`[TokenMetadata] Helius API failed for ${address}:`, error);
    }
    return null;
  }
}

class JupiterProvider implements TokenMetadataProvider {
  name = 'Jupiter';
  private tokenListCache: Map<string, TokenMetadata> = new Map();
  private lastFetch = 0;
  private cacheExpiry = 30 * 60 * 1000; // 30 minutes

  async fetchMetadata(address: string): Promise<TokenMetadata | null> {
    try {
      await this.refreshTokenList();
      return this.tokenListCache.get(address) || null;
    } catch (error) {
      console.log(`[TokenMetadata] Jupiter API failed for ${address}:`, error);
      return null;
    }
  }

  private async refreshTokenList() {
    const now = Date.now();
    if (now - this.lastFetch < this.cacheExpiry && this.tokenListCache.size > 0) {
      return;
    }

    try {
      const response = await fetch('https://token.jup.ag/strict');
      if (response.ok) {
        const tokens = await response.json() as any[];
        this.tokenListCache.clear();
        
        for (const token of tokens) {
          this.tokenListCache.set(token.address, {
            address: token.address,
            symbol: token.symbol,
            name: token.name,
            logoURI: token.logoURI,
            decimals: token.decimals
          });
        }
        this.lastFetch = now;
        console.log(`[TokenMetadata] Loaded ${tokens.length} tokens from Jupiter`);
      }
    } catch (error) {
      console.error('[TokenMetadata] Failed to refresh Jupiter token list:', error);
    }
  }
}

class SolscanProvider implements TokenMetadataProvider {
  name = 'Solscan';

  async fetchMetadata(address: string): Promise<TokenMetadata | null> {
    try {
      const response = await fetch(`https://api.solscan.io/token/meta?token=${address}`);
      if (response.ok) {
        const data: any = await response.json();
        if (data && data.data && (data.data.symbol || data.data.name)) {
          return {
            address,
            symbol: data.data.symbol || data.data.name,
            name: data.data.name || data.data.symbol,
            logoURI: data.data.icon,
            decimals: data.data.decimals
          };
        }
      }
    } catch (error) {
      console.log(`[TokenMetadata] Solscan API failed for ${address}:`, error);
    }
    return null;
  }
}

class SolanaFMProvider implements TokenMetadataProvider {
  name = 'SolanaFM';

  async fetchMetadata(address: string): Promise<TokenMetadata | null> {
    try {
      const response = await fetch(`https://api.solana.fm/v0/tokens/${address}`);
      if (response.ok) {
        const data: any = await response.json();
        if (data && data.result && (data.result.data.symbol || data.result.data.name)) {
          const tokenData = data.result.data;
          return {
            address,
            symbol: tokenData.symbol || tokenData.name,
            name: tokenData.name || tokenData.symbol,
            logoURI: tokenData.logoURI,
            decimals: tokenData.decimals
          };
        }
      }
    } catch (error) {
      console.log(`[TokenMetadata] SolanaFM API failed for ${address}:`, error);
    }
    return null;
  }
}

export class TokenMetadataService {
  private providers: TokenMetadataProvider[];
  private cache: Map<string, { metadata: TokenMetadata | null; timestamp: number }> = new Map();
  private cacheExpiry = 60 * 60 * 1000; // 1 hour

  constructor() {
    this.providers = [
      new JupiterProvider(), // Try Jupiter first as it has comprehensive token list
      new HeliusProvider(),  // Then Helius 
      new SolscanProvider(), // Then Solscan
      new SolanaFMProvider() // Finally SolanaFM
    ];
  }

  async getTokenMetadata(address: string): Promise<TokenMetadata | null> {
    // Skip SOL as it's handled separately
    if (address === 'So11111111111111111111111111111111111111112') {
      return {
        address,
        symbol: 'SOL',
        name: 'Solana',
        decimals: 9
      };
    }

    // Check cache first
    const cached = this.cache.get(address);
    if (cached && Date.now() - cached.timestamp < this.cacheExpiry) {
      return cached.metadata;
    }

    // Try each provider in order
    for (const provider of this.providers) {
      try {
        console.log(`[TokenMetadata] Trying ${provider.name} for token ${address.slice(0, 8)}...`);
        const metadata = await provider.fetchMetadata(address);
        
        if (metadata && (metadata.symbol || metadata.name)) {
          console.log(`[TokenMetadata] ✓ Found metadata via ${provider.name}: ${metadata.symbol} - ${metadata.name}`);
          
          // Cache the result
          this.cache.set(address, {
            metadata,
            timestamp: Date.now()
          });
          
          return metadata;
        }
      } catch (error) {
        console.log(`[TokenMetadata] ${provider.name} failed for ${address}:`, error);
      }
    }

    console.log(`[TokenMetadata] ✗ No metadata found for token ${address.slice(0, 8)}...`);
    
    // Cache null result to avoid repeated failures
    this.cache.set(address, {
      metadata: null,
      timestamp: Date.now()
    });
    
    return null;
  }

  // Batch fetch multiple tokens
  async getTokenMetadataBatch(addresses: string[]): Promise<Map<string, TokenMetadata | null>> {
    const results = new Map<string, TokenMetadata | null>();
    
    // Process in parallel with concurrency limit
    const concurrency = 5;
    for (let i = 0; i < addresses.length; i += concurrency) {
      const batch = addresses.slice(i, i + concurrency);
      const promises = batch.map(async address => {
        const metadata = await this.getTokenMetadata(address);
        return { address, metadata };
      });
      
      const batchResults = await Promise.all(promises);
      for (const { address, metadata } of batchResults) {
        results.set(address, metadata);
      }
    }
    
    return results;
  }

  // Clear cache
  clearCache() {
    this.cache.clear();
  }
}

// Export singleton instance
export const tokenMetadataService = new TokenMetadataService();