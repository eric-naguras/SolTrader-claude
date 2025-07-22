# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Sonar Platform - A whale wallet intelligence system for Solana that monitors high-net-worth wallet activity to identify early memecoin investment opportunities. The system detects coordinated buying patterns and generates trading signals.

## Goal

This project is about Solana Memecoin trading.
The idea is to watch a moderate number of specific wallets for open and close prositions
and when a number of wallets get into the same coin within a short time
this is probably a good trading opportunity 
(let's assume these guys know what they are doing because they are successful).
These wallets are owned by whales, kols, insideds, etc.
The number of wallets that should hold a position concurrently and the timeframe in which
they need to open their positions are configurable.

Whenever multiple wallets buy/swap the same coin, we will generate a BUY signal.
This signal shows the date-time, the wallets, the number of wallets and the size of each purchase and the price of the coin.
A signal is generated when 2, 3, 4, 5 and >5 wallets are in a coin at the same time.
So we can have 6 signals about the same coin purchase.
We will do the same for every close or sell and generate a SELL signal.
So, also here we can have a max of 6 SELL signals.


The system will generate paper trades for each signal and calculates the profit for each signal.
A few times a day, depending on how many of these signals were created, we give the paper trades
to one or more LLMs for analyses. The analyses should look at how many concurrent wallets generate the best results,
does the day and the time of day have any influence, is the purchase amount or combined amount of influence
and is the precense of certain wallets of influence.

From these analyses, the system should (re-)generate some rules that will determine when we will
actually engage in a real trade and with how much money.

## Modules

### wallet-watcher
This module will use one or more RPC services like Helius, Quicknode and others to subscribe to wallet changes.
It will maintain an in-memory list of purchased coins whereby it keeps a coin purchase in the list for as long as the timeframe
that is set by the frontend. After every wallet transaction there will be a count on wallets holding the same coin.
Depending on the outcome of the count a signal is generated. Signals are stored in the database where they will be picked up by the frontend.

### wallet-analyzer
This module will scan all the wallets for wallet to wallet transactions. The goal is to find related wallets.
Sometimes funds are moved to other wallets or wallets are funded from other wallets. If related wallets hold balances
They should be linked to eachother and participate in the watching.

### paper-trader
This module will act on a signal an open or close a papertrade.Papertrades are recorded in the database.

### signal-analyzer
This module will analyze a bunch of trades to find the optimal trading strategy.
The signal analyzer should look at optimal stop-loss and take-profit strategies with the help of the signal trader.

### signal-trader
This module will make real trades based on the rules set by the rule analyzer.
This module can also act as a trailing stop loss and trailing take profit actor.
The signal analyzer should look at optimal stop-loss and take-profit strategies.

## MCP Servers to use
Use context7 to search for documentation on Supabase, Neon, Helius, Solana and everything that you have trouble with getting things to work. Read more docs!
Use the Neon mcp server to get info on tables, views, functions, etc. You may also update table schemas if needed.


## Architecture

The platform uses a modular architecture with separate backend and frontend components:

### Frontend (`/frontend`)
- **Stack**: HTMX + Alpine.js + Pico CSS (NOT a SPA)
- **Server**: Bun-based with SSR support
- **Philosophy**: Server-side rendering, minimal client-side complexity
- **No build step**: Direct serving of static assets

## Development Commands

### Frontend Commands
```bash
cd frontend
npm run dev              # Bun development server with watch mode
npm start                # Production server
npm run build            # Build for Bun runtime
npm run test             # Run tests with test database
npm run test:watch       # Tests in watch mode
npm run deploy           # Deploy to Cloudflare Workers
```

## Testing

- **Frontend**: Bun test runner with database integration tests
- **Database Testing**: Uses Neon test branches or test database
- Run a single test: Use `npm run test -- path/to/test.ts`

## Key Technical Decisions

1. **Runtime Agnostic**: Avoid Node-specific APIs for broader deployment
2. **Database-First**: Neon as single source of truth
3. **Event-Driven**: Database triggers and Neon Realtime for Phase 1
4. **TypeScript Strict**: Enforced type safety across codebase
5. **HTMX Philosophy**: Server-side rendering, not a SPA
6. **Modular Services**: Independent development and deployment

## Database Schema

Core tables:
- `tracked_wallets`: Monitored whale wallets
- `tokens`: SPL token information
- `whale_trades`: TimescaleDB hypertable for trades
- `trade_signals`: Multi-whale pattern detections
- `portfolio_trades`: Trading records

## Environment Variables

Required:
- `DATABASE_URL`: Neon connections string as URL
- `HELIUS_API_KEY`: Blockchain data access
- `API_SECRET`: API authentication

Optional:
- `TELEGRAM_BOT_TOKEN` & `TELEGRAM_CHAT_ID`: Telegram alerts
- `DISCORD_WEBHOOK_URL`: Discord alerts

## Code Quality Rules (CRITICAL)

1. **Clean up after yourself**: Delete ALL related code when removing functionality
2. **Understand before changing**: Know how existing systems work first
3. **Work with frameworks**: Don't fight framework behavior with hacks
4. **HTMX-specific**:
   - This is NOT a SPA - keep it simple
   - Components re-initialize on swap - this is normal
   - Use caching strategies, not global flags
   - Data fetching: Use app-level stores, not component-level
5. **Remove unused code**: Search for and remove orphaned code after changes
6. **Test mentally first**: Think through lifecycle and edge cases
7. **Be thorough**: No sloppy or half-finished implementations

## MCP Servers

Use these MCP servers when needed:
- **context7**: For documentation on Neon, Neon, Helius, Solana
- **Neon MCP**: For database operations and schema updates
- **Neon MCP**: For additional database operations

## Future Phases

Architecture supports evolution:
- Phase 2: Automated trading via Jupiter SDK
- Phase 3: Advanced exit strategies
- Phase 4: Whale discovery engine
- Phase 5: Web dashboard and public API