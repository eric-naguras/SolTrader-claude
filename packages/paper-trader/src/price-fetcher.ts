import axios from 'axios';
import { Logger, RateLimiter, retryWithBackoff } from '@sonar/shared';

export interface TokenPrice {
  tokenAddress: string;
  priceInSol: number;
  priceInUsd?: number;
  source: 'jupiter' | 'birdeye' | 'dexscreener';
  timestamp: Date;
}

export interface PriceFetcher {
  getPrice(tokenAddress: string): Promise<TokenPrice | null>;
  getBatchPrices(tokenAddresses: string[]): Promise<Map<string, TokenPrice>>;
}

export class JupiterPriceFetcher implements PriceFetcher {
  private apiUrl = 'https://price.jup.ag/v4';
  private logger: Logger;
  private rateLimiter: RateLimiter;
  private cache = new Map<string, { price: TokenPrice; timestamp: number }>();
  private cacheMaxAge = 30000; // 30 seconds

  constructor(logger: Logger) {
    this.logger = logger;
    this.rateLimiter = new RateLimiter(10, 10); // 10 requests per second
  }

  async getPrice(tokenAddress: string): Promise<TokenPrice | null> {
    // Check cache first
    const cached = this.cache.get(tokenAddress);
    if (cached && Date.now() - cached.timestamp < this.cacheMaxAge) {
      return cached.price;
    }

    try {
      await this.rateLimiter.acquire();
      
      const response = await retryWithBackoff(
        async () => {
          return await axios.get(`${this.apiUrl}/price`, {
            params: {
              ids: tokenAddress,
            },
          });
        },
        {
          maxAttempts: 3,
          initialDelay: 1000,
        }
      );

      const data = response.data.data[tokenAddress];
      if (!data) {
        this.logger.debug('No price data found for token', { tokenAddress });
        return null;
      }

      // Jupiter returns prices in USD, we need to convert to SOL
      // For this, we also need SOL price
      const solPrice = await this.getSolPrice();
      if (!solPrice) {
        throw new Error('Could not fetch SOL price');
      }

      const price: TokenPrice = {
        tokenAddress,
        priceInSol: data.price / solPrice,
        priceInUsd: data.price,
        source: 'jupiter',
        timestamp: new Date(),
      };

      // Cache the result
      this.cache.set(tokenAddress, { price, timestamp: Date.now() });
      
      return price;
    } catch (error) {
      this.logger.error('Failed to fetch price from Jupiter', error as Error, {
        tokenAddress,
      });
      return null;
    }
  }

  async getBatchPrices(tokenAddresses: string[]): Promise<Map<string, TokenPrice>> {
    const prices = new Map<string, TokenPrice>();
    const uncachedTokens: string[] = [];

    // Check cache first
    for (const address of tokenAddresses) {
      const cached = this.cache.get(address);
      if (cached && Date.now() - cached.timestamp < this.cacheMaxAge) {
        prices.set(address, cached.price);
      } else {
        uncachedTokens.push(address);
      }
    }

    if (uncachedTokens.length === 0) {
      return prices;
    }

    try {
      await this.rateLimiter.acquire();
      
      const response = await retryWithBackoff(
        async () => {
          return await axios.get(`${this.apiUrl}/price`, {
            params: {
              ids: uncachedTokens.join(','),
            },
          });
        },
        {
          maxAttempts: 3,
          initialDelay: 1000,
        }
      );

      const solPrice = await this.getSolPrice();
      if (!solPrice) {
        throw new Error('Could not fetch SOL price');
      }

      for (const [address, data] of Object.entries(response.data.data)) {
        const price: TokenPrice = {
          tokenAddress: address,
          priceInSol: (data as any).price / solPrice,
          priceInUsd: (data as any).price,
          source: 'jupiter',
          timestamp: new Date(),
        };

        prices.set(address, price);
        this.cache.set(address, { price, timestamp: Date.now() });
      }

      return prices;
    } catch (error) {
      this.logger.error('Failed to fetch batch prices from Jupiter', error as Error);
      return prices;
    }
  }

  private async getSolPrice(): Promise<number | null> {
    const SOL_ADDRESS = 'So11111111111111111111111111111111111111112';
    
    try {
      const response = await axios.get(`${this.apiUrl}/price`, {
        params: {
          ids: SOL_ADDRESS,
        },
      });

      return response.data.data[SOL_ADDRESS]?.price || null;
    } catch (error) {
      this.logger.error('Failed to fetch SOL price', error as Error);
      return null;
    }
  }
}

// Alternative implementation using a different price source
export class BirdeyePriceFetcher implements PriceFetcher {
  private apiUrl = 'https://public-api.birdeye.so/public';
  private apiKey?: string;
  private logger: Logger;
  private rateLimiter: RateLimiter;

  constructor(logger: Logger, apiKey?: string) {
    this.logger = logger;
    this.apiKey = apiKey;
    this.rateLimiter = new RateLimiter(5, 5); // More conservative rate limit
  }

  async getPrice(tokenAddress: string): Promise<TokenPrice | null> {
    try {
      await this.rateLimiter.acquire();
      
      const headers: any = {};
      if (this.apiKey) {
        headers['X-API-KEY'] = this.apiKey;
      }

      const response = await retryWithBackoff(
        async () => {
          return await axios.get(`${this.apiUrl}/price`, {
            headers,
            params: {
              address: tokenAddress,
            },
          });
        },
        {
          maxAttempts: 3,
          initialDelay: 1000,
        }
      );

      if (!response.data.success) {
        return null;
      }

      const data = response.data.data;
      
      return {
        tokenAddress,
        priceInSol: data.value, // Birdeye returns price in SOL
        priceInUsd: data.usdValue,
        source: 'birdeye',
        timestamp: new Date(),
      };
    } catch (error) {
      this.logger.error('Failed to fetch price from Birdeye', error as Error, {
        tokenAddress,
      });
      return null;
    }
  }

  async getBatchPrices(tokenAddresses: string[]): Promise<Map<string, TokenPrice>> {
    const prices = new Map<string, TokenPrice>();
    
    // Birdeye doesn't support batch pricing in the public API
    // So we need to fetch individually (with rate limiting)
    for (const address of tokenAddresses) {
      const price = await this.getPrice(address);
      if (price) {
        prices.set(address, price);
      }
    }
    
    return prices;
  }
}