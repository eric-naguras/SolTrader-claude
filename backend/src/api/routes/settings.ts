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

// Get UI refresh configuration
settingsRoutes.get('/ui', async (c) => {
  const { data, error } = await supabase
    .from('service_configs')
    .select('ui_refresh_config')
    .eq('service_name', 'frontend-ui')
    .single();

  if (error && error.code !== 'PGRST116') { // Ignore "not found" error
    return c.json({ error: error.message }, 500);
  }

  // Return default config if not found
  const defaultConfig = {
    balance_interval_minutes: 5,
    auto_refresh_enabled: true,
    pause_on_activity: true,
    show_refresh_indicators: true
  };

  return c.json({ 
    ui_refresh_config: data?.ui_refresh_config || defaultConfig 
  });
});

// Update UI refresh configuration
settingsRoutes.put('/ui', async (c) => {
  const body = await c.req.json();
  const { ui_refresh_config } = body;

  if (!ui_refresh_config) {
    return c.json({ error: 'ui_refresh_config required' }, 400);
  }

  // Validate the configuration
  const { 
    balance_interval_minutes, 
    auto_refresh_enabled, 
    pause_on_activity, 
    show_refresh_indicators 
  } = ui_refresh_config;

  // Validation rules
  if (balance_interval_minutes < 1 || balance_interval_minutes > 60) {
    return c.json({ error: 'balance_interval_minutes must be between 1 and 60' }, 400);
  }

  if (typeof auto_refresh_enabled !== 'boolean') {
    return c.json({ error: 'auto_refresh_enabled must be a boolean' }, 400);
  }

  if (typeof pause_on_activity !== 'boolean') {
    return c.json({ error: 'pause_on_activity must be a boolean' }, 400);
  }

  if (typeof show_refresh_indicators !== 'boolean') {
    return c.json({ error: 'show_refresh_indicators must be a boolean' }, 400);
  }

  const { data, error } = await supabase
    .from('service_configs')
    .upsert({
      service_name: 'frontend-ui',
      ui_refresh_config,
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