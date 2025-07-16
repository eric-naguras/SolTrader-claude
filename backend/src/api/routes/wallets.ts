import { Hono } from 'hono';
import { supabase, type TrackedWallet } from '../../lib/supabase.js';
import { PublicKey, Connection } from '@solana/web3.js';

export const walletRoutes = new Hono();

// Get all wallets
walletRoutes.get('/', async (c) => {
  const { data, error } = await supabase
    .from('tracked_wallets')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    return c.json({ error: error.message }, 500);
  }

  return c.json({ wallets: data });
});

// Add new wallet
walletRoutes.post('/', async (c) => {
  const body = await c.req.json();
  const { 
    address, 
    alias, 
    tags, 
    ui_color,
    twitter_handle,
    telegram_channel,
    streaming_channel,
    image_data,
    notes,
    sol_balance,
    last_balance_check
  } = body;

  // Validate Solana address
  try {
    new PublicKey(address);
  } catch (e) {
    return c.json({ error: 'Invalid Solana address' }, 400);
  }

  // Validate image size if provided (limit to 1MB)
  if (image_data && image_data.length > 1_400_000) { // ~1MB in base64
    return c.json({ error: 'Image size too large (max 1MB)' }, 400);
  }

  const { data, error } = await supabase
    .from('tracked_wallets')
    .insert({
      address,
      alias,
      tags,
      ui_color,
      twitter_handle,
      telegram_channel,
      streaming_channel,
      image_data,
      notes,
      sol_balance,
      last_balance_check,
      is_active: true
    })
    .select()
    .single();

  if (error) {
    if (error.code === '23505') {
      return c.json({ error: 'Wallet already exists' }, 409);
    }
    return c.json({ error: error.message }, 500);
  }

  return c.json({ wallet: data }, 201);
});

// Update wallet
walletRoutes.patch('/:address', async (c) => {
  const address = c.req.param('address');
  const body = await c.req.json();

  const { data, error } = await supabase
    .from('tracked_wallets')
    .update(body)
    .eq('address', address)
    .select()
    .single();

  if (error) {
    return c.json({ error: error.message }, 500);
  }

  if (!data) {
    return c.json({ error: 'Wallet not found' }, 404);
  }

  return c.json({ wallet: data });
});

// Toggle wallet active status
walletRoutes.post('/:address/toggle', async (c) => {
  const address = c.req.param('address');

  // First get current status
  const { data: wallet } = await supabase
    .from('tracked_wallets')
    .select('is_active')
    .eq('address', address)
    .single();

  if (!wallet) {
    return c.json({ error: 'Wallet not found' }, 404);
  }

  // Toggle status
  const { data, error } = await supabase
    .from('tracked_wallets')
    .update({ is_active: !wallet.is_active })
    .eq('address', address)
    .select()
    .single();

  if (error) {
    return c.json({ error: error.message }, 500);
  }

  return c.json({ wallet: data });
});

// Delete wallet
walletRoutes.delete('/:address', async (c) => {
  const address = c.req.param('address');

  const { error } = await supabase
    .from('tracked_wallets')
    .delete()
    .eq('address', address);

  if (error) {
    return c.json({ error: error.message }, 500);
  }

  return c.json({ success: true });
});

// Update wallet balance using SolanaFM API
walletRoutes.post('/:address/balance', async (c) => {
  const address = c.req.param('address');

  try {
    // Validate Solana address
    try {
      new PublicKey(address);
    } catch (e) {
      return c.json({ error: 'Invalid Solana address' }, 400);
    }

    // Fetch balance directly from RPC - simpler and more reliable
    const connection = new Connection(process.env.HELIUS_RPC_URL || 'https://api.mainnet-beta.solana.com', 'confirmed');
    const pubkey = new PublicKey(address);
    const balance = await connection.getBalance(pubkey);
    const solBalance = balance / 1e9; // Convert lamports to SOL
    
    // Update database
    const { data, error } = await supabase
      .from('tracked_wallets')
      .update({ 
        sol_balance: solBalance,
        last_balance_check: new Date().toISOString()
      })
      .eq('address', address)
      .select()
      .single();

    if (error) {
      return c.json({ error: error.message }, 500);
    }

    if (!data) {
      return c.json({ error: 'Wallet not found' }, 404);
    }

    return c.json({ 
      wallet: data,
      balance: solBalance 
    });
  } catch (error) {
    console.error('Error fetching balance:', error);
    return c.json({ 
      error: 'Failed to fetch balance',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
});

// Bulk balance update endpoint for efficient frontend updates
walletRoutes.post('/bulk-balance', async (c) => {
  const body = await c.req.json();
  const { addresses } = body;

  if (!addresses || !Array.isArray(addresses)) {
    return c.json({ error: 'addresses array is required' }, 400);
  }

  if (addresses.length === 0) {
    return c.json({ balances: [] });
  }

  if (addresses.length > 50) {
    return c.json({ error: 'Maximum 50 addresses allowed per request' }, 400);
  }

  try {
    const results = [];
    const errors = [];

    // Process addresses in batches to respect API limits
    for (let i = 0; i < addresses.length; i++) {
      const address = addresses[i];
      
      try {
        // Validate Solana address
        new PublicKey(address);
        
        // Add delay between requests to respect rate limits
        if (i > 0) {
          await new Promise(resolve => setTimeout(resolve, 100)); // 100ms delay
        }

        // Fetch balance directly from RPC - simpler and more reliable
        const connection = new Connection(process.env.HELIUS_RPC_URL || 'https://api.mainnet-beta.solana.com', 'confirmed');
        const pubkey = new PublicKey(address);
        const balance = await connection.getBalance(pubkey);
        const solBalance = balance / 1e9; // Convert lamports to SOL
        
        // Update database
        const { data, error } = await supabase
          .from('tracked_wallets')
          .update({ 
            sol_balance: solBalance,
            last_balance_check: new Date().toISOString()
          })
          .eq('address', address)
          .select()
          .single();

        if (error) {
          errors.push({ address, error: error.message });
        } else if (data) {
          results.push({ 
            address, 
            balance: solBalance,
            wallet: data
          });
        } else {
          errors.push({ address, error: 'Wallet not found' });
        }

      } catch (error) {
        console.error(`Error fetching balance for ${address}:`, error);
        errors.push({ 
          address, 
          error: error instanceof Error ? error.message : 'Unknown error' 
        });
      }
    }

    return c.json({ 
      balances: results,
      errors: errors,
      total_requested: addresses.length,
      successful: results.length,
      failed: errors.length
    });

  } catch (error) {
    console.error('Error in bulk balance update:', error);
    return c.json({ 
      error: 'Failed to process bulk balance update',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
});