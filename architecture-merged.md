Of course. Here is a single, comprehensive architecture document created by intelligently merging and synthesizing the best ideas from the four provided files.

This new document is structured for clarity, eliminates redundancy, and combines the most robust and practical concepts to serve as a definitive blueprint for an AI coding agent.

---

# **Unified Architecture & Technology Blueprint: Project "Sonar"**

**Version:** 2.0
**Purpose:** This document provides a comprehensive technical architecture for the Sonar platform, a system designed to monitor Solana whale wallet activity, generate trading signals, automate trades, and provide rich analytics. It synthesizes the strongest concepts from multiple design documents into a single, actionable blueprint intended for development by AI coding agents.

---

## 1. Overview & Architectural Principles

### 1.1. Core Concept

The Sonar platform will ingest real-time on-chain data from the Solana blockchain, process it against a set of rules to identify trading signals based on whale activity, store the state and results in a central database, and trigger external actions like notifications and automated trades.

### 1.2. Architectural Principles

The system is designed with the following principles in mind:

*   **Service-Oriented & Modular:** The system is composed of several independent microservices. In the initial phases, these will be implemented as discrete CLI applications, allowing for independent development, testing, and deployment.
*   **Event-Driven:** Services communicate asynchronously through a central database (for initial phases) and a dedicated message queue (for scaling). This decouples services and enhances resilience.
*   **Database as the "Single Source of Truth":** Supabase (PostgreSQL) acts as the central nervous system, storing all state, configuration, and results. Features like DB triggers and real-time subscriptions are leveraged for efficiency.
*   **CLI-First:** The core logic is encapsulated in command-line applications, making automation, testing, and integration straightforward. UIs are considered presentation layers on top of this solid foundation.
*   **Phased Evolution:** The architecture is designed to start simple and scale in complexity, moving from simple database triggers to a robust message queue and from manual execution to fully automated trading and discovery.

## 2. System Architecture Diagram

This diagram illustrates the flow of data from the blockchain through the various services and data stores to the end-user and trading venues.

```
+---------------------------------+      +--------------------------------+
|      Solana Blockchain          |      |    Third-Party Data APIs       |
| (RPC & WebSocket Endpoints)     |      | (Jupiter, Birdeye, Solscan)    |
+-----------------+---------------+      +----------------+---------------+
                  ^                                        ^
                  | (subscribes & fetches)                 | (data enrichment)
                  |                                        |
+-----------------v----------------------------------------v---------------+
|                                                                          |
|                     Sonar Application Core Services                      |
|                                                                          |
|  +-------------------+  +-------------------+  +------------------------+ |
|  |  Service 1:       |  |  Service 2:       |  |  Service 3:            | |
|  |  Whale-Watcher    |  |  Whale-Discovery  |  |  Signal-Processor      | |
|  |  (Data Ingest)    |  |  (Scraping)       |  |  (Business Logic)      | |
|  +-------------------+  +-------------------+  +------------------------+ |
|         |                      |                     |                   |
|         +----------------------v---------------------v-------------------+ |
|                                | (Jobs In)                               | |
| +------------------------------v---------------------------------------+ |
| |                                                                       | |
| |            Message Queue (e.g., BullMQ on Redis) - Phase 2+           | |
| |       [Queues: tx-processing, signal-generation, trades, etc.]        | |
| |                                                                       | |
| +------------------------------^---------------------------------------+ |
|                                | (Jobs Out / Direct DB Writes)           | |
|                                v                                         |
| +----------------------------------------------------------------------+ |
| |                                                                      | |
| |    Data Store: Supabase (PostgreSQL + TimescaleDB + Realtime)        | |
| |  [Tables: wallets, trades, signals, portfolio, etc.]                 | |
| |                                                                      | |
| +------------------------------------^---------------------------------+ |
|                                      | (reads/writes)                    |
|                                      v                                   |
|  +-------------------+  +-------------------+  +------------------------+ |
|  |  Service 4:       |  |  Service 5:       |  |  Service 6:            | |
|  |  Notifier         |  |  Trade-Executor   |  |  Exit-Manager          | |
|  |  (Alerting)       |  |  (Live/Paper)     |  |  (T/P & Exits)         | |
|  +-------------------+  +-------------------+  +------------------------+ |
|         |                      |                     |                   |
+---------|----------------------|---------------------|-------------------+
          v                      v                     v
+---------+----------+ +---------+---------+ +---------+---------+
| User via           | | DEX Aggregator    | | Dashboard           |
| Telegram/Discord   | | API (Jupiter)     | | (Web App)           |
+--------------------+ +-------------------+ +-------------------+

```

