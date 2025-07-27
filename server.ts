// Initialize HTTP monitoring first to catch all HTTP requests
import './src/lib/http-monitor.js';

import { Hono, Context } from 'hono';
import { ENV } from './src/lib/env.js';
import { messageBus } from './src/lib/message-bus.js';
import ServiceManager from './src/services/service-manager.js';

// Import template functions
import { layout, layoutWithInitialLoad } from './src/templates/layout.js';
import { dashboardPage } from './src/templates/pages/dashboard.js';
import { walletsPage } from './src/templates/pages/wallets.js';
import { tradesPage } from './src/templates/pages/trades.js';
import { settingsPage } from './src/templates/pages/settings.js';
import { getPartial } from './src/templates/registry.js';
import { walletsTablePartial, walletsTableErrorPartial } from './src/templates/partials/wallets-table.js';
import { walletRowPartial } from './src/templates/partials/wallet-row.js';

// Import database functions
import { 
  getActiveSignals, 
  getRecentTrades, 
  getStats, 
  getTrackedWallets,
  getWalletsWithTraderInfo, 
  getTrackedWalletByAddress, 
  createTrackedWallet, 
  updateTrackedWallet, 
  deleteTrackedWallet, 
  toggleWalletStatus 
} from './src/lib/database.js';

const app = new Hono();

// Add request logging middleware
app.use('*', async (c, next) => {
  const start = Date.now();
  const method = c.req.method;
  const url = c.req.url;
  const userAgent = c.req.header('User-Agent') || 'Unknown';
  const clientIP = c.req.header('X-Forwarded-For') || c.req.header('CF-Connecting-IP') || 'Unknown';
  
  await next();
  
  const duration = Date.now() - start;
  const status = c.res.status;
  
  // Log requests that might be causing issues
  if (status === 429 || duration > 1000 || method !== 'GET') {
    console.log(`[Server] ${method} ${url} - ${status} (${duration}ms) - IP: ${clientIP} - UA: ${userAgent.substring(0, 100)}`);
  }
});

// Add CORS middleware for API endpoints
app.use('*', async (c, next) => {
  c.header('Access-Control-Allow-Origin', '*');
  c.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  c.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-API-Key');
  
  if (c.req.method === 'OPTIONS') {
    return c.text('', 200);
  }
  
  await next();
});

// Initialize services
const serviceManager = new ServiceManager();

// SSE endpoint for real-time updates - using ReadableStream for Bun compatibility
app.get('/events', (c: Context) => {
  console.log('[Server] New SSE connection established');
  
  const encoder = new TextEncoder();
  let eventId = 0;
  const unsubscribers: (() => void)[] = [];
  
  const stream = new ReadableStream({
    start(controller) {
      // Set up message bus listeners for this client
      const tradeHandler = (data: any) => {
        const msg = `id: ${eventId++}\nevent: new_trade\ndata: ${JSON.stringify({
          type: 'new_trade',
          trade: data.trade,
          timestamp: new Date().toISOString()
        })}\n\n`;
        try {
          controller.enqueue(encoder.encode(msg));
        } catch (error) {
          console.log('[Server] Failed to send trade event to SSE client');
        }
      };

      const signalHandler = (data: any) => {
        const msg = `id: ${eventId++}\nevent: new_signal\ndata: ${JSON.stringify({
          type: 'new_signal',
          signal: data.signal,
          timestamp: new Date().toISOString()
        })}\n\n`;
        try {
          controller.enqueue(encoder.encode(msg));
        } catch (error) {
          console.log('[Server] Failed to send signal event to SSE client');
        }
      };

      const statsHandler = (data: any) => {
        const msg = `id: ${eventId++}\nevent: stats_updated\ndata: ${JSON.stringify({
          type: 'stats_updated',
          stats: data.stats,
          timestamp: new Date().toISOString()
        })}\n\n`;
        try {
          controller.enqueue(encoder.encode(msg));
        } catch (error) {
          console.log('[Server] Failed to send stats event to SSE client');
        }
      };

      // Subscribe to message bus events
      messageBus.subscribe('new_trade', tradeHandler);
      messageBus.subscribe('new_signal', signalHandler);  
      messageBus.subscribe('stats_updated', statsHandler);
      
      // Store unsubscribers for cleanup
      unsubscribers.push(() => messageBus.unsubscribe('new_trade', tradeHandler));
      unsubscribers.push(() => messageBus.unsubscribe('new_signal', signalHandler));
      unsubscribers.push(() => messageBus.unsubscribe('stats_updated', statsHandler));

      // Send initial connection event
      const initialMsg = `id: ${eventId++}\nevent: connected\ndata: ${JSON.stringify({
        type: 'connected',
        timestamp: new Date().toISOString()
      })}\n\n`;
      controller.enqueue(encoder.encode(initialMsg));

      // Keep connection alive with periodic heartbeat
      const heartbeatInterval = setInterval(() => {
        const heartbeatMsg = `id: ${eventId++}\nevent: heartbeat\ndata: ${JSON.stringify({
          type: 'heartbeat',
          timestamp: new Date().toISOString()
        })}\n\n`;
        try {
          controller.enqueue(encoder.encode(heartbeatMsg));
        } catch (error) {
          // Client disconnected, clean up
          clearInterval(heartbeatInterval);
          unsubscribers.forEach(unsub => unsub());
          console.log('[Server] SSE client disconnected during heartbeat');
        }
      }, 30000); // 30 second heartbeat
      
      // Store interval for cleanup
      unsubscribers.push(() => clearInterval(heartbeatInterval));
    },
    
    cancel() {
      // Clean up when connection is closed
      unsubscribers.forEach(unsub => unsub());
      console.log('[Server] SSE client disconnected');
    }
  });
  
  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Cache-Control',
    },
  });
});

