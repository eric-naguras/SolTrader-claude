# Phase 1 System Design: Core Monitoring & Alerting (PoC)

## Executive Summary

This document provides the comprehensive system design for Phase 1 of Project Sonar - a Solana whale wallet monitoring platform. Phase 1 focuses on establishing the core monitoring infrastructure, signal generation, and notification system as a proof of concept.

### Phase 1 Objectives
- Monitor real-time transactions from tracked whale wallets
- Detect coordinated buying patterns in memecoins
- Generate trading signals based on configurable rules
- Deliver instant notifications across multiple channels
- Implement paper trading for performance tracking

## System Architecture

### Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                        Solana Blockchain                         │
│                   (Helius WebSocket + RPC)                       │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                      whale-watcher Service                       │
│                    (TypeScript/Node.js)                          │
│  • Subscribes to whale wallet transactions                       │
│  • Parses and filters DEX trades                                │
│  • Writes to whale_trades table                                 │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                     Supabase PostgreSQL                          │
│                                                                  │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐ │
│  │ tracked_wallets │  │  whale_trades   │  │     tokens      │ │
│  └─────────────────┘  └────────┬────────┘  └─────────────────┘ │
│                               │                                  │
│                               ▼ (DB Trigger)                     │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐ │
│  │ signal_processor│  │  trade_signals  │  │portfolio_trades │ │
│  │   (PL/pgSQL)    │  └────────┬────────┘  └─────────────────┘ │
│  └─────────────────┘           │                                │
└────────────────────────────────┼────────────────────────────────┘
                                 │ (Realtime)
                    ┌────────────┴────────────┐
                    ▼                         ▼
┌─────────────────────────────┐  ┌─────────────────────────────┐
│       notifier Service       │  │    paper-trader Service     │
│     (TypeScript/Node.js)     │  │    (TypeScript/Node.js)     │
│  • Telegram notifications    │  │  • Records paper trades     │
│  • Discord webhooks         │  │  • Tracks entry prices      │
│  • CLI output               │  │  • Monitors performance     │
└──────────┬──────────────────┘  └─────────────────────────────┘
           │
           ▼
┌─────────────────────────────────────────────────────────────────┐
│                         User Channels                            │
│        Telegram Bot │ Discord Server │ CLI Terminal              │
└─────────────────────────────────────────────────────────────────┘
```

### Service Architecture

#### 1. whale-watcher Service
- **Purpose**: Real-time blockchain data ingestion
- **Technology**: TypeScript, Helius SDK, @solana/web3.js
- **Deployment**: Standalone Node.js process managed by PM2

#### 2. signal-processor (DB Function)
- **Purpose**: Analyze trades and generate signals
- **Technology**: PostgreSQL PL/pgSQL function with trigger
- **Deployment**: Database-resident function

#### 3. notifier Service
- **Purpose**: Multi-channel alert delivery
- **Technology**: TypeScript, Supabase Realtime, Telegram/Discord APIs
- **Deployment**: Standalone Node.js process

#### 4. paper-trader Service
- **Purpose**: Automatic paper trade recording
- **Technology**: TypeScript, Supabase Realtime
- **Deployment**: Integrated with notifier service initially

#### 5. wallet-manager CLI
- **Purpose**: Manage tracked wallets
- **Technology**: TypeScript CLI using Commander.js
- **Deployment**: NPM executable

## Database Design

### Schema Definition

```sql
-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "timescaledb";

