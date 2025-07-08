# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Project Sonar is a Solana blockchain trading intelligence platform that monitors high-net-worth wallets ("whales") to detect coordinated buying patterns in memecoins and generate automated trading signals.

## Key Architecture Components

### Microservices Architecture
The system is designed as independent CLI-based microservices:
- **whale-watcher**: Real-time transaction monitoring service
- **whale-discovery**: New profitable wallet discovery service  
- **signal-processor**: Business logic for detecting coordinated activity
- **notifier**: Multi-channel alert delivery service
- **trade-executor**: Automated trading execution service
- **exit-manager**: Position management and exit strategy service

### Technology Stack
- **Primary Language**: TypeScript/Node.js
- **Secondary Language**: Python (for data analysis and ML)
- **Database**: Supabase (PostgreSQL with TimescaleDB extension)
- **Cache**: Redis
- **Message Queue**: BullMQ
- **Blockchain**: Solana via Helius SDK, @solana/web3.js
- **Trading**: Jupiter SDK (@jup-ag/core)
- **Frontend**: Next.js/React or Streamlit

## Development Commands

### Initial Setup
```bash
# Install dependencies for TypeScript services
npm install

# Install Python dependencies (when Python services are added)
pip install -r requirements.txt

# Set up environment variables
cp .env.example .env
# Edit .env with your RPC endpoints and API keys
```

### Running Services
```bash
# Run individual services (once implemented)
npm run whale-watcher
npm run signal-processor
npm run notifier
npm run trade-executor
npm run exit-manager

# Run all services with PM2 (production)
pm2 start ecosystem.config.js
```

### Database Management
```bash
# Run database migrations
npm run db:migrate

# Seed initial data (tracked wallets, etc.)
npm run db:seed

# Access Supabase Studio for database management
# Use your Supabase project URL
```

### Testing
```bash
# Run unit tests
npm test

# Run integration tests
npm run test:integration

# Run specific service tests
npm test whale-watcher
```

### Code Quality
```bash
# Run ESLint for TypeScript
npm run lint

# Run type checking
npm run typecheck

# Format code with Prettier
npm run format

# For Python services
python -m black .
python -m flake8
python -m mypy .
```

## Development Workflow

### Phase 1: Core Monitoring (Current Focus)
1. Implement whale-watcher service with Helius WebSocket integration
2. Set up Supabase database with core schema (tracked_wallets, whale_trades, trade_signals)
3. Create signal-processor as PostgreSQL trigger/function
4. Build notifier service with Telegram/Discord integration
5. Add paper trading functionality

### Phase 2: Automated Trading
1. Implement trade-executor with Jupiter SDK integration
2. Add Supabase Vault for secure credential storage
3. Build web dashboard for portfolio visualization

### Phase 3: Advanced Features
1. Implement exit-manager with trailing take-profit
2. Add whale exit detection
3. Build whale-discovery service

### Phase 4: Scale & Optimization
1. Migrate from DB triggers to BullMQ message queue
2. Add Redis caching layer
3. Containerize with Docker
4. Set up monitoring (Prometheus/Grafana)

## Key Implementation Notes

### Security Requirements
- NEVER store private keys in code or regular database tables
- Use Supabase Vault for all sensitive credentials
- Implement Row Level Security (RLS) for user data isolation
- All transactions must be simulated before signing

### Performance Targets
- Signal detection latency: < 5 seconds
- Trade execution latency: < 2 seconds
- System uptime: 99.9%
- Handle 100-1000 tracked wallets without redesign

### Database Optimization
- Use TimescaleDB hypertables for whale_trades table
- Create appropriate indexes for wallet_address and coin_address lookups
- Implement database triggers for initial signal processing

### Error Handling
- Implement automatic RPC provider failover (Helius -> QuickNode)
- Add exponential backoff for API rate limits
- Log all errors to structured logging system
- Implement circuit breakers for external services

## Common Development Tasks

### Adding a New Tracked Wallet
```typescript
// Use the CLI tool (to be implemented)
npm run cli wallet add <address> --alias "Whale Name" --tags "vc,influencer"
```

### Testing Signal Generation
```typescript
// Manually insert test trades to trigger signals
// Use Supabase Studio or psql
```

### Monitoring WebSocket Health
```typescript
// Check whale-watcher service logs
pm2 logs whale-watcher
```

## Architecture Decisions

### Why Supabase?
- Provides database, realtime subscriptions, auth, and secret storage in one platform
- Excellent for rapid development with built-in features
- Free tier suitable for proof of concept

### Why Helius for RPC?
- Parsed transaction WebSockets dramatically simplify data ingestion
- Human-readable JSON output for swaps
- Reliable infrastructure with good free tier

### Why CLI-First Design?
- Enables modular development and testing
- Easy automation and integration
- Clear separation of concerns
- Simple deployment model

## Troubleshooting

### WebSocket Connection Issues
- Check Helius API key validity
- Verify network connectivity
- Review rate limits on free tier
- Check for WebSocket timeout settings

### Database Performance
- Monitor slow queries in Supabase dashboard
- Ensure hypertables are properly configured
- Check index usage with EXPLAIN ANALYZE
- Review connection pool settings

### Signal Generation Problems
- Verify wallet addresses are properly formatted
- Check time window configuration in signal rules
- Review database trigger logs
- Ensure all services are running and connected