// Runtime-specific static file serving
async function setupStaticFiles() {
  // For Bun runtime
  if (typeof Bun !== 'undefined') {
    const { serveStatic } = await import('hono/bun');
    app.use('/css/*', serveStatic({ root: './src/public' }));
    app.use('/js/*', serveStatic({ root: './src/public' }));
    app.use('/images/*', serveStatic({ root: './src/public' }));
  }
  // For Node.js runtime
  else if (typeof process !== 'undefined' && process.versions?.node) {
    const { serveStatic } = await import('@hono/node-server/serve-static');
    app.use('/css/*', serveStatic({ root: './src/public' }));
    app.use('/js/*', serveStatic({ root: './src/public' }));
    app.use('/images/*', serveStatic({ root: './src/public' }));
  }
  // For Cloudflare Workers - static assets need different handling
  // You would typically use Workers Sites, R2, or inline critical assets
}

// Helper function to serve full page with content
function servePage(c: Context, pageContent: string) {
  const html = layout(pageContent);
  return c.html(html);
}

// Root route - special case with initial load
app.get('/', (c: Context) => {
  return c.html(layoutWithInitialLoad());
});

// Serve pages (both direct access and HTMX)
app.get('/wallets', (c: Context) => {
  // Extract query parameters for filter persistence
  const { sortBy, sortOrder, tags } = c.req.query();
  return servePage(c, walletsPage({ sortBy, sortOrder, tags }));
});

app.get('/trades', (c: Context) => {
  return servePage(c, tradesPage());
});

app.get('/settings', (c: Context) => {
  return servePage(c, settingsPage());
});

// HTMX fragments (for navigation without full page reload)
app.get('/htmx/dashboard', (c: Context) => {
  return c.html(dashboardPage());
});

app.get('/htmx/wallets', (c: Context) => {
  return c.html(walletsPage());
});

app.get('/htmx/trades', (c: Context) => {
  return c.html(tradesPage());
});

app.get('/htmx/settings', (c: Context) => {
  return c.html(settingsPage());
});

// HTMX endpoints for logging settings
app.get('/htmx/logging-config', async (c: Context) => {
  try {
    const { getDatabase } = await import('./src/lib/database.js');
    const db = getDatabase();
    const result = await db.query(
      `SELECT log_categories FROM service_configs WHERE service_name = 'unified' LIMIT 1`
    );
    
    let logCategories;
    if (!result.rows || result.rows.length === 0 || !result.rows[0] || !result.rows[0].log_categories) {
      // Return default configuration if not found
      logCategories = {
        connection: true,
        wallet: true,
        trade: true,
        multiWhale: true,
        transaction: false,
        dataFlow: false,
        health: true,
        debug: false
      };
    } else {
      logCategories = result.rows[0].log_categories;
      console.log('Loaded log categories from database:', logCategories);
    }
    
    // Use the new logging config template
    const { loggingConfigTemplate } = await import('./src/templates/partials/logging-config.js');
    return c.html(loggingConfigTemplate(logCategories));
  } catch (error) {
    console.error('Failed to get logging settings:', error);
    return c.html('<div class="error">Failed to load logging settings</div>', 500);
  }
});

