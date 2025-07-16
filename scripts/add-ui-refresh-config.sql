-- Add ui_refresh_config column to service_configs table
ALTER TABLE service_configs 
ADD COLUMN IF NOT EXISTS ui_refresh_config JSONB DEFAULT '{
    "balance_interval_minutes": 5,
    "auto_refresh_enabled": true,
    "pause_on_activity": true,
    "show_refresh_indicators": true
}'::jsonb;

-- Insert default configuration for frontend-ui
INSERT INTO service_configs (service_name, ui_refresh_config)
VALUES ('frontend-ui', '{
    "balance_interval_minutes": 5,
    "auto_refresh_enabled": true,
    "pause_on_activity": true,
    "show_refresh_indicators": true
}'::jsonb)
ON CONFLICT (service_name) DO UPDATE SET
    ui_refresh_config = EXCLUDED.ui_refresh_config;