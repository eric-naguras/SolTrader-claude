# Project Sonar - Phase 1 Implementation

## 🚀 Quick Start

### Prerequisites
- Node.js 18+ and npm 9+
- Supabase account and project
- Helius API key
- Telegram Bot Token and/or Discord Webhook (optional)

### Setup

1. **Clone and install dependencies:**
```bash
npm install
```

2. **Configure environment:**
```bash
cp .env.example .env
# Edit .env with your API keys
```

3. **Set up database:**
```bash
# Run migrations
npm run db:migrate

# Seed test data
npm run db:seed
```

4. **Build all packages:**
```bash
npm run build
```

## 🏃 Running Services

### Individual Services

```bash
# Whale Watcher - Monitors blockchain transactions
npm run whale-watcher

# Notifier - Sends alerts via Telegram/Discord/CLI
npm run notifier

# Paper Trader - Records and tracks paper trades
npm run paper-trader
```

### All Services with PM2

```bash
# Start all services
npm run start:all

# View logs
npm run logs

# Monitor services
npm run monitor

# Stop all services
npm run stop:all
```

## 📊 Monitoring

### Check Service Health
Each service exposes health endpoints and logs to console. Monitor using:
- PM2: `npm run monitor`
- Logs: `npm run logs`
- Database: Check Supabase dashboard

### Key Metrics
- Transaction processing rate (whale-watcher)
- Signal generation latency (< 5 seconds target)
- Notification delivery success rate
- Paper trading P&L

## 🔧 Development

### Project Structure
```
packages/
├── shared/          # Shared types, utils, database client
├── whale-watcher/   # Blockchain monitoring service  
├── notifier/        # Multi-channel notification service
├── paper-trader/    # Paper trading service
├── database/        # Migrations and utilities
├── cli/            # CLI tool (TODO)
└── api/            # REST API (TODO)
```

### Adding a New Whale Wallet
```typescript
// Using the database directly or via future CLI
await supabase.from('tracked_wallets').insert({
  address: 'wallet-address-here',
  alias: 'Whale Name',
  is_active: true,
  tags: ['whale', 'high-volume']
});
```

## 🐛 Troubleshooting

### Common Issues

1. **WebSocket Connection Failed**
   - Check Helius API key is valid
   - Verify network connectivity
   - Check rate limits

2. **Database Connection Error**
   - Verify Supabase URL and service key
   - Check if migrations have run
   - Ensure TimescaleDB extension is enabled

3. **Notifications Not Sending**
   - Verify Telegram bot token or Discord webhook
   - Check notification service logs
   - Ensure signal generation is working

### Debug Mode
Set `LOG_LEVEL=debug` in `.env` for verbose logging.

## 📈 Performance Targets

- Signal Detection: < 5 seconds from trade to notification
- System Uptime: 99.9%
- Transaction Processing: > 98% success rate
- Supports 100+ tracked wallets

## 🔒 Security Notes

- Never commit `.env` file
- API keys stored in Supabase Vault (Phase 2)
- All sensitive operations logged
- Rate limiting on all external APIs

## 📚 API Documentation

See [api/openapi.yaml](api/openapi.yaml) for REST API specification (Phase 2).

## 🤝 Contributing

1. Follow TypeScript best practices
2. Add tests for new features
3. Update documentation
4. Run linter before committing: `npm run lint`

## 📄 License

MIT