## 3. Core Components & Service Breakdown

### Service 1: `whale-watcher` (Data Ingestion)
*   **Purpose:** The primary data ingestion service. Connects to Solana, subscribes to transaction logs for a list of tracked whale wallets, and pushes raw, relevant transaction data into the database or message queue.
*   **Technology:** TypeScript (`ts-node`), Helius SDK, `@solana/web3.js`.
*   **Key Justification:** Helius's parsed transaction WebSockets are critical. They offload the complex and slow task of fetching and parsing each transaction, providing human-readable JSON output for swaps directly, which dramatically simplifies ingestion.
*   **Data Flow:**
    1. Reads the list of active wallets from the `tracked_wallets` table.
    2. Establishes a WebSocket connection via Helius, subscribing to transactions for all wallets.
    3. On receiving a parsed transaction, it filters for relevant actions (e.g., buys/sells of SPL tokens).
    4. Inserts a new record into the `whale_trades` table or pushes a job to the `transaction-processing` queue.

### Service 2: `whale-discovery` (Scout)
*   **Purpose:** Proactively finds new potential whale wallets to track.
*   **Technology:** Python or TypeScript, `axios`/`requests`, SolanaFM/Solscan APIs.
*   **Data Flow:**
    1. Scrapes DEX screeners (Birdeye, DexScreener) for newly created, high-volume tokens.
    2. Analyzes the top holders and initial buyers of these tokens.
    3. Queries SolanaFM/Solscan APIs for wallet history and balance (> $1M USD).
    4. Identifies wallets that frequently appear as early, large buyers and suggests them for addition to the `tracked_wallets` table.
    5. Detects CEX transfers by checking against a known list of CEX-owned wallets.

### Service 3: `signal-processor` (Business Logic)
*   **Purpose:** Analyzes new whale trades to identify coordinated activity that constitutes a trade signal.
*   **Evolutionary Implementation:**
    *   **Phase 1 (DB Trigger):** A `PL/pgSQL` database function and trigger on the `whale_trades` table. This is atomic, fast, and simple. On a new `INSERT`, the function checks if enough unique whales have bought the same coin in a configured time window. If a threshold is met (e.g., >= 3 whales), it inserts a new record into the `trade_signals` table.
    *   **Phase 2 (Dedicated Service):** A standalone service that processes jobs from a message queue. This is more scalable and allows for more complex, stateful analysis (e.g., pattern recognition, velocity checks).
*   **Technology:** Supabase (PostgreSQL) for Phase 1; TypeScript/Python service consuming from BullMQ/Redis for Phase 2.

### Service 4: `notifier` (Alerting)
*   **Purpose:** Listens for new signals and sends alerts to users via multiple channels.
*   **Technology:** Python or TypeScript, `python-telegram-bot`/`node-telegram-bot-api`, `nodemailer`.
*   **Mechanism:** Utilizes **Supabase Realtime** subscriptions. This is highly efficient as it avoids polling. The service listens for `INSERT` events on the `trade_signals` table.
*   **Data Flow:**
    1. Subscribes to new rows in the `trade_signals` table.
    2. On receiving a new signal, it formats a message including the coin, the reason, and a link to a DEX screener (`https://dexscreener.com/solana/{coin_address}`).
    3. Sends the message via configured Telegram, Discord (webhook), and/or email endpoints.

### Service 5: `trade-executor` (Live/Paper Trading)
*   **Purpose:** Listens for new signals and executes trades based on user configuration.
*   **Technology:** TypeScript/Python, **Jupiter Core SDK (`@jup-ag/core`)**, and/or custom integrations with trading bots (Maestro, BonkBot).
*   **Security:** All API keys and wallet private keys are stored and accessed exclusively through **Supabase Vault**.
*   **Data Flow:**
    1. Subscribes to new `trade_signals` via Supabase Realtime.
    2. On a new signal, it reads the user's trade configuration (mode: 'PAPER' or 'LIVE', trade size, slippage).
    3. Uses the Jupiter SDK to fetch a quote and execute the swap for direct trades.
    4. Logs the result of the trade (entry price, fees, status) into the `portfolio_trades` table.

