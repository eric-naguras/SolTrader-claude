import { toggleSwitch } from './toggle-switch.js';

interface LogCategory {
  key: string;
  label: string;
  description: string;
  emoji: string;
}

const logCategories: LogCategory[] = [
  { key: 'connection', label: 'Connection Events', description: 'WebSocket connections, disconnections, reconnects', emoji: '🔌' },
  { key: 'wallet', label: 'Wallet Activity', description: 'Wallet loading, tracking changes', emoji: '👛' },
  { key: 'trade', label: 'Trade Detection', description: 'Entry/exit trades, amounts, tokens', emoji: '📊' },
  { key: 'multiWhale', label: 'Multi-Whale Alerts', description: 'Multiple whales in same token', emoji: '🎯' },
  { key: 'transaction', label: 'Transaction Processing', description: 'Raw transaction details, parsing', emoji: '💾' },
  { key: 'dataFlow', label: 'Data Flow', description: 'WebSocket messages, queue status', emoji: '📡' },
  { key: 'health', label: 'Health & Performance', description: 'Heartbeats, latency, memory usage', emoji: '❤️' },
  { key: 'debug', label: 'Debug Information', description: 'Detailed errors, raw data, state changes', emoji: '🐛' }
];

export const loggingConfigTemplate = (config: Record<string, boolean>) => `
  <article>
    <header>
      <h3>Log Categories</h3>
      <p>Toggle which events appear in the console logs</p>
    </header>
    
    <form hx-put="/htmx/logging-config" hx-trigger="change" hx-target="#toast-container">
      <div class="logging-grid">
        ${logCategories.map(category => `
          <div class="log-category-item">
            ${toggleSwitch({
              name: category.key,
              checked: config[category.key] || false,
              label: `${category.emoji} ${category.label}`,
              description: category.description
            })}
          </div>
        `).join('')}
      </div>
      
      <footer>
        <div class="grid">
          <button type="button" class="secondary" disabled>Save as Preset (Coming Soon)</button>
          <button type="button" class="outline" onclick="location.reload()">Reset to Defaults</button>
        </div>
      </footer>
    </form>
  </article>

  <style>
    .logging-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(350px, 1fr));
      gap: 0.5rem;
      margin: 1rem 0 2rem 0;
    }

    .log-category-item {
      padding: 0.25rem;
      border-radius: 4px;
      background: var(--pico-background-color);
    }
  </style>
`;

// Keep the old partial for backwards compatibility if needed
export const loggingConfigPartial = () => `<div 
    hx-get="/htmx/logging-config" 
    hx-trigger="load" 
    hx-swap="outerHTML"
    id="logging-config-container">
    <article aria-busy="true">Loading configuration...</article>
</div>

<div id="toast-container"></div>`;