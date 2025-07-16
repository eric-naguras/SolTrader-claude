# Claude Code Instructions: Hono/HTMX Project Migration

## Project Overview
This is a Hono.js + HTMX web application that needs to be migrated from Node.js-specific code to portable TypeScript that runs across multiple JavaScript runtimes (Node.js, Bun, and Cloudflare Workers).

## Current Project Structure
```
.
├── server.ts           # Main server file (needs migration)
├── public/
│   ├── index.html     # Main HTML template
│   ├── css/           # Static CSS files
│   └── js/            # Static JS files
├── pages/
│   ├── dashboard.html # Page templates
│   ├── wallets.html
│   ├── trades.html
│   ├── settings.html
│   └── _partials/     # Reusable HTML components
├── lib/
│   └── database.js    # Database functions (Supabase)
└── package.json
```

## Migration Requirements

### 1. Remove Node.js-specific APIs
The current code uses Node.js-specific modules that need to be replaced:
- `node:fs/promises` (readFile)
- `node:path` (join, dirname)
- `node:url` (fileURLToPath)
- `__dirname` and `__filename`

### 2. Make HTML Loading Runtime-Agnostic
Current approach reads HTML files at runtime using `readFile`. This doesn't work in edge environments like Cloudflare Workers. Solution:
- Rewrite all HTML files as TypeScript modules using template literals
- Export functions that return HTML strings
- No build step or HTML-to-TS conversion needed
- Use plain TypeScript (not TSX) to avoid transpilation requirements

### 3. Static File Serving
The current `serveStatic` implementation needs to be environment-aware:
- For Bun/Node.js: Serve from file system
- For Cloudflare Workers: Use Workers Sites, R2, or inline the assets
- Consider inlining critical CSS/JS for edge deployment

### 4. Environment Detection
Replace the current startup logic:
```typescript
if (import.meta.url === `file://${process.argv[1]}`) {
```
With something that works across all environments.

### 5. Why Template Literals Over TSX
- **No transpilation needed**: Template literals are valid JavaScript/TypeScript
- **Runtime agnostic**: Works directly in Bun, Node.js, and browsers
- **Simpler toolchain**: No JSX transform or bundler configuration
- **Better for small projects**: Less complexity, faster development
- **Syntax highlighting**: Modern editors support HTML in template literals

## Specific Tasks

1. **Rewrite HTML as TypeScript modules**:
   - Convert all HTML files to TypeScript using template literals
   - Create a clean module structure under `src/templates/`
   - Export functions that return HTML strings
   - Maintain all HTMX attributes and behavior

2. **Refactor server.ts** to:
   - Use only standard Web APIs
   - Import HTML content from the new TypeScript modules
   - Handle static files appropriately per environment
   - Export the app correctly for each runtime

3. **Create portable module structure**:
   - `src/templates/layout.ts` - Main layout template
   - `src/templates/pages/*.ts` - Page templates
   - `src/templates/partials/*.ts` - Reusable components
   - Use a registry pattern for partials

4. **Update configuration**:
   - Minimal TypeScript config for multiple targets
   - Simple scripts in package.json (no build step needed)
   - Create wrangler.toml for Cloudflare deployment

## Constraints

- **No framework-specific code**: Use only standard TypeScript/JavaScript
- **No Bun-specific APIs**: Even though we use Bun for development
- **No TSX/JSX**: Use template literals to avoid transpilation needs
- **No bundler required**: Code should run with minimal configuration
- **Maintain HTMX patterns**: The client-side HTMX logic should remain unchanged
- **Keep it simple**: This is a small project, avoid over-engineering

## Expected Deliverables

1. **TypeScript template modules** - All HTML rewritten as TS
2. **Migrated server.ts** - Portable across all runtimes
3. **Clean module structure** - Organized templates directory
4. **Updated package.json** - Simple scripts, no build step
5. **Deployment configs** - wrangler.toml for Cloudflare
6. **README updates** - Document the new setup

## Additional Context

- The app uses Supabase for the database (already portable)
- There are webhook endpoints that need to remain functional
- The HTMX patterns use both full page loads and partial fragments
- Partials are stored in `pages/_partials/` directory
- Using template literals instead of TSX to avoid transpilation requirements
- No bundler setup to keep deployment simple

### Example Template Pattern
```typescript
// src/templates/pages/dashboard.ts
export const dashboardPage = () => `
  <div class="container" hx-get="/api/signals" hx-trigger="revealed">
    <header>
      <h1>Trading Dashboard</h1>
    </header>
    <main>
      <section id="active-signals">
        <div class="placeholder">Loading signals...</div>
      </section>
    </main>
  </div>
`;

// src/templates/layout.ts
export const layout = (content: string) => `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <title>Trading App</title>
    <link rel="stylesheet" href="/css/style.css">
    <script src="/js/htmx.min.js"></script>
</head>
<body>
    <nav hx-boost="true">
        <a href="/">Dashboard</a>
        <a href="/wallets">Wallets</a>
        <a href="/trades">Trades</a>
        <a href="/settings">Settings</a>
    </nav>
    ${content}
</body>
</html>
`;
```

## Success Criteria

- `bun run server.ts` works for local development (no build step)
- `bun run build && node dist/server.js` works with Node.js (minimal transpilation)
- `wrangler deploy` successfully deploys to Cloudflare Workers
- No runtime file system dependencies
- Clean, maintainable template structure
- All HTML is now portable TypeScript code