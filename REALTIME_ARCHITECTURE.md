# Real-time Architecture Documentation

## Overview

The Sonar Platform uses an event-driven architecture where the backend writes data to Supabase (PostgreSQL), and the frontend receives updates through Supabase Realtime and database triggers - **NOT through polling**.

## Architecture Principles

### 1. Database-Centric Communication
- Backend services write data directly to Supabase tables
- Frontend listens to database changes via Supabase Realtime
- No direct API polling from frontend to backend for real-time updates

### 2. Event Flow
```
[Whale Watcher] → [Database] → [Realtime] → [Frontend]
       ↓             ↓           ↓
   Write trades → Triggers → Push updates → Update UI
```

## Components

### Backend Services
- **Whale Watcher**: Monitors blockchain, writes trades to `whale_trades` table
- **Token Metadata Service**: Fetches and caches token information from multiple APIs
- **Notifier**: Sends alerts via Telegram/Discord (triggered by database changes)

### Database Layer (Supabase)
- **Tables**: `whale_trades`, `tokens`, `tracked_wallets`, `trade_signals`
- **Views**: `recent_whale_trades` (joins trades with wallet and token metadata)
- **Triggers**: Automatically generate trade signals when thresholds are met
- **Realtime**: Publishes changes to subscribed frontend clients

### Frontend
- **Supabase Client**: Connects to database for both queries and real-time subscriptions
- **Realtime Subscriptions**: Listens for `INSERT` on `whale_trades` table and `UPDATE` on `tokens` table (**Note: Views do not support Realtime**)
- **Data Reconstruction**: When table events arrive, frontend fetches joined data to recreate view-like records
- **Wallet Cards**: Auto-update when new trades arrive or token metadata is enriched

## Real-time Update Flow

### 1. New Trade Detection
1. Whale Watcher detects trade via Helius WebSocket
2. Calls Token Metadata Service to ensure token exists with metadata
3. Inserts record into `whale_trades` table
4. Database trigger potentially creates trade signal
5. Supabase Realtime publishes INSERT event
6. Frontend receives event and updates wallet cards

### 2. Token Metadata Updates
1. Token Metadata Service fetches missing metadata from external APIs
2. Updates `tokens` table with symbol/name
3. Supabase Realtime publishes UPDATE event
4. Frontend receives event and refreshes trade display with proper token names

### 3. Fallback SSE
- Additional SSE endpoint provides fallback real-time updates
- Uses same database view (`recent_whale_trades`) for consistent data
- Primarily for compatibility with HTMX SSE extension

## Token Metadata Resolution

### Multi-Provider Strategy
The system tries multiple APIs in order of reliability:
1. **Jupiter Token List**: Comprehensive, cached list of known tokens
2. **Helius**: Digital Asset Standard API
3. **Solscan**: Public API with good coverage
4. **SolanaFM**: Additional source for newer tokens

### Caching Strategy
- In-memory cache with 1-hour expiry
- Database persistence for long-term storage
- Background backfill scripts for existing tokens

## Key Benefits

1. **No Polling**: Frontend never polls APIs, reducing load and latency
2. **Real-time Updates**: Instant UI updates when trades occur
3. **Resilient**: Multiple fallback mechanisms for different update paths
4. **Scalable**: Database handles fan-out to multiple connected clients
5. **Consistent**: Single source of truth in database ensures all clients see same data

## Frontend Implementation

### Important: Views vs Tables with Realtime
**Critical Discovery**: Supabase Realtime only works with **tables**, not **views**. Since our frontend needs data from the `recent_whale_trades` view (which joins multiple tables), we must:

1. Listen to the underlying `whale_trades` table for INSERTs
2. Listen to the `tokens` table for UPDATEs 
3. When events arrive, fetch the complete joined data from the table to reconstruct view-like records

### Supabase Realtime Subscription
```javascript
const tradesChannel = window.supabase.channel('database_changes')
  .on('postgres_changes', { 
    event: 'INSERT', 
    schema: 'public', 
    table: 'whale_trades'  // Listen to table, not view!
  }, handleNewTradeFromTable)
  .on('postgres_changes', { 
    event: 'UPDATE', 
    schema: 'public', 
    table: 'tokens' 
  }, handleTokenMetadataUpdate)
  .subscribe();
```

### Data Reconstruction Pattern
```javascript
// When a table INSERT arrives, fetch joined data
async function handleNewTradeFromTable(newTradeRow) {
  const { data } = await supabase
    .from('whale_trades')
    .select(`
      *,
      tracked_wallets!inner(alias, ui_color, ...),
      tokens(symbol, name)
    `)
    .eq('id', newTradeRow.id)
    .single();
  
  // Now we have view-like data to update the UI
}
```

### Wallet Card Updates
- Cards automatically re-render when trades are added
- Token names update when metadata becomes available
- Smooth animations show new trades arriving
- Automatic sorting by most recent activity

## Configuration

### Environment Variables
- `SUPABASE_URL`: Database connection URL
- `SUPABASE_ANON_KEY`: Public key for frontend connections
- `HELIUS_API_KEY`: Blockchain data provider key

### Database Setup
- Enable Realtime on relevant tables
- Configure Row Level Security (RLS) policies
- Set up proper indexes for performance

## Monitoring

### Health Checks
- Service heartbeats stored in `service_heartbeats` table
- Real-time connection status visible in frontend console
- Token metadata fetch success rates logged

### Troubleshooting
- Check Supabase Realtime connection status
- Verify database triggers are functioning
- Monitor token metadata fetch rates
- Review service heartbeat timestamps