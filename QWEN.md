# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

SolTrader - A whale wallet intelligence system for Solana that monitors high-net-worth wallet activity to identify coordinated memecoin investment opportunities. The system detects coordinated buying patterns and generates trading signals.

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
Use context7 to search for documentation on Neon, Helius, Solana, Hono, HTMX and everything that you have trouble with getting things to work. Read more docs!
Use the Neon mcp server to get info on tables, views, functions, etc. You may also update table schemas if needed.


## Architecture

The platform uses a unified single-process architecture:

### Unified Server (`server.ts`)
- **Framework**: Hono web framework (lightweight, fast)
- **Frontend**: HTMX + Alpine.js + Pico CSS (NOT a SPA)
- **Backend Services**: 4 coordinated services in same process
- **Philosophy**: Server-side rendering, minimal client-side complexity
- **Runtime**: Bun-first but Node.js compatible

## Development Commands

### Unified Server Commands
```bash
# Development with auto-reload
bun run dev              # Unified server with watch mode

# Production
bun run start            # Production server  

# Building
bun run build            # Build for Bun runtime
bun run build:node       # Build for Node.js runtime

# Testing  
bun test                 # Run tests with Bun
npm run test             # Run tests (uses test database)
npm run test:watch       # Tests in watch mode

# Deployment
npm run deploy           # Deploy to Cloudflare Workers
```

## Testing

- **Framework**: Bun test runner with database integration tests
- **Database Testing**: Uses Neon test branches or test database
- **Single Test**: Use `bun test path/to/test.ts` or `npm run test -- path/to/test.ts`

## Key Technical Decisions

1. **Unified Architecture**: Single process for simplicity and performance
2. **Runtime Agnostic**: Avoid Node-specific APIs (Bun/Node.js/Workers compatible)
3. **Database-First**: Neon PostgreSQL as single source of truth
4. **Event-Driven**: Database triggers and real-time notifications
5. **TypeScript Strict**: Enforced type safety across codebase
6. **HTMX Philosophy**: Server-side rendering, not a SPA
7. **Service Coordination**: All services managed by ServiceManager

## Database Schema

Core tables:
- `tracked_wallets`: Monitored whale wallets
- `tokens`: SPL token information
- `whale_trades`: TimescaleDB hypertable for trades
- `trade_signals`: Multi-whale pattern detections
- `portfolio_trades`: Trading records

## Environment Variables

Required:
- `DATABASE_URL`: Neon PostgreSQL connection string
- `HELIUS_API_KEY`: Solana WebSocket and API access

Optional:
- `PORT`: Server port (default: 3000)
- `ENABLE_LIVE_TRADING`: Enable real trading (default: false)
- `LOG_*`: Configurable logging levels (CONNECTION, WALLET, TRADE, MULTI_WHALE, DEBUG)

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
- **context7**: For documentation on Neon, Helius, Solana, Hono, HTMX
- **Neon MCP**: For database operations and schema updates

## Future Phases

Architecture supports evolution:
- Phase 2: Automated trading via Jupiter SDK
- Phase 3: Advanced exit strategies
- Phase 4: Whale discovery engine
- Phase 5: Web dashboard and public API

# Architecture Overview

## Core Technologies
- **Bun**: Runtime and package manager (native TypeScript support, no build step)
- **Hono.js**: Lightweight web framework
- **HTMX**: HTML-first approach for dynamic interactions
- **SSE (Server-Sent Events)**: Real-time server-to-client communication

## Architectural Patterns

### 1. Message Bus Pattern
A central publish/subscribe system for decoupled service communication:
```typescript
// Publishing events
messageBus.publish('config.changed', { key: 'value' });

// Subscribing to events
const unsubscribe = messageBus.subscribe('config.changed', (data) => {
  // Handle event
});
```

**Benefits:**
- Services don't need direct references to each other
- Easy to add new services without modifying existing code
- Clear event flow for debugging

