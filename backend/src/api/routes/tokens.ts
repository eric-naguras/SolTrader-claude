import { Hono } from 'hono';
import { supabase } from '../../lib/supabase.js';
import { tokenMetadataService } from '../../services/token-metadata.js';

export const tokenRoutes = new Hono();

// Get all tokens
tokenRoutes.get('/', async (c) => {
  const { data, error } = await supabase
    .from('tokens')
    .select('*')
    .order('last_seen', { ascending: false });

  if (error) {
    return c.json({ error: error.message }, 500);
  }

  return c.json(data || []);
});

// Get tokens missing metadata
tokenRoutes.get('/missing-metadata', async (c) => {
  const { data, error } = await supabase
    .from('tokens')
    .select('address, symbol, name, last_seen')
    .or('symbol.is.null,name.is.null')
    .order('last_seen', { ascending: false });

  if (error) {
    return c.json({ error: error.message }, 500);
  }

  return c.json(data || []);
});

// Refresh metadata for specific token
tokenRoutes.post('/:address/refresh', async (c) => {
  const address = c.req.param('address');
  
  try {
    // Fetch fresh metadata
    const metadata = await tokenMetadataService.getTokenMetadata(address);
    
    if (metadata && (metadata.symbol || metadata.name)) {
      // Update token in database
      const { data, error } = await supabase
        .from('tokens')
        .update({
          symbol: metadata.symbol || null,
          name: metadata.name || null,
          metadata: {
            logoURI: metadata.logoURI,
            decimals: metadata.decimals
          },
          last_seen: new Date().toISOString()
        })
        .eq('address', address)
        .select()
        .single();

      if (error) {
        return c.json({ error: error.message }, 500);
      }

      return c.json({ 
        success: true, 
        token: data,
        metadata 
      });
    } else {
      return c.json({ 
        success: false, 
        message: 'No metadata found for this token',
        address 
      });
    }
  } catch (error) {
    console.error(`Error refreshing token ${address}:`, error);
    return c.json({ error: 'Failed to refresh token metadata' }, 500);
  }
});

// Backfill metadata for all tokens missing it
tokenRoutes.post('/backfill-metadata', async (c) => {
  try {
    // Get all tokens missing metadata
    const { data: tokens, error } = await supabase
      .from('tokens')
      .select('address, symbol, name')
      .or('symbol.is.null,name.is.null');

    if (error) {
      return c.json({ error: error.message }, 500);
    }

    if (!tokens || tokens.length === 0) {
      return c.json({ 
        success: true, 
        message: 'No tokens need metadata backfill',
        processed: 0,
        successful: 0
      });
    }

    // Filter out SOL token
    const tokensToProcess = tokens.filter(token => 
      token.address !== 'So11111111111111111111111111111111111111112'
    );

    let successful = 0;
    let failed = 0;

    // Process in smaller batches for API endpoint (to avoid timeout)
    const batchSize = 3;
    for (let i = 0; i < Math.min(tokensToProcess.length, 15); i += batchSize) { // Limit to first 15 tokens to avoid timeout
      const batch = tokensToProcess.slice(i, i + batchSize);
      
      const promises = batch.map(async (token) => {
        try {
          const metadata = await tokenMetadataService.getTokenMetadata(token.address);
          
          if (metadata && (metadata.symbol || metadata.name)) {
            const { error: updateError } = await supabase
              .from('tokens')
              .update({
                symbol: metadata.symbol || token.symbol,
                name: metadata.name || token.name || metadata.symbol,
                metadata: {
                  logoURI: metadata.logoURI,
                  decimals: metadata.decimals
                },
                last_seen: new Date().toISOString()
              })
              .eq('address', token.address);

            if (!updateError) {
              successful++;
              return { success: true, address: token.address, metadata };
            } else {
              failed++;
              return { success: false, address: token.address, error: updateError };
            }
          } else {
            failed++;
            return { success: false, address: token.address, error: 'No metadata found' };
          }
        } catch (error) {
          failed++;
          return { success: false, address: token.address, error };
        }
      });

      await Promise.all(promises);
    }

    return c.json({ 
      success: true,
      message: `Processed ${Math.min(tokensToProcess.length, 15)} tokens`,
      processed: successful + failed,
      successful,
      failed,
      totalPending: Math.max(0, tokensToProcess.length - 15)
    });

  } catch (error) {
    console.error('Error in metadata backfill:', error);
    return c.json({ error: 'Failed to backfill metadata' }, 500);
  }
});

// Clear token metadata cache
tokenRoutes.post('/clear-cache', async (c) => {
  try {
    tokenMetadataService.clearCache();
    return c.json({ success: true, message: 'Token metadata cache cleared' });
  } catch (error) {
    return c.json({ error: 'Failed to clear cache' }, 500);
  }
});