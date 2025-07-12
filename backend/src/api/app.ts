import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { serve } from '@hono/node-server';

import { walletRoutes } from './routes/wallets.js';
import { tradeRoutes } from './routes/trades.js';
import { healthRoutes } from './routes/health.js';

const app = new Hono();

// Middleware
app.use('*', logger());
app.use('/api/*', cors());

// Routes
app.route('/api/wallets', walletRoutes);
app.route('/api/trades', tradeRoutes);
app.route('/api/health', healthRoutes);

// SSE endpoint for real-time updates
app.get('/api/events', (c) => {
  return c.streamText(async (stream) => {
    // Send initial connection message
    await stream.write('data: {"type":"connected"}\n\n');
    
    // Keep connection alive
    const interval = setInterval(async () => {
      await stream.write('data: {"type":"ping"}\n\n');
    }, 30000);
    
    // Cleanup on disconnect
    stream.onAbort(() => {
      clearInterval(interval);
    });
  });
});

// Default route
app.get('/', (c) => {
  return c.json({
    name: 'Sonar Platform API',
    version: '1.0.0',
    endpoints: [
      '/api/wallets',
      '/api/trades',
      '/api/health',
      '/api/events'
    ]
  });
});

// For Node.js
if (import.meta.url === `file://${process.argv[1]}`) {
  const port = Number(process.env.PORT) || 3001;
  console.log(`Server is running on port ${port}`);
  serve({
    fetch: app.fetch,
    port,
  });
}

export default app;