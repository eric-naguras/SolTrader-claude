# Webhook Migration Guide

This guide explains how to migrate from Supabase Realtime to webhook-based notifications.

## Changes Made

### 1. Frontend Server (frontend/server.ts)
- Added webhook endpoint: `POST /webhooks/db-changes`
- Added health check endpoint: `GET /health`
- Integrated WebhookNotifierService for processing signals

### 2. New Webhook Notifier (backend/src/services/webhook-notifier.ts)
- Created webhook-based notifier service
- Processes signals without Realtime subscription
- Same notification channels (Telegram, Discord, CLI)

### 3. Database Setup (scripts/setup-webhooks.sql)
- PostgreSQL triggers for `trade_signals` and `whale_trades` tables
- HTTP extension for webhook calls
- Test function for verification

## Migration Steps

### 1. Setup Database Webhooks
```sql
-- Run in Supabase SQL Editor
\i scripts/setup-webhooks.sql
```

### 2. Test the Webhook
```sql
-- Test the webhook connection
SELECT test_webhook();
```

### 3. Start the Frontend Server
```bash
cd frontend
npm run dev
```

### 4. Replace Old Notifier Service
The old `backend/src/services/notifier.ts` can be deprecated since the webhook notifier is now integrated into the frontend server.

## Webhook Endpoint

**URL:** `http://localhost:3000/webhooks/db-changes`
**Method:** POST
**Content-Type:** application/json

**Payload Format:**
```json
{
  "table": "trade_signals|whale_trades",
  "type": "INSERT",
  "record": { ... }
}
```

## Health Check

**URL:** `http://localhost:3000/health`
**Method:** GET

Returns notifier service status and configured channels.

## Benefits Over Realtime

1. **Reliability**: HTTP webhooks are more reliable than WebSocket connections
2. **Debugging**: Easier to debug with standard HTTP logs
3. **Scaling**: Can handle higher loads without connection limits
4. **Integration**: Directly integrated into existing HonoJS server

## Environment Variables

Same as before:
- `TELEGRAM_BOT_TOKEN` (optional)
- `TELEGRAM_CHAT_ID` (optional)  
- `DISCORD_WEBHOOK_URL` (optional)

## Cleanup

The following files can be removed after migration:
- `backend/src/services/notifier.ts` (old realtime version)
- `REALTIME_TROUBLESHOOTING.md` (if webhooks work reliably)