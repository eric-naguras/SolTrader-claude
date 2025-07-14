import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { serve } from '@hono/node-server';
import { config } from 'dotenv';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

// Load environment variables
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
config({ path: join(__dirname, '../../.env') });

import { walletRoutes } from './routes/wallets.js';
import { tradeRoutes } from './routes/trades.js';
import { healthRoutes } from './routes/health.js';
import { settingsRoutes } from './routes/settings.js';

const app = new Hono();

// Middleware
app.use('*', logger());
app.use('/api/*', cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true
}));

// Simple API key authentication middleware
const authenticateApiKey = (c: any, next: any) => {
  const apiKey = c.req.header('X-API-Key') || c.req.query('api_key');
  
  if (!process.env.API_SECRET) {
    // If no API_SECRET is set, allow all requests (development mode)
    return next();
  }
  
  if (apiKey !== process.env.API_SECRET) {
    return c.json({ error: 'Unauthorized' }, 401);
  }
  
  return next();
};

// Apply auth middleware to all API routes
app.use('/api/*', authenticateApiKey);

// Routes
app.route('/api/wallets', walletRoutes);
app.route('/api/trades', tradeRoutes);
app.route('/api/health', healthRoutes);
app.route('/api/settings', settingsRoutes);

// SSE endpoint for real-time updates
app.get('/api/events', async (c) => {
  // Set CORS headers specifically for SSE
  c.header('Access-Control-Allow-Origin', process.env.FRONTEND_URL || 'http://localhost:3000');
  c.header('Access-Control-Allow-Credentials', 'true');
  
  c.header('Content-Type', 'text/event-stream');
  c.header('Cache-Control', 'no-cache');
  c.header('Connection', 'keep-alive');
  
  return c.body(
    new ReadableStream({
      start(controller) {
        // Send initial connection message
        controller.enqueue(new TextEncoder().encode('data: {"type":"connected"}\n\n'));
        
        // Keep connection alive
        const interval = setInterval(() => {
          controller.enqueue(new TextEncoder().encode('data: {"type":"ping"}\n\n'));
        }, 30000);
        
        // Cleanup on abort
        c.req.raw.signal.addEventListener('abort', () => {
          clearInterval(interval);
          controller.close();
        });
      }
    })
  );
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