app.put('/htmx/logging-config', async (c: Context) => {
  try {
    const formData = await c.req.formData();
    const logCategories = {
      connection: formData.get('connection') === 'on',
      wallet: formData.get('wallet') === 'on',
      trade: formData.get('trade') === 'on',
      multiWhale: formData.get('multiWhale') === 'on',
      transaction: formData.get('transaction') === 'on',
      dataFlow: formData.get('dataFlow') === 'on',
      health: formData.get('health') === 'on',
      debug: formData.get('debug') === 'on'
    };
    
    const { getDatabase } = await import('./src/lib/database.js');
    const db = getDatabase();
    
    // Upsert the configuration
    await db.query(
      `INSERT INTO service_configs (service_name, log_categories) 
       VALUES ('unified', $1::jsonb)
       ON CONFLICT (service_name) 
       DO UPDATE SET log_categories = $1::jsonb, updated_at = NOW()`,
      [JSON.stringify(logCategories)]
    );
    
    // Publish configuration change via message bus
    messageBus.publish('logging_config_changed', { log_categories: logCategories });
    
    // Return empty response - the toggle switch will maintain its state
    return c.html('');
  } catch (error) {
    console.error('Failed to update logging settings:', error);
    // Return error response with HTMX error header
    c.header('HX-Reswap', 'innerHTML');
    return c.html('<div class="error">Failed to update configuration</div>', 500);
  }
});

// HTMX endpoints for data partials
app.get('/htmx/signals', async (c: Context) => {
  const signals = await getActiveSignals();
  const { activeSignalsPartial } = await import('./src/templates/partials/active-signals.js');
  
  // Generate signals HTML
  let signalsHtml = '';
  if (signals.length === 0) {
    signalsHtml = '<p style="color: var(--pico-muted-color); text-align: center; padding: 2rem;">No active signals</p>';
  } else {
    signalsHtml = signals.map(signal => `
      <div class="signal-card" data-signal-id="${signal.id}">
        <h4>🎯 ${signal.whale_count} Whale Signal</h4>
        <p><strong>Token:</strong> ${signal.token_symbol || 'Unknown'}</p>
        <p><strong>Trigger:</strong> ${signal.trigger_reason}</p>
        <p><strong>Created:</strong> ${new Date(signal.created_at).toLocaleString()}</p>
      </div>
    `).join('');
  }
  
  return c.html(signalsHtml);
});

app.get('/htmx/trades', async (c: Context) => {
  const limit = Number(c.req.query('limit')) || 100;
  const trades = await getRecentTrades(limit);
  
  // Return trade cards HTML for the recent-trades component
  if (trades.length === 0) {
    return c.html('<p style="color: var(--pico-muted-color); text-align: center; padding: 2rem; grid-column: 1 / -1;">No recent trades found</p>');
  }
  
  // The frontend recent-trades component expects JSON data, but we'll return it as a script
  return c.html(`
    <script>
      window.tradesData = ${JSON.stringify(trades)};
      if (window.walletTradeManager) {
        window.walletTradeManager.clear();
        window.tradesData.forEach(trade => {
          const tokenSymbol = trade.token_symbol || 'Unknown';
          const tokenName = trade.token_name;
          const walletAlias = trade.wallet_alias || \`\${trade.wallet_address.slice(0, 8)}...\${trade.wallet_address.slice(-4)}\`;
          const walletColor = trade.wallet_color || '#4338ca';
          const isVerified = trade.is_verified || false;
          const twitterHandle = trade.twitter_handle;
          const telegramChannel = trade.telegram_channel;
          const streamingChannel = trade.streaming_channel;
          const imageData = trade.image_data;
          
          const tradeData = {
            id: trade.id,
            trade_type: trade.trade_type,
            sol_amount: trade.sol_amount || 0,
            token_amount: trade.token_amount,
            token_symbol: tokenSymbol,
            token_name: tokenName,
            token_address: trade.coin_address,
            price_usd: trade.price_usd,
            transaction_hash: trade.transaction_hash,
            trade_timestamp: trade.trade_timestamp,
            time_ago: new Date(trade.trade_timestamp).toLocaleString()
          };
          
          window.walletTradeManager.addTrade(
            trade.wallet_address,
            tradeData,
            walletAlias,
            walletColor,
            isVerified,
            twitterHandle,
            telegramChannel,
            streamingChannel,
            imageData
          );
        });
        
        // Trigger re-render
        if (window.renderWallets) window.renderWallets();
      }
    </script>
  `);
});

