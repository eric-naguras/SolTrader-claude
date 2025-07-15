import { Hono } from 'hono';
import { serveStatic } from '@hono/node-server/serve-static';
import { serve } from '@hono/node-server';
import { readFile } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { getActiveSignals, getRecentTrades, getStats } from './lib/database.js';
import { WebhookNotifierService } from '../backend/src/services/webhook-notifier.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = new Hono();
const webhookNotifier = new WebhookNotifierService();

// Serve static files
app.use('/css/*', serveStatic({ root: './public' }));
app.use('/js/*', serveStatic({ root: './public' }));

// Helper function to serve full page with content
async function servePage(c: any, contentPath?: string) {
  let html = await readFile(join(__dirname, 'public/index.html'), 'utf-8');
  
  // If a content path is specified, load that content and inject it
  if (contentPath) {
    const content = await readFile(join(__dirname, contentPath), 'utf-8');
    html = html.replace(
      '<div hx-get="/htmx/dashboard" hx-trigger="load" hx-swap="outerHTML">\n            <article aria-busy="true">Loading...</article>\n        </div>',
      content
    );
  }
  
  return c.html(html);
}

// Serve pages (both direct access and HTMX)
app.get('/', async (c) => {
  return servePage(c, 'pages/dashboard.html');
});

app.get('/wallets', async (c) => {
  return servePage(c, 'pages/wallets.html');
});

app.get('/trades', async (c) => {
  return servePage(c, 'pages/trades.html');
});

app.get('/settings', async (c) => {
  return servePage(c, 'pages/settings.html');
});

// HTMX fragments (for navigation without full page reload)
app.get('/htmx/dashboard', async (c) => {
  const html = await readFile(join(__dirname, 'pages/dashboard.html'), 'utf-8');
  return c.html(html);
});

app.get('/htmx/wallets', async (c) => {
  const html = await readFile(join(__dirname, 'pages/wallets.html'), 'utf-8');
  return c.html(html);
});

app.get('/htmx/trades', async (c) => {
  const html = await readFile(join(__dirname, 'pages/trades.html'), 'utf-8');
  return c.html(html);
});

app.get('/htmx/settings', async (c) => {
  const html = await readFile(join(__dirname, 'pages/settings.html'), 'utf-8');
  return c.html(html);
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
app.get('/htmx/partials/:partial', async (c) => {
  const partial = c.req.param('partial');
  try {
    const html = await readFile(join(__dirname, `pages/_partials/${partial}.html`), 'utf-8');
    return c.html(html);
  } catch (e) {
    return c.notFound();
  }
});

// Health check endpoint
app.get('/health', async (c) => {
  return c.json(webhookNotifier.getStatus());
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

    // Handle trade_signals inserts
    if (payload.table === 'trade_signals' && payload.type === 'INSERT') {
      await handleNewSignalWebhook(payload.record);
    }

    // Handle whale_trades inserts  
    if (payload.table === 'whale_trades' && payload.type === 'INSERT') {
      await handleNewTradeWebhook(payload.record);
    }

    return c.json({ success: true });
  } catch (error) {
    console.error('[Webhook] Error processing database change:', error);
    return c.json({ error: 'Processing failed' }, 500);
  }
});

// Signal webhook handler
async function handleNewSignalWebhook(signal: any) {
  console.log('[Webhook] New signal detected:', signal.coin_address);
  await webhookNotifier.processSignalWebhook(signal);
}

// Trade webhook handler  
async function handleNewTradeWebhook(trade: any) {
  console.log('[Webhook] New whale trade:', trade.wallet_address, trade.coin_address);
}

// Start server
if (import.meta.url === `file://${process.argv[1]}`) {
  const port = Number(process.env.PORT) || 3000;
  console.log(`Frontend server is running on port ${port}`);
  console.log(`Webhook endpoint: http://localhost:${port}/webhooks/db-changes`);
  serve({
    fetch: app.fetch,
    port,
  });
}

export default app;