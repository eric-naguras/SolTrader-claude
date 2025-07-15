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
- `API_SECRET` - Secret key for API authentication (set a secure random string)

### 3. Install Dependencies

```bash
# Backend
cd backend
npm install

# Frontend
cd ../frontend
npm install
```

### 4. Configure Frontend API Key

Edit `frontend/public/js/config.js` and set the API key to match your backend `API_SECRET`:

```javascript
window.CONFIG = {
  API_URL: 'http://localhost:3001',
  API_KEY: 'your-api-key-here' // Must match API_SECRET in backend .env
};
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



● Summary of Issues Being Fixed                                                                                                                                                                │[💾 TRANSACTION] 16:58:24 - Potential swap detected:
                                                                                                                                                                                               │[💾 TRANSACTION] 16:58:27 - Processing UNKNOWN transaction: 2nCBhe65...
  Current Problems:                                                                                                                                                                            │[📊 TRADE] 16:58:27 - 🔴 Yenni SOLD 0.013 SOL of 76if6EqZci5KKCPvFGKdxB89F6DHrcrmdhRWQudVbonk
                                                                                                                                                                                               │[💾 TRANSACTION] 17:00:50 - Potential swap detected5NG76gtvqfq2ng1L3WP4428Mcr7Ye4QoKXtcD6Hvxx8rVcHHJ3BTnUDwpfphy9igm5PN6Wd5AB4geqY1kvxv57YM
  1. Wallet cards only display in one row - Grid layout not wrapping to multiple rows                                                                                                          │[💾 TRANSACTION] 17:00:52 - Processing UNKNOWN transaction: 5NG76gtv...
  2. No wallet images showing - Cards display colored dots instead of wallet profile images                                                                                                    │[📊 TRADE] 17:00:52 - 🔴 Sefa SOLD 0.877 SOL of So11111111111111111111111111111111111111112
  3. No social icons visible - Twitter, Telegram, streaming links not appearing                                                                                                                │[💾 TRANSACTION] 17:01:57 - Potential swap detected: KS1jBWFBVsVQPzBfgq9do12DjgZDdn2PwWgVdsSVSXcPYqUEEtw18tzZRabV24rXTsB1J6BYzQ5uWVAeB3yLH5i
  4. No coin/token names - Only showing symbols, missing full token names                                                                                                                      │[💾 TRANSACTION] 17:02:00 - Processing UNKNOWN transaction: KS1jBWFB...
  5. Grid scrolling issues - Section height constraints preventing proper card display                                                                                                         │[📊 TRADE] 17:02:00 - 🟢 Kev BOUGHT 1.644 SOL of So11111111111111111111111111111111111111112
                                                                                                                                                                                               │[💾 TRANSACTION] 17:02:40 - Potential swap detected: 3cvowvE1XbGmVFJsYGxKgPN9u4djSk8ExUUMjZhBx7WX4BbrjNotLDWuhMLiWSECgoYiNV1ef6RSSzjNQXtYYW6j
  Root Causes Identified:                                                                                                                                                                      │[💾 TRANSACTION] 17:02:42 - Processing UNKNOWN transaction: 3cvowvE1...
                                                                                                                                                                                               │[📊 TRADE] 17:02:43 - 🟢 Sefa BOUGHT 1.513 SOL of So11111111111111111111111111111111111111112
  1. CSS Grid Layout: .wallet-trades-grid was constraining to single row                                                                                                                       │[🎯 MULTIWHALE] 17:02:43 - ⚠️  2 whales in So11111111111111111111111111111111111111112: Kev, Sefa
  2. Data Structure Mismatch: Frontend JavaScript expecting different field names than database provides                                                                                       │[💾 TRANSACTION] 17:02:45 - Potential swap detected: 21KgnvmoWVL7iidgCBkWEgwRxRdTtwuusGaMZov3i7Bw9ycMJQP1DhyAy1G6Npepaf915qgBhVybvdfKAX4HQSA2
  3. API Response Issues: /api/trades endpoint may not be returning expected data structure                                                                                                    │[💾 TRANSACTION] 17:02:47 - Processing UNKNOWN transaction: 21Kgnvmo...
  4. Database Schema: Missing fields like is_verified, price_usd in some tables                                                                                                                │[📊 TRADE] 17:02:47 - 🔴 Yenni SOLD 0.013 SOL of 76if6EqZci5KKCPvFGKdxB89F6DHrcrmdhRWQudVbonk
  5. View Usage: Not utilizing the recent_whale_trades view that has proper joins                                                                                                              │[💾 TRANSACTION] 17:03:00 - Potential swap detected: 3Cefohwac4Jd1M84x2Su5RavHofRgCn9GEW43t7hArKxkjzekGidup2YwWMH47Ubor8zFSzZzJviY5sz6XnBFwa3
                                                                                                                                                                                               │[💾 TRANSACTION] 17:03:02 - Processing UNKNOWN transaction: 3Cefohwa...
  Changes Made So Far:                                                                                                                                                                         │[📊 TRADE] 17:03:02 - 🔴 Sefa SOLD 1.093 SOL of So11111111111111111111111111111111111111112
                                                                                                                                                                                               │[💾 TRANSACTION] 17:03:58 - Potential swap detected: 2RhURJNfiBUez6Ex6qoen6WtUsffkajMQiJEkSZJVaK1tDETkqRXwS8tbBgsY9HnMJE2qE3YfWWbWBEzu1gMJbJa
  1. CSS Updates: Modified grid to allow multiple rows with grid-auto-rows: max-content                                                                                                        │[💾 TRANSACTION] 17:04:01 - Processing UNKNOWN transaction: 2RhURJNf...
  2. Avatar Logic: Updated JavaScript to prioritize wallet images over colored dots                                                                                                            │[📊 TRADE] 17:04:01 - 🟢 Sefa BOUGHT 1.633 SOL of So11111111111111111111111111111111111111112
  3. Social Icons: Fixed Telegram icon and improved display logic                                                                                                                              │[🎯 MULTIWHALE] 17:04:01 - ⚠️  2 whales in So11111111111111111111111111111111111111112: Kev, Sefa
  4. Database Schema: Created script to add missing fields (is_verified, price_usd)                                                                                                            │[💾 TRANSACTION] 17:04:51 - Potential swap detected: 61CoFegDNW1kKwGJ2ZYr2brWyhzETDbNDy5bF3Pp8nZvfSBfJkk8DKYDMv3oYzaNP9s6hTs6hu9NVwQAjBBDHFYC
  5. View Recreation: Updated recent_whale_trades view to include all needed fields                                                                                                            │[💾 TRANSACTION] 17:04:53 - Processing UNKNOWN transaction: 61CoFegD...
                                                                                                                                                                                               │[📊 TRADE] 17:04:53 - 🔴 Sefa SOLD 0.973 SOL of So11111111111111111111111111111111111111112
  Still Need To Do:                                                                                                                                                                            │[💾 TRANSACTION] 17:06:34 - Potential swap detected: 5JV934jx56GD7ZK9QfvvJ5MTZ1tzXxsr5WNCanuHK2VoahdZiAnXCLhGRJFFjQDoVcvZPAfSwGKD851Mbj9vxzRi
                                                                                                                                                                                               │[💾 TRANSACTION] 17:06:36 - Potential swap detected: 3kqaGxpsCtvBaQ78r29chmZbmg4dVsiTnc21cqirXfjF6Cod2HiyroYuveAnXuJdMfReqBRnwQ2WQ68rctqKBF65
  1. Verify Database Data: Use Supabase MCP to check actual data in tables                                                                                                                     │[💾 TRANSACTION] 17:06:37 - Processing UNKNOWN transaction: 5JV934jx...
  2. API Endpoint Fix: Ensure /api/trades uses the proper view with all joins                                                                                                                  │[📊 TRADE] 17:06:37 - 🔴 Yenni SOLD 0.013 SOL of 76if6EqZci5KKCPvFGKdxB89F6DHrcrmdhRWQudVbonk
  3. Test With Real Data: Confirm frontend properly processes actual database records                                                                                                          │[💾 TRANSACTION] 17:06:39 - Processing UNKNOWN transaction: 3kqaGxps...
  4. Debug Console Errors: Check browser console for JavaScript errors                                                                                                                         │[📊 TRADE] 17:06:39 - 🔴 Yenni SOLD 0.013 SOL of 76if6EqZci5KKCPvFGKdxB89F6DHrcrmdhRWQudVbonk
                                                                                                                                                                                               │[💾 TRANSACTION] 17:08:29 - Potential swap detected: 3pQ6NXmm5mRTLXqiTP7VkTc5zioV41jQq3w8qPmfdaLYCht5QCrMgsuktUnXCZfYGRmb5vgfjDvmMmSj88yJUQwD
  The main issue seems to be a disconnect between what the frontend expects and what the database/API actually provides. With Supabase MCP access, we can verify the actual data structure     │[💾 TRANSACTION] 17:08:31 - Processing UNKNOWN transaction: 3pQ6NXmm...
   and fix the remaining issues. 
  

  claude mcp add context7 -- npx -y @upstash/context7-mcp
  claude mcp add supabase -- npx -y @supabase/mcp-server-supabase@latest --access-token sbp_b430d17412fe0b83d9ddd1963f6bada61ce46cad                                                              │[💾 TRANSACTION] 17:21:56 - Processing UNKNOWN transaction: 4a61T7ua...