import { ENV } from '../lib/env.js';
import { Logger } from '../lib/logger.js';
import { getDatabase } from '../lib/database.js';
import { messageBus } from '../lib/message-bus.js';
import { Service, ServiceStatus } from '../lib/service-interface.js';
import { WalletWatcher } from './wallet-watcher.js';
import { WalletUpdater } from './wallet-updater.js';
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
  private serviceEnabledState: Map<string, boolean> = new Map();
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
    this.services.set('wallet-updater', new WalletUpdater(messageBus));
    this.services.set('paper-trader', new PaperTrader(messageBus));
    this.services.set('signal-analyzer', new SignalAnalyzer(messageBus));
    this.services.set('signal-trader', new SignalTrader(messageBus));

    // Initialize service statuses and enabled states
    for (const [name] of this.services) {
      this.serviceStatuses.set(name, {
        name,
        status: 'stopped'
      });
      // Default all services to enabled until we load configs
      this.serviceEnabledState.set(name, true);
    }
  }

  async start() {
    this.logger.system('Starting all services...');

    try {
      // Load service configs to check which are enabled
      await this.loadServiceConfigs();
    } catch (error) {
      this.logger.error('Failed to load service configurations, using defaults:', error);
    }

    // Initialize service statuses based on enabled state
    for (const [name, isEnabled] of this.serviceEnabledState) {
      if (!isEnabled) {
        this.serviceStatuses.set(name, {
          name,
          status: 'disabled'
        });
      }
    }

    // Start services in dependency order
    const startOrder = [
      'wallet-watcher',
      'wallet-updater',
      'paper-trader',
      'signal-analyzer', 
      'signal-trader'
    ];

    for (const serviceName of startOrder) {
      try {
        await this.startService(serviceName);
      } catch (error) {
        this.logger.error(`Failed to start service ${serviceName}:`, error);
      }
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

    // Check if service is enabled
    const isEnabled = this.serviceEnabledState.get(name);
    if (!isEnabled) {
      this.logger.system(`[ServiceManager] Service ${name} is disabled, skipping start`);
      this.serviceStatuses.set(name, {
        name,
        status: 'disabled'
      });
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
      'wallet-updater',
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
    // Get real-time status from services for running services
    for (const [name, service] of this.services) {
      // Only update status for services that are not disabled
      const isEnabled = this.serviceEnabledState.get(name);
      if (isEnabled) {
        const serviceStatus = service.getStatus();
        this.serviceStatuses.set(name, {
          name,
          status: serviceStatus.running ? 'running' : 'stopped',
          error: serviceStatus.error,
          lastHeartbeat: serviceStatus.lastHeartbeat
        });
      }
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
                   status.status === 'error' ? '❌' : 
                   status.status === 'disabled' ? '⏸️' : '⏹️';
      this.logger.system(`${emoji} ${name}: ${status.status}`);
      if (status.error) {
        this.logger.system(`   Error: ${status.error}`);
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

  private async loadServiceConfigs() {
    try {
      const db = await getDatabase();
      const configs = await db.getAllServiceConfigs();
      
      // Map service names from class names to database names
      const serviceNameMapping: Record<string, string> = {
        'wallet-watcher': 'WalletWatcher',
        'wallet-updater': 'WalletUpdater',
        'paper-trader': 'PaperTrader',
        'signal-analyzer': 'SignalAnalyzer',
        'signal-trader': 'SignalTrader'
      };
      
      // Set default enabled state for all services
      for (const [serviceName] of this.services) {
        this.serviceEnabledState.set(serviceName, true);
      }
      
      // Update enabled state from database
      if (configs && configs.length > 0) {
        for (const config of configs) {
          // Find the service name key for this database name
          const serviceKey = Object.entries(serviceNameMapping).find(
            ([_, dbName]) => dbName === config.service_name
          )?.[0];
          
          if (serviceKey) {
            this.serviceEnabledState.set(serviceKey, config.enabled);
            this.logger.system(`[ServiceManager] Service ${serviceKey} is ${config.enabled ? 'enabled' : 'disabled'}`);
          }
        }
      } else {
        this.logger.system('[ServiceManager] No service configurations found in database, using defaults (all enabled)');
      }
      
      // Log status of all services
      for (const [serviceName, isEnabled] of this.serviceEnabledState) {
        if (!isEnabled) {
          // This logging is now handled in startService method to avoid duplication
        }
      }
    } catch (error) {
      this.logger.error('Failed to load service configurations:', error);
      // Default to all services enabled on error
      for (const [serviceName] of this.services) {
        this.serviceEnabledState.set(serviceName, true);
      }
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

    // Listen for service control events
    messageBus.subscribe('service_enable_requested', async (data) => {
      const { serviceName } = data;
      this.logger.system(`Received request to enable service: ${serviceName}`);
      await this.enableService(serviceName);
    });

    messageBus.subscribe('service_disable_requested', async (data) => {
      const { serviceName } = data;
      this.logger.system(`Received request to disable service: ${serviceName}`);
      await this.disableService(serviceName);
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

  async enableService(serviceName: string) {
    this.serviceEnabledState.set(serviceName, true);
    await this.startService(serviceName);
    messageBus.publish('service_enabled', { serviceName });
  }

  async disableService(serviceName: string) {
    this.serviceEnabledState.set(serviceName, false);
    await this.stopService(serviceName);
    messageBus.publish('service_disabled', { serviceName });
  }

  getServiceEnabledStates(): Map<string, boolean> {
    return new Map(this.serviceEnabledState);
  }
}

export default ServiceManager;