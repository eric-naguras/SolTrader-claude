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
    notes
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

// Update wallet balance
walletRoutes.post('/:address/balance', async (c) => {
  const address = c.req.param('address');

  try {
    // Create connection to Solana RPC
    const rpcUrl = process.env.HELIUS_API_KEY 
      ? `https://mainnet.helius-rpc.com/?api-key=${process.env.HELIUS_API_KEY}`
      : 'https://api.mainnet-beta.solana.com';
    
    const connection = new Connection(rpcUrl, 'confirmed');
    
    // Get balance
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