### 2. Service Architecture
Services implement a standard interface and lifecycle:
```typescript
interface Service {
  name: string;
  start(): Promise<void>;
  stop(): Promise<void>;
  getStatus(): ServiceStatus;
}
```

**Service Manager** orchestrates all services:
- Registers and manages service lifecycle
- Provides health monitoring
- Handles graceful shutdown

### 3. Frontend Architecture (HTMX + SSE Hybrid)
- **HTMX**: Handles user interactions (forms, buttons) with declarative attributes
- **Vanilla JS + SSE**: Manages real-time updates for better compatibility
- **No build step**: Direct HTML/JS served by the server

```html
<!-- HTMX for user actions -->
<button hx-post="/api/action" hx-trigger="click">Click Me</button>

<!-- Vanilla JS for SSE -->
<script>
const evtSource = new EventSource('/api/sse');
evtSource.addEventListener('update', (e) => {
  document.getElementById('display').textContent = e.data;
});
</script>
```

## Data Flow
1. **User Action** → HTMX → HTTP POST → Server Handler
2. **Server Handler** → Message Bus → Service(s)
3. **Service Processing** → Message Bus → SSE Handler
4. **SSE Handler** → EventSource → DOM Update

## Key Principles
- **Separation of Concerns**: Each service has a single responsibility
- **Event-Driven**: Services communicate through events, not direct calls
- **Stateless HTTP**: Use SSE for server-initiated updates
- **Progressive Enhancement**: Works without JavaScript, enhanced with HTMX/SSE
- **Extensive Logging**: Every component logs its actions for debugging


# HTMX + Service Architecture Quick Reference

## 🚀 Quick Start Pattern
```typescript
// 1. Message Bus Event
messageBus.publish('feature.action', { data });

// 2. Service Subscription  
messageBus.subscribe('feature.action', (data) => {
  // Process and publish result
  messageBus.publish('feature.result', { result });
});

// 3. SSE to Frontend
messageBus.subscribe('feature.result', (data) => {
  // Send to connected clients via SSE
});
```

## 📋 Service Template
```typescript
export class FeatureService implements Service {
  name = 'FeatureService';
  private running = false;
  private unsubscribers: (() => void)[] = [];
  
  constructor(private messageBus: MessageBus) {}
  
  async start() {
    this.unsubscribers.push(
      this.messageBus.subscribe('event', this.handleEvent)
    );
    this.running = true;
  }
  
  async stop() {
    this.unsubscribers.forEach(unsub => unsub());
    this.running = false;
  }
  
  getStatus() {
    return { running: this.running };
  }
}
```

## 🌐 Frontend Patterns

### HTMX (User Actions)
```html
<button hx-post="/api/endpoint" 
        hx-vals='js:{param: value}'
        hx-swap="none">Action</button>
```

### SSE (Real-time Updates)
```javascript
const evtSource = new EventSource('/api/sse');
evtSource.addEventListener('eventName', (e) => {
  document.getElementById('target').textContent = e.data;
});
```

## 🛣️ Route Patterns
```typescript
// Serve HTML
app.get('/', async (c) => {
  return c.html(await Bun.file('./index.html').text());
});

// Handle HTMX POST
app.post('/api/action', async (c) => {
  const body = await c.req.parseBody();
  messageBus.publish('action.requested', body);
  return c.text('OK');
});

// SSE Endpoint
app.get('/api/sse', (c) => {
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    start(controller) {
      const unsub = messageBus.subscribe('updates', (data) => {
        const msg = `event: update\ndata: ${JSON.stringify(data)}\n\n`;
        controller.enqueue(encoder.encode(msg));
      });
    }
  });
  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache'
    }
  });
});
```

## 📝 Event Naming Convention
- `domain.action.detail`
- Examples:
  - `user.login.success`
  - `config.theme.changed`
  - `data.refresh.requested`

## ⚠️ Do's and Don'ts

### ✅ DO
- Use message bus for ALL service communication
- Log with [ServiceName] prefix
- Clean up in stop() method
- Test with curl: `curl -N localhost:8000/api/sse`