-- Tracked whale wallets
CREATE TABLE tracked_wallets (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    address TEXT NOT NULL UNIQUE,
    alias TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    tags TEXT[] DEFAULT '{}',
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for efficient querying
CREATE INDEX idx_tracked_wallets_active ON tracked_wallets(is_active);
CREATE INDEX idx_tracked_wallets_tags ON tracked_wallets USING GIN(tags);

-- Token metadata cache
CREATE TABLE tokens (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    address TEXT NOT NULL UNIQUE,
    symbol TEXT,
    name TEXT,
    decimals INTEGER DEFAULT 9,
    metadata JSONB DEFAULT '{}',
    last_seen TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_tokens_address ON tokens(address);

-- Whale trade logs (TimescaleDB hypertable)
CREATE TABLE whale_trades (
    id BIGSERIAL,
    wallet_id UUID NOT NULL REFERENCES tracked_wallets(id),
    wallet_address TEXT NOT NULL,
    token_id UUID REFERENCES tokens(id),
    token_address TEXT NOT NULL,
    trade_type TEXT NOT NULL CHECK (trade_type IN ('BUY', 'SELL')),
    sol_amount NUMERIC(20, 9),
    token_amount NUMERIC(40, 9),
    usd_value NUMERIC(20, 2),
    price_per_token NUMERIC(40, 18),
    transaction_hash TEXT NOT NULL UNIQUE,
    block_slot BIGINT,
    trade_timestamp TIMESTAMPTZ NOT NULL,
    raw_data JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (id, trade_timestamp)
);

-- Convert to hypertable for time-series optimization
SELECT create_hypertable('whale_trades', 'trade_timestamp');

-- Create composite indexes for common queries
CREATE INDEX idx_whale_trades_wallet_time ON whale_trades(wallet_address, trade_timestamp DESC);
CREATE INDEX idx_whale_trades_token_time ON whale_trades(token_address, trade_timestamp DESC);
CREATE INDEX idx_whale_trades_type_time ON whale_trades(trade_type, trade_timestamp DESC);

-- Signal configuration
CREATE TABLE signal_rules (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    min_whales INTEGER DEFAULT 3,
    time_window_hours NUMERIC(5, 2) DEFAULT 1.0,
    min_total_sol NUMERIC(20, 9) DEFAULT 10,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Generated trading signals
CREATE TABLE trade_signals (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    token_id UUID REFERENCES tokens(id),
    token_address TEXT NOT NULL,
    rule_id UUID REFERENCES signal_rules(id),
    status TEXT DEFAULT 'OPEN' CHECK (status IN ('OPEN', 'EXECUTED', 'EXPIRED', 'CANCELLED')),
    trigger_reason TEXT,
    whale_count INTEGER,
    total_sol_amount NUMERIC(20, 9),
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    closed_at TIMESTAMPTZ
);

CREATE INDEX idx_trade_signals_status ON trade_signals(status);
CREATE INDEX idx_trade_signals_created ON trade_signals(created_at DESC);

-- Paper trading portfolio
CREATE TABLE portfolio_trades (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    signal_id UUID REFERENCES trade_signals(id),
    token_id UUID REFERENCES tokens(id),
    token_address TEXT NOT NULL,
    trade_mode TEXT DEFAULT 'PAPER' CHECK (trade_mode IN ('PAPER', 'LIVE')),
    status TEXT DEFAULT 'OPEN' CHECK (status IN ('OPEN', 'CLOSED')),
    entry_price NUMERIC(40, 18),
    entry_sol_amount NUMERIC(20, 9) DEFAULT 1.0,
    entry_token_amount NUMERIC(40, 9),
    entry_timestamp TIMESTAMPTZ DEFAULT NOW(),
    current_price NUMERIC(40, 18),
    high_water_mark NUMERIC(40, 18),
    exit_price NUMERIC(40, 18),
    exit_timestamp TIMESTAMPTZ,
    pnl_sol NUMERIC(20, 9),
    pnl_percentage NUMERIC(10, 2),
    exit_reason TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_portfolio_trades_status ON portfolio_trades(status);
CREATE INDEX idx_portfolio_trades_signal ON portfolio_trades(signal_id);

-- Notification log
CREATE TABLE notification_log (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    signal_id UUID REFERENCES trade_signals(id),
    channel TEXT NOT NULL CHECK (channel IN ('TELEGRAM', 'DISCORD', 'CLI', 'EMAIL')),
    recipient TEXT,
    status TEXT DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'SENT', 'FAILED')),
    message TEXT,
    error_message TEXT,
    sent_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create update trigger for updated_at columns
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_tracked_wallets_updated_at BEFORE UPDATE ON tracked_wallets
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_portfolio_trades_updated_at BEFORE UPDATE ON portfolio_trades
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
```

### Signal Processor Database Function

```sql
-- Signal generation function
CREATE OR REPLACE FUNCTION process_whale_trade()
RETURNS TRIGGER AS $$
DECLARE
    v_rule signal_rules;
    v_whale_count INTEGER;
    v_total_sol NUMERIC;
    v_signal_id UUID;
BEGIN
    -- Only process BUY trades
    IF NEW.trade_type != 'BUY' THEN
        RETURN NEW;
    END IF;

    -- Check each active rule
    FOR v_rule IN SELECT * FROM signal_rules WHERE is_active = TRUE LOOP
        -- Count unique whales buying this token within the time window
        SELECT 
            COUNT(DISTINCT wallet_address),
            COALESCE(SUM(sol_amount), 0)
        INTO v_whale_count, v_total_sol
        FROM whale_trades
        WHERE token_address = NEW.token_address
            AND trade_type = 'BUY'
            AND trade_timestamp >= NOW() - INTERVAL '1 hour' * v_rule.time_window_hours;

        -- Check if rule conditions are met
        IF v_whale_count >= v_rule.min_whales AND v_total_sol >= v_rule.min_total_sol THEN
            -- Check if signal already exists for this token
            SELECT id INTO v_signal_id
            FROM trade_signals
            WHERE token_address = NEW.token_address
                AND status = 'OPEN'
                AND created_at >= NOW() - INTERVAL '1 hour' * v_rule.time_window_hours;

            -- Create new signal if none exists
            IF v_signal_id IS NULL THEN
                INSERT INTO trade_signals (
                    token_address,
                    token_id,
                    rule_id,
                    trigger_reason,
                    whale_count,
                    total_sol_amount,
                    metadata
                ) VALUES (
                    NEW.token_address,
                    NEW.token_id,
                    v_rule.id,
                    format('%s whales bought %s SOL worth in %s hours', 
                        v_whale_count, v_total_sol::TEXT, v_rule.time_window_hours),
                    v_whale_count,
                    v_total_sol,
                    jsonb_build_object(
                        'triggering_trade', NEW.transaction_hash,
                        'rule_name', v_rule.name
                    )
                );
            END IF;
        END IF;
    END LOOP;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for signal processing
CREATE TRIGGER trigger_process_whale_trade
AFTER INSERT ON whale_trades
FOR EACH ROW EXECUTE FUNCTION process_whale_trade();
```

## Service API Specifications

### whale-watcher Service

```typescript
// Configuration Interface
interface WhaleWatcherConfig {
  helius: {
    apiKey: string;
    websocketUrl: string;
    rpcUrl: string;
  };
  supabase: {
    url: string;
    serviceKey: string;
  };
  monitoring: {
    batchSize: number;
    reconnectDelay: number;
    maxReconnectAttempts: number;
  };
}

// Main Service Class
class WhaleWatcherService {
  // Initialize and start monitoring
  async start(): Promise<void>;
  
  // Stop monitoring gracefully
  async stop(): Promise<void>;
  
  // Add wallet to monitoring
  async addWallet(address: string): Promise<void>;
  
  // Remove wallet from monitoring
  async removeWallet(address: string): Promise<void>;
  
  // Process incoming transaction
  private async processTransaction(tx: ParsedTransaction): Promise<void>;
  
  // Handle WebSocket events
  private handleWebSocketMessage(data: any): void;
  private handleWebSocketError(error: Error): void;
  private handleWebSocketClose(): void;
}
```

### notifier Service

```typescript
// Notification Configuration
interface NotifierConfig {
  supabase: {
    url: string;
    serviceKey: string;
  };
  channels: {
    telegram?: {
      botToken: string;
      chatIds: string[];
    };
    discord?: {
      webhookUrl: string;
    };
  };
}

// Notification Service Class
class NotifierService {
  // Start listening for signals
  async start(): Promise<void>;
  
  // Stop service
  async stop(): Promise<void>;
  
  // Send notification
  private async sendNotification(signal: TradeSignal): Promise<void>;
  
  // Format message for different channels
  private formatTelegramMessage(signal: TradeSignal): string;
  private formatDiscordMessage(signal: TradeSignal): object;
  private formatCliMessage(signal: TradeSignal): string;
}
```

## REST API Endpoints

### Wallet Management API

```yaml
openapi: 3.0.0
info:
  title: Sonar Wallet Management API
  version: 1.0.0

paths:
  /api/wallets:
    get:
      summary: List all tracked wallets
      parameters:
        - in: query
          name: active
          schema:
            type: boolean
        - in: query
          name: tags
          schema:
            type: array
            items:
              type: string
      responses:
        200:
          description: List of wallets
          content:
            application/json:
              schema:
                type: array
                items:
                  $ref: '#/components/schemas/Wallet'
    
    post:
      summary: Add new wallet to track
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              required:
                - address
              properties:
                address:
                  type: string
                alias:
                  type: string
                tags:
                  type: array
                  items:
                    type: string
      responses:
        201:
          description: Wallet created
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/Wallet'

  /api/wallets/{address}:
    get:
      summary: Get wallet details
      parameters:
        - in: path
          name: address
          required: true
          schema:
            type: string
      responses:
        200:
          description: Wallet details
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/Wallet'
    
    patch:
      summary: Update wallet
      parameters:
        - in: path
          name: address
          required: true
          schema:
            type: string
      requestBody:
        content:
          application/json:
            schema:
              type: object
              properties:
                alias:
                  type: string
                is_active:
                  type: boolean
                tags:
                  type: array
                  items:
                    type: string
      responses:
        200:
          description: Wallet updated
    
    delete:
      summary: Remove wallet from tracking
      parameters:
        - in: path
          name: address
          required: true
          schema:
            type: string
      responses:
        204:
          description: Wallet removed

  /api/signals:
    get:
      summary: List trade signals
      parameters:
        - in: query
          name: status
          schema:
            type: string
            enum: [OPEN, EXECUTED, EXPIRED, CANCELLED]
        - in: query
          name: limit
          schema:
            type: integer
            default: 20
        - in: query
          name: offset
          schema:
            type: integer
            default: 0
      responses:
        200:
          description: List of signals
          content:
            application/json:
              schema:
                type: array
                items:
                  $ref: '#/components/schemas/TradeSignal'

  /api/portfolio:
    get:
      summary: Get portfolio trades
      parameters:
        - in: query
          name: status
          schema:
            type: string
            enum: [OPEN, CLOSED]
      responses:
        200:
          description: Portfolio trades
          content:
            application/json:
              schema:
                type: array
                items:
                  $ref: '#/components/schemas/PortfolioTrade'

components:
  schemas:
    Wallet:
      type: object
      properties:
        id:
          type: string
          format: uuid
        address:
          type: string
        alias:
          type: string
        is_active:
          type: boolean
        tags:
          type: array
          items:
            type: string
        created_at:
          type: string
          format: date-time
    
    TradeSignal:
      type: object
      properties:
        id:
          type: string
          format: uuid
        token_address:
          type: string
        trigger_reason:
          type: string
        whale_count:
          type: integer
        total_sol_amount:
          type: number
        status:
          type: string
        created_at:
          type: string
          format: date-time
    
    PortfolioTrade:
      type: object
      properties:
        id:
          type: string
          format: uuid
        signal_id:
          type: string
          format: uuid
        token_address:
          type: string
        status:
          type: string
        entry_price:
          type: number
        current_price:
          type: number
        pnl_percentage:
          type: number
        created_at:
          type: string
          format: date-time
```

## CLI Tool Specifications

### wallet-manager CLI

```bash
# Main command structure
sonar-cli [command] [options]

# Commands:
wallet add <address>        # Add wallet to tracking
wallet remove <address>     # Remove wallet from tracking
wallet list                 # List all tracked wallets
wallet update <address>     # Update wallet details
signal list                 # List recent signals
signal stats                # Show signal statistics
portfolio status            # Show portfolio status
config set <key> <value>    # Set configuration
config get <key>            # Get configuration value

# Examples:
sonar-cli wallet add 5xoBq7f3bLZzC1SUAo9GiTBJyDoku8C5WvFWJRgKTYCr --alias "Famous Whale" --tags "degen,early"
sonar-cli wallet list --active --tags "degen"
sonar-cli signal list --limit 10 --status OPEN
sonar-cli portfolio status --format json
```

## Data Flow Diagrams

### Transaction Processing Flow

```
1. Helius WebSocket → Transaction Data
   ↓
2. whale-watcher → Parse & Filter
   ↓
3. Insert into whale_trades table
   ↓
4. DB Trigger → signal_processor function
   ↓
5. Evaluate rules → Generate signal?
   ↓
6. Insert into trade_signals table
   ↓
7. Supabase Realtime → Broadcast INSERT event
   ↓
8. notifier service → Format & Send alerts
   ↓
9. paper-trader → Record paper trade
```

### Signal Generation Logic

```
For each new BUY trade:
1. Get active signal rules
2. For each rule:
   - Count unique whales buying token in time window
   - Sum total SOL spent
   - Check if thresholds met
3. If conditions met:
   - Check for existing open signal
   - Create new signal if none exists
4. Broadcast signal via Realtime
```

## Configuration Files

### Environment Variables (.env)

```bash
# Helius Configuration
HELIUS_API_KEY=your-api-key-here
HELIUS_WEBSOCKET_URL=wss://atlas-mainnet.helius-rpc.com/?api-key=
HELIUS_RPC_URL=https://mainnet.helius-rpc.com/?api-key=

# Supabase Configuration
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_KEY=your-service-key-here

# Notification Channels
TELEGRAM_BOT_TOKEN=your-bot-token
TELEGRAM_CHAT_IDS=chat1,chat2
DISCORD_WEBHOOK_URL=https://discord.com/api/webhooks/...

# Service Configuration
WHALE_WATCHER_BATCH_SIZE=10
SIGNAL_MIN_WHALES=3
SIGNAL_TIME_WINDOW_HOURS=1
PAPER_TRADE_SIZE_SOL=1.0
```

### Docker Compose (docker-compose.yml)

```yaml
version: '3.8'

services:
  whale-watcher:
    build:
      context: ./services/whale-watcher
      dockerfile: Dockerfile
    env_file: .env
    restart: unless-stopped
    depends_on:
      - redis
    volumes:
      - ./logs:/app/logs

  notifier:
    build:
      context: ./services/notifier
      dockerfile: Dockerfile
    env_file: .env
    restart: unless-stopped
    depends_on:
      - redis
    volumes:
      - ./logs:/app/logs

  redis:
    image: redis:7-alpine
    restart: unless-stopped
    volumes:
      - redis-data:/data

volumes:
  redis-data:
```

## Development Guidelines

### Project Structure

```
sonar-phase1/
├── packages/
│   ├── whale-watcher/
│   │   ├── src/
│   │   │   ├── index.ts
│   │   │   ├── websocket.ts
│   │   │   ├── parser.ts
│   │   │   └── database.ts
│   │   ├── package.json
│   │   └── tsconfig.json
│   ├── notifier/
│   │   ├── src/
│   │   │   ├── index.ts
│   │   │   ├── channels/
│   │   │   │   ├── telegram.ts
│   │   │   │   └── discord.ts
│   │   │   └── formatter.ts
│   │   └── package.json
│   ├── cli/
│   │   ├── src/
│   │   │   ├── index.ts
│   │   │   └── commands/
│   │   └── package.json
│   └── shared/
│       ├── src/
│       │   ├── types.ts
│       │   └── supabase.ts
│       └── package.json
├── database/
│   ├── migrations/
│   │   └── 001_initial_schema.sql
│   └── functions/
│       └── signal_processor.sql
├── scripts/
│   ├── setup.sh
│   └── seed-data.ts
├── docker-compose.yml
├── package.json
├── tsconfig.json
└── .env.example
```

### Code Quality Standards

1. **TypeScript Strict Mode**: Enable all strict checks
2. **Error Handling**: Implement comprehensive error handling with retry logic
3. **Logging**: Use structured logging (winston/pino)
4. **Testing**: Minimum 80% code coverage
5. **Documentation**: JSDoc for all public methods

### Testing Strategy

1. **Unit Tests**: Test individual functions and classes
2. **Integration Tests**: Test service interactions
3. **End-to-End Tests**: Test complete flows from WebSocket to notification
4. **Load Tests**: Ensure system handles 100+ wallet monitoring

## Deployment Instructions

### Local Development

```bash
# Clone repository
git clone https://github.com/your-org/sonar.git
cd sonar

# Install dependencies
npm install

# Set up environment
cp .env.example .env
# Edit .env with your credentials

# Run database migrations
npm run db:migrate

# Start services
npm run dev
```

### Production Deployment

```bash
# Build all services
npm run build

# Run with PM2
pm2 start ecosystem.config.js

# Or with Docker
docker-compose up -d
```

## Monitoring & Observability

### Key Metrics

1. **WebSocket Health**
   - Connection status
   - Messages received/processed per minute
   - Reconnection attempts

2. **Signal Generation**
   - Signals generated per hour
   - Average whale count per signal
   - Rule trigger frequency

3. **Notification Delivery**
   - Success/failure rates by channel
   - Average delivery latency

4. **System Performance**
   - Database query performance
   - Memory usage by service
   - CPU utilization

### Health Checks

```typescript
// Health check endpoint for each service
GET /health

Response:
{
  "status": "healthy",
  "version": "1.0.0",
  "uptime": 3600,
  "checks": {
    "database": "connected",
    "websocket": "connected",
    "notifications": "operational"
  }
}
```

## Security Considerations

1. **API Authentication**: Use API keys for all endpoints
2. **Database Security**: Use connection pooling with SSL
3. **Secret Management**: Store all credentials in environment variables
4. **Rate Limiting**: Implement rate limits on API endpoints
5. **Input Validation**: Validate all wallet addresses and user inputs

## Success Criteria

Phase 1 will be considered successful when:

1. **Monitoring**: Successfully tracking 10+ whale wallets in real-time
2. **Detection**: Identifying 95%+ of whale trades within 5 seconds
3. **Signals**: Generating accurate signals based on configured rules
4. **Notifications**: Delivering alerts to all channels within 5 seconds
5. **Stability**: System maintains 99% uptime over 7 days
6. **Paper Trading**: Accurately tracking performance of all signals

---

This design document provides the complete blueprint for implementing Phase 1 of Project Sonar. The modular architecture allows for easy extension in future phases while maintaining a solid foundation for the core monitoring and alerting functionality.