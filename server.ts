import { Hono } from 'hono';
import { ENV } from './src/lib/env.js';
import ServiceManager from './src/services/service-manager.js';

// Import template functions
import { layout, layoutWithInitialLoad } from './src/templates/layout.js';
import { dashboardPage } from './src/templates/pages/dashboard.js';
import { walletsPage } from './src/templates/pages/wallets.js';
import { tradesPage } from './src/templates/pages/trades.js';
import { settingsPage } from './src/templates/pages/settings.js';
import { getPartial } from './src/templates/registry.js';
import { walletsTablePartial, walletsTableErrorPartial } from './src/templates/partials/wallets-table.js';
import { walletRowPartial } from './src/templates/partials/wallet-row.js';

// Import database functions
import { 
  getActiveSignals, 
  getRecentTrades, 
  getStats, 
  getTrackedWallets, 
  getTrackedWalletByAddress, 
  createTrackedWallet, 
  updateTrackedWallet, 
  deleteTrackedWallet, 
  toggleWalletStatus 
} from './src/lib/database.js';

const app = new Hono();

// Initialize services
const serviceManager = new ServiceManager();

// Runtime-specific static file serving
async function setupStaticFiles() {
  // For Bun runtime
  if (typeof Bun !== 'undefined') {
    const { serveStatic } = await import('hono/bun');
    app.use('/css/*', serveStatic({ root: './src/public' }));
    app.use('/js/*', serveStatic({ root: './src/public' }));
    app.use('/images/*', serveStatic({ root: './src/public' }));
  }
  // For Node.js runtime
  else if (typeof process !== 'undefined' && process.versions?.node) {
    const { serveStatic } = await import('@hono/node-server/serve-static');
    app.use('/css/*', serveStatic({ root: './src/public' }));
    app.use('/js/*', serveStatic({ root: './src/public' }));
    app.use('/images/*', serveStatic({ root: './src/public' }));
  }
  // For Cloudflare Workers - static assets need different handling
  // You would typically use Workers Sites, R2, or inline critical assets
}

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

// Service management endpoints
app.get('/api/services/status', async (c) => {
  const statuses = serviceManager.getAllServiceStatuses();
  return c.json(statuses);
});

app.post('/api/services/:service/restart', async (c) => {
  const serviceName = c.req.param('service');
  await serviceManager.restartService(serviceName);
  return c.json({ success: true, message: `Service ${serviceName} restarted` });
});

app.post('/api/trading/enable', async (c) => {
  await serviceManager.enableLiveTrading();
  return c.json({ success: true, message: 'Live trading enabled' });
});

app.post('/api/trading/disable', async (c) => {
  await serviceManager.disableLiveTrading();
  return c.json({ success: true, message: 'Live trading disabled' });
});

app.post('/api/analysis/trigger', async (c) => {
  await serviceManager.triggerManualAnalysis();
  return c.json({ success: true, message: 'Analysis triggered' });
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
    
    // Reload wallets in wallet watcher
    const walletWatcher = await serviceManager.getService('wallet-watcher');
    if (walletWatcher && walletWatcher.loadTrackedWallets) {
      await walletWatcher.loadTrackedWallets();
    }
    
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
    
    // Safety check - should not be needed now, but keeping for robustness
    if (!Array.isArray(allWallets)) {
      console.error('getTrackedWallets() did not return an array:', typeof allWallets, allWallets);
      return c.html(walletsTableErrorPartial());
    }
    
    const allTags = new Set<string>();
    allWallets.forEach(wallet => {
      if (wallet.tags && Array.isArray(wallet.tags)) {
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

// Export the app for different runtimes
export default app;

// Runtime-specific startup
async function startServer() {
  // Setup static file serving
  await setupStaticFiles();
  
  // Start backend services
  console.log('🚀 Starting Sonar Platform...');
  await serviceManager.start();
  
  // Determine port
  const port = Number(ENV.PORT) || 3005;
  
  console.log(`🌐 Frontend server starting on port ${port}`);
  console.log(`📊 Dashboard: http://localhost:${port}`);
  console.log('');
  
  // Runtime-specific server startup
  if (typeof Bun !== 'undefined') {
    // Bun runtime
    Bun.serve({
      fetch: app.fetch,
      port,
    });
    console.log(`✅ Server running on Bun at http://localhost:${port}`);
  } else if (typeof process !== 'undefined' && process.versions?.node) {
    // Node.js runtime
    const { serve } = await import('@hono/node-server');
    serve({
      fetch: app.fetch,
      port,
    });
    console.log(`✅ Server running on Node.js at http://localhost:${port}`);
  }
  // For Cloudflare Workers, the default export is used directly
}

// Only start server if this file is the main module
const isMainModule = () => {
  // Runtime-agnostic main module detection
  if (typeof Bun !== 'undefined') {
    return import.meta.main;
  }
  if (typeof process !== 'undefined') {
    return import.meta.url === `file://${process.argv[1]}`;
  }
  return false;
};

if (isMainModule()) {
  startServer().catch(error => {
    console.error('💥 Fatal error starting server:', error);
    if (typeof process !== 'undefined' && process.exit) {
      process.exit(1);
    }
  });
}