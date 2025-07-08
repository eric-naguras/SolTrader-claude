# Project Sonar - Phase 1 Design Documentation

## Overview

This repository contains comprehensive design documentation for Phase 1 of Project Sonar, a Solana blockchain trading intelligence platform that monitors whale wallet activity to generate automated trading signals.

## Documentation Structure

### Core Design Documents

1. **[phase1-design.md](phase1-design.md)** - Complete Phase 1 system design
   - System architecture overview
   - Service specifications
   - Database schema
   - API endpoints
   - Development guidelines

2. **[phase1-implementation-plan.md](phase1-implementation-plan.md)** - Detailed implementation roadmap
   - 10-week development timeline
   - Task breakdown by week
   - Risk mitigation strategies
   - Testing and deployment plans

3. **[cli-design.md](cli-design.md)** - CLI tool specifications
   - Command structure
   - Usage examples
   - Configuration management
   - Interactive mode features

### Database Design

- **[database/migrations/](database/migrations/)** - SQL migration files
  - `001_initial_schema.sql` - Core tables and indexes
  - `002_signal_processor.sql` - Signal generation logic
  - `003_seed_data.sql` - Initial test data

### API Design

- **[api/openapi.yaml](api/openapi.yaml)** - Complete REST API specification
  - Wallet management endpoints
  - Signal querying endpoints
  - Portfolio tracking endpoints
  - Health monitoring endpoints

- **[api/types/index.ts](api/types/index.ts)** - TypeScript type definitions
  - Database models
  - API request/response types
  - Service configurations
  - Error definitions

### Service Interfaces

- **[api/services/whale-watcher.interface.ts](api/services/whale-watcher.interface.ts)**
  - Real-time blockchain monitoring service
  - WebSocket management
  - Transaction processing

- **[api/services/notifier.interface.ts](api/services/notifier.interface.ts)**
  - Multi-channel notification service
  - Message formatting
  - Channel management

- **[api/services/paper-trader.interface.ts](api/services/paper-trader.interface.ts)**
  - Paper trading management
  - Portfolio tracking
  - Performance analytics

## Quick Start Guide

### 1. Review Documentation
Start with `phase1-design.md` for system overview, then review `phase1-implementation-plan.md` for development roadmap.

### 2. Database Setup
1. Create a Supabase project
2. Run migrations in order: 001 → 002 → 003
3. Enable TimescaleDB extension

### 3. Service Development Order
1. **whale-watcher** - Core monitoring service
2. **signal-processor** - Database function/trigger
3. **notifier** - Alert delivery service
4. **paper-trader** - Trading simulation
5. **CLI tools** - Management interface
6. **REST API** - External access

### 4. Key Technologies
- **Backend**: TypeScript/Node.js
- **Database**: Supabase (PostgreSQL + TimescaleDB)
- **Blockchain**: Helius WebSocket API
- **Notifications**: Telegram, Discord
- **Infrastructure**: Docker, PM2

## Phase 1 Features

### Core Functionality
- ✅ Real-time whale wallet monitoring
- ✅ Automated signal generation
- ✅ Multi-channel notifications
- ✅ Paper trading system
- ✅ CLI management tools
- ✅ REST API access

### Performance Targets
- Signal detection: < 5 seconds
- Notification delivery: < 5 seconds
- System uptime: 99.9%
- Support for 100+ tracked wallets

## Architecture Overview

```
Solana Blockchain → Helius WebSocket → whale-watcher Service
                                             ↓
                                    PostgreSQL Database
                                             ↓
                            Signal Processor (DB Trigger)
                                             ↓
                                     Trade Signals
                                    ↙            ↘
                          Notifier Service    Paper Trader
                                ↓
                    Telegram | Discord | CLI
```

## Development Timeline

- **Weeks 1-2**: Foundation setup
- **Weeks 3-4**: Whale watcher service
- **Week 5**: Signal generation
- **Week 6**: Notification service
- **Week 7**: Paper trading
- **Week 8**: CLI & API
- **Weeks 9-10**: Testing & deployment

## Next Steps

1. Set up development environment
2. Create Supabase project
3. Configure API keys (Helius, Telegram, Discord)
4. Begin implementation following the weekly plan

## Additional Resources

- [Project Requirements (PRD)](prd-merged.md)
- [Technical Architecture](architecture-merged.md)
- [CLAUDE.md](CLAUDE.md) - AI assistant context

---

For questions or clarifications about the design, refer to the specific documentation files or create an issue in the repository.