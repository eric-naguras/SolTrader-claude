import { Hono } from 'hono';

// Import template functions
import { layout, layoutWithInitialLoad } from './src/templates/layout';
import { dashboardPage } from './src/templates/pages/dashboard';
import { walletsPage } from './src/templates/pages/wallets';
import { tradesPage } from './src/templates/pages/trades';
import { settingsPage } from './src/templates/pages/settings';
import { getPartial } from './src/templates/registry';
import { walletsTablePartial, walletsTableErrorPartial } from './src/templates/partials/wallets-table';
import { walletRowPartial } from './src/templates/partials/wallet-row';

// Import database functions
import { getActiveSignals, getRecentTrades, getStats, getTrackedWallets, getTrackedWalletByAddress, createTrackedWallet, updateTrackedWallet, deleteTrackedWallet, toggleWalletStatus } from './src/lib/database';

const app = new Hono();

// Determine the port to use
let portToUse: number;

if (process.env.PORT) {
  // If PORT is explicitly set in environment variables, use that
  portToUse = Number(process.env.PORT);
} else {
  // Otherwise, use port 0 to let Bun find an available port
  // Bun will pick a random available port if 0 is specified
  portToUse = 0;
}

// Serve static files - runtime-specific imports
// For Bun runtime
if (typeof Bun !== 'undefined') {
  const { serveStatic } = await import('hono/bun');
  app.use('/css/*', serveStatic({ root: './public' }));
  app.use('/js/*', serveStatic({ root: './public' }));
  app.use('/images/*', serveStatic({ root: './public' }));
}
// For Node.js runtime
else if (typeof process !== 'undefined' && process.versions?.node) {
  const { serveStatic } = await import('@hono/node-server/serve-static');
  app.use('/css/*', serveStatic({ root: './public' }));
  app.use('/js/*', serveStatic({ root: './public' }));
  app.use('/images/*', serveStatic({ root: './public' }));
}
// For Cloudflare Workers - static assets need different handling
// You would typically use Workers Sites, R2, or inline critical assets

// Helper function to serve full page with content
function servePage(c: any, pageContent: string) {
  const html = layout(pageContent);
  return c.html(html);
}

// Root route - special case with initial load
app.get('/', (c) => {
  return c.html(layoutWithInitialLoad());
});

// Serve pages (both direct access and HTMX)
app.get('/wallets', (c) => {
  return servePage(c, walletsPage());
});

app.get('/trades', (c) => {
  return servePage(c, tradesPage());
});

app.get('/settings', (c) => {
  return servePage(c, settingsPage());
});

// HTMX fragments (for navigation without full page reload)
app.get('/htmx/dashboard', (c) => {
  return c.html(dashboardPage());
});

app.get('/htmx/wallets', (c) => {
  return c.html(walletsPage());
});

app.get('/htmx/trades', (c) => {
  return c.html(tradesPage());
});

app.get('/htmx/settings', (c) => {
  return c.html(settingsPage());
});

// API endpoints for database data
app.get('/api/signals', async (c) => {
  const signals = await getActiveSignals();
  return c.json(signals);
});

app.get('/api/trades', async (c) => {
  const limit = Number(c.req.query('limit')) || 20;
  const trades = await getRecentTrades(limit);
  return c.json(trades);
});

app.get('/api/stats', async (c) => {
  const stats = await getStats();
  return c.json(stats);
});

// Wallets API endpoints (only for mutations - GET handled by HTMX)

app.post('/api/wallets', async (c) => {
  try {
    const walletData = await c.req.json();
    
    // Check if wallet already exists
    const existingWallet = await getTrackedWalletByAddress(walletData.address);
    if (existingWallet) {
      return c.json({ error: 'A wallet with this address already exists' }, 409);
    }
    
    const newWallet = await createTrackedWallet(walletData);
    return c.json({ wallet: newWallet }, 201);
  } catch (error) {
    console.error('Error creating wallet:', error);
    
    // Handle database unique constraint violation
    if (error instanceof Error && (error.message?.includes('unique constraint') || error.message?.includes('duplicate key'))) {
      return c.json({ error: 'A wallet with this address already exists' }, 409);
    }
    
    return c.json({ error: 'Failed to create wallet' }, 500);
  }
});

app.put('/api/wallets/:address', async (c) => {
  try {
    const address = c.req.param('address');
    const updates = await c.req.json();
    const updatedWallet = await updateTrackedWallet(address, updates);
    
    if (!updatedWallet) {
      return c.json({ error: 'Wallet not found' }, 404);
    }
    
    return c.json(updatedWallet);
  } catch (error) {
    console.error('Error updating wallet:', error);
    return c.json({ error: 'Failed to update wallet' }, 500);
  }
});