app.get('/htmx/stats', async (c: Context) => {
  const stats = await getStats();
  
  return c.html(`
    <div class="stats-grid">
      <div class="stat-card">
        <h3>📊 Total Trades</h3>
        <p class="stat-value">${stats.total_trades || 0}</p>
      </div>
      <div class="stat-card">
        <h3>👛 Active Wallets</h3>
        <p class="stat-value">${stats.active_wallets || 0}</p>
      </div>
      <div class="stat-card">
        <h3>🎯 Active Signals</h3>
        <p class="stat-value">${stats.active_signals || 0}</p>
      </div>
      <div class="stat-card">
        <h3>💰 Portfolio Value</h3>
        <p class="stat-value">$${(stats.portfolio_value || 0).toLocaleString()}</p>
      </div>
    </div>
  `);
});

// HTMX endpoints for service management
app.get('/htmx/services/status', async (c: Context) => {
  const statuses = serviceManager.getAllServiceStatuses();
  
  const statusHtml = statuses.map(status => {
    const emoji = status.status === 'running' ? '✅' : 
                 status.status === 'error' ? '❌' : '⏹️';
    return `
      <div class="service-status">
        <span>${emoji} ${status.name}</span>
        <span class="status-${status.status}">${status.status}</span>
        ${status.error ? `<small class="error">${status.error}</small>` : ''}
        <button hx-post="/htmx/services/${status.name}/restart" 
                hx-target="#toast-container" 
                class="secondary">Restart</button>
      </div>
    `;
  }).join('');
  
  return c.html(statusHtml);
});

app.post('/htmx/services/:service/restart', async (c: Context) => {
  try {
    const serviceName = c.req.param('service');
    await serviceManager.restartService(serviceName);
    
    return c.html(`
      <div class="toast success">
        ✅ Service ${serviceName} restarted successfully
      </div>
      <script>
        setTimeout(() => {
          document.querySelector('.toast').remove();
          htmx.trigger('#services-status', 'refresh');
        }, 2000);
      </script>
    `);
  } catch (error) {
    return c.html(`
      <div class="toast error">
        ❌ Failed to restart service: ${error.message}
      </div>
      <script>
        setTimeout(() => document.querySelector('.toast').remove(), 3000);
      </script>
    `, 500);
  }
});

app.post('/htmx/trading/enable', async (c: Context) => {
  try {
    await serviceManager.enableLiveTrading();
    
    return c.html(`
      <div class="toast success">
        ✅ Live trading enabled
      </div>
      <script>
        setTimeout(() => document.querySelector('.toast').remove(), 3000);
      </script>
    `);
  } catch (error) {
    return c.html(`
      <div class="toast error">
        ❌ Failed to enable trading: ${error.message}
      </div>
      <script>
        setTimeout(() => document.querySelector('.toast').remove(), 3000);
      </script>
    `, 500);
  }
});

app.post('/htmx/trading/disable', async (c: Context) => {
  try {
    await serviceManager.disableLiveTrading();
    
    return c.html(`
      <div class="toast success">
        ✅ Live trading disabled
      </div>
      <script>
        setTimeout(() => document.querySelector('.toast').remove(), 3000);
      </script>
    `);
  } catch (error) {
    return c.html(`
      <div class="toast error">
        ❌ Failed to disable trading: ${error.message}
      </div>
      <script>
        setTimeout(() => document.querySelector('.toast').remove(), 3000);
      </script>
    `, 500);
  }
});

app.post('/htmx/analysis/trigger', async (c: Context) => {
  try {
    await serviceManager.triggerManualAnalysis();
    
    return c.html(`
      <div class="toast success">
        ✅ Analysis triggered successfully
      </div>
      <script>
        setTimeout(() => document.querySelector('.toast').remove(), 3000);
      </script>
    `);
  } catch (error) {
    return c.html(`
      <div class="toast error">
        ❌ Failed to trigger analysis: ${error.message}
      </div>
      <script>
        setTimeout(() => document.querySelector('.toast').remove(), 3000);
      </script>
    `, 500);
  }
});

