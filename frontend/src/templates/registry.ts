import { activeSignalsPartial } from './partials/active-signals';
import { loggingConfigPartial } from './partials/logging-config';
import { openPositionsPartial } from './partials/open-positions';
import { recentTradesPartial } from './partials/recent-trades';
import { statsPartial } from './partials/stats';

// Registry of all partial templates
export const partialRegistry: Record<string, () => string> = {
  'active-signals': activeSignalsPartial,
  'logging-config': loggingConfigPartial,
  'open-positions': openPositionsPartial,
  'recent-trades': recentTradesPartial,
  'stats': statsPartial,
  // wallets-table is handled by dedicated server endpoint at /htmx/partials/wallets-table
};

// Helper function to get a partial by name
export const getPartial = (name: string): string | null => {
  const partial = partialRegistry[name];
  return partial ? partial() : null;
};