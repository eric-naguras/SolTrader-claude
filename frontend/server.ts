import { Hono } from 'hono';

// Import template functions
import { layout, layoutWithInitialLoad } from './src/templates/layout';
import { dashboardPage } from './src/templates/pages/dashboard';
import { walletsPage } from './src/templates/pages/wallets';
import { tradesPage } from './src/templates/pages/trades';
import { settingsPage } from './src/templates/pages/settings';
import { getPartial } from './src/templates/registry';

// Import database functions
import { getActiveSignals, getRecentTrades, getStats } from './src/lib/database';

const app = new Hono();

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
  const port = Number(process.env.PORT) || 3000;
  
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