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