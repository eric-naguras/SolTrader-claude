# Sonar Platform - Phase 1

A sophisticated whale wallet intelligence platform for the Solana ecosystem that monitors high-net-worth wallet activity to identify early investment opportunities in memecoins.

## 🚀 Quick Start

### Prerequisites

- Node.js 18+ 
- npm or yarn
- Supabase account
- Helius API key
- Telegram Bot Token and/or Discord Webhook (optional)

### Installation

1. Clone the repository and install dependencies:

```bash
cd sonar-platform
npm install
```

2. Set up your environment variables:

```bash
cp .env.example .env
# Edit .env with your credentials
```

3. Set up the Supabase database:

```bash
# Copy the contents of scripts/supabase-schema.sql
# Run it in your Supabase SQL editor
```

4. Build the project:

```bash
npm run build
```

## 🏗️ Architecture

The platform consists of several microservices:

- **whale-watcher**: Monitors blockchain for whale wallet transactions
- **notifier**: Sends alerts via Telegram/Discord when signals are detected
- **cli**: Command-line interface for managing wallets and viewing data

The signal detection logic is implemented as a PostgreSQL trigger for atomic, fast processing.

## 📦 Services

### Whale Watcher Service

Monitors tracked wallets for buy/sell transactions:

```bash
cd services/whale-watcher
npm run dev  # Development mode
npm start    # Production mode
```

### Notifier Service

Sends real-time alerts when signals are detected:

```bash
cd services/notifier
npm run dev  # Development mode
npm start    # Production mode
```

## 🛠️ CLI Usage

The CLI tool manages wallets, views signals, and controls paper trading:

```bash
cd cli
npm run build
npm link  # Makes 'sonar' command available globally
```

### Wallet Management

```bash
# List all tracked wallets
sonar wallet list

# Add a new wallet
sonar wallet add <address> --name "Whale 1" --tags "vip,early_buyer"

# Remove a wallet
sonar wallet remove <address>

# Toggle wallet active/inactive
sonar wallet toggle <address>

# Import wallets from file
sonar wallet import wallets.txt
```

### Signal Management

```bash
# View recent signals
sonar signal list

# View/update signal configuration
sonar signal config
sonar signal config --whales 3 --time 1 --amount 0.5
```

### Portfolio Management

```bash
# View portfolio trades
sonar portfolio list
sonar portfolio list --mode PAPER --status OPEN

# Enable paper trading (automatically creates trades for new signals)
sonar portfolio paper-trade
```

## 🔧 Configuration

### Signal Detection Rules

The system generates a signal when:
- **N** or more unique whales buy the same token
- Within **T** hours
- With trades >= **M** SOL

Default: 3 whales, 1 hour, 0.5 SOL

Configure via CLI: `sonar signal config`

### Database Schema

- `tracked_wallets`: Wallets being monitored
- `tokens`: SPL tokens seen in trades
- `whale_trades`: All buy/sell transactions
- `trade_signals`: Generated trading signals
- `portfolio_trades`: Paper/live trade records

## 🚦 Running in Production

1. Use PM2 for process management:

```bash
npm install -g pm2

# Start services
pm2 start services/whale-watcher/dist/index.js --name whale-watcher
pm2 start services/notifier/dist/index.js --name notifier

# Monitor
pm2 status
pm2 logs
```

2. Enable PM2 startup:

```bash
pm2 startup
pm2 save
```

## 📊 Monitoring

- Check service logs: `pm2 logs <service-name>`
- Monitor database: Supabase dashboard
- View real-time data: `sonar signal list` or `sonar portfolio list`

## 🔐 Security

- All sensitive credentials stored in environment variables
- Database uses Row Level Security (RLS)
- No private keys are ever stored
- Supabase handles authentication and authorization

## 🎯 Next Steps (Phase 2+)

- Automated trade execution via Jupiter/trading bots
- Advanced exit strategies (trailing take-profit)
- Whale discovery engine
- Web dashboard
- Machine learning optimization

## 📝 License

This project is private and proprietary.