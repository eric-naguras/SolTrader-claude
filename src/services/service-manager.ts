import { ENV } from '../lib/env.js';
import { Logger } from '../lib/logger.js';
import { WalletWatcher } from './wallet-watcher.js';
import { PaperTrader } from './paper-trader.js';
import { SignalAnalyzer } from './signal-analyzer.js';
import { SignalTrader } from './signal-trader.js';

interface ServiceStatus {
  name: string;
  status: 'running' | 'stopped' | 'error';
  lastHeartbeat?: string;
  error?: string;
}

export class ServiceManager {
  private services: Map<string, any> = new Map();
  private serviceStatuses: Map<string, ServiceStatus> = new Map();
  private isShuttingDown = false;
  private logger: Logger;

  constructor() {
    this.logger = new Logger('service-manager');
    this.initializeServices();
  }

  private initializeServices() {
    // Initialize core modules based on CLAUDE.md goals
    this.services.set('wallet-watcher', new WalletWatcher());
    this.services.set('paper-trader', new PaperTrader());
    this.services.set('signal-analyzer', new SignalAnalyzer());
    this.services.set('signal-trader', new SignalTrader());

    // Initialize service statuses
    for (const [name] of this.services) {
      this.serviceStatuses.set(name, {
        name,
        status: 'stopped'
      });
    }
  }

  async start() {
    this.logger.system('Starting all services...');

    // Start services in dependency order
    const startOrder = [
      'wallet-watcher',
      'paper-trader',
      'signal-analyzer', 
      'signal-trader'
    ];

    for (const serviceName of startOrder) {
      await this.startService(serviceName);
    }

    this.logger.system('All services started');
    this.printServiceStatus();

    // Handle graceful shutdown using runtime-agnostic approach
    this.setupShutdownHandlers();

    // Start periodic status updates
    setInterval(() => this.updateStatus(), 60000); // Every minute
  }

  private setupShutdownHandlers() {
    // Runtime-agnostic shutdown handling
    if (typeof process !== 'undefined') {
      // Node.js and Bun
      process.on('SIGINT', () => this.shutdown());
      process.on('SIGTERM', () => this.shutdown());
    }
    
    // Additional cleanup for other runtimes could be added here
    if (typeof addEventListener !== 'undefined') {
      // Browser-like environments
      addEventListener('beforeunload', () => this.shutdown());
    }
  }

  private async startService(name: string) {
    const service = this.services.get(name);
    if (!service) {
      this.logger.error(`Service ${name} not found`);
      return;
    }

    try {
      this.logger.system(`Starting ${name}...`);
      await service.start();
      
      this.serviceStatuses.set(name, {
        name,
        status: 'running'
      });
      
      this.logger.system(`${name} started successfully`);
    } catch (error) {
      this.logger.error(`Failed to start ${name}:`, error);
      this.serviceStatuses.set(name, {
        name,
        status: 'error',
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  async shutdown() {
    if (this.isShuttingDown) return;
    
    this.isShuttingDown = true;
    this.logger.system('Shutting down services...');

    // Stop services in reverse dependency order
    const stopOrder = [
      'signal-trader',
      'signal-analyzer',
      'paper-trader',
      'wallet-watcher'
    ];

    for (const serviceName of stopOrder) {
      await this.stopService(serviceName);
    }

    this.logger.system('All services stopped');
    
    // Runtime-agnostic process exit
    if (typeof process !== 'undefined' && process.exit) {
      process.exit(0);
    }
  }

  private async stopService(name: string) {
    const service = this.services.get(name);
    if (!service || !service.stop) {
      return;
    }

    try {
      this.logger.system(`Stopping ${name}...`);
      await service.stop();
      
      this.serviceStatuses.set(name, {
        name,
        status: 'stopped'
      });
      
      this.logger.system(`${name} stopped successfully`);
    } catch (error) {
      this.logger.error(`Error stopping ${name}:`, error);
      this.serviceStatuses.set(name, {
        name,
        status: 'error',
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  async restartService(name: string) {
    this.logger.system(`Restarting ${name}...`);
    await this.stopService(name);
    await this.startService(name);
  }

  getServiceStatus(name: string): ServiceStatus | undefined {
    return this.serviceStatuses.get(name);
  }

  getAllServiceStatuses(): ServiceStatus[] {
    return Array.from(this.serviceStatuses.values());
  }

  async getService(name: string): Promise<any> {
    return this.services.get(name);
  }

  private updateStatus() {
    // Update service statuses based on heartbeat data
    // This would query the database for recent heartbeats if needed
  }

  private printServiceStatus() {
    this.logger.system('');
    this.logger.system('=== Service Status ===');
    for (const [name, status] of this.serviceStatuses) {
      const emoji = status.status === 'running' ? '✅' : 
                   status.status === 'error' ? '❌' : '⏹️';
      console.log(`${emoji} ${name}: ${status.status}`);
      if (status.error) {
        console.log(`   Error: ${status.error}`);
      }
    }
    this.logger.system('====================');
    this.logger.system('');
  }

  // Service-specific methods
  async enableLiveTrading() {
    const signalTrader = this.services.get('signal-trader');
    if (signalTrader && signalTrader.enableTrading) {
      await signalTrader.enableTrading();
      this.logger.system('Live trading enabled');
    }
  }

  async disableLiveTrading() {
    const signalTrader = this.services.get('signal-trader');
    if (signalTrader && signalTrader.disableTrading) {
      await signalTrader.disableTrading();
      this.logger.system('Live trading disabled');
    }
  }

  async getPaperTradeStats() {
    const paperTrader = this.services.get('paper-trader');
    if (paperTrader && paperTrader.getPortfolioStats) {
      return await paperTrader.getPortfolioStats();
    }
    return null;
  }

  async triggerManualAnalysis() {
    const signalAnalyzer = this.services.get('signal-analyzer');
    if (signalAnalyzer && signalAnalyzer.triggerAnalysis) {
      await signalAnalyzer.triggerAnalysis();
      this.logger.system('Manual analysis triggered');
    }
  }
}

export default ServiceManager;