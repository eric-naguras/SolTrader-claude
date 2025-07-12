# Sonar Platform - Simplified Architecture

A whale wallet intelligence system for Solana that monitors high-net-worth wallet activity to identify early memecoin investment opportunities.

## Architecture

This is the simplified, runtime-agnostic version of Sonar Platform featuring:

- **Backend**: Hono framework (runs on Cloudflare, Deno, Bun, Node)
- **Frontend**: HTMX + Alpine.js + Pico CSS
- **Database**: Supabase (PostgreSQL with real-time)
- **Services**: Whale monitoring & notifications

## Project Structure

```
sonar-platform/
├── backend/
│   ├── src/
│   │   ├── api/          # Hono API server
│   │   ├── services/     # Whale watcher & notifier
│   │   └── lib/          # Shared utilities
│   └── package.json
├── frontend/
│   ├── public/           # Static assets
│   ├── pages/            # HTMX page fragments
│   └── server.ts         # Static file server
├── scripts/              # Database scripts
└── docs/                 # Documentation
```

## Setup

### 1. Database Setup

1. Create a Supabase project at https://supabase.com
2. Run `scripts/supabase-schema.sql` in the SQL editor
3. Run `scripts/database-updates.sql` for UI-specific features

### 2. Environment Configuration

Copy `.env.example` to `.env` in the backend folder:

```bash
cd backend
cp .env.example .env
```

Configure your environment variables:
- `SUPABASE_URL` - Your Supabase project URL
- `SUPABASE_ANON_KEY` - Supabase anonymous key
- `HELIUS_API_KEY` - Required for blockchain data

### 3. Install Dependencies

```bash
# Backend
cd backend
npm install

# Frontend
cd ../frontend
npm install
```

## Running the Application

### Development Mode

Start all services in separate terminals:

```bash
# Terminal 1: API Server
cd backend
npm run dev

# Terminal 2: Background Services
cd backend
npm run dev:services

# Terminal 3: Frontend
cd frontend
npm run dev
```

Access the application at http://localhost:3000

### Production Mode

```bash
# Build
cd backend && npm run build
cd ../frontend && npm run build

# Run
cd backend && npm start          # API on port 3001
cd backend && npm start:services  # Services
cd ../frontend && npm start       # Frontend on port 3000
```

## Features

### Web Interface
- **Dashboard**: Real-time whale activity feed and signals
- **Wallets**: Manage tracked wallets with custom colors and tags
- **Trades**: View trade history and performance metrics

### Core Services
- **Whale Watcher**: Monitors Solana blockchain for whale trades
- **Notifier**: Sends alerts via Telegram, Discord, and CLI
- **Signal Processor**: Database triggers detect multi-whale patterns

## API Endpoints

- `GET /api/health` - Service health check
- `GET /api/wallets` - List tracked wallets
- `POST /api/wallets` - Add new wallet
- `PATCH /api/wallets/:address` - Update wallet
- `POST /api/wallets/:address/toggle` - Toggle active status
- `DELETE /api/wallets/:address` - Remove wallet
- `GET /api/trades/positions` - Get open positions
- `POST /api/trades/:id/close` - Close position
- `GET /api/trades/history` - Trade history
- `GET /api/trades/stats` - Performance statistics
- `GET /api/events` - Server-sent events for real-time updates

## Deployment Options

This architecture is runtime-agnostic and can be deployed to:
- **Cloudflare Workers** (with some modifications)
- **Deno Deploy**
- **Bun** runtime
- **Traditional Node.js** hosts
- **Docker** containers

## Development Notes

- The frontend uses HTMX for dynamic updates without JavaScript frameworks
- Real-time updates use Server-Sent Events (SSE)
- All database queries go through Supabase client
- WebSocket connections to Helius are managed in whale-watcher service
- No Node-specific APIs are used (fs, crypto, etc.)

## Migration from Monorepo

The original monorepo structure has been simplified:
- Removed Turbo and workspace complexity
- Consolidated packages into single backend/frontend
- Preserved business logic from original services
- CLI functionality can be recreated as needed