// HTMX endpoints for UI settings
app.get('/htmx/settings/ui', async (c: Context) => {
  try {
    const { getDatabase } = await import('./src/lib/database.js');
    const db = getDatabase();
    const result = await db.query(
      `SELECT ui_refresh_config FROM service_configs WHERE service_name = 'unified' LIMIT 1`
    );
    
    let config;
    if (!result.rows || result.rows.length === 0 || !result.rows[0] || !result.rows[0].ui_refresh_config) {
      config = {
        balance_interval_minutes: 5,
        auto_refresh_enabled: true,
        pause_on_activity: true,
        show_refresh_indicators: true
      };
    } else {
      config = result.rows[0].ui_refresh_config;
    }
    
    return c.html(`
      <form hx-put="/htmx/settings/ui" hx-target="#ui-refresh-tab #toast-container">
        <div>
          <label for="balance-interval">
            Balance Refresh Interval (minutes)
            <input type="number" name="balance_interval_minutes" 
                   value="${config.balance_interval_minutes}" 
                   min="1" max="60" required>
            <small>How often to check wallet balances (1-60 minutes)</small>
          </label>
        </div>
        
        <div class="grid">
          <div>
            <label>
              <input type="checkbox" name="auto_refresh_enabled" 
                     ${config.auto_refresh_enabled ? 'checked' : ''} role="switch">
              Enable Auto-Refresh
            </label>
            <small>Automatically refresh balances and age information</small>
          </div>
          <div>
            <label>
              <input type="checkbox" name="pause_on_activity" 
                     ${config.pause_on_activity ? 'checked' : ''} role="switch">
              Pause on User Activity
            </label>
            <small>Pause auto-refresh when user is interacting with the page</small>
          </div>
        </div>
        
        <div>
          <label>
            <input type="checkbox" name="show_refresh_indicators" 
                   ${config.show_refresh_indicators ? 'checked' : ''} role="switch">
            Show Refresh Indicators
          </label>
          <small>Display loading indicators during refresh operations</small>
        </div>
        
        <div class="grid">
          <button type="submit">Save Settings</button>
          <button type="button" class="secondary" onclick="location.reload()">Reset to Defaults</button>
        </div>
      </form>
    `);
  } catch (error) {
    console.error('Failed to get UI settings:', error);
    return c.html('<div class="error">Failed to load UI settings</div>', 500);
  }
});

app.put('/htmx/settings/ui', async (c: Context) => {
  try {
    const formData = await c.req.formData();
    const uiConfig = {
      balance_interval_minutes: parseInt(formData.get('balance_interval_minutes') || '5'),
      auto_refresh_enabled: formData.get('auto_refresh_enabled') === 'on',
      pause_on_activity: formData.get('pause_on_activity') === 'on',
      show_refresh_indicators: formData.get('show_refresh_indicators') === 'on'
    };
    
    const { getDatabase } = await import('./src/lib/database.js');
    const db = getDatabase();
    
    await db.query(
      `INSERT INTO service_configs (service_name, ui_refresh_config) 
       VALUES ('unified', $1::jsonb)
       ON CONFLICT (service_name) 
       DO UPDATE SET ui_refresh_config = $1::jsonb, updated_at = NOW()`,
      [JSON.stringify(uiConfig)]
    );
    
    // Publish configuration change via message bus
    messageBus.publish('ui_config_changed', { ui_refresh_config: uiConfig });
    
    // Return empty response - form elements will maintain their state
    return c.html('');
  } catch (error) {
    console.error('Failed to update UI settings:', error);
    // Return error response with HTMX error header
    c.header('HX-Reswap', 'innerHTML');
    return c.html('<div class="error">Failed to update UI settings</div>', 500);
  }
});

// HTMX endpoints for service control
app.get('/htmx/service-controls', async (c: Context) => {
  try {
    const { getDatabase } = await import('./src/lib/database.js');
    const { serviceControlsTemplate } = await import('./src/templates/partials/service-controls.js');
    const db = getDatabase();
    
    // Get all service configs
    const configs = await db.getAllServiceConfigs();
    
    // Define service metadata
    const serviceMetadata = new Map([
      ['WalletWatcher', { displayName: 'Wallet Watcher', description: 'Monitors whale wallet activity and detects coordinated trades' }],
      ['WalletUpdater', { displayName: 'Wallet Updater', description: 'Tracks wallet relationships and identifies traders with multiple wallets' }],
      ['PaperTrader', { displayName: 'Paper Trader', description: 'Simulates trades based on signals for testing strategies' }],
      ['SignalAnalyzer', { displayName: 'Signal Analyzer', description: 'Analyzes trading patterns and generates insights' }],
      ['SignalTrader', { displayName: 'Signal Trader', description: 'Executes real trades based on signals (requires live trading enabled)' }]
    ]);
    
    // Build service control configs
    const serviceControlConfigs = configs
      .filter(config => serviceMetadata.has(config.service_name))
      .map(config => ({
        serviceName: config.service_name,
        displayName: serviceMetadata.get(config.service_name)?.displayName || config.service_name,
        enabled: config.enabled,
        description: serviceMetadata.get(config.service_name)?.description
      }));
    
    return c.html(serviceControlsTemplate(serviceControlConfigs));
  } catch (error) {
    console.error('Failed to get service controls:', error);
    return c.html('<div class="error">Failed to load service controls</div>', 500);
  }
});

