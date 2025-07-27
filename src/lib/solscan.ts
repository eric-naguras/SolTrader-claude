import { ENV } from './env.js';

// Solscan API base URL
const SOLSCAN_BASE_URL = 'https://public-api.solscan.io';

// Fetch SOL balance for a wallet address
export async function getWalletBalance(address: string): Promise<number | null> {
  try {
    if (!ENV.SOLSCAN_API_KEY) {
      console.warn('[Solscan] SOLSCAN_API_KEY not configured, skipping balance fetch');
      return null;
    }

    const response = await fetch(
      `${SOLSCAN_BASE_URL}/account/${address}`,
      {
        headers: {
          'accept': 'application/json',
          'token': ENV.SOLSCAN_API_KEY
        }
      }
    );

    if (!response.ok) {
      if (response.status === 429) {
        console.error(`[Solscan Balance API] 🚫 Rate limited (429) when fetching balance for ${address.substring(0,8)}... - Consider increasing balance check intervals`);
      } else {
        console.error(`[Solscan Balance API] ❌ Failed to fetch balance for ${address.substring(0,8)}...: ${response.status} ${response.statusText}`);
      }
      return null;
    }

    const data = await response.json();
    
    // Solscan returns balance in lamports, convert to SOL
    if (data.lamports !== undefined) {
      return data.lamports / 1_000_000_000; // Convert lamports to SOL
    }
    
    console.warn(`[Solscan] Balance not found in response for ${address}`, data);
    return null;
  } catch (error) {
    if (error.message && error.message.includes('429')) {
      console.error(`[Solscan Balance API] 🚫 Rate limit error for ${address.substring(0,8)}... - ${error.message}`);
    } else {
      console.error(`[Solscan Balance API] ❌ Network error fetching balance for ${address.substring(0,8)}...:`, error.message);
    }
    return null;
  }
}

// Fetch multiple wallet balances
export async function getMultipleWalletBalances(addresses: string[]): Promise<Record<string, number | null>> {
  const balances: Record<string, number | null> = {};
  
  // Process in smaller batches to avoid rate limiting
  const batchSize = 5;  // Reduced from 10 to 5 to be more respectful
  for (let i = 0; i < addresses.length; i += batchSize) {
    const batch = addresses.slice(i, i + batchSize);
    const batchPromises = batch.map(address => getWalletBalance(address));
    const batchResults = await Promise.all(batchPromises);
    
    batch.forEach((address, index) => {
      balances[address] = batchResults[index];
    });
    
    // Longer delay between batches to avoid rate limiting
    if (i + batchSize < addresses.length) {
      await new Promise(resolve => setTimeout(resolve, 1000));  // Increased from 100ms to 1s
    }
  }
  
  return balances;
}