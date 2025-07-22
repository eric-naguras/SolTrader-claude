# SolTrader - Whale Intelligence Platform

A whale wallet intelligence system for Solana that monitors high-net-worth wallet activity to identify coordinated memecoin investment opportunities and generate trading signals.

## 🎯 Core Concept

SolTrader monitors a curated list of successful whale wallets and detects when multiple wallets purchase the same token within a short timeframe. This coordination pattern often indicates profitable trading opportunities.

**Signal Generation Logic:**
- Monitors wallet positions in real-time via Helius WebSocket
- Generates BUY signals when 2, 3, 4, 5, or 5+ wallets hold the same token
- Generates SELL signals when wallets exit positions
- Creates paper trades for performance analysis
- Uses LLM analysis to optimize trading rules

## 🚀 Quick Start

```bash
# Install dependencies (using Bun)
bun install

# Start development server (unified frontend + backend)
bun run dev

# Production server
bun start
```

## 📁 Project Structure

```
/
├── package.json                    # Single unified package.json
├── server.ts                       # Main server (Hono-based, HTMX frontend)
├── tsconfig.json                   # TypeScript configuration  
├── migrations/                     # Database schema and sample data
│   ├── 001_initial_schema.sql     # Core tables and triggers
│   └── 002_wallet_data.sql        # Sample whale wallets
└── src/
    ├── lib/                        # Core libraries
    │   ├── env.ts                 # Runtime-agnostic environment
    │   ├── database.ts            # Neon PostgreSQL integration
    │   └── logger.ts              # Configurable logging
    ├── services/                   # Backend services
    │   ├── service-manager.ts     # Service orchestration
    │   ├── wallet-watcher.ts      # Helius WebSocket monitoring
    │   ├── paper-trader.ts        # Paper trading simulation
    │   ├── signal-analyzer.ts     # Multi-whale pattern detection
    │   └── signal-trader.ts       # Live trading (safety disabled)
    ├── templates/                  # Server-side rendered UI
    │   ├── layout.ts              # Base HTML layout
    │   ├── pages/                 # Full page components
    │   │   ├── dashboard.ts       # Main dashboard
    │   │   ├── wallets.ts         # Wallet management
    │   │   ├── trades.ts          # Trade history
    │   │   └── settings.ts        # Configuration
    │   └── partials/              # HTMX fragments
    │       ├── active-signals.ts  # Live signals display
    │       ├── recent-trades.ts   # Trade history
    │       ├── stats.ts           # Platform statistics
    │       └── wallets-table.ts   # Wallet management UI
    └── public/                     # Static assets
        ├── css/app.css            # Application styles
        ├── js/                    # Client-side JavaScript
        └── images/                # Assets
```

## 🔧 Architecture Features

### Unified Single-Process Design
- **Frontend**: Server-rendered HTMX dashboard with minimal JavaScript
- **Backend**: 4 coordinated services in one process
- **Database**: Neon PostgreSQL with real-time triggers
- **Runtime**: Bun-first but Node.js compatible

### Core Services
1. **wallet-watcher**: Real-time whale wallet monitoring via Helius WebSocket
2. **paper-trader**: Automated paper trading simulation
3. **signal-analyzer**: Multi-whale coordination pattern detection
4. **signal-trader**: Live trading execution (disabled by default)

### Technology Stack
- **Framework**: Hono (lightweight web framework)
- **Frontend**: HTMX + Alpine.js + Pico CSS (no SPA complexity)
- **Database**: Neon PostgreSQL with TimescaleDB features
- **Runtime**: Bun (development) / Node.js (production)
- **WebSocket**: Helius SDK for real-time Solana data

## 🌍 Environment Variables

```env
# Required
DATABASE_URL=postgresql://user:password@host/database
HELIUS_API_KEY=your_helius_api_key

# Optional - Server Configuration
PORT=3000

# Optional - Logging Configuration  
LOG_CONNECTION=false     # Database connections
LOG_WALLET=true         # Wallet transaction events
LOG_TRADE=true          # Paper/live trading activity
LOG_MULTI_WHALE=true    # Signal generation events
LOG_DEBUG=false         # Debug-level logging

# Optional - Trading Configuration
ENABLE_LIVE_TRADING=false  # Safety: must explicitly enable
```

## 🔒 Safety Features

- **Live trading disabled by default** - Must be explicitly enabled
- **Paper trading first** - Test strategies before real money
- **Service isolation** - Services can be restarted independently
- **Comprehensive logging** - Configurable log categories
- **Database triggers** - Real-time change notifications

## 🖥️ Web Dashboard

Access at `http://localhost:3000` - Server-side rendered with HTMX interactivity

### Pages
- **Dashboard**: Live statistics, active signals, recent activity
- **Wallets**: Manage tracked whale wallets (add/remove/edit)  
- **Trades**: Historical whale trades and coordination patterns
- **Settings**: Configure logging levels and service parameters

### Features
- **Real-time updates**: HTMX-powered live data refresh
- **Responsive design**: Works on desktop and mobile
- **No build step**: Direct serving, minimal JavaScript

## 🛠️ Development

```bash
# Development with auto-reload
bun run dev

# Run tests
bun test

# Build for production
bun run build

# TypeScript compilation
bun run build:node
```

## 🚀 Deployment Options

### Single Process Deployment
- **Bun**: `bun run start` (recommended for performance)
- **Node.js**: `npm run build:node && npm run start:node`
- **Cloudflare Workers**: `npm run deploy` (requires wrangler setup)

### Environment Setup
1. Set required environment variables (`DATABASE_URL`, `HELIUS_API_KEY`)
2. Run database migrations in `/migrations`
3. Start server - all services launch automatically

### Database Setup
```bash
# Apply schema and sample data
psql $DATABASE_URL -f migrations/001_initial_schema.sql
psql $DATABASE_URL -f migrations/002_wallet_data.sql
```

## 🏗️ Built With

- **[Bun](https://bun.sh)** - Fast JavaScript runtime
- **[Hono](https://hono.dev)** - Lightweight web framework  
- **[HTMX](https://htmx.org)** - Server-side rendered interactivity
- **[Neon Database](https://neon.tech)** - Serverless PostgreSQL
- **[Helius](https://helius.xyz)** - Solana API and WebSocket