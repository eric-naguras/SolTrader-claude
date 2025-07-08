#!/bin/bash

echo "🚀 Setting up Project Sonar - Phase 1"
echo "===================================="

# Check if .env exists
if [ ! -f .env ]; then
    echo "📝 Creating .env file from .env.example..."
    cp .env.example .env
    echo "⚠️  Please edit .env and add your API keys before running services"
    echo ""
fi

# Install dependencies
echo "📦 Installing dependencies..."
npm install

# Build all packages
echo "🔨 Building all packages..."
npm run build

# Run database migrations
echo "🗄️  Running database migrations..."
echo "⚠️  Make sure your Supabase project is created and SUPABASE_URL/SUPABASE_SERVICE_KEY are set in .env"
read -p "Press Enter to continue or Ctrl+C to cancel..."
npm run db:migrate

# Seed database
echo "🌱 Seeding database with test data..."
npm run -w @sonar/database seed

echo ""
echo "✅ Setup complete!"
echo ""
echo "📋 Next steps:"
echo "1. Edit .env and add your API keys:"
echo "   - HELIUS_API_KEY"
echo "   - SUPABASE_URL"
echo "   - SUPABASE_SERVICE_KEY"
echo "   - TELEGRAM_BOT_TOKEN (optional)"
echo "   - DISCORD_WEBHOOK_URL (optional)"
echo ""
echo "2. Start services:"
echo "   - Whale Watcher: npm run whale-watcher"
echo "   - Notifier: npm run notifier"
echo "   - Paper Trader: npm run paper-trader"
echo "   - All services: npm run start:all"
echo ""
echo "3. Use the CLI:"
echo "   - npm run cli -- wallet list"
echo "   - npm run cli -- signal list"
echo "   - npm run cli -- portfolio summary"
echo ""
echo "Happy trading! 🐋"