-- Example demonstrating the time_window_hours fix
-- This shows how the updated schema allows for flexible time windows

-- Example 1: The original problematic insert now works
INSERT INTO signal_rules (name, min_whales, time_window_hours, min_total_sol, is_active) VALUES
    ('Quick Scalp', 2, 0.5, 3.0, FALSE);

-- Example 2: Various time windows that are now possible
INSERT INTO signal_rules (name, min_whales, time_window_hours, min_total_sol, is_active) VALUES
    ('Ultra Fast', 3, 0.25, 5.0, TRUE),     -- 15 minutes
    ('Standard', 3, 1.0, 10.0, TRUE),       -- 1 hour
    ('Extended', 5, 2.5, 25.0, TRUE),       -- 2.5 hours
    ('Daily', 10, 24.0, 100.0, FALSE);      -- 24 hours

-- Example 3: How the signal processor uses these values
-- This query simulates what the signal processor function does
SELECT 
    name,
    time_window_hours,
    -- This is the key calculation that needed to work with decimals
    NOW() - INTERVAL '1 hour' * time_window_hours as cutoff_time,
    -- Show it in a human-readable format
    (time_window_hours * 60)::INTEGER || ' minutes' as time_window_display
FROM signal_rules
WHERE name IN ('Quick Scalp', 'Ultra Fast', 'Standard')
ORDER BY time_window_hours;

-- Expected output:
-- name         | time_window_hours | cutoff_time              | time_window_display
-- Ultra Fast   | 0.25             | 2025-01-07 02:32:00      | 15 minutes
-- Quick Scalp  | 0.50             | 2025-01-07 02:17:00      | 30 minutes  
-- Standard     | 1.00             | 2025-01-07 01:47:00      | 60 minutes

-- Example 4: Business scenarios this enables
/*
Use Cases:
1. Quick Scalp (0.5 hours): Detect rapid coordinated buying for immediate scalping opportunities
2. Ultra Fast (0.25 hours): Catch coordinated buying within 15 minutes for high-frequency strategies  
3. Micro windows (0.1 hours): 6-minute windows for detecting coordinated entries
4. Extended periods (4.5 hours): Longer-term accumulation patterns

This flexibility allows traders to configure detection windows that match their trading style
and market conditions, rather than being limited to whole-hour increments.
*/