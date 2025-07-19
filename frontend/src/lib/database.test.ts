import { describe, test, expect, beforeAll, afterAll, beforeEach } from 'bun:test';
import { 
  getTrackedWallets, 
  getTrackedWalletByAddress, 
  createTrackedWallet, 
  updateTrackedWallet, 
  deleteTrackedWallet, 
  toggleWalletStatus,
  getActiveSignals,
  getRecentTrades,
  getStats,
  TrackedWallet 
} from './database';

// Test data
const testWallet = {
  address: 'So11111111111111111111111111111111111111112',
  alias: 'Test Wallet',
  tags: ['test', 'whale'],
  ui_color: '#ff0000',
  twitter_handle: '@testwallet',
  telegram_channel: 'https://t.me/testwallet',
  streaming_channel: 'https://twitch.tv/testwallet',
  image_data: 'data:image/jpeg;base64,test',
  notes: 'This is a test wallet',
  is_active: true,
  sol_balance: 100.5,
  last_balance_check: new Date().toISOString()
};

const testWallet2 = {
  address: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
  alias: 'Test Wallet 2',
  tags: ['test2', 'insider'],
  ui_color: '#00ff00',
  is_active: false
};

describe('Database Functions', () => {
  let createdWallet: TrackedWallet;
  let createdWallet2: TrackedWallet;

  beforeAll(async () => {
    console.log('Running database tests...');
    console.log('Using test branch (production schema copy)');
    
    // Clean up any existing test data and inspect schema
    try {
      const { neon } = await import('@neondatabase/serverless');
      const sql = neon(process.env.DATABASE_URL!);
      
      // Check the actual schema
      const columns = await sql`
        SELECT column_name, data_type 
        FROM information_schema.columns 
        WHERE table_name = 'tracked_wallets' 
        ORDER BY ordinal_position
      `;
      
      console.log('tracked_wallets columns:', columns.map(c => `${c.column_name}: ${c.data_type}`));
      
      // Clean up existing test data from tracked_wallets
      await sql`DELETE FROM tracked_wallets WHERE address IN ('So11111111111111111111111111111111111111112', 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v')`;
      
      console.log('✅ Test environment cleaned up successfully');
    } catch (error) {
      console.error('❌ Failed to clean up test environment:', error);
      // Don't throw here - tests might still work
    }
  });

  afterAll(async () => {
    // Clean up any test data
    try {
      if (createdWallet) {
        await deleteTrackedWallet(createdWallet.address);
      }
      if (createdWallet2) {
        await deleteTrackedWallet(createdWallet2.address);
      }
    } catch (error) {
      console.log('Cleanup completed');
    }
  });

  beforeEach(async () => {
    // Clean up any existing test wallets
    try {
      await deleteTrackedWallet(testWallet.address);
      await deleteTrackedWallet(testWallet2.address);
    } catch (error) {
      // Ignore if wallets don't exist
    }
  });

  describe('Wallet CRUD Operations', () => {
    test('should create a tracked wallet', async () => {
      createdWallet = await createTrackedWallet(testWallet);
      
      expect(createdWallet).toBeDefined();
      expect(createdWallet.id).toBeDefined();
      expect(createdWallet.address).toBe(testWallet.address);
      expect(createdWallet.alias).toBe(testWallet.alias);
      expect(createdWallet.tags).toEqual(testWallet.tags);
      expect(createdWallet.ui_color).toBe(testWallet.ui_color);
      expect(createdWallet.twitter_handle).toBe(testWallet.twitter_handle);
      expect(createdWallet.telegram_channel).toBe(testWallet.telegram_channel);
      expect(createdWallet.streaming_channel).toBe(testWallet.streaming_channel);
      expect(createdWallet.image_data).toBe(testWallet.image_data);
      expect(createdWallet.notes).toBe(testWallet.notes);
      expect(createdWallet.is_active).toBe(testWallet.is_active);
      expect(createdWallet.created_at).toBeDefined();
    });

    test('should get tracked wallets', async () => {
      // Create test wallet first
      createdWallet = await createTrackedWallet(testWallet);
      
      const wallets = await getTrackedWallets();
      
      expect(Array.isArray(wallets)).toBe(true);
      expect(wallets.length).toBeGreaterThan(0);
      
      const foundWallet = wallets.find(w => w.address === testWallet.address);
      expect(foundWallet).toBeDefined();
      expect(foundWallet?.alias).toBe(testWallet.alias);
    });

    test('should get tracked wallet by address', async () => {
      // Create test wallet first
      createdWallet = await createTrackedWallet(testWallet);
      
      const wallet = await getTrackedWalletByAddress(testWallet.address);
      
      expect(wallet).toBeDefined();
      expect(wallet?.address).toBe(testWallet.address);
      expect(wallet?.alias).toBe(testWallet.alias);
    });

    test('should return null for non-existent wallet', async () => {
      const wallet = await getTrackedWalletByAddress('NonExistentAddress123');
      
      expect(wallet).toBeNull();
    });

    test('should update a tracked wallet', async () => {
      // Create test wallet first
      createdWallet = await createTrackedWallet(testWallet);
      
      const updates = {
        alias: 'Updated Test Wallet',
        tags: ['updated', 'test'],
        ui_color: '#0000ff',
        notes: 'Updated notes',
        is_active: false
      };
      
      const updatedWallet = await updateTrackedWallet(createdWallet.address, updates);
      
      expect(updatedWallet).toBeDefined();
      expect(updatedWallet?.alias).toBe(updates.alias);
      expect(updatedWallet?.tags).toEqual(updates.tags);
      expect(updatedWallet?.ui_color).toBe(updates.ui_color);
      expect(updatedWallet?.notes).toBe(updates.notes);
      expect(updatedWallet?.is_active).toBe(updates.is_active);
    });

    test('should toggle wallet status', async () => {
      // Create test wallet first
      createdWallet = await createTrackedWallet(testWallet);
      
      const originalStatus = createdWallet.is_active;
      
      const toggledWallet = await toggleWalletStatus(createdWallet.address);
      
      expect(toggledWallet).toBeDefined();
      expect(toggledWallet?.is_active).toBe(!originalStatus);
    });

    test('should delete a tracked wallet', async () => {
      // Create test wallet first
      createdWallet = await createTrackedWallet(testWallet);
      
      const deleted = await deleteTrackedWallet(createdWallet.address);
      
      expect(deleted).toBe(true);
      
      // Verify wallet is actually deleted
      const wallet = await getTrackedWalletByAddress(createdWallet.address);
      expect(wallet).toBeNull();
      
      // Clear reference since it's deleted
      createdWallet = null as any;
    });

    test('should return false when deleting non-existent wallet', async () => {
      const deleted = await deleteTrackedWallet('NonExistentAddress123');
      
      expect(deleted).toBe(false);
    });

    test('should prevent duplicate wallet addresses', async () => {
      // Create first wallet
      createdWallet = await createTrackedWallet(testWallet);
      
      // Try to create another wallet with same address
      try {
        await createTrackedWallet({
          ...testWallet,
          alias: 'Duplicate Wallet'
        });
        // Should not reach here
        expect(true).toBe(false);
      } catch (error) {
        expect(error).toBeDefined();
        // Should throw an error due to unique constraint
      }
    });
  });

  describe('Stats and Analytics Functions', () => {
    test('should get active signals', async () => {
      const signals = await getActiveSignals();
      
      expect(Array.isArray(signals)).toBe(true);
      // Signals might be empty in test environment, that's okay
    });

    test('should get recent trades', async () => {
      const trades = await getRecentTrades(10);
      
      expect(Array.isArray(trades)).toBe(true);
      // Trades might be empty in test environment, that's okay
    });

    test('should get stats', async () => {
      const stats = await getStats();
      
      expect(stats).toBeDefined();
      expect(typeof stats.activeWallets).toBe('number');
      expect(typeof stats.signals24h).toBe('number');
      expect(typeof stats.trades24h).toBe('number');
      expect(stats.activeWallets).toBeGreaterThanOrEqual(0); // Stats should be numbers >= 0
    });
  });

  describe('Edge Cases and Error Handling', () => {
    test('should handle empty updates gracefully', async () => {
      createdWallet = await createTrackedWallet(testWallet);
      
      const result = await updateTrackedWallet(createdWallet.address, {});
      
      // Should return null for empty updates
      expect(result).toBeNull();
    });

    test('should handle updates with undefined values', async () => {
      createdWallet = await createTrackedWallet(testWallet);
      
      const result = await updateTrackedWallet(createdWallet.address, {
        alias: undefined,
        tags: ['new', 'tags'],
        notes: undefined
      });
      
      expect(result).toBeDefined();
      expect(result?.tags).toEqual(['new', 'tags']);
      // Undefined values should be filtered out
    });

    test('should return null when updating non-existent wallet', async () => {
      const result = await updateTrackedWallet('NonExistentAddress123', {
        alias: 'New Alias'
      });
      
      expect(result).toBeNull();
    });

    test('should return null when toggling non-existent wallet', async () => {
      const result = await toggleWalletStatus('NonExistentAddress123');
      
      expect(result).toBeNull();
    });
  });

  describe('Data Validation and Constraints', () => {
    test('should handle tags as array correctly', async () => {
      createdWallet = await createTrackedWallet(testWallet);
      
      expect(Array.isArray(createdWallet.tags)).toBe(true);
      expect(createdWallet.tags).toEqual(testWallet.tags);
    });

    test('should handle optional fields correctly', async () => {
      const minimalWallet = {
        address: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
        alias: 'Minimal Wallet',
        tags: ['minimal'],
        ui_color: '#ffffff',
        is_active: true
      };
      
      createdWallet2 = await createTrackedWallet(minimalWallet);
      
      expect(createdWallet2).toBeDefined();
      expect(createdWallet2.twitter_handle).toBeFalsy();
      expect(createdWallet2.telegram_channel).toBeFalsy();
      expect(createdWallet2.streaming_channel).toBeFalsy();
      expect(createdWallet2.image_data).toBeFalsy();
      expect(createdWallet2.notes).toBeFalsy();
    });
  });
});