import { config } from 'dotenv';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { supabase } from './src/lib/supabase.js';
import { WhaleWatcher } from './src/services/whale-watcher.js';
import { NotifierService } from './src/services/notifier.js';

// Load environment variables
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
config({ path: join(__dirname, '.env') });

// Test result tracking
interface TestResult {
  name: string;
  status: 'pass' | 'fail';
  message: string;
  error?: any;
}

const results: TestResult[] = [];

function log(message: string, type: 'info' | 'success' | 'error' = 'info') {
  const colors = {
    info: '\x1b[36m',    // Cyan
    success: '\x1b[32m', // Green
    error: '\x1b[31m'    // Red
  };
  const reset = '\x1b[0m';
  console.log(`${colors[type]}${message}${reset}`);
}

async function testEnvironmentVariables(): Promise<void> {
  log('\n=== Testing Environment Variables ===', 'info');
  
  const required = ['SUPABASE_URL', 'SUPABASE_ANON_KEY', 'HELIUS_API_KEY'];
  const optional = ['TELEGRAM_BOT_TOKEN', 'TELEGRAM_CHAT_ID', 'DISCORD_WEBHOOK_URL'];
  
  for (const varName of required) {
    if (process.env[varName]) {
      results.push({
        name: `Environment: ${varName}`,
        status: 'pass',
        message: 'Variable is set'
      });
      log(`✓ ${varName} is set`, 'success');
    } else {
      results.push({
        name: `Environment: ${varName}`,
        status: 'fail',
        message: 'Required variable is missing'
      });
      log(`✗ ${varName} is missing (REQUIRED)`, 'error');
    }
  }
  
  for (const varName of optional) {
    if (process.env[varName]) {
      log(`✓ ${varName} is set (optional)`, 'success');
    } else {
      log(`- ${varName} is not set (optional)`, 'info');
    }
  }
}

async function testDatabaseConnection(): Promise<void> {
  log('\n=== Testing Database Connection ===', 'info');
  
  try {
    // Test basic connection
    const { data, error } = await supabase
      .from('tracked_wallets')
      .select('count')
      .limit(1);
    
    if (error) throw error;
    
    results.push({
      name: 'Database: Connection',
      status: 'pass',
      message: 'Successfully connected to Supabase'
    });
    log('✓ Database connection successful', 'success');
    
    // Test if tables exist
    const tables = ['tracked_wallets', 'whale_trades', 'tokens', 'trade_signals', 'service_heartbeats'];
    for (const table of tables) {
      try {
        const { error } = await supabase.from(table).select('*').limit(1);
        if (error) throw error;
        results.push({
          name: `Database: Table ${table}`,
          status: 'pass',
          message: 'Table exists and is accessible'
        });
        log(`✓ Table '${table}' exists`, 'success');
      } catch (error: any) {
        results.push({
          name: `Database: Table ${table}`,
          status: 'fail',
          message: error.message,
          error
        });
        log(`✗ Table '${table}' error: ${error.message}`, 'error');
      }
    }
  } catch (error: any) {
    results.push({
      name: 'Database: Connection',
      status: 'fail',
      message: error.message,
      error
    });
    log(`✗ Database connection failed: ${error.message}`, 'error');
  }
}

async function testWhaleWatcher(): Promise<void> {
  log('\n=== Testing WhaleWatcher Service ===', 'info');
  
  try {
    // Create instance
    const whaleWatcher = new WhaleWatcher();
    results.push({
      name: 'WhaleWatcher: Initialization',
      status: 'pass',
      message: 'Service initialized successfully'
    });
    log('✓ WhaleWatcher initialized', 'success');
    
    // Test loading wallets
    try {
      // Use private method through type assertion for testing
      const loadWallets = (whaleWatcher as any).loadTrackedWallets.bind(whaleWatcher);
      await loadWallets();
      
      const walletCount = (whaleWatcher as any).trackedWallets.size;
      results.push({
        name: 'WhaleWatcher: Load Wallets',
        status: 'pass',
        message: `Loaded ${walletCount} tracked wallets`
      });
      log(`✓ Loaded ${walletCount} tracked wallets`, 'success');
    } catch (error: any) {
      results.push({
        name: 'WhaleWatcher: Load Wallets',
        status: 'fail',
        message: error.message,
        error
      });
      log(`✗ Failed to load wallets: ${error.message}`, 'error');
    }
    
    // Test heartbeat update
    try {
      const updateHeartbeat = (whaleWatcher as any).updateHeartbeat.bind(whaleWatcher);
      await updateHeartbeat();
      results.push({
        name: 'WhaleWatcher: Heartbeat',
        status: 'pass',
        message: 'Heartbeat updated successfully'
      });
      log('✓ Heartbeat update successful', 'success');
    } catch (error: any) {
      results.push({
        name: 'WhaleWatcher: Heartbeat',
        status: 'fail',
        message: error.message,
        error
      });
      log(`✗ Heartbeat update failed: ${error.message}`, 'error');
    }
    
  } catch (error: any) {
    results.push({
      name: 'WhaleWatcher: Initialization',
      status: 'fail',
      message: error.message,
      error
    });
    log(`✗ WhaleWatcher initialization failed: ${error.message}`, 'error');
  }
}

