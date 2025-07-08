-- Test script to verify the time_window_hours column fix
-- This script tests that the column accepts decimal values and works correctly with PostgreSQL INTERVAL

-- Test table creation with NUMERIC column
CREATE TEMP TABLE test_signal_rules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    min_whales INTEGER DEFAULT 3,
    time_window_hours NUMERIC(5, 2) DEFAULT 1.0,
    min_total_sol NUMERIC(20, 9) DEFAULT 10,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Test inserting decimal values (this should work now)
INSERT INTO test_signal_rules (name, min_whales, time_window_hours, min_total_sol, is_active) VALUES
    ('Aggressive Signal', 2, 1, 5.0, TRUE),
    ('Conservative Signal', 5, 2, 50.0, TRUE),
    ('Quick Scalp', 2, 0.5, 3.0, FALSE),
    ('Ultra Quick', 3, 0.25, 15.0, TRUE);

-- Test that INTERVAL arithmetic works with decimal hours
SELECT 
    name,
    time_window_hours,
    -- Test the INTERVAL multiplication that's used in the signal processor
    NOW() - INTERVAL '1 hour' * time_window_hours as time_cutoff,
    -- Show the actual interval for verification
    INTERVAL '1 hour' * time_window_hours as window_interval
FROM test_signal_rules
ORDER BY time_window_hours;

-- Verify data types
SELECT 
    column_name, 
    data_type, 
    numeric_precision,
    numeric_scale
FROM information_schema.columns 
WHERE table_name = 'test_signal_rules' 
AND column_name = 'time_window_hours';

-- Test edge cases
INSERT INTO test_signal_rules (name, min_whales, time_window_hours, min_total_sol, is_active) VALUES
    ('10 Minutes', 2, 0.17, 1.0, TRUE),   -- 10 minutes ≈ 0.17 hours
    ('5 Minutes', 4, 0.08, 2.0, TRUE);    -- 5 minutes ≈ 0.08 hours

-- Show final results
SELECT name, time_window_hours, 
       (time_window_hours * 60)::INTEGER as minutes,
       INTERVAL '1 hour' * time_window_hours as interval_display
FROM test_signal_rules 
ORDER BY time_window_hours;

DROP TABLE test_signal_rules;