app.delete('/api/wallets/:address', async (c) => {
  try {
    const address = c.req.param('address');
    const deleted = await deleteTrackedWallet(address);
    
    if (!deleted) {
      return c.json({ error: 'Wallet not found' }, 404);
    }
    
    return c.json({ success: true });
  } catch (error) {
    console.error('Error deleting wallet:', error);
    return c.json({ error: 'Failed to delete wallet' }, 500);
  }
});

app.patch('/api/wallets/:address/toggle', async (c) => {
  try {
    const address = c.req.param('address');
    const updatedWallet = await toggleWalletStatus(address);
    
    if (!updatedWallet) {
      return c.json({ error: 'Wallet not found' }, 404);
    }
    
    return c.json(updatedWallet);
  } catch (error) {
    console.error('Error toggling wallet status:', error);
    return c.json({ error: 'Failed to toggle wallet status' }, 500);
  }
});

// HTMX endpoint for toggling wallet status - returns only the updated row
app.patch('/htmx/wallets/:address/toggle', async (c) => {
  try {
    const address = c.req.param('address');
    const updatedWallet = await toggleWalletStatus(address);
    
    if (!updatedWallet) {
      return c.html('<div class="error">Wallet not found</div>', 404);
    }
    
    // Return only the updated row HTML
    const rowHtml = walletRowPartial(updatedWallet);
    return c.html(rowHtml);
  } catch (error) {
    console.error('Error toggling wallet status:', error);
    return c.html('<div class="error">Failed to toggle wallet status</div>', 500);
  }
});

// HTMX endpoints for wallets - return HTML fragments
app.get('/htmx/partials/wallets-table', async (c) => {
  try {
    const { sortBy, sortOrder, tags } = c.req.query();
    const validSortOrder = sortOrder === 'asc' ? 'asc' : 'desc';
    
    // Get all wallets to extract all available tags
    const allWallets = await getTrackedWallets();
    const allTags = new Set<string>();
    allWallets.forEach(wallet => {
      if (wallet.tags) {
        wallet.tags.forEach(tag => allTags.add(tag));
      }
    });
    
    // Parse selected tags - if no tags parameter, default to ALL tags (show all wallets)
    let selectedTags: string[] = [];
    if (tags === undefined || tags === '') {
      // No filter specified = show all wallets (all tags selected)
      selectedTags = Array.from(allTags);
    } else {
      // Parse the tags parameter
      selectedTags = tags.split(',').filter(Boolean);
    }
    
    // Get filtered wallets
    const wallets = selectedTags.length > 0 
      ? await getTrackedWallets(sortBy, validSortOrder, selectedTags)
      : []; // No tags selected = show no wallets
    
    const tableHtml = walletsTablePartial(wallets, sortBy, validSortOrder, selectedTags, Array.from(allTags).sort());
    return c.html(tableHtml);
  } catch (error) {
    console.error('Error fetching wallets for HTMX:', error);
    return c.html(walletsTableErrorPartial());
  }
});

// Partial fragments
app.get('/htmx/partials/:partial', (c) => {
  const partialName = c.req.param('partial');
  const html = getPartial(partialName);
  
  if (html) {
    return c.html(html);
  } else {
    return c.notFound();
  }
});

// Webhook endpoint for Supabase database changes
app.post('/webhooks/db-changes', async (c) => {
  try {
    const payload = await c.req.json();
    
    console.log('[Webhook] Database change received:', {
      table: payload.table,
      type: payload.type,
      record: payload.record
    });

    return c.json({ success: true });
  } catch (error) {
    console.error('[Webhook] Error processing database change:', error);
    return c.json({ error: 'Processing failed' }, 500);
  }
});

// Export the app for different runtimes
export default app;

// Runtime-specific startup
// For Bun and Node.js
if (typeof Bun !== 'undefined' || (typeof process !== 'undefined' && process.versions?.node)) {
  const port = Number(process.env.PORT) || portToUse;
  
  // Only start server if this file is the main module
  if (import.meta.url.endsWith(process.argv[1] || '')) {
    console.log(`Frontend server is running on port ${port}`);
    console.log(`Webhook endpoint: http://localhost:${port}/webhooks/db-changes`);
    
    // Import Node.js server adapter if needed
    if (typeof Bun === 'undefined' && typeof process !== 'undefined') {
      const { serve } = await import('@hono/node-server');
      serve({
        fetch: app.fetch,
        port,
      });
    }
  }
}

// For Cloudflare Workers, the default export is used directly