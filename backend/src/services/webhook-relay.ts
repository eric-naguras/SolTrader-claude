import { Hono } from 'hono';
import { serve } from '@hono/node-server';
import { WhaleWatcherStream } from './whale-watcher-stream.js';
import { ConfigurableLogger } from '../lib/logger.js';
import { config } from 'dotenv';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

// Load environment variables
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
config({ path: join(__dirname, '../../.env') });

// This service runs alongside whale-watcher to handle webhooks
export class WebhookRelayService {
  private app = new Hono();
  private whaleWatcher: WhaleWatcherStream | null = null;
  private loggers: Map<string, ConfigurableLogger> = new Map();
  
  constructor() {
    this.setupRoutes();
  }
  
  setWhaleWatcher(instance: WhaleWatcherStream) {
    this.whaleWatcher = instance;
  }
  
  registerLogger(serviceName: string, logger: ConfigurableLogger) {
    this.loggers.set(serviceName, logger);
  }
  
  private setupRoutes() {
    // Webhook endpoint for wallet configuration changes
    this.app.post('/webhooks/wallet-changes', async (c) => {
      try {
        const payload = await c.req.json();
        
        console.log('[WebhookRelay] Wallet change received:', {
          table: payload.table,
          type: payload.type,
          record: payload.record?.alias || payload.record?.address
        });

        // Handle tracked_wallets changes
        if (payload.table === 'tracked_wallets' && this.whaleWatcher) {
          await this.whaleWatcher.handleWalletChangeWebhook(
            payload.type,
            payload.record || payload.old_record
          );
          return c.json({ success: true });
        }

        return c.json({ error: 'Unhandled webhook event' }, 400);
      } catch (error) {
        console.error('[WebhookRelay] Error processing wallet change:', error);
        return c.json({ error: 'Processing failed' }, 500);
      }
    });

    // Webhook endpoint for service configuration changes
    this.app.post('/webhooks/config-changes', async (c) => {
      try {
        const payload = await c.req.json();
        
        console.log('[WebhookRelay] Config change received:', {
          table: payload.table,
          type: payload.type,
          service: payload.record?.service_name
        });

        // Handle service_configs changes
        if (payload.table === 'service_configs' && payload.type === 'UPDATE') {
          const serviceName = payload.record?.service_name;
          const logger = this.loggers.get(serviceName);
          
          if (logger) {
            logger.handleConfigUpdate(payload.record);
            return c.json({ success: true });
          }
        }

        return c.json({ error: 'Unhandled webhook event' }, 400);
      } catch (error) {
        console.error('[WebhookRelay] Error processing config change:', error);
        return c.json({ error: 'Processing failed' }, 500);
      }
    });
    
    // Health check
    this.app.get('/health', (c) => {
      return c.json({ 
        status: 'healthy',
        whaleWatcher: this.whaleWatcher ? 'connected' : 'not connected',
        loggers: Array.from(this.loggers.keys())
      });
    });
  }
  
  async start(port: number = 4001) {
    console.log(`[WebhookRelay] Starting webhook relay service on port ${port}`);
    serve({
      fetch: this.app.fetch,
      port,
    });
  }
}

// If run directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const relay = new WebhookRelayService();
  relay.start();
}