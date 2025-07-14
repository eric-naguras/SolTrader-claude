import { config } from 'dotenv';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

// Load environment variables
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
config({ path: join(__dirname, '.env') });

async function quickTest() {
  console.log('🚀 Quick Backend Service Test\n');
  
  // Check critical environment variables
  const required = ['SUPABASE_URL', 'SUPABASE_ANON_KEY', 'HELIUS_API_KEY'];
  let hasAllRequired = true;
  
  console.log('Environment Check:');
  for (const varName of required) {
    if (process.env[varName]) {
      console.log(`  ✓ ${varName} is set`);
    } else {
      console.log(`  ✗ ${varName} is MISSING`);
      hasAllRequired = false;
    }
  }
  
  if (!hasAllRequired) {
    console.error('\n❌ Missing required environment variables!');
    console.log('\nMake sure you have a .env file with the required variables.');
    console.log('Copy .env.example to .env and fill in your values.');
    process.exit(1);
  }
  
  console.log('\n✅ Environment looks good!\n');
  
  // Try to import and start services
  try {
    console.log('Loading services...');
    const { WhaleWatcher } = await import('./src/services/whale-watcher.js');
    const { NotifierService } = await import('./src/services/notifier.js');
    console.log('✓ Services loaded successfully\n');
    
    // Test WhaleWatcher
    console.log('Testing WhaleWatcher...');
    const whaleWatcher = new WhaleWatcher();
    console.log('✓ WhaleWatcher created\n');
    
    // Test Notifier
    console.log('Testing NotifierService...');
    const notifier = new NotifierService();
    console.log('✓ NotifierService created\n');
    
    console.log('🎉 All services can be initialized!\n');
    console.log('Run "npm run dev" to start all services.');
    
  } catch (error: any) {
    console.error('\n❌ Service initialization failed!');
    console.error('Error:', error.message);
    
    if (error.message.includes('Cannot find module')) {
      console.log('\nMake sure to build the project first:');
      console.log('  npm run build');
    }
    
    process.exit(1);
  }
}

quickTest();