app.put('/htmx/service-control/:serviceName/toggle', async (c: Context) => {
  try {
    const serviceName = c.req.param('serviceName');
    const { getDatabase } = await import('./src/lib/database.js');
    const db = getDatabase();
    
    // Get current state
    const config = await db.getServiceConfig(serviceName);
    if (!config) {
      return c.html('<div class="error">Service not found</div>', 404);
    }
    
    // Toggle the enabled state
    const newEnabledState = !config.enabled;
    await db.updateServiceEnabled(serviceName, newEnabledState);
    
    // Map database service names to internal service names
    const serviceNameMapping: Record<string, string> = {
      'WalletWatcher': 'wallet-watcher',
      'WalletUpdater': 'wallet-updater',
      'PaperTrader': 'paper-trader',
      'SignalAnalyzer': 'signal-analyzer',
      'SignalTrader': 'signal-trader'
    };
    
    const internalServiceName = serviceNameMapping[serviceName];
    if (internalServiceName) {
      // Publish event to enable/disable service
      if (newEnabledState) {
        messageBus.publish('service_enable_requested', { serviceName: internalServiceName });
      } else {
        messageBus.publish('service_disable_requested', { serviceName: internalServiceName });
      }
    }
    
    // Get updated service configs and return the whole service control panel
    const configs = await db.getAllServiceConfigs();
    const { serviceControlsTemplate } = await import('./src/templates/partials/service-controls.js');
    
    // Define service metadata
    const serviceMetadata = new Map([
      ['WalletWatcher', { displayName: 'Wallet Watcher', description: 'Monitors whale wallet activity and detects coordinated trades' }],
      ['WalletUpdater', { displayName: 'Wallet Updater', description: 'Tracks wallet relationships and identifies traders with multiple wallets' }],
      ['PaperTrader', { displayName: 'Paper Trader', description: 'Simulates trades based on signals for testing strategies' }],
      ['SignalAnalyzer', { displayName: 'Signal Analyzer', description: 'Analyzes trading patterns and generates insights' }],
      ['SignalTrader', { displayName: 'Signal Trader', description: 'Executes real trades based on signals (requires live trading enabled)' }]
    ]);
    
    // Build service control configs
    const serviceControlConfigs = configs
      .filter(config => serviceMetadata.has(config.service_name))
      .map(config => ({
        serviceName: config.service_name,
        displayName: serviceMetadata.get(config.service_name)?.displayName || config.service_name,
        enabled: config.enabled,
        description: serviceMetadata.get(config.service_name)?.description
      }));
    
    // Return just the service controls template without the toast
    return c.html(serviceControlsTemplate(serviceControlConfigs));
  } catch (error) {
    console.error('Failed to toggle service:', error);
    return c.html('<div class="error">Failed to toggle service</div>', 500);
  }
});

