-- Migration: 002_signal_processor.sql
-- Description: Signal generation function and trigger for Phase 1
-- Date: 2025-01-07

-- Signal generation function
CREATE OR REPLACE FUNCTION process_whale_trade()
RETURNS TRIGGER AS $$
DECLARE
    v_rule signal_rules;
    v_whale_count INTEGER;
    v_total_sol NUMERIC;
    v_signal_id UUID;
    v_whale_addresses TEXT[];
    v_token_info RECORD;
BEGIN
    -- Only process BUY trades
    IF NEW.trade_type != 'BUY' THEN
        RETURN NEW;
    END IF;

    -- Get token info if not already linked
    IF NEW.token_id IS NULL THEN
        SELECT id, symbol, name INTO v_token_info
        FROM tokens
        WHERE address = NEW.token_address;
        
        -- Update the trade with token_id if found
        IF v_token_info.id IS NOT NULL THEN
            NEW.token_id = v_token_info.id;
        END IF;
    END IF;

    -- Check each active rule
    FOR v_rule IN SELECT * FROM signal_rules WHERE is_active = TRUE LOOP
        -- Count unique whales and gather addresses buying this token within the time window
        SELECT 
            COUNT(DISTINCT wallet_address),
            COALESCE(SUM(sol_amount), 0),
            ARRAY_AGG(DISTINCT wallet_address)
        INTO v_whale_count, v_total_sol, v_whale_addresses
        FROM whale_trades
        WHERE token_address = NEW.token_address
            AND trade_type = 'BUY'
            AND trade_timestamp >= NOW() - INTERVAL '1 hour' * v_rule.time_window_hours;

        -- Check if rule conditions are met
        IF v_whale_count >= v_rule.min_whales AND v_total_sol >= v_rule.min_total_sol THEN
            -- Check if signal already exists for this token within the time window
            SELECT id INTO v_signal_id
            FROM trade_signals
            WHERE token_address = NEW.token_address
                AND status = 'OPEN'
                AND created_at >= NOW() - INTERVAL '1 hour' * v_rule.time_window_hours;

            -- Create new signal if none exists
            IF v_signal_id IS NULL THEN
                -- Log the signal generation
                RAISE NOTICE 'Generating signal for token % - % whales, % SOL', 
                    NEW.token_address, v_whale_count, v_total_sol;

                INSERT INTO trade_signals (
                    token_address,
                    token_id,
                    rule_id,
                    trigger_reason,
                    whale_count,
                    total_sol_amount,
                    metadata
                ) VALUES (
                    NEW.token_address,
                    NEW.token_id,
                    v_rule.id,
                    format('%s whales bought %s SOL worth in %s hours', 
                        v_whale_count, 
                        ROUND(v_total_sol, 2)::TEXT, 
                        v_rule.time_window_hours),
                    v_whale_count,
                    v_total_sol,
                    jsonb_build_object(
                        'triggering_trade', NEW.transaction_hash,
                        'rule_name', v_rule.name,
                        'whale_addresses', v_whale_addresses,
                        'token_symbol', v_token_info.symbol,
                        'token_name', v_token_info.name
                    )
                );
            END IF;
        END IF;
    END LOOP;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for signal processing
DROP TRIGGER IF EXISTS trigger_process_whale_trade ON whale_trades;
CREATE TRIGGER trigger_process_whale_trade
AFTER INSERT ON whale_trades
FOR EACH ROW EXECUTE FUNCTION process_whale_trade();

-- Insert default signal rule
INSERT INTO signal_rules (name, min_whales, time_window_hours, min_total_sol, is_active)
VALUES ('Default Rule', 3, 1, 10.0, TRUE)
ON CONFLICT DO NOTHING;