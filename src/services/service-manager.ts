import { ENV } from '../lib/env.js';
import { Logger } from '../lib/logger.js';
import { getDatabase } from '../lib/database.js';
import { messageBus } from '../lib/message-bus.js';
import { Service, ServiceStatus } from '../lib/service-interface.js';
import { WalletWatcher } from './wallet-watcher.js';
import { PaperTrader } from './paper-trader.js';
import { SignalAnalyzer } from './signal-analyzer.js';
import { SignalTrader } from './signal-trader.js';

interface ServiceManagerStatus {
  name: string;
  status: 'running' | 'stopped' | 'error';
  lastHeartbeat?: string;
  error?: string;
}

export class ServiceManager {
  private services: Map<string, Service> = new Map();
  private serviceStatuses: Map<string, ServiceManagerStatus> = new Map();
  private isShuttingDown = false;
  private logger: Logger;

  constructor() {
    this.logger = new Logger('service-manager');
    this.initializeServices();
    this.loadLogConfiguration();
    this.setupMessageBusListeners();
  }

  private initializeServices() {
    // Initialize core modules with MessageBus injection
    this.services.set('wallet-watcher', new WalletWatcher(messageBus));
    this.services.set('paper-trader', new PaperTrader(messageBus));
    this.services.set('signal-analyzer', new SignalAnalyzer(messageBus));
    this.services.set('signal-trader', new SignalTrader(messageBus));

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
      this.logger.error(`[ServiceManager] Service ${name} not found`);
      return;
    }

    try {
      this.logger.system(`[ServiceManager] Starting ${name}...`);
      await service.start();
      
      // Get status from service interface
      const serviceStatus = service.getStatus();
      this.serviceStatuses.set(name, {
        name,
        status: serviceStatus.running ? 'running' : 'stopped',
        error: serviceStatus.error
      });
      
      this.logger.system(`[ServiceManager] ${name} started successfully`);
    } catch (error) {
      this.logger.error(`[ServiceManager] Failed to start ${name}:`, error);
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
    if (!service) {
      return;
    }

    try {
      this.logger.system(`[ServiceManager] Stopping ${name}...`);
      await service.stop();
      
      // Get final status from service
      const serviceStatus = service.getStatus();
      this.serviceStatuses.set(name, {
        name,
        status: serviceStatus.running ? 'running' : 'stopped',
        error: serviceStatus.error
      });
      
      this.logger.system(`[ServiceManager] ${name} stopped successfully`);
    } catch (error) {
      this.logger.error(`[ServiceManager] Error stopping ${name}:`, error);
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
    
    // Emit restart event
    messageBus.publish('service_restarted', { serviceName: name });
  }

  getServiceStatus(name: string): ServiceManagerStatus | undefined {
    return this.serviceStatuses.get(name);
  }

  getAllServiceStatuses(): ServiceManagerStatus[] {
    // Get real-time status from services
    for (const [name, service] of this.services) {
      const serviceStatus = service.getStatus();
      this.serviceStatuses.set(name, {
        name,
        status: serviceStatus.running ? 'running' : 'stopped',
        error: serviceStatus.error,
        lastHeartbeat: serviceStatus.lastHeartbeat
      });
    }
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
      messageBus.publish('trading_enabled', {});
    }
  }

  async disableLiveTrading() {
    const signalTrader = this.services.get('signal-trader');
    if (signalTrader && signalTrader.disableTrading) {
      await signalTrader.disableTrading();
      this.logger.system('Live trading disabled');
      messageBus.publish('trading_disabled', {});
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
      messageBus.publish('analysis_triggered', {});
    }
  }

  private async loadLogConfiguration() {
    try {
      const db = await getDatabase();
      const result = await db.query(
        `SELECT log_categories FROM service_configs WHERE service_name = 'unified' LIMIT 1`
      );
      
      if (result.rows.length > 0 && result.rows[0].log_categories) {
        this.updateLogConfiguration(result.rows[0].log_categories);
      }
    } catch (error) {
      this.logger.error('Failed to load log configuration:', error);
    }
  }

  private setupMessageBusListeners() {
    // Listen for configuration changes
    messageBus.subscribe('logging_config_changed', (data) => {
      this.logger.system('Received logging config change via message bus');
      this.updateLogConfiguration(data.log_categories);
    });

    messageBus.subscribe('ui_config_changed', (data) => {
      this.logger.system('Received UI config change via message bus');
      // Store UI config for services that might need it
      // For now, just log it
    });
  }

  private updateLogConfiguration(logCategories: any) {
    // Update logger configuration
    this.logger.updateConfig(logCategories);
    
    // Update all service loggers
    for (const [name, service] of this.services) {
      if (service.logger && service.logger.updateConfig) {
        service.logger.updateConfig(logCategories);
        this.logger.system(`Updated log configuration for ${name}`);
      }
    }
  }
}

export default ServiceManager;