# Scaling and Failover Strategies for Whale Watcher

## Overview

The whale-watcher service is critical for monitoring whale wallet activity on Solana. Missing whale exits or entries can result in significant losses. This document outlines strategies for scaling the service horizontally and ensuring high availability.

## Current Architecture

The whale-watcher service:
- Maintains WebSocket connections to Helius
- Monitors multiple whale wallets for transactions
- Writes trades to Supabase (PostgreSQL)
- No direct communication with other services

This architecture naturally supports distribution and scaling.

## Scaling Strategies

### 1. Active-Active Redundancy (Recommended)

**Best for: High availability and simplicity**

Run multiple identical instances that monitor ALL wallets simultaneously. The database handles deduplication through unique constraints.

#### Implementation

```sql
-- Add unique constraint to prevent duplicate trades
ALTER TABLE whale_trades 
ADD CONSTRAINT unique_transaction 
UNIQUE (transaction_hash);
```

```typescript
// Each instance tries to insert every trade
const insertTrade = async (trade: WhaleTrade) => {
  const { error } = await supabase
    .from('whale_trades')
    .insert(trade);
  
  if (error?.code === '23505') {
    // Duplicate - another instance already processed
    console.log('[WhaleWatcher] Trade already recorded by another instance');
    return;
  }
  // Handle other errors...
};
```

#### Deployment Example

```yaml
# Instance 1 - Primary datacenter
whale-watcher-1:
  location: US-East
  env:
    INSTANCE_ID: ww-use1-001
    
# Instance 2 - Secondary datacenter  
whale-watcher-2:
  location: US-West
  env:
    INSTANCE_ID: ww-usw2-001
```

#### Pros
- Zero downtime during failures
- No coordination required
- Simple to implement
- No single point of failure

#### Cons
- Duplicate WebSocket connections (higher Helius API usage)
- All instances process all transactions

### 2. Wallet Sharding (Horizontal Scaling)

**Best for: Large numbers of wallets (1000+)**

Distribute wallets across multiple instances, each responsible for a subset.

#### Implementation

```sql
-- Add instance assignment to wallets
ALTER TABLE tracked_wallets 
ADD COLUMN assigned_instance TEXT,
ADD COLUMN shard_key INTEGER GENERATED ALWAYS AS (
  ('x' || substring(md5(address), 1, 8))::bit(32)::int % 10
) STORED;

-- Create index for efficient queries
CREATE INDEX idx_wallet_shard ON tracked_wallets(assigned_instance, is_active);
```

```typescript
// Each instance only monitors its assigned wallets
const loadTrackedWallets = async () => {
  const { data } = await supabase
    .from('tracked_wallets')
    .select('*')
    .eq('assigned_instance', process.env.INSTANCE_ID)
    .eq('is_active', true);
    
  return data;
};
```

#### Automatic Rebalancing

```typescript
// Coordinator service to rebalance wallets
const rebalanceWallets = async () => {
  const instances = await getHealthyInstances();
  const wallets = await getAllActiveWallets();
  
  const walletsPerInstance = Math.ceil(wallets.length / instances.length);
  
  for (let i = 0; i < wallets.length; i++) {
    const instanceIndex = Math.floor(i / walletsPerInstance);
    await assignWalletToInstance(
      wallets[i].address, 
      instances[instanceIndex].id
    );
  }
};
```

#### Pros
- Linear scalability
- Reduced load per instance
- Lower API costs

#### Cons
- Requires coordination
- Partial failures affect some wallets
- Rebalancing complexity

### 3. Leader-Follower Pattern

**Best for: Resource efficiency with hot standby**

One active instance (leader) processes transactions while followers maintain ready connections.

#### Implementation

```sql
-- Leader election table
CREATE TABLE service_leadership (
  service_name TEXT PRIMARY KEY,
  instance_id TEXT NOT NULL,
  leader_since TIMESTAMPTZ NOT NULL,
  last_heartbeat TIMESTAMPTZ NOT NULL,
  metadata JSONB
);

-- Function to claim leadership
CREATE OR REPLACE FUNCTION claim_leadership(
  p_service TEXT,
  p_instance TEXT,
  p_timeout INTERVAL DEFAULT '30 seconds'
) RETURNS BOOLEAN AS $$
BEGIN
  -- Try to claim leadership if expired
  UPDATE service_leadership
  SET instance_id = p_instance,
      leader_since = NOW(),
      last_heartbeat = NOW()
  WHERE service_name = p_service
    AND last_heartbeat < NOW() - p_timeout;
    
  IF NOT FOUND THEN
    -- Try to insert if no leader exists
    INSERT INTO service_leadership (service_name, instance_id, leader_since, last_heartbeat)
    VALUES (p_service, p_instance, NOW(), NOW())
    ON CONFLICT (service_name) DO NOTHING;
  END IF;
  
  -- Check if we are the leader
  RETURN EXISTS (
    SELECT 1 FROM service_leadership
    WHERE service_name = p_service
      AND instance_id = p_instance
  );
END;
$$ LANGUAGE plpgsql;
```

