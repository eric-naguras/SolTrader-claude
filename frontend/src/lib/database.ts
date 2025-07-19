import { neon } from '@neondatabase/serverless';

// Create a SQL client using the DATABASE_URL from environment
const sql = neon(process.env.DATABASE_URL!);

export interface TrackedWallet {
  id: string;
  address: string;
  alias: string;
  tags: string[];
  ui_color: string;
  twitter_handle?: string;
  telegram_channel?: string;
  streaming_channel?: string;
  image_data?: string;
  notes?: string;
  sol_balance?: number;
  last_balance_check?: string;
  is_active: boolean;
  created_at: string;
}

export async function getTrackedWallets(sortBy: string = 'created_at', sortOrder: string = 'desc', filterTags: string[] = []): Promise<TrackedWallet[]> {
  try {
    // Whitelist of allowed sort columns to prevent SQL injection
    const allowedSortBy = ['alias', 'sol_balance', 'tags', 'is_active', 'created_at'];
    const safeSortBy = allowedSortBy.includes(sortBy) ? sortBy : 'created_at';
    
    // Ensure sortOrder is either 'asc' or 'desc'
    const safeSortOrder = sortOrder.toLowerCase() === 'asc' ? 'ASC' : 'DESC';

    // Dynamically construct the ORDER BY clause
    const orderByClause = `${safeSortBy} ${safeSortOrder}`;

    // Build the query based on whether we have filter tags
    let query = `SELECT 
        id,
        address,
        alias,
        tags,
        ui_color,
        twitter_handle,
        telegram_channel,
        streaming_channel,
        image_data,
        notes,
        sol_balance,
        last_balance_check,
        is_active,
        created_at
      FROM tracked_wallets`;

    // Add WHERE clause for tag filtering if tags are provided
    if (filterTags.length > 0) {
      const tagConditions = filterTags.map((_, index) => `$${index + 1} = ANY(tags)`).join(' OR ');
      query += ` WHERE ${tagConditions}`;
    }

    query += ` ORDER BY ${orderByClause}`;

    const result = filterTags.length > 0 
      ? await sql.query(query, filterTags)
      : await sql.query(query);
    
    return result.map(row => ({
      ...row,
      tags: Array.isArray(row.tags) ? row.tags : (row.tags ? (row.tags as string).split(',').map(t => t.trim()) : [])
    })) as TrackedWallet[];
  } catch (error) {
    console.error('Error fetching tracked wallets:', error);
    throw error;
  }
}

export async function getTrackedWalletByAddress(address: string): Promise<TrackedWallet | null> {
  try {
    const result = await sql`
      SELECT *
      FROM tracked_wallets
      WHERE address = ${address}
    `;
    
    if (result.length === 0) {
      return null;
    }
    
    const row = result[0];
    return {
      ...row,
      tags: Array.isArray(row.tags) ? row.tags : (row.tags ? (row.tags as string).split(',').map(t => t.trim()) : [])
    } as TrackedWallet;
  } catch (error) {
    console.error('Error fetching wallet by address:', error);
    throw error;
  }
}

export async function createTrackedWallet(wallet: Omit<TrackedWallet, 'id' | 'created_at'>): Promise<TrackedWallet> {
  try {
    const result = await sql`
      INSERT INTO tracked_wallets (
        address,
        alias,
        tags,
        ui_color,
        twitter_handle,
        telegram_channel,
        streaming_channel,
        image_data,
        notes,
        is_active
      ) VALUES (
        ${wallet.address},
        ${wallet.alias},
        ${wallet.tags},
        ${wallet.ui_color},
        ${wallet.twitter_handle},
        ${wallet.telegram_channel},
        ${wallet.streaming_channel},
        ${wallet.image_data},
        ${wallet.notes},
        ${wallet.is_active}
      )
      RETURNING *
    `;
    
    const row = result[0];
    return {
      ...row,
      tags: Array.isArray(row.tags) ? row.tags : (row.tags ? (row.tags as string).split(',').map(t => t.trim()) : [])
    } as TrackedWallet;
  } catch (error) {
    console.error('Error creating tracked wallet:', error);
    throw error;
  }
}

