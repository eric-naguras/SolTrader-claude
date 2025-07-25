-- Migration to add service enable/disable settings
-- This allows individual services to be started/stopped from the UI
-- and persist their state across server restarts

-- Add enabled column to service_configs table
ALTER TABLE service_configs
ADD COLUMN IF NOT EXISTS enabled boolean NOT NULL DEFAULT true;

-- Update existing service configs to be enabled by default
UPDATE service_configs SET enabled = true WHERE enabled IS NULL;

-- Insert default service configurations if they don't exist
INSERT INTO service_configs (service_name, enabled, log_categories, other_settings, ui_refresh_config)
VALUES 
    ('WalletWatcher', true, 
     '{"debug": false, "trade": true, "connection": true, "wallet": true, "multiWhale": true, "transaction": true, "dataFlow": false, "health": false}'::jsonb,
     '{}'::jsonb,
     '{}'::jsonb),
    ('PaperTrader', true,
     '{"debug": false, "trade": true, "connection": false, "wallet": false, "multiWhale": false, "transaction": false, "dataFlow": false, "health": false}'::jsonb,
     '{}'::jsonb,
     '{}'::jsonb),
    ('SignalAnalyzer', true,
     '{"debug": false, "trade": true, "connection": false, "wallet": false, "multiWhale": false, "transaction": false, "dataFlow": false, "health": false}'::jsonb,
     '{}'::jsonb,
     '{}'::jsonb),
    ('SignalTrader', false,  -- Disabled by default for safety
     '{"debug": false, "trade": true, "connection": false, "wallet": false, "multiWhale": false, "transaction": false, "dataFlow": false, "health": false}'::jsonb,
     '{}'::jsonb,
     '{}'::jsonb)
ON CONFLICT (service_name) DO UPDATE
SET enabled = EXCLUDED.enabled;

-- Create a function to notify when service enabled status changes
CREATE OR REPLACE FUNCTION notify_service_state_change()
RETURNS trigger AS $$
BEGIN
    IF OLD.enabled IS DISTINCT FROM NEW.enabled THEN
        PERFORM pg_notify('service_state_changed', 
            json_build_object(
                'service_name', NEW.service_name,
                'enabled', NEW.enabled,
                'timestamp', NOW()
            )::text
        );
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for service state changes
DROP TRIGGER IF EXISTS service_state_change_trigger ON service_configs;
CREATE TRIGGER service_state_change_trigger
AFTER UPDATE ON service_configs
FOR EACH ROW
EXECUTE FUNCTION notify_service_state_change();

-- Add comment for documentation
COMMENT ON COLUMN service_configs.enabled IS 'Whether the service should be started automatically. Services can be enabled/disabled from the UI settings page.';