### ❌ DON'T
- Import services into each other
- Use HTMX SSE extension
- Use localStorage in SSE/services
- Skip error handling

## 🐛 Debug Commands
```bash
# Test SSE
curl -N http://localhost:8000/api/sse

# Check health
curl http://localhost:8000/health

# Run with auto-reload
bun run --watch server.ts
```

# Instructions for Claude Code

When working on this project, follow these architectural rules strictly:

## Technology Stack
- Runtime: Bun (NOT Node.js or Deno)
- Framework: Hono.js
- Frontend: HTMX for interactions, vanilla JS for SSE
- No build tools, no bundlers, TypeScript runs directly

## Critical Implementation Rules

### 1. Service Communication
```typescript
// ALWAYS use message bus for inter-service communication
messageBus.publish('event.name', data);
messageBus.subscribe('event.name', handler);

// NEVER import services into each other
// NEVER use direct service method calls
```

### 2. Creating a New Service
```typescript
// Every service MUST follow this pattern:
export class MyService implements Service {
  name = 'MyService';
  private running = false;
  
  constructor(private messageBus: MessageBus) {
    console.log('[MyService] Initialized');
  }
  
  async start(): Promise<void> {
    console.log('[MyService] Starting...');
    // Subscribe to events
    // Initialize resources
    this.running = true;
  }
  
  async stop(): Promise<void> {
    console.log('[MyService] Stopping...');
    // Unsubscribe from events
    // Clean up resources
    this.running = false;
  }
  
  getStatus(): ServiceStatus {
    return { running: this.running };
  }
}
```

### 3. SSE Implementation for Bun
```typescript
// Use ReadableStream, NOT Hono's streamSSE helper
app.get('/api/sse', (c) => {
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    start(controller) {
      // Format: event: name\ndata: content\n\n
      const message = `event: update\ndata: ${JSON.stringify(data)}\n\n`;
      controller.enqueue(encoder.encode(message));
    }
  });
  
  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive'
    }
  });
});
```

### 4. Frontend Pattern
```html
<!-- HTMX for user actions ONLY -->
<button hx-post="/api/action" 
        hx-trigger="click" 
        hx-swap="none">
  Click Me
</button>

<!-- Vanilla JS for SSE, NOT hx-ext="sse" -->
<script>
const evtSource = new EventSource('/api/sse');
evtSource.addEventListener('update', (e) => {
  const data = JSON.parse(e.data);
  // Update DOM
});
</script>
```

### 5. Server Structure
```typescript
// server.ts structure:
import { Hono } from 'hono';
import { cors } from 'hono/cors';

const app = new Hono();
app.use('*', cors());

// 1. Initialize message bus
const messageBus = new MessageBus();

// 2. Initialize service manager
const serviceManager = new ServiceManager(messageBus);

// 3. Create and register services
const myService = new MyService(messageBus);
serviceManager.registerService('myService', myService);

// 4. Start all services
await serviceManager.startAll();

// 5. Define routes
app.get('/', async (c) => {
  const file = Bun.file('./index.html');
  return c.html(await file.text());
});

// 6. Export for Bun
export default { port: 8000, fetch: app.fetch };
```

## Common Mistakes to Avoid
1. ❌ Using Hono's streamSSE (compatibility issues with Bun)
2. ❌ Using HTMX SSE extension (use vanilla EventSource)
3. ❌ Direct service imports (always use message bus)
4. ❌ Missing cleanup in stop() methods
5. ❌ Using Deno or Node.js APIs (use Bun APIs)
6. ❌ Complex build steps (run TypeScript directly)

## Testing Checklist
- [ ] Health endpoint shows all service statuses
- [ ] SSE connection works (test with curl -N)
- [ ] Message bus events are logged
- [ ] Services start/stop cleanly
- [ ] No direct service dependencies

## Remember
- Log everything with [ServiceName] prefix
- Services communicate through events only
- HTMX for actions, EventSource for updates
- Keep it simple, no build steps needed

