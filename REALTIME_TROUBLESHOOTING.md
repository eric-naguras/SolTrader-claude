# Real-time Updates Troubleshooting Guide

## Current Status ⚠️

**Issue**: Supabase Realtime WebSocket connections are failing consistently  
**Workaround**: SSE (Server-Sent Events) is working as primary real-time mechanism  
**Backend**: Running successfully on localhost:3001  

## Working Components ✅

### 1. SSE (Server-Sent Events) - PRIMARY
- ✅ Backend SSE endpoint: `GET /api/events`
- ✅ Frontend automatically connects via HTMX SSE extension
- ✅ Real-time trade notifications working
- ✅ Proper token metadata display
- ✅ Wallet cards update in real-time

### 2. Token Metadata Resolution
- ✅ Multi-API approach (Jupiter → Helius → Solscan → SolanaFM)
- ✅ USDC metadata successfully resolved
- ✅ Fallback to truncated addresses for unknown tokens

### 3. Database Architecture
- ✅ Tables enabled for Realtime publication
- ✅ RLS policies allow public access
- ✅ Views working for initial data loading

## Failing Components ❌

### Supabase Realtime WebSocket
```
WebSocket connection to 'wss://jjbnwdfcavzszjszuumw.supabase.co/realtime/v1/websocket?...' failed
```

**Possible Causes**:
1. **Supabase Project Configuration**: Realtime might not be fully enabled
2. **Network/Firewall Issues**: WebSocket connections blocked
3. **API Key Issues**: Anon key might not have Realtime permissions
4. **Supabase Service Status**: Regional or service-level issues

## Testing Commands

### Test SSE (Working)
```bash
# Backend
npx tsx src/scripts/test-sse.ts

# Frontend console should show:
# [SSE] ✓ SSE connection opened
# [SSE] Received new trade: {...}
```

### Test Supabase Realtime (Failing)
```javascript
// Frontend console
window.enableRealtimeSubscriptions()

// Expected result: WebSocket errors (currently failing)
```

### Test Token Metadata
```bash
# Backend
npx tsx src/scripts/backfill-token-metadata.ts
```

## Manual Testing

### 1. Test Real-time Updates
```javascript
// Frontend console - works via SSE
window.testTradeInsert()
```

### 2. Test Wallet Cards
- Cards should update immediately when new trades arrive via SSE
- Token names should display properly (USDC, SOL, etc.)
- Fallback to truncated addresses for unknown tokens

## Current Architecture

```
[Whale Watcher] → [Database] → [SSE Endpoint] → [Frontend]
                                    ↓
                             Real-time updates ✅

[Supabase Realtime] → [Frontend] (❌ Currently failing)
```

## Next Steps

### Short-term (Current)
- ✅ Use SSE as primary real-time mechanism  
- ✅ Wallet cards update properly
- ✅ Token names resolve correctly

### Long-term (Future)
- 🔍 Investigate Supabase Realtime configuration
- 🔍 Check Supabase project settings in dashboard
- 🔍 Verify Realtime service is enabled for the project
- 🔍 Test with different API keys or project setup

## Verification Checklist

- [x] Backend running on port 3001
- [x] SSE endpoint responding (200 OK)
- [x] Frontend SSE connection established
- [x] Trade inserts trigger SSE events
- [x] Wallet cards update in real-time
- [x] Token metadata resolution working
- [ ] Supabase Realtime WebSocket connection (failing)
- [ ] Realtime table events (N/A due to WebSocket failure)

## Error Messages

### WebSocket Errors (Expected - Known Issue)
```
WebSocket connection to 'wss://jjbnwdfcavzszjszuumw.supabase.co/realtime/v1/websocket?...' failed
[Realtime] ✗ Channel error: undefined
[Realtime] ✗ Subscription timed out
```

### SSE Errors (Should Not Occur)
```
GET http://localhost:3001/api/events net::ERR_CONNECTION_REFUSED
```
If you see SSE errors, ensure backend is running with `npm run dev`.