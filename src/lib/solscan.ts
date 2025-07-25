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
      console.error(`[Solscan] Failed to fetch balance for ${address}: ${response.status} ${response.statusText}`);
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
    console.error(`[Solscan] Error fetching balance for ${address}:`, error);
    return null;
  }
}

// Fetch multiple wallet balances
export async function getMultipleWalletBalances(addresses: string[]): Promise<Record<string, number | null>> {
  const balances: Record<string, number | null> = {};
  
  // Process in batches to avoid rate limiting
  const batchSize = 10;
  for (let i = 0; i < addresses.length; i += batchSize) {
    const batch = addresses.slice(i, i + batchSize);
    const batchPromises = batch.map(address => getWalletBalance(address));
    const batchResults = await Promise.all(batchPromises);
    
    batch.forEach((address, index) => {
      balances[address] = batchResults[index];
    });
    
    // Small delay between batches
    if (i + batchSize < addresses.length) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }
  
  return balances;
}