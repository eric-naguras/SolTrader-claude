#!/bin/bash

echo "🚀 Setting up Sonar Platform..."

# Check Node.js version
NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 18 ]; then
    echo "❌ Node.js 18+ is required. Current version: $(node -v)"
    exit 1
fi

# Install dependencies
echo "📦 Installing dependencies..."
npm install

# Build the project
echo "🔨 Building project..."
npm run build

# Check for .env file
if [ ! -f .env ]; then
    echo "⚠️  No .env file found. Creating from example..."
    cp .env.example .env
    echo "📝 Please edit .env with your configuration"
fi

# Make CLI available
echo "🛠️  Setting up CLI..."
cd cli && npm link && cd ..

echo "✅ Setup complete!"
echo ""
echo "Next steps:"
echo "1. Edit .env with your Supabase and Helius credentials"
echo "2. Run the schema in scripts/supabase-schema.sql in your Supabase SQL editor"
echo "3. Start the services:"
echo "   - cd services/whale-watcher && npm run dev"
echo "   - cd services/notifier && npm run dev"
echo "4. Use the CLI: sonar wallet list"