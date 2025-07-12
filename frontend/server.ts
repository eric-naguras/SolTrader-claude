import { Hono } from 'hono';
import { serveStatic } from 'hono/node-server/serve-static';
import { serve } from '@hono/node-server';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

const app = new Hono();

// Serve static files
app.use('/css/*', serveStatic({ root: './public' }));
app.use('/js/*', serveStatic({ root: './public' }));

// Serve HTMX pages
app.get('/', async (c) => {
  const html = await readFile(join(import.meta.dir, 'public/index.html'), 'utf-8');
  return c.html(html);
});

// HTMX fragments
app.get('/htmx/dashboard', async (c) => {
  const html = await readFile(join(import.meta.dir, 'pages/dashboard.html'), 'utf-8');
  return c.html(html);
});

app.get('/htmx/wallets', async (c) => {
  const html = await readFile(join(import.meta.dir, 'pages/wallets.html'), 'utf-8');
  return c.html(html);
});

app.get('/htmx/trades', async (c) => {
  const html = await readFile(join(import.meta.dir, 'pages/trades.html'), 'utf-8');
  return c.html(html);
});

// Partial fragments
app.get('/htmx/partials/:partial', async (c) => {
  const partial = c.req.param('partial');
  try {
    const html = await readFile(join(import.meta.dir, `pages/_partials/${partial}.html`), 'utf-8');
    return c.html(html);
  } catch (e) {
    return c.notFound();
  }
});

// Start server
if (import.meta.url === `file://${process.argv[1]}`) {
  const port = Number(process.env.PORT) || 3000;
  console.log(`Frontend server is running on port ${port}`);
  serve({
    fetch: app.fetch,
    port,
  });
}

export default app;