async function testNotifier(): Promise<void> {
  log('\n=== Testing Notifier Service ===', 'info');
  
  try {
    // Create instance
    const notifier = new NotifierService();
    results.push({
      name: 'Notifier: Initialization',
      status: 'pass',
      message: 'Service initialized successfully'
    });
    log('✓ Notifier initialized', 'success');
    
    // Check channels
    const channels = (notifier as any).channels;
    const activeChannels = [];
    
    if (channels.telegram) {
      activeChannels.push('Telegram');
    }
    if (channels.discord) {
      activeChannels.push('Discord');
    }
    
    if (activeChannels.length > 0) {
      results.push({
        name: 'Notifier: Channels',
        status: 'pass',
        message: `Active channels: ${activeChannels.join(', ')}`
      });
      log(`✓ Active notification channels: ${activeChannels.join(', ')}`, 'success');
    } else {
      results.push({
        name: 'Notifier: Channels',
        status: 'pass',
        message: 'No channels configured (all optional)'
      });
      log('- No notification channels configured', 'info');
    }
    
    // Test heartbeat update
    try {
      const updateHeartbeat = (notifier as any).updateHeartbeat.bind(notifier);
      await updateHeartbeat();
      results.push({
        name: 'Notifier: Heartbeat',
        status: 'pass',
        message: 'Heartbeat updated successfully'
      });
      log('✓ Heartbeat update successful', 'success');
    } catch (error: any) {
      results.push({
        name: 'Notifier: Heartbeat',
        status: 'fail',
        message: error.message,
        error
      });
      log(`✗ Heartbeat update failed: ${error.message}`, 'error');
    }
    
  } catch (error: any) {
    results.push({
      name: 'Notifier: Initialization',
      status: 'fail',
      message: error.message,
      error
    });
    log(`✗ Notifier initialization failed: ${error.message}`, 'error');
  }
}

async function testServiceIntegration(): Promise<void> {
  log('\n=== Testing Service Integration ===', 'info');
  
  try {
    // Test if both services can start together
    const whaleWatcher = new WhaleWatcher();
    const notifier = new NotifierService();
    
    // Start services briefly
    await Promise.all([
      whaleWatcher.start(),
      notifier.start()
    ]);
    
    results.push({
      name: 'Integration: Service Startup',
      status: 'pass',
      message: 'Both services can start together'
    });
    log('✓ Services can start together', 'success');
    
    // Stop services
    await Promise.all([
      whaleWatcher.stop(),
      notifier.stop()
    ]);
    
    results.push({
      name: 'Integration: Service Shutdown',
      status: 'pass',
      message: 'Both services can stop gracefully'
    });
    log('✓ Services can stop gracefully', 'success');
    
  } catch (error: any) {
    results.push({
      name: 'Integration: Service Management',
      status: 'fail',
      message: error.message,
      error
    });
    log(`✗ Service integration failed: ${error.message}`, 'error');
  }
}

async function runTests(): Promise<void> {
  log('\n🧪 Starting Backend Service Tests\n', 'info');
  
  // Run all tests
  await testEnvironmentVariables();
  await testDatabaseConnection();
  await testWhaleWatcher();
  await testNotifier();
  await testServiceIntegration();
  
  // Summary
  log('\n=== Test Summary ===', 'info');
  
  const passed = results.filter(r => r.status === 'pass').length;
  const failed = results.filter(r => r.status === 'fail').length;
  const total = results.length;
  
  log(`\nTotal Tests: ${total}`, 'info');
  log(`Passed: ${passed}`, 'success');
  log(`Failed: ${failed}`, failed > 0 ? 'error' : 'success');
  
  if (failed > 0) {
    log('\nFailed Tests:', 'error');
    results
      .filter(r => r.status === 'fail')
      .forEach(r => {
        log(`  - ${r.name}: ${r.message}`, 'error');
      });
  }
  
  // Exit with appropriate code
  process.exit(failed > 0 ? 1 : 0);
}

// Run tests
runTests().catch(error => {
  log(`\n💥 Fatal error running tests: ${error.message}`, 'error');
  process.exit(1);
});