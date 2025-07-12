# Whale Watcher Service - Detailed Technical Explanation

## Overview

The whale-watcher service is the core monitoring component of the Sonar Platform. It connects to the Solana blockchain via Helius WebSocket API to monitor specific high-net-worth wallets (whales) in real-time, tracking their memecoin trading activity and triggering signals when multiple whales buy the same token.

## Architecture Flow

```
Helius WebSocket → Whale Watcher → Database → Trigger → Signal Generation
                         ↓
                   Transaction Parser
                         ↓
                   Trade Classifier
                         ↓
                   Database Storage
```

## How It Works

### 1. Initialization and Connection

When the service starts:
- Loads environment variables (Supabase credentials, Helius API key)
- Creates a Helius SDK instance for blockchain access
- Initializes Winston logger for structured logging
- Connects to Supabase database

```javascript
// Key initialization
this.helius = new Helius(heliusApiKey);
```

### 2. Wallet Management

The service maintains a list of wallets to monitor:

- **Initial Load**: Queries `tracked_wallets` table for all active wallets (`is_active = true`)
- **In-Memory Cache**: Stores wallets in a `Map<address, TrackedWallet>` for fast lookups
- **Auto-Refresh**: Reloads wallet list every 60 seconds to pick up newly added wallets
- **No Restart Required**: New wallets are automatically monitored after the next refresh cycle

### 3. WebSocket Subscription

The service subscribes to Helius WebSocket for real-time transaction monitoring:

```javascript
// Subscribes to transaction logs for each tracked wallet
websocket.on('transactionNotification', async (notification) => {
  // Process incoming transaction
});
```

**What triggers notifications:**
- Any transaction where a tracked wallet is the fee payer
- Includes all transaction types (swaps, transfers, etc.)

### 4. Transaction Processing Pipeline

When a transaction notification arrives:

#### Step 1: Parse Transaction
```javascript
const enhancedTransaction = await helius.parseTransaction(signature);
```
- Converts raw transaction data to structured format
- Extracts events, token transfers, and swap details

#### Step 2: Filter for Swaps
```javascript
const swapEvents = events.filter(event => event.type === 'SWAP');
```
- Only processes SWAP events (trades on DEXes)
- Ignores transfers, stakes, and other transaction types

#### Step 3: Classify Trade Direction
```javascript
// BUY: SOL in, tokens out
if (swap.nativeInput && swap.tokenOutputs?.length > 0) {
  tradeType = 'BUY';
  solAmount = swap.nativeInput.amount / 1e9; // Convert lamports to SOL
  tokenAddress = swap.tokenOutputs[0].mint;
}

// SELL: Tokens in, SOL out
if (swap.tokenInputs?.length > 0 && swap.nativeOutput) {
  tradeType = 'SELL';
  solAmount = swap.nativeOutput.amount / 1e9;
  tokenAddress = swap.tokenInputs[0].mint;
}
```

#### Step 4: Store Trade Data
1. **Upsert Token**: Add or update token information
   ```sql
   INSERT INTO tokens (address, symbol, name, metadata, last_seen) 
   VALUES (...) ON CONFLICT (address) DO UPDATE
   ```

2. **Insert Trade**: Record the whale trade
   ```sql
   INSERT INTO whale_trades (
     wallet_address, coin_address, trade_type, 
     sol_amount, token_amount, transaction_hash, trade_timestamp
   )
   ```

### 5. Signal Generation (Database Level)

Signal detection happens automatically via PostgreSQL trigger:

**Trigger: `trigger_check_signals`**
- Fires after every BUY trade insertion
- Executes the `check_for_signals()` function

**Signal Logic:**
1. Check if signal already exists for this coin (prevent duplicates)
2. Count distinct whales who bought within time window:
   ```sql
   SELECT COUNT(DISTINCT wallet_address) 
   FROM whale_trades
   WHERE coin_address = NEW.coin_address
   AND trade_type = 'BUY'
   AND trade_timestamp >= NOW() - INTERVAL '1 hour'
   AND sol_amount >= 0.5
   ```
3. If count >= threshold (default 3), create signal:
   ```sql
   INSERT INTO trade_signals (
     coin_address, status, trigger_reason, metadata
   )
   ```
4. Send real-time notification: `pg_notify('new_signal', ...)`

### 6. Configuration Parameters

Default signal detection parameters (stored in `signal_config` table):
- **min_whales**: 3 (minimum whales required)
- **time_window_hours**: 1 (look back period)
- **min_trade_amount_sol**: 0.5 (minimum trade size)

## Data Flow Example

Let's trace a typical whale trade:

1. **Whale swaps 10 SOL for BONK tokens on Raydium**
2. **Helius detects** transaction and notifies whale-watcher
3. **Whale-watcher parses** transaction, identifies it as a BUY
4. **Database stores**:
   - Token: BONK (address, symbol, name)
   - Trade: wallet, BONK address, BUY, 10 SOL, timestamp
5. **Trigger checks**: Are there 3+ whales buying BONK in last hour?
6. **If yes**: Signal created and notification sent
7. **Notifier service** picks up signal and alerts users

## Monitoring and Debugging

### Log Outputs
The service logs:
- Service start/stop events
- Wallet loading and refresh cycles
- WebSocket connection status
- Trade detection with details
- Errors and exceptions

### Common Issues and Solutions

1. **"Garbage" output**: Raw WebSocket data - use filtered startup script
2. **Missing trades**: Check if wallet is active in database
3. **No signals**: Verify min_whales threshold and time window
4. **Connection drops**: Service auto-reconnects to WebSocket

## Performance Characteristics

- **Latency**: Sub-second from blockchain to database
- **Throughput**: Can handle 100s of trades per second
- **Memory**: ~100MB base + wallet cache
- **CPU**: Low usage, mostly I/O bound

## Security Considerations

1. **Read-only access**: Service only monitors, never sends transactions
2. **RLS enabled**: Database access controlled by Row Level Security
3. **Environment variables**: Sensitive keys never in code
4. **Input validation**: All data sanitized before database insertion

## Future Enhancements

Phase 2-5 additions planned:
- Machine learning for trade pattern recognition
- Custom alert thresholds per wallet
- Historical performance tracking
- Integration with trading bots for auto-execution