export async function updateTrackedWallet(address: string, updates: Partial<TrackedWallet>): Promise<TrackedWallet | null> {
  try {
    // Filter out undefined values and system fields
    const filteredUpdates = Object.entries(updates)
      .filter(([key, value]) => value !== undefined && key !== 'address' && key !== 'id' && key !== 'created_at')
      .reduce((acc, [key, value]) => ({ ...acc, [key]: value }), {});

    if (Object.keys(filteredUpdates).length === 0) {
      return null;
    }

    // Build the SET clause dynamically
    const setClauses: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    for (const [key, value] of Object.entries(filteredUpdates)) {
      setClauses.push(`${key} = $${paramIndex}`);
      values.push(value);
      paramIndex++;
    }

    // Add the address parameter
    values.push(address);

    const query = `
      UPDATE tracked_wallets
      SET ${setClauses.join(', ')}
      WHERE address = $${paramIndex}
      RETURNING *
    `;

    const result = await sql.query(query, values);
    
    if (result.length === 0) {
      return null;
    }
    
    const row = result[0];
    return {
      ...row,
      tags: Array.isArray(row.tags) ? row.tags : (row.tags ? (row.tags as string).split(',').map(t => t.trim()) : [])
    } as TrackedWallet;
  } catch (error) {
    console.error('Error updating tracked wallet:', error);
    throw error;
  }
}

export async function deleteTrackedWallet(address: string): Promise<boolean> {
  try {
    const result = await sql`
      DELETE FROM tracked_wallets
      WHERE address = ${address}
      RETURNING id
    `;
    
    return result.length > 0;
  } catch (error) {
    console.error('Error deleting tracked wallet:', error);
    throw error;
  }
}

export async function toggleWalletStatus(address: string): Promise<TrackedWallet | null> {
  try {
    const result = await sql`
      UPDATE tracked_wallets
      SET is_active = NOT is_active
      WHERE address = ${address}
      RETURNING *
    `;
    
    if (result.length === 0) {
      return null;
    }
    
    const row = result[0];
    return {
      ...row,
      tags: Array.isArray(row.tags) ? row.tags : (row.tags ? (row.tags as string).split(',').map(t => t.trim()) : [])
    } as TrackedWallet;
  } catch (error) {
    console.error('Error toggling wallet status:', error);
    throw error;
  }
}

// Stats functions for dashboard
export async function getActiveSignals() {
  try {
    const result = await sql`
      SELECT * FROM trade_signals 
      WHERE created_at > NOW() - INTERVAL '24 hours'
      ORDER BY created_at DESC
      LIMIT 50
    `;
    return result;
  } catch (error) {
    console.error('Error fetching active signals:', error);
    return [];
  }
}

export async function getRecentTrades(limit: number = 20) {
  try {
    const result = await sql`
      SELECT * FROM whale_trades 
      ORDER BY trade_timestamp DESC 
      LIMIT ${limit}
    `;
    return result;
  } catch (error) {
    console.error('Error fetching recent trades:', error);
    return [];
  }
}

export async function getStats() {
  try {
    const [walletCount, signalCount, tradeCount] = await Promise.all([
      sql`SELECT COUNT(*) as count FROM tracked_wallets WHERE is_active = true`,
      sql`SELECT COUNT(*) as count FROM trade_signals WHERE created_at > NOW() - INTERVAL '24 hours'`,
      sql`SELECT COUNT(*) as count FROM whale_trades WHERE trade_timestamp > NOW() - INTERVAL '24 hours'`
    ]);

    return {
      activeWallets: Number(walletCount[0].count),
      signals24h: Number(signalCount[0].count),
      trades24h: Number(tradeCount[0].count)
    };
  } catch (error) {
    console.error('Error fetching stats:', error);
    return {
      activeWallets: 0,
      signals24h: 0,
      trades24h: 0
    };
  }
}