// HTMX endpoint for creating wallets
app.post('/htmx/wallets', async (c: Context) => {
  try {
    const formData = await c.req.formData();
    const walletData = {
      address: formData.get('address')?.toString().trim(),
      alias: formData.get('alias')?.toString(),
      tags: formData.get('tags')?.toString().split(',').map(t => t.trim()).filter(t => t),
      ui_color: formData.get('ui_color')?.toString() || '#4338ca',
      twitter_handle: formData.get('twitter_handle')?.toString(),
      telegram_channel: formData.get('telegram_channel')?.toString(),
      streaming_channel: formData.get('streaming_channel')?.toString(),
      image_data: formData.get('image_data')?.toString(),
      notes: formData.get('notes')?.toString(),
      sol_balance: null,
      last_balance_check: null,
      is_active: true
    };
    
    // Check if wallet already exists
    const existingWallet = await getTrackedWalletByAddress(walletData.address!);
    if (existingWallet) {
      return c.html(`
        <div class="toast error" style="position: fixed; top: 1rem; right: 1rem; z-index: 1000;">
          ❌ A wallet with this address already exists
        </div>
        <script>
          setTimeout(() => document.querySelector('.toast').remove(), 3000);
        </script>
      `, 409);
    }
    
    const newWallet = await createTrackedWallet({
      ...walletData,
      metadata: {}
    });
    
    // Reload wallets in wallet watcher
    const walletWatcher = await serviceManager.getService('wallet-watcher');
    if (walletWatcher && walletWatcher.loadTrackedWallets) {
      await walletWatcher.loadTrackedWallets();
    }
    
    // Publish wallet update event
    messageBus.publish('wallet_updated', { wallet: newWallet });
    
    return c.html(`
      <div class="toast success" style="position: fixed; top: 1rem; right: 1rem; z-index: 1000;">
        ✅ Wallet added: ${newWallet.alias}
      </div>
      <script>
        setTimeout(() => {
          document.querySelector('.toast').remove();
          htmx.trigger('#wallets-table', 'refresh');
        }, 2000);
      </script>
    `, 201);
  } catch (error) {
    console.error('Error creating wallet:', error);
    
    // Handle database unique constraint violation
    const errorMessage = error instanceof Error && (error.message?.includes('unique constraint') || error.message?.includes('duplicate key'))
      ? 'A wallet with this address already exists'
      : 'Failed to create wallet';
      
    return c.html(`
      <div class="toast error" style="position: fixed; top: 1rem; right: 1rem; z-index: 1000;">
        ❌ ${errorMessage}
      </div>
      <script>
        setTimeout(() => document.querySelector('.toast').remove(), 3000);
      </script>
    `, 500);
  }
});

app.put('/htmx/wallets/:address', async (c: Context) => {
  try {
    const address = c.req.param('address');
    const formData = await c.req.formData();
    
    const updates = {
      alias: formData.get('alias')?.toString(),
      tags: formData.get('tags')?.toString().split(',').map(t => t.trim()).filter(t => t),
      ui_color: formData.get('ui_color')?.toString() || '#4338ca',
      twitter_handle: formData.get('twitter_handle')?.toString(),
      telegram_channel: formData.get('telegram_channel')?.toString(),
      streaming_channel: formData.get('streaming_channel')?.toString(),
      image_data: formData.get('image_data')?.toString(),
      notes: formData.get('notes')?.toString(),
      is_active: formData.get('is_active') === 'on'
    };
    
    const updatedWallet = await updateTrackedWallet(address, updates);
    
    if (!updatedWallet) {
      return c.html(`
        <div class="toast error" style="position: fixed; top: 1rem; right: 1rem; z-index: 1000;">
          ❌ Wallet not found
        </div>
        <script>
          setTimeout(() => document.querySelector('.toast').remove(), 3000);
        </script>
      `, 404);
    }
    
    // Publish wallet update event
    messageBus.publish('wallet_updated', { wallet: updatedWallet });
    
    return c.html(`
      <div class="toast success" style="position: fixed; top: 1rem; right: 1rem; z-index: 1000;">
        ✅ Wallet updated successfully
      </div>
      <script>
        setTimeout(() => {
          document.querySelector('.toast').remove();
          htmx.trigger('#wallets-table', 'refresh');
        }, 2000);
      </script>
    `);
  } catch (error) {
    console.error('Error updating wallet:', error);
    return c.html(`
      <div class="toast error" style="position: fixed; top: 1rem; right: 1rem; z-index: 1000;">
        ❌ Failed to update wallet
      </div>
      <script>
        setTimeout(() => document.querySelector('.toast').remove(), 3000);
      </script>
    `, 500);
  }
});

app.delete('/htmx/wallets/:address', async (c: Context) => {
  try {
    const address = c.req.param('address');
    const deleted = await deleteTrackedWallet(address);
    
    if (!deleted) {
      return c.html(`
        <div class="toast error" style="position: fixed; top: 1rem; right: 1rem; z-index: 1000;">
          ❌ Wallet not found
        </div>
        <script>
          setTimeout(() => document.querySelector('.toast').remove(), 3000);
        </script>
      `, 404);
    }
    
    // Publish wallet update event
    messageBus.publish('wallet_updated', { wallet: { address, deleted: true } });
    
    return c.html(`
      <div class="toast success" style="position: fixed; top: 1rem; right: 1rem; z-index: 1000;">
        ✅ Wallet deleted successfully
      </div>
      <script>
        setTimeout(() => {
          document.querySelector('.toast').remove();
          htmx.trigger('#wallets-table', 'refresh');
        }, 2000);
      </script>
    `);
  } catch (error) {
    console.error('Error deleting wallet:', error);
    return c.html(`
      <div class="toast error" style="position: fixed; top: 1rem; right: 1rem; z-index: 1000;">
        ❌ Failed to delete wallet
      </div>
      <script>
        setTimeout(() => document.querySelector('.toast').remove(), 3000);
      </script>
    `, 500);
  }
});