### Service 6: `exit-manager` (Position Management)
*   **Purpose:** Monitors open positions and executes exit strategies based on predefined rules.
*   **Technology:** TypeScript/Python, Jupiter API (for price feeds and execution).
*   **Data Flow:**
    1. **Whale Exit Detection:** The `whale-watcher` also logs sell transactions. A DB trigger or service logic can check if a selling whale was part of the original signal for an open position, flagging it for exit.
    2. **Trailing Take-Profit:** A service periodically (e.g., every 3-5 seconds) fetches the current price for all 'OPEN' positions in the `portfolio_trades` table. It compares the `current_price` against the stored "high water mark" (highest price seen). If `current_price < high_water_mark * (1 - trailing_percentage)`, it triggers a sell via the `trade-executor`'s logic.

## 4. Technology Stack Summary

| Category | Technology | Justification |
| :--- | :--- | :--- |
| **Primary Language** | **TypeScript / Node.js** | Strong ecosystem for crypto (`@solana/web3.js`), type safety, ideal for I/O-bound tasks. |
| **Secondary Language** | **Python** | Excellent for data analysis, ML models, and wallet discovery scripts (`solders`). |
| **Database** | **Supabase (PostgreSQL)** | All-in-one: Managed DB, Auth, Storage, Realtime, Vault. Perfect for rapid development. |
| **DB Extension**| **TimescaleDB** | PostgreSQL extension for optimizing time-series data like transactions and price feeds. |
| **Cache Layer**| **Redis** | For caching frequently accessed data like whale profiles, token metadata, and for backing the message queue. |
| **Message Queue**| **BullMQ** | Robust, Redis-based job queue system for scalable, asynchronous processing between services. |
| **RPC Provider** | **Helius** (Primary), QuickNode (Fallback) | Helius's Parsed Transaction History API and WebSockets are essential for simplifying the data ingestion pipeline. |
| **Core Libraries** | `@solana/web3.js`, Helius SDK, `@solana/spl-token` | For all core blockchain interactions. |
| **Trading API** | **Jupiter SDK (@jup-ag/core)** | The most robust and feature-rich API for executing swaps on Solana. |
| **Secret Management** | **Supabase Vault** | Securely stores all sensitive API keys, wallet credentials, and secrets. |
| **Deployment** | Docker, PM2 (for CLIs), Supabase Edge Functions, Kubernetes (future) | Containerize services for portability. PM2 for process management. K8s for future scaling. |
| **Monitoring** | Prometheus + Grafana, Sentry | Industry-standard stack for metrics, logging, and error tracking. |
| **Dashboard (PoC)**| Streamlit (Python) or Next.js/React (TypeScript) | Easy to build a simple, real-time data visualization front-end that reads directly from Supabase. |

## 5. Database Schema (Enhanced Design)

This schema combines the best attributes from all source documents, providing a comprehensive and normalized structure.

