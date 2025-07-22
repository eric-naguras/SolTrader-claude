# Sonar Platform - Unified Deployment

A whale wallet intelligence system for Solana that monitors high-net-worth wallet activity to identify early memecoin investment opportunities.

## 🚀 Quick Start

```bash
# Install dependencies (using Bun)
bun install

# Start development server (frontend + backend combined)
bun run dev

# Production server
bun start
```

## 📁 Project Structure

```
/
├── package.json                    # Single unified package.json
├── server.ts                       # Main server (frontend + backend combined)
├── tsconfig.json                   # TypeScript configuration  
├── .env                           # Environment variables
├── migrations/                    # Database migrations
│   ├── 001_initial_schema.sql    # Database schema with triggers
│   └── 002_wallet_data.sql       # Sample data
└── src/
    ├── lib/                       # Core libraries
    │   ├── env.ts                # Runtime-agnostic environment variables
    │   ├── database.ts           # Clean Neon database layer (no Supabase)
    │   └── logger.ts             # Runtime-agnostic logging
    ├── services/                 # Backend services
    │   ├── service-manager.ts    # Coordinates all services
    │   ├── wallet-watcher.ts     # Helius WebSocket integration
    │   ├── paper-trader.ts       # Paper trading simulation
    │   ├── signal-analyzer.ts    # Multi-whale pattern detection
    │   └── signal-trader.ts      # Live trading (disabled by default)
    ├── templates/                # HTMX frontend templates
    │   ├── layout.ts             # Main HTML layout
    │   ├── pages/                # Full page templates
    │   └── partials/             # Reusable HTML fragments
    └── public/                   # Static assets
        ├── css/
        ├── js/
        └── images/
```

## 🔧 Key Features

### Runtime-Agnostic
- Works on **Bun** (recommended for development)
- Works on **Node.js** (production compatible)
- Works on **Cloudflare Workers** (with minor config changes)
- **No platform-specific code** - uses runtime detection

### Single Process Architecture
- **Frontend**: HTMX-powered dashboard served by Hono
- **Backend**: 4 coordinated services running in same process
- **Database**: Neon PostgreSQL with real-time triggers
- **Monitoring**: Built-in service health monitoring

### Services Overview
- **wallet-watcher**: Monitors whale wallets via Helius WebSocket
- **paper-trader**: Simulates trades and tracks performance
- **signal-analyzer**: Detects multi-whale coordination patterns
- **signal-trader**: Executes real trades (disabled by default for safety)

## 🌍 Environment Variables

```env
# Required
DATABASE_URL=postgresql://user:password@host/database
HELIUS_API_KEY=your_helius_api_key

# Optional
PORT=3000
LOG_CONNECTION=false
LOG_WALLET=true  
LOG_TRADE=true
LOG_MULTI_WHALE=true
LOG_DEBUG=false
```

## 🔒 Safety Features

- **Live trading disabled by default** - Must be explicitly enabled
- **Paper trading first** - Test strategies before real money
- **Service isolation** - Services can be restarted independently
- **Comprehensive logging** - Configurable log categories
- **Database triggers** - Real-time change notifications

## 🖥️ Dashboard

Access the dashboard at `http://localhost:3000`

- **Wallets**: Manage tracked whale wallets
- **Trades**: View recent whale trades and patterns
- **Signals**: Monitor multi-whale coordination alerts
- **Settings**: Configure logging and service parameters

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

## 🚀 Deployment

The unified architecture makes deployment simple:

1. **Single process** - No orchestration needed
2. **Runtime flexible** - Deploy on Bun, Node.js, or serverless
3. **Environment variables** - Configure via .env or deployment platform
4. **Static assets** - Served directly or via CDN

Built with ❤️ using Bun, Hono, HTMX, and Neon Database.