# Example: Adding a Chat Feature Using the Architecture

This example shows how to add a complete chat feature following the service architecture pattern.

## 1. Create the Chat Service

```typescript
// services/chatService.ts
import { Service, ServiceStatus } from './serviceManager.ts';
import { MessageBus } from './messageBus.ts';

export class ChatService implements Service {
    name = 'ChatService';
    private running = false;
    private messages: Array<{id: string, user: string, text: string, timestamp: Date}> = [];
    private unsubscribers: (() => void)[] = [];
    
    constructor(private messageBus: MessageBus) {
        console.log('[ChatService] Initialized');
    }
    
    async start(): Promise<void> {
        console.log('[ChatService] Starting...');
        
        // Subscribe to chat events
        this.unsubscribers.push(
            this.messageBus.subscribe('chat.message.send', (data) => {
                this.handleNewMessage(data);
            })
        );
        
        this.unsubscribers.push(
            this.messageBus.subscribe('chat.history.request', (data) => {
                this.handleHistoryRequest(data);
            })
        );
        
        this.running = true;
        console.log('[ChatService] Started');
    }
    
    async stop(): Promise<void> {
        console.log('[ChatService] Stopping...');
        this.unsubscribers.forEach(unsub => unsub());
        this.unsubscribers = [];
        this.running = false;
        console.log('[ChatService] Stopped');
    }
    
    getStatus(): ServiceStatus {
        return {
            running: this.running,
            metadata: {
                messageCount: this.messages.length
            }
        };
    }
    
    private handleNewMessage(data: {user: string, text: string}) {
        const message = {
            id: crypto.randomUUID(),
            user: data.user,
            text: data.text,
            timestamp: new Date()
        };
        
        this.messages.push(message);
        console.log(`[ChatService] New message from ${data.user}: ${data.text}`);
        
        // Publish the message for SSE
        this.messageBus.publish('chat.message.received', message);
    }
    
    private handleHistoryRequest(data: {requester: string}) {
        console.log(`[ChatService] History requested by ${data.requester}`);
        this.messageBus.publish('chat.history.response', {
            messages: this.messages.slice(-50) // Last 50 messages
        });
    }
}
```

## 2. Register the Service in server.ts

```typescript
// In server.ts, after other service registrations:
import { ChatService } from './services/chatService.ts';

const chatService = new ChatService(messageBus);
serviceManager.registerService('chat', chatService);
```

## 3. Add HTTP Endpoints

```typescript
// In server.ts, add these routes:

// Handle new chat messages from HTMX
app.post('/api/chat/send', async (c) => {
    try {
        const body = await c.req.parseBody();
        const user = body.user as string || 'Anonymous';
        const text = body.text as string;
        
        console.log(`[Server] Chat message from ${user}: ${text}`);
        
        messageBus.publish('chat.message.send', { user, text });
        
        return c.text('OK');
    } catch (error) {
        console.error('[Server] Error processing chat message:', error);
        return c.text('Error', 500);
    }
});

// Modify the SSE endpoint to include chat events
app.get('/api/sse', (c) => {
    console.log('[Server] New SSE connection established');
    
    const encoder = new TextEncoder();
    let eventId = 0;
    const unsubscribers: (() => void)[] = [];
    
    const stream = new ReadableStream({
        start(controller) {
            // Subscribe to chat messages
            unsubscribers.push(
                messageBus.subscribe('chat.message.received', (data) => {
                    const msg = `id: ${eventId++}\nevent: chatMessage\ndata: ${JSON.stringify(data)}\n\n`;
                    try {
                        controller.enqueue(encoder.encode(msg));
                    } catch (error) {
                        console.log('[Server] Failed to send chat message');
                    }
                })
            );
            
            // Keep existing subscriptions...
            
            // Send initial connection message
            const initialMsg = `id: ${eventId++}\nevent: connected\ndata: Connected to chat\n\n`;
            controller.enqueue(encoder.encode(initialMsg));
        },
        
        cancel() {
            unsubscribers.forEach(unsub => unsub());
        }
    });
    
    return new Response(stream, {
        headers: {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive'
        }
    });
});
```

