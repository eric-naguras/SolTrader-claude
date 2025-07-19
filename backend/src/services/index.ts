import { WhaleWatcher } from './whale-watcher.js';
import { WhaleWatcherPolling } from './whale-watcher-polling.js';
import { WhaleWatcherStream } from './whale-watcher-stream.js';
import { WebhookRelayService } from './webhook-relay.js';
import { config } from 'dotenv';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

// Load environment variables
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
config({ path: join(__dirname, '../../.env') });

// Service manager
class ServiceManager {
  private services: Map<string, any> = new Map();

  async start() {
    console.log('[ServiceManager] Starting all services...');

    // Start webhook relay service first
    const webhookRelay = new WebhookRelayService();
    webhookRelay.start(4001); // Run on separate port
    
    // Start WhaleWatcher - use streaming version for real-time monitoring
    try {
      const whaleWatcher = new WhaleWatcherStream();
      await whaleWatcher.start();
      this.services.set('whale-watcher', whaleWatcher);
      
      // Connect whale watcher to webhook relay
      webhookRelay.setWhaleWatcher(whaleWatcher);
      
      // Register logger for webhook config updates
      const logger = (whaleWatcher as any).logger;
      if (logger) {
        webhookRelay.registerLogger('whale-watcher', logger);
      }
    } catch (error) {
      console.error('[ServiceManager] Failed to start WhaleWatcher:', error);
    }

    // Notifier is now handled by webhook-notifier.ts integrated into frontend server

    console.log('[ServiceManager] All services started');

    // Handle graceful shutdown
    process.on('SIGINT', () => this.shutdown());
    process.on('SIGTERM', () => this.shutdown());
  }

  async shutdown() {
    console.log('[ServiceManager] Shutting down services...');
    
    for (const [name, service] of this.services) {
      try {
        if (service.stop) {
          await service.stop();
        }
        console.log(`[ServiceManager] ${name} stopped`);
      } catch (error) {
        console.error(`[ServiceManager] Error stopping ${name}:`, error);
      }
    }

    process.exit(0);
  }
}

// Start services
const manager = new ServiceManager();
manager.start().catch(error => {
  console.error('[ServiceManager] Fatal error:', error);
  process.exit(1);
});