// HTMX endpoint for toggling wallet status - returns only the updated row
app.patch('/htmx/wallets/:address/toggle', async (c: Context) => {
  try {
    const address = c.req.param('address');
    const updatedWallet = await toggleWalletStatus(address);
    
    if (!updatedWallet) {
      return c.html('<div class="error">Wallet not found</div>', 404);
    }
    
    // Return only the updated row HTML
    const rowHtml = walletRowPartial(updatedWallet);
    return c.html(rowHtml);
  } catch (error) {
    console.error('Error toggling wallet status:', error);
    return c.html('<div class="error">Failed to toggle wallet status</div>', 500);
  }
});

// HTMX endpoints for wallets - return HTML fragments
app.get('/htmx/partials/wallets-table', async (c: Context) => {
  try {
    console.log('wallets-table endpoint called');
    const { sortBy, sortOrder, tags } = c.req.query();
    console.log('[Server] Query params:', { sortBy, sortOrder, tags });
    console.log('[Server] tags type:', typeof tags, 'tags value:', JSON.stringify(tags));
    const validSortOrder = sortOrder === 'asc' ? 'asc' : 'desc';
    
    // Get all wallets with trader info to extract all available tags
    console.log('Fetching all wallets with trader info...');
    const allWallets = await getWalletsWithTraderInfo();
    console.log('All wallets fetched:', allWallets?.length || 0);
    
    // Safety check - should not be needed now, but keeping for robustness
    if (!Array.isArray(allWallets)) {
      console.error('getWalletsWithTraderInfo() did not return an array:', typeof allWallets, allWallets);
      return c.html(walletsTableErrorPartial());
    }
    
    const allTags = new Set<string>();
    allWallets.forEach(wallet => {
      if (wallet.trader_tags && Array.isArray(wallet.trader_tags)) {
        wallet.trader_tags.forEach(tag => allTags.add(tag));
      }
    });
    
    // Parse selected tags
    let selectedTags: string[] = [];
    if (tags === undefined) {
      // No filter specified = show all wallets (all tags selected)
      selectedTags = Array.from(allTags);
    } else if (tags === '') {
      // Empty string = no tags selected = show no wallets
      selectedTags = [];
    } else {
      // Parse the tags parameter
      selectedTags = tags.split(',').filter(Boolean);
    }
    
    // Get filtered wallets with trader info
    const wallets = selectedTags.length > 0 
      ? await getWalletsWithTraderInfo(sortBy, validSortOrder, selectedTags)
      : []; // No tags selected = show no wallets
    
    const tableHtml = walletsTablePartial(wallets, sortBy, validSortOrder, selectedTags, Array.from(allTags).sort());
    return c.html(tableHtml);
  } catch (error) {
    console.error('Error fetching wallets for HTMX:', error);
    return c.html(walletsTableErrorPartial());
  }
});


// Partial fragments
app.get('/htmx/partials/:partial', (c: Context) => {
  const partialName = c.req.param('partial');
  const html = getPartial(partialName);
  
  if (html) {
    return c.html(html);
  } else {
    return c.notFound();
  }
});

// Initialize services
let initialized = false;
async function initialize() {
  if (initialized) return;
  initialized = true;
  
  // Setup static file serving
  await setupStaticFiles();
  
  // Small delay to ensure database is ready
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  // Start backend services
  console.log('🚀 Starting Sonar Platform...');
  await serviceManager.start();
}

// Start initialization
initialize().catch(error => {
  console.error('💥 Fatal error initializing services:', error);
});

// Determine port
const port = Number(ENV.PORT) || 3005;
console.log(`🌐 Frontend server starting on port ${port}`);
console.log(`📊 Dashboard: http://localhost:${port}`);

// Export for Bun runtime
export default {
  port,
  fetch: app.fetch,
  idleTimeout: 255 // Maximum allowed timeout for Bun (about 4.25 minutes)
};