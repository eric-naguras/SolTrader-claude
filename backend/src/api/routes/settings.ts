import { Hono } from 'hono';
import { supabase, type ServiceConfig } from '../../lib/supabase.js';

export const settingsRoutes = new Hono();

// Get logging configuration
settingsRoutes.get('/logging', async (c) => {
  const { data, error } = await supabase
    .from('service_configs')
    .select('log_categories')
    .eq('service_name', 'whale-watcher')
    .single();

  if (error && error.code !== 'PGRST116') { // Ignore "not found" error
    return c.json({ error: error.message }, 500);
  }

  // Return default config if not found
  const defaultConfig = {
    connection: true,
    wallet: true,
    trade: true,
    multiWhale: true,
    transaction: false,
    dataFlow: false,
    health: true,
    debug: false
  };

  return c.json({ 
    log_categories: data?.log_categories || defaultConfig 
  });
});

// Update logging configuration
settingsRoutes.put('/logging', async (c) => {
  const body = await c.req.json();
  const { log_categories } = body;

  if (!log_categories) {
    return c.json({ error: 'log_categories required' }, 400);
  }

  const { data, error } = await supabase
    .from('service_configs')
    .upsert({
      service_name: 'whale-watcher',
      log_categories,
      updated_at: new Date().toISOString()
    }, {
      onConflict: 'service_name'
    })
    .select()
    .single();

  if (error) {
    return c.json({ error: error.message }, 500);
  }

  return c.json({ 
    success: true,
    config: data 
  });
});

// Get all service configurations (for future use)
settingsRoutes.get('/', async (c) => {
  const { data, error } = await supabase
    .from('service_configs')
    .select('*')
    .order('service_name');

  if (error) {
    return c.json({ error: error.message }, 500);
  }

  return c.json({ configs: data });
});