```sql
-- Wallets we are actively tracking or have discovered
CREATE TABLE tracked_wallets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    address TEXT NOT NULL UNIQUE,
    alias TEXT, -- User-defined name
    is_active BOOLEAN DEFAULT TRUE,
    tags TEXT[], -- e.g., ['influencer', 'vc', 'early_buyer']
    metadata JSONB, -- { "discovery_method": "scout", "associated_wallets": [...] }
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Memecoins we have seen in trades
CREATE TABLE tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    address TEXT NOT NULL UNIQUE,
    symbol TEXT,
    name TEXT,
    metadata JSONB, -- from DAS or Birdeye
    last_seen TIMESTAMPTZ DEFAULT NOW()
);

-- Log of every relevant transaction by a tracked whale.
-- This should be a TimescaleDB Hypertable.
CREATE TABLE whale_trades (
    id BIGSERIAL PRIMARY KEY,
    wallet_address TEXT NOT NULL REFERENCES tracked_wallets(address),
    coin_address TEXT NOT NULL REFERENCES tokens(address),
    trade_type TEXT NOT NULL, -- 'BUY' or 'SELL'
    sol_amount NUMERIC,
    token_amount NUMERIC,
    transaction_hash TEXT NOT NULL UNIQUE,
    trade_timestamp TIMESTAMPTZ NOT NULL
);
-- Convert to Hypertable for time-series optimization
SELECT create_hypertable('whale_trades', 'trade_timestamp');
CREATE INDEX ON whale_trades (wallet_address, trade_timestamp DESC);
CREATE INDEX ON whale_trades (coin_address, trade_timestamp DESC);

-- Signals generated by the processor
CREATE TABLE trade_signals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    coin_address TEXT NOT NULL REFERENCES tokens(address),
    status TEXT NOT NULL DEFAULT 'OPEN', -- 'OPEN', 'EXECUTED', 'EXPIRED'
    trigger_reason TEXT, -- e.g., "3 whales bought within 1 hour"
    metadata JSONB, -- { "whale_addresses": [...], "confidence": 0.85 }
    created_at TIMESTAMPTZ DEFAULT NOW(),
    closed_at TIMESTAMPTZ
);

-- Our own trades, paper or live
CREATE TABLE portfolio_trades (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    signal_id UUID REFERENCES trade_signals(id),
    trade_mode TEXT NOT NULL, -- 'PAPER' or 'LIVE'
    coin_address TEXT NOT NULL REFERENCES tokens(address),
    status TEXT NOT NULL DEFAULT 'OPEN', -- 'OPEN', 'PARTIALLY_CLOSED', 'CLOSED'
    entry_price NUMERIC,
    high_water_mark_price NUMERIC, -- For trailing take-profit
    entry_timestamp TIMESTAMPTZ,
    exit_price NUMERIC,
    exit_timestamp TIMESTAMPTZ,
    pnl_usd NUMERIC,
    exit_reason TEXT -- e.g., 'TRAILING_TP', 'WHALE_EXIT', 'MANUAL_CLOSE'
);
```

## 6. Security Architecture

*   **Secret Management:** All sensitive data (API keys, wallet private keys for the trade executor) **must** be stored in Supabase Vault or a comparable secrets manager like HashiCorp Vault. They should never be hardcoded or stored in the database.
*   **Authentication:** The web dashboard will use JWTs for session management, with OAuth2 (Google, GitHub) providers for user login. API access will be governed by HMAC-signed API keys with granular permissions.
*   **Transaction Security:** All transactions will be simulated client-side before being signed. Use of the `@solana/wallet-adapter` secure signing flow is mandatory for user-facing actions.
*   **Database Security:** Supabase's Row Level Security (RLS) will be enabled to ensure users can only access their own data (e.g., `portfolio_trades`, configurations).

## 7. Phased Implementation Roadmap

*   **Phase 1: Core Monitoring & Alerting (PoC)**
    *   Implement `whale-watcher` using Helius WebSockets.
    *   Set up Supabase with the core schema.
    *   Implement the `signal-processor` using a simple DB function/trigger.
    *   Implement the `notifier` for Telegram/Discord using Supabase Realtime.
    *   Build a CLI to manage the `tracked_wallets` table.
    *   Implement a paper-trading logger within the `trade-executor`.

*   **Phase 2: Automated Trading & Dashboard**
    *   Implement the `trade-executor` with live trading capabilities via the Jupiter SDK.
    *   Integrate Supabase Vault for secure key storage.
    *   Develop a simple web dashboard (Next.js/React) to display `portfolio_trades` and active signals in real-time.

*   **Phase 3: Advanced Exits & Discovery**
    *   Implement the `exit-manager` with trailing take-profit logic.
    *   Enhance `whale-watcher` to detect whale sells and trigger exit flags.
    *   Implement the `whale-discovery` service to begin automatically suggesting new wallets.

*   **Phase 4: Scale & Optimization**
    *   Refactor the `signal-processor` from a DB trigger to a dedicated microservice using a BullMQ message queue to handle higher throughput and more complex logic.
    *   Implement Redis for caching to reduce database and RPC load.
    *   Containerize all services with Docker for consistent deployment.
    *   Set up a monitoring stack (Prometheus/Grafana) to observe system health.
