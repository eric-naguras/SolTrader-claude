# Backend Service Testing Guide

This directory contains test scripts to verify that the backend services are running properly.

## Quick Test

For a fast check to see if services can initialize:

```bash
npm run test:quick
```

This will:
- Check if all required environment variables are set
- Verify that services can be loaded and instantiated
- Provide quick feedback on basic setup issues

## Comprehensive Test

For a thorough test of all service functionality:

```bash
npm run test
```

This will test:
1. **Environment Variables**
   - All required variables (SUPABASE_URL, SUPABASE_ANON_KEY, HELIUS_API_KEY)
   - Optional variables (Telegram and Discord configs)

2. **Database Connection**
   - Connection to Supabase
   - Existence of all required tables
   - Basic query functionality

3. **WhaleWatcher Service**
   - Service initialization
   - Loading tracked wallets from database
   - Heartbeat updates

4. **Notifier Service**
   - Service initialization
   - Channel configuration (Telegram/Discord)
   - Heartbeat updates

5. **Service Integration**
   - Both services starting together
   - Graceful shutdown

## Expected Results

### Success Scenario
- All required environment variables are set
- Database connection is successful
- All tables exist and are accessible
- Services can initialize and start
- Heartbeats are working

### Common Issues

1. **Missing Environment Variables**
   - Copy `.env.example` to `.env`
   - Fill in your Supabase and Helius credentials

2. **Database Connection Failed**
   - Check your SUPABASE_URL and SUPABASE_ANON_KEY
   - Ensure your Supabase project is running

3. **Missing Tables**
   - Run the schema setup script: `../scripts/supabase-schema.sql`
   - Execute in Supabase SQL editor

4. **Build Issues**
   - Make sure to build first: `npm run build`
   - Install dependencies: `npm install`

## Running Services

Once tests pass, you can start the services:

```bash
# Start API server
npm run dev

# Start background services (WhaleWatcher + Notifier)
npm run dev:services

# Or start both in separate terminals
```

## Service Health

Services update their heartbeat in the `service_heartbeats` table every 30 seconds. You can monitor service health using:

```bash
# Check health once
npm run monitor

# Watch health continuously (updates every 10s)
npm run monitor:watch
```

Or query the database directly:

```sql
SELECT * FROM service_heartbeats ORDER BY last_heartbeat DESC;
```

Services are considered healthy if their `last_heartbeat` is within the last 2 minutes.