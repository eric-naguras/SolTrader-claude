-- Setup webhooks for Supabase database changes
-- Run this in Supabase SQL Editor

-- Enable the http extension for making HTTP requests
CREATE EXTENSION IF NOT EXISTS http;

-- Create webhook function for trade_signals
CREATE OR REPLACE FUNCTION notify_signal_webhook()
RETURNS TRIGGER AS $$
DECLARE
  webhook_url TEXT := 'http://localhost:3000/webhooks/db-changes';
  payload JSON;
BEGIN
  -- Build the payload
  payload := json_build_object(
    'table', 'trade_signals',
    'type', TG_OP,
    'record', row_to_json(NEW)
  );

  -- Make HTTP request to webhook
  PERFORM http_post(
    webhook_url,
    payload::TEXT,
    'application/json'
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create webhook function for whale_trades  
CREATE OR REPLACE FUNCTION notify_trade_webhook()
RETURNS TRIGGER AS $$
DECLARE
  webhook_url TEXT := 'http://localhost:3000/webhooks/db-changes';
  payload JSON;
BEGIN
  -- Build the payload
  payload := json_build_object(
    'table', 'whale_trades',
    'type', TG_OP,
    'record', row_to_json(NEW)
  );

  -- Make HTTP request to webhook
  PERFORM http_post(
    webhook_url,
    payload::TEXT,
    'application/json'
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers
DROP TRIGGER IF EXISTS trade_signals_webhook_trigger ON trade_signals;
CREATE TRIGGER trade_signals_webhook_trigger
  AFTER INSERT ON trade_signals
  FOR EACH ROW
  EXECUTE FUNCTION notify_signal_webhook();

DROP TRIGGER IF EXISTS whale_trades_webhook_trigger ON whale_trades;
CREATE TRIGGER whale_trades_webhook_trigger
  AFTER INSERT ON whale_trades
  FOR EACH ROW
  EXECUTE FUNCTION notify_trade_webhook();

-- Test webhook function (for manual testing)
CREATE OR REPLACE FUNCTION test_webhook()
RETURNS TEXT AS $$
DECLARE
  webhook_url TEXT := 'http://localhost:3000/webhooks/db-changes';
  response HTTP_RESPONSE;
  test_payload JSON;
BEGIN
  test_payload := json_build_object(
    'table', 'test',
    'type', 'TEST',
    'record', json_build_object('message', 'Webhook test from Supabase')
  );

  response := http_post(
    webhook_url,
    test_payload::TEXT,
    'application/json'
  );

  RETURN 'Status: ' || response.status || ', Content: ' || response.content;
END;
$$ LANGUAGE plpgsql;

-- Example: SELECT test_webhook();

-- Create webhook function for tracked_wallets changes
CREATE OR REPLACE FUNCTION notify_wallet_change_webhook()
RETURNS TRIGGER AS $$
DECLARE
  webhook_url TEXT := 'http://localhost:4001/webhooks/wallet-changes'; -- Webhook relay port
  payload JSON;
BEGIN
  -- Build the payload
  payload := json_build_object(
    'table', 'tracked_wallets',
    'type', TG_OP,
    'record', CASE 
      WHEN TG_OP = 'DELETE' THEN row_to_json(OLD)
      ELSE row_to_json(NEW)
    END,
    'old_record', CASE 
      WHEN TG_OP = 'UPDATE' THEN row_to_json(OLD)
      ELSE NULL
    END
  );

  -- Make HTTP request to webhook
  PERFORM http_post(
    webhook_url,
    payload::TEXT,
    'application/json'
  );

  RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for tracked_wallets changes
DROP TRIGGER IF EXISTS tracked_wallets_webhook_trigger ON tracked_wallets;
CREATE TRIGGER tracked_wallets_webhook_trigger
  AFTER INSERT OR UPDATE OR DELETE ON tracked_wallets
  FOR EACH ROW
  EXECUTE FUNCTION notify_wallet_change_webhook();

-- Create webhook function for service_configs changes
CREATE OR REPLACE FUNCTION notify_config_change_webhook()
RETURNS TRIGGER AS $$
DECLARE
  webhook_url TEXT := 'http://localhost:4001/webhooks/config-changes'; -- Webhook relay port
  payload JSON;
BEGIN
  -- Build the payload
  payload := json_build_object(
    'table', 'service_configs',
    'type', TG_OP,
    'record', row_to_json(NEW),
    'old_record', CASE 
      WHEN TG_OP = 'UPDATE' THEN row_to_json(OLD)
      ELSE NULL
    END
  );

  -- Make HTTP request to webhook
  PERFORM http_post(
    webhook_url,
    payload::TEXT,
    'application/json'
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for service_configs changes
DROP TRIGGER IF EXISTS service_configs_webhook_trigger ON service_configs;
CREATE TRIGGER service_configs_webhook_trigger
  AFTER UPDATE ON service_configs
  FOR EACH ROW
  EXECUTE FUNCTION notify_config_change_webhook();