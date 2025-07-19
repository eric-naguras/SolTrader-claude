import { Hono } from 'hono';
import { WhaleWatcherStream } from '../../services/whale-watcher-stream.js';

const app = new Hono();

// Store reference to whale watcher instance
let whaleWatcherInstance: WhaleWatcherStream | null = null;

export function setWhaleWatcherInstance(instance: WhaleWatcherStream) {
  whaleWatcherInstance = instance;
}

// Webhook endpoint for wallet configuration changes
app.post('/wallet-changes', async (c) => {
  try {
    const payload = await c.req.json();
    
    console.log('[Webhook] Wallet change received:', {
      table: payload.table,
      type: payload.type,
      record: payload.record
    });

    // Handle tracked_wallets changes
    if (payload.table === 'tracked_wallets' && whaleWatcherInstance) {
      await whaleWatcherInstance.handleWalletChangeWebhook(
        payload.type,
        payload.record || payload.old_record
      );
      return c.json({ success: true });
    }

    return c.json({ error: 'Unhandled webhook event' }, 400);
  } catch (error) {
    console.error('[Webhook] Error processing wallet change:', error);
    return c.json({ error: 'Processing failed' }, 500);
  }
});

// Webhook endpoint for service configuration changes
app.post('/config-changes', async (c) => {
  try {
    const payload = await c.req.json();
    
    console.log('[Webhook] Config change received:', {
      table: payload.table,
      type: payload.type,
      record: payload.record
    });

    // Handle service_configs changes
    if (payload.table === 'service_configs' && payload.type === 'UPDATE') {
      // Services will need to implement their own config update handlers
      console.log('[Webhook] Config update for service:', payload.record?.service_name);
      return c.json({ success: true });
    }

    return c.json({ error: 'Unhandled webhook event' }, 400);
  } catch (error) {
    console.error('[Webhook] Error processing config change:', error);
    return c.json({ error: 'Processing failed' }, 500);
  }
});

export const webhookRoutes = app;