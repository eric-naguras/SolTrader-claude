import { WhaleWatcherStream } from './src/services/whale-watcher-stream';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_ANON_KEY!
);

async function debugWhaleWatcher() {
  console.log('🔍 Debugging whale-watcher service...\n');

  // Check environment variables
  console.log('Environment check:');
  console.log('- HELIUS_API_KEY:', process.env.HELIUS_API_KEY ? '✓ Set' : '❌ Missing');
  console.log('- SUPABASE_URL:', process.env.SUPABASE_URL ? '✓ Set' : '❌ Missing');
  console.log('- SUPABASE_ANON_KEY:', process.env.SUPABASE_ANON_KEY ? '✓ Set' : '❌ Missing');

  // Check tracked wallets
  const { data: wallets, error } = await supabase
    .from('tracked_wallets')
    .select('*')
    .eq('is_active', true);

  console.log(`\nActive wallets: ${wallets?.length || 0}`);
  
  if (wallets && wallets.length > 0) {
    console.log('\nWallet addresses:');
    wallets.forEach(w => console.log(`- ${w.address} (${w.label || 'No label'})`));
  }

  // Create service instance with verbose logging
  console.log('\n🚀 Starting whale-watcher with debug logging...\n');
  
  const originalLog = console.log;
  const originalError = console.error;
  
  // Intercept all logs
  console.log = (...args) => {
    originalLog('[DEBUG]', new Date().toISOString(), ...args);
  };
  
  console.error = (...args) => {
    originalError('[ERROR]', new Date().toISOString(), ...args);
  };

  try {
    const whaleWatcher = new WhaleWatcherStream();
    await whaleWatcher.start();
    
    console.log('\nService started. Waiting 15 seconds for activity...');
    
    // Wait and observe
    await new Promise(resolve => setTimeout(resolve, 15000));
    
    console.log('\nStopping service...');
    await whaleWatcher.stop();
    
  } catch (error) {
    console.error('Failed to start whale-watcher:', error);
  }

  // Restore original console
  console.log = originalLog;
  console.error = originalError;
  
  process.exit(0);
}

debugWhaleWatcher().catch(console.error);