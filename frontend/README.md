# Sonar Frontend - Portable TypeScript Edition

This Hono/HTMX frontend has been migrated to portable TypeScript that runs on multiple JavaScript runtimes without modification.

## Architecture

- **Templates as TypeScript**: All HTML templates are now TypeScript modules using template literals
- **No Build Step**: For development with Bun, just run the TypeScript directly
- **Runtime Agnostic**: Works on Bun, Node.js, and Cloudflare Workers
- **Static Assets**: Served via Hono's serveStatic (configure for your deployment target)

## Project Structure

```
frontend/
├── src/templates/       # All HTML templates as TypeScript
│   ├── layout.ts       # Main layout wrapper
│   ├── pages/          # Full page templates
│   ├── partials/       # Reusable fragments
│   └── registry.ts     # Dynamic partial loading
├── lib/                # Database and utilities
├── public/             # Static assets (CSS, JS, images)
├── server.ts           # Main server (portable)
└── wrangler.toml       # Cloudflare Workers config
```

## Running Locally

### With Bun (recommended for development)
```bash
bun install
bun run dev     # Development with auto-reload
bun start       # Production mode
```

### With Node.js
```bash
npm install
npm run build:node
npm run start:node
```

### With Cloudflare Workers
```bash
npm install
npm run dev:worker    # Local development
npm run deploy        # Deploy to Cloudflare
```

## Environment Variables

Create a `.env` file:
```env
SUPABASE_URL=your-supabase-url
SUPABASE_ANON_KEY=your-supabase-anon-key
PORT=3000
```

For Cloudflare Workers, set these via:
```bash
wrangler secret put SUPABASE_URL
wrangler secret put SUPABASE_ANON_KEY
```

## Key Differences from Original

1. **No file system access**: Templates are imported as modules
2. **Runtime detection**: Automatically adapts to Bun, Node.js, or Workers
3. **Static assets**: Configure based on your deployment target
4. **No transpilation needed**: Template literals work everywhere

## Deployment Notes

### Cloudflare Workers
- Update `wrangler.toml` with your account details
- Consider using R2 or Workers Sites for static assets
- Environment variables go in Cloudflare dashboard or via wrangler

### Traditional Hosting
- Build with `npm run build:node` for Node.js
- Use `bun build` for a Bun-optimized bundle
- Serve static files with your web server of choice