## 4. Update the Frontend

```html
<!-- Add to index.html -->
<div class="chat-section">
    <h2>Chat</h2>
    
    <!-- Chat messages display -->
    <div id="chat-messages" class="chat-messages">
        <!-- Messages will appear here -->
    </div>
    
    <!-- Chat input form using HTMX -->
    <div class="chat-input">
        <input type="text" 
               id="chat-user" 
               placeholder="Your name" 
               value="Anonymous">
        <input type="text" 
               id="chat-text" 
               placeholder="Type a message..."
               hx-trigger="keyup[keyCode==13]"
               hx-post="/api/chat/send"
               hx-vals='js:{
                   user: document.getElementById("chat-user").value,
                   text: document.getElementById("chat-text").value
               }'
               hx-on::after-request="if(event.detail.successful) this.value = ''"
               hx-swap="none">
        <button hx-post="/api/chat/send"
                hx-vals='js:{
                    user: document.getElementById("chat-user").value,
                    text: document.getElementById("chat-text").value
                }'
                hx-on::after-request="if(event.detail.successful) document.getElementById('chat-text').value = ''"
                hx-swap="none">
            Send
        </button>
    </div>
</div>

<script>
// Add to existing JavaScript
evtSource.addEventListener('chatMessage', function(e) {
    const message = JSON.parse(e.data);
    const messagesDiv = document.getElementById('chat-messages');
    
    const messageEl = document.createElement('div');
    messageEl.className = 'chat-message';
    messageEl.innerHTML = `
        <strong>${message.user}:</strong> ${message.text}
        <span class="timestamp">${new Date(message.timestamp).toLocaleTimeString()}</span>
    `;
    
    messagesDiv.appendChild(messageEl);
    messagesDiv.scrollTop = messagesDiv.scrollHeight;
    
    addLog(`Chat message from ${message.user}`);
});
</script>

<style>
.chat-section {
    margin-top: 30px;
    padding: 20px;
    background-color: #f9f9f9;
    border-radius: 10px;
}

.chat-messages {
    height: 300px;
    overflow-y: auto;
    border: 1px solid #ddd;
    padding: 10px;
    margin-bottom: 10px;
    background-color: white;
}

.chat-message {
    margin-bottom: 10px;
    padding: 5px;
}

.timestamp {
    font-size: 0.8em;
    color: #666;
    float: right;
}

.chat-input {
    display: flex;
    gap: 10px;
}

.chat-input input[type="text"] {
    flex: 1;
    padding: 8px;
    border: 1px solid #ddd;
    border-radius: 4px;
}

.chat-input button {
    padding: 8px 16px;
    background-color: #007bff;
    color: white;
    border: none;
    border-radius: 4px;
    cursor: pointer;
}
</style>
```

## Event Flow Diagram

```
User types message → HTMX POST → /api/chat/send
                                        ↓
                              messageBus.publish('chat.message.send')
                                        ↓
                              ChatService handles message
                                        ↓
                              messageBus.publish('chat.message.received')
                                        ↓
                              SSE handler sends to clients
                                        ↓
                              Browser EventSource updates DOM
```

## Key Points Demonstrated

1. **Service Independence**: ChatService doesn't know about HTTP or SSE
2. **Message Bus Communication**: All components communicate through events
3. **HTMX for Actions**: Send button uses `hx-post` and `hx-vals`
4. **SSE for Updates**: Real-time message delivery to all connected clients
5. **Clean Separation**: Frontend, HTTP layer, and business logic are separate
6. **Proper Cleanup**: Service unsubscribes when stopped
7. **Extensive Logging**: Every action is logged with [ServiceName] prefix

This pattern can be replicated for any feature: notifications, user presence, live updates, etc.