import { config } from 'dotenv';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { supabase } from './src/lib/supabase.js';

// Load environment variables
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
config({ path: join(__dirname, '.env') });

async function monitorHealth() {
  console.log('🏥 Service Health Monitor\n');
  
  try {
    // Get heartbeats
    const { data: heartbeats, error } = await supabase
      .from('service_heartbeats')
      .select('*')
      .order('last_heartbeat', { ascending: false });
    
    if (error) throw error;
    
    if (!heartbeats || heartbeats.length === 0) {
      console.log('No service heartbeats found. Services may not have started yet.');
      return;
    }
    
    const now = new Date();
    const twoMinutesAgo = new Date(now.getTime() - 2 * 60 * 1000);
    
    console.log('Service Status:');
    console.log('─'.repeat(70));
    
    for (const heartbeat of heartbeats) {
      const lastBeat = new Date(heartbeat.last_heartbeat);
      const secondsAgo = Math.floor((now.getTime() - lastBeat.getTime()) / 1000);
      const isHealthy = lastBeat > twoMinutesAgo;
      
      const status = isHealthy ? '✅ HEALTHY' : '❌ UNHEALTHY';
      const statusColor = isHealthy ? '\x1b[32m' : '\x1b[31m';
      const reset = '\x1b[0m';
      
      console.log(`Service: ${heartbeat.service_name.padEnd(20)} ${statusColor}${status}${reset}`);
      console.log(`  Last heartbeat: ${lastBeat.toLocaleString()} (${secondsAgo}s ago)`);
      
      if (heartbeat.metadata) {
        const meta = heartbeat.metadata as any;
        if (meta.tracked_wallets !== undefined) {
          console.log(`  Tracked wallets: ${meta.tracked_wallets}`);
        }
        if (meta.channels) {
          console.log(`  Active channels: ${meta.channels.join(', ')}`);
        }
        if (meta.subscriptions !== undefined) {
          console.log(`  Active subscriptions: ${meta.subscriptions}`);
        }
      }
      
      console.log('');
    }
    
    console.log('─'.repeat(70));
    console.log('\nHealthy = heartbeat within last 2 minutes');
    
    // Check for recent signals
    const { data: signals, error: signalError } = await supabase
      .from('trade_signals')
      .select('count')
      .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());
    
    if (!signalError && signals) {
      const count = signals[0]?.count || 0;
      console.log(`\n📊 Signals in last 24h: ${count}`);
    }
    
  } catch (error: any) {
    console.error('❌ Error checking health:', error.message);
  }
}

// Run monitor
monitorHealth();

// If running with --watch flag, monitor continuously
if (process.argv.includes('--watch')) {
  setInterval(monitorHealth, 10000); // Check every 10 seconds
  console.log('\n👁️  Watching... (updates every 10s, Ctrl+C to stop)\n');
}