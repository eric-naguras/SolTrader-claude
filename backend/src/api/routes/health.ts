import { Hono } from 'hono';
import { supabase } from '../../lib/supabase.js';

export const healthRoutes = new Hono();

healthRoutes.get('/', async (c) => {
  const checks = {
    api: 'healthy',
    database: 'unknown',
    services: {
      whaleWatcher: 'unknown',
      notifier: 'unknown',
      executor: 'unknown'
    },
    timestamp: new Date().toISOString()
  };

  // Check database connection
  try {
    const { error } = await supabase.from('tracked_wallets').select('count').limit(1);
    checks.database = error ? 'unhealthy' : 'healthy';
  } catch (e) {
    checks.database = 'unhealthy';
  }

  // TODO: Check service health via database heartbeats

  const allHealthy = checks.database === 'healthy';
  
  return c.json(checks, allHealthy ? 200 : 503);
});