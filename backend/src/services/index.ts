import { WhaleWatcher } from './whale-watcher.js';
import { NotifierService } from './notifier.js';
import { config } from 'dotenv';

// Load environment variables
config();

// Service manager
class ServiceManager {
  private services: Map<string, any> = new Map();

  async start() {
    console.log('[ServiceManager] Starting all services...');

    // Start WhaleWatcher
    try {
      const whaleWatcher = new WhaleWatcher();
      await whaleWatcher.start();
      this.services.set('whale-watcher', whaleWatcher);
    } catch (error) {
      console.error('[ServiceManager] Failed to start WhaleWatcher:', error);
    }

    // Start Notifier
    try {
      const notifier = new NotifierService();
      await notifier.start();
      this.services.set('notifier', notifier);
    } catch (error) {
      console.error('[ServiceManager] Failed to start Notifier:', error);
    }

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