```typescript
class WhaleWatcherWithLeadership extends WhaleWatcher {
  private isLeader = false;
  private leadershipInterval?: NodeJS.Timeout;
  
  async start() {
    await super.start(); // Connect WebSockets
    
    // Try to become leader
    this.leadershipInterval = setInterval(async () => {
      const wasLeader = this.isLeader;
      this.isLeader = await this.tryBecomeLeader();
      
      if (!wasLeader && this.isLeader) {
        console.log('[WhaleWatcher] Became leader, starting processing');
      } else if (wasLeader && !this.isLeader) {
        console.log('[WhaleWatcher] Lost leadership, entering standby');
      }
    }, 10000); // Check every 10 seconds
  }
  
  async processTransaction(params: any) {
    if (!this.isLeader) {
      // Standby mode - maintain connection but don't process
      return;
    }
    
    await super.processTransaction(params);
  }
}
```

#### Pros
- Efficient resource usage
- Instant failover
- No duplicate processing

#### Cons
- More complex implementation
- Brief gap during failover
- Requires leader election mechanism

### 4. Queue-Based Architecture (Future Enhancement)

**Best for: Complex processing pipelines**

Separate transaction detection from processing using a message queue.

#### Architecture

```
Helius WebSocket → Collectors → Redis Queue → Processors → Database
                       ↓                          ↓
                  (Multiple)                  (Multiple)
```

#### Implementation with BullMQ

```typescript
// Collector (lightweight, many instances)
const transactionQueue = new Queue('whale-transactions');

ws.on('message', async (data) => {
  const tx = parseTransaction(data);
  if (isRelevantTransaction(tx)) {
    await transactionQueue.add('process-trade', {
      signature: tx.signature,
      timestamp: Date.now()
    }, {
      attempts: 3,
      backoff: { type: 'exponential', delay: 2000 }
    });
  }
});

// Processor (heavy processing, scalable)
const processor = new Worker('whale-transactions', async (job) => {
  const { signature } = job.data;
  const fullTx = await helius.getTransaction(signature);
  const trade = await parseTradeDetails(fullTx);
  await supabase.from('whale_trades').insert(trade);
});
```

#### Pros
- Infinite scalability
- Fault tolerance with retries
- Can replay failed transactions
- Separate scaling of collectors and processors

#### Cons
- Additional infrastructure (Redis)
- More complex deployment
- Slight processing delay

## Monitoring and Alerting

Regardless of scaling strategy, implement monitoring:

```sql
-- Monitor instance health
CREATE OR REPLACE VIEW instance_health AS
SELECT 
  instance_id,
  last_heartbeat,
  CASE 
    WHEN last_heartbeat > NOW() - INTERVAL '1 minute' THEN 'healthy'
    WHEN last_heartbeat > NOW() - INTERVAL '5 minutes' THEN 'degraded'
    ELSE 'unhealthy'
  END as status,
  metadata->>'tracked_wallets' as tracked_wallets,
  metadata->>'websocket_connected' as websocket_connected
FROM service_heartbeats
WHERE service_name = 'whale-watcher';

-- Alert on missing trades
CREATE OR REPLACE FUNCTION check_trade_gaps() RETURNS TABLE(
  wallet_address TEXT,
  last_trade_minutes_ago INTEGER
) AS $$
SELECT 
  tw.address,
  EXTRACT(MINUTE FROM NOW() - MAX(wt.trade_timestamp))::INTEGER
FROM tracked_wallets tw
LEFT JOIN whale_trades wt ON tw.address = wt.wallet_address
WHERE tw.is_active = true
GROUP BY tw.address
HAVING MAX(wt.trade_timestamp) < NOW() - INTERVAL '60 minutes'
    OR MAX(wt.trade_timestamp) IS NULL;
$$ LANGUAGE sql;
```

## Deployment Recommendations

### For Reliability (Your Current Need)
1. Deploy 2-3 instances using **Active-Active Redundancy**
2. Use different hosting providers (e.g., one on AWS, one on Hetzner)
3. Monitor instance health via Supabase queries
4. Set up alerts for instance failures

### For Scale (Future Growth)
1. Start with Active-Active for < 500 wallets
2. Move to Wallet Sharding for 500-5000 wallets
3. Consider Queue-Based for > 5000 wallets or complex processing

### Quick Start Commands

```bash
# Deploy instance 1
INSTANCE_ID=ww-prod-001 npm run start:services

# Deploy instance 2 (different server)
INSTANCE_ID=ww-prod-002 npm run start:services

# Monitor health
psql $DATABASE_URL -c "SELECT * FROM instance_health;"
```

## Cost Considerations

- **Helius API**: Each instance maintains its own WebSocket connection
- **Database writes**: Minimal overhead from duplicate attempts
- **Bandwidth**: Scales linearly with instance count
- **Recommended**: Start with 2 instances, add more only if needed

## Summary

For your immediate needs of ensuring whale exits are never missed, deploy 2-3 instances using the **Active-Active Redundancy** pattern. It's simple, reliable, and requires minimal code changes. As you grow, the architecture supports evolution to more sophisticated scaling strategies without major rewrites.