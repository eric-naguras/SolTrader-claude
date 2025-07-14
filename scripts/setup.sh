#!/bin/bash

echo "🚀 Setting up Sonar Platform..."

# Check Node.js version
NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 18 ]; then
    echo "❌ Node.js 18+ is required. Current version: $(node -v)"
    exit 1
fi

# Install backend dependencies
echo "📦 Installing backend dependencies..."
cd backend && npm install && cd ..

# Install frontend dependencies
echo "📦 Installing frontend dependencies..."
cd frontend && npm install && cd ..

# Check for .env file
if [ ! -f backend/.env ]; then
    echo "⚠️  No backend/.env file found. Creating from example..."
    if [ -f backend/.env.example ]; then
        cp backend/.env.example backend/.env
        echo "📝 Please edit backend/.env with your configuration"
    else
        echo "❌ No .env.example found in backend directory"
    fi
fi

echo "✅ Setup complete!"
echo ""
echo "Next steps:"
echo "1. Edit backend/.env with your Supabase and Helius credentials"
echo "2. Run these SQL scripts in your Supabase SQL editor:"
echo "   - scripts/supabase-schema.sql (initial setup)"
echo "   - scripts/database-updates.sql (UI features)"
echo "3. Start the services in separate terminals:"
echo "   - Backend API: cd backend && npm run dev"
echo "   - Backend Services: cd backend && npm run dev:services"
echo "   - Frontend: cd frontend && npm run dev"
echo "4. Open http://localhost:3000 in your browser"