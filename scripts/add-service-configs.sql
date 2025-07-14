-- Create service configuration table for dynamic settings
CREATE TABLE IF NOT EXISTS service_configs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    service_name TEXT NOT NULL UNIQUE,
    log_categories JSONB DEFAULT '{
        "connection": true,
        "wallet": true,
        "trade": true,
        "multiWhale": true,
        "transaction": false,
        "dataFlow": false,
        "health": true,
        "debug": false
    }'::jsonb,
    other_settings JSONB DEFAULT '{}'::jsonb,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create index for quick lookups
CREATE INDEX IF NOT EXISTS idx_service_configs_service_name ON service_configs(service_name);

-- Insert default configuration for whale-watcher
INSERT INTO service_configs (service_name, log_categories)
VALUES ('whale-watcher', '{
    "connection": true,
    "wallet": true,
    "trade": true,
    "multiWhale": true,
    "transaction": false,
    "dataFlow": false,
    "health": true,
    "debug": false
}'::jsonb)
ON CONFLICT (service_name) DO NOTHING;

-- Create trigger to update timestamp
CREATE OR REPLACE FUNCTION update_service_config_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_service_configs_timestamp
    BEFORE UPDATE ON service_configs
    FOR EACH ROW
    EXECUTE FUNCTION update_service_config_timestamp();

-- Enable real-time updates
ALTER TABLE service_configs REPLICA IDENTITY FULL;