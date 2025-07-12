# Architecture Rework Documentation

## Overview

This document outlines the architectural changes made to the Sonar Platform, transforming it from a complex monorepo structure to a simplified, runtime-agnostic architecture with a web-based interface.

## Motivation for Changes

### Original Pain Points

1. **Monorepo Complexity**
   - Multiple packages with interdependencies
   - Turbo build system overhead
   - Complex workspace configuration
   - Difficult to understand project structure

2. **CLI-Only Interface**
   - No visual feedback for running processes
   - Limited control over active operations
   - Difficult to monitor real-time activity
   - No way to manually intervene in trades

3. **Over-Engineering**
   - Microservices architecture for a single-user application
   - Separate packages for types and database
   - Multiple build steps and configurations

## New Architecture

### Design Principles

1. **Simplicity First**
   - Flat structure with clear separation of concerns
   - Single package.json per component
   - Direct file imports instead of package dependencies

2. **Runtime Agnostic**
   - No Node.js-specific APIs
   - Standard Web APIs (fetch, WebSocket, etc.)
   - Can run on Cloudflare Workers, Deno, Bun, or Node.js

3. **Database as Message Bus**
   - Leverages Supabase's real-time capabilities
   - Reduces complexity of message queuing
   - Perfect for single-user scenario

4. **Web-First Interface**
   - HTMX for interactivity without heavy JavaScript
   - Server-side rendering for simplicity
   - Real-time updates via SSE

## Technical Decisions

### Backend Stack

**Hono Framework**
- Lightweight (12KB)
- Runtime agnostic
- Express-like API
- Built-in TypeScript support
- Works everywhere (Edge, Node, Deno, Bun)

**Why not Express?**
- Express is Node.js specific
- Heavier dependencies
- Not designed for edge runtimes

### Frontend Stack

**HTMX + Alpine.js**
- Minimal JavaScript
- Server-driven UI
- Progressive enhancement
- Easy to understand and modify

**Pico CSS**
- Semantic HTML styling
- Dark mode built-in
- No build step required
- Lighter than Tailwind for HTMX

**Why not React/Vue/Svelte?**
- Overkill for a single-user app
- Requires build tooling
- More complex state management
- HTMX provides sufficient interactivity

### Database Strategy

**Supabase as Central Hub**
- Real-time subscriptions replace message queues
- Database triggers for signal generation
- Direct frontend queries for read operations
- Minimal API surface for write operations

**Benefits:**
- Already using Supabase
- Built-in real-time capabilities
- Reduces service communication complexity
- Single source of truth

## Architecture Comparison

### Before (Monorepo)
```
sonar-platform/
├── apps/
│   ├── cli/
│   ├── notifier/
│   └── whale-watcher/
├── packages/
│   ├── database/
│   └── types/
├── package.json (root)
├── turbo.json
└── Multiple tsconfig.json files
```

### After (Simplified)
```
sonar-platform/
├── backend/
│   ├── src/
│   │   ├── api/       # API server
│   │   ├── services/  # Background services
│   │   └── lib/       # Shared code
│   └── package.json
├── frontend/
│   ├── public/        # Static assets
│   ├── pages/         # HTMX fragments
│   └── package.json
└── scripts/           # Database setup
```

## Migration Details

### What Was Preserved

1. **Core Business Logic**
   - Whale watching algorithm
   - Signal detection rules
   - Notification system
   - Database schema (with UI additions)

2. **Service Architecture**
   - WhaleWatcher still monitors blockchain
   - Notifier still sends alerts
   - Services run as separate processes

### What Changed

1. **Removed Abstractions**
   - No more shared packages
   - Direct imports instead of workspace dependencies
   - Single build process per component

2. **Added Web Interface**
   - Dashboard for real-time monitoring
   - Wallet management UI
   - Trade control panel
   - Performance statistics

3. **Simplified APIs**
   - Minimal endpoints for essential operations
   - Most reads go directly to database
   - Server-sent events for real-time updates

## Benefits Achieved

### Developer Experience
- Easier to understand codebase
- Faster development cycle
- Simpler debugging
- Less configuration

### User Experience
- Visual feedback for all operations
- Real-time activity monitoring
- Manual control over trades
- Better situational awareness

### Deployment Flexibility
- Can deploy anywhere
- No runtime lock-in
- Simpler hosting requirements
- Lower operational overhead

## Implementation Notes

### WebSocket Management
- Native WebSocket API instead of ws package
- Automatic reconnection logic
- Exponential backoff for failures

### Real-time Updates
- SSE for frontend updates
- Supabase Realtime for service communication
- Database triggers for signal generation

### Security Considerations
- Environment variables for secrets
- CORS configured for API
- No private keys in code
- Supabase RLS for data access

## Future Considerations

### Potential Enhancements
1. WebSocket multiplexing for multiple blockchain connections
2. Service worker for offline capability
3. IndexedDB for client-side caching
4. Progressive Web App features

### Scaling Considerations
- Current architecture handles single user perfectly
- Can add Redis for multi-instance coordination
- Can split services to separate deployments
- Database can handle significant scale

## Conclusion

The rework successfully achieves the goal of simplifying the architecture while adding requested features. The system is now easier to understand, develop, and deploy while providing better visibility and control through the web interface. The runtime-agnostic approach ensures maximum deployment flexibility without sacrificing functionality.