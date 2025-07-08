-- Migration: 003_seed_data.sql
-- Description: Initial seed data for testing Phase 1
-- Date: 2025-01-07

-- Insert some well-known whale wallets for testing
INSERT INTO tracked_wallets (address, alias, is_active, tags) VALUES
    ('5xoBq7f3bLZzC1SUAo9GiTBJyDoku8C5WvFWJRgKTYCr', 'Test Whale 1', TRUE, ARRAY['test', 'whale']),
    ('8AKJHSLJf3JfkDJ39fjJSDFjksjdf93jfJFKDJ39fSD', 'Test Whale 2', TRUE, ARRAY['test', 'whale']),
    ('9BKJHSLJf3JfkDJ39fjJSDFjksjdf93jfJFKDJ39fTE', 'Test Whale 3', TRUE, ARRAY['test', 'whale'])
ON CONFLICT (address) DO NOTHING;

-- Insert some common SPL tokens for reference
INSERT INTO tokens (address, symbol, name, decimals) VALUES
    ('So11111111111111111111111111111111111111112', 'SOL', 'Wrapped SOL', 9),
    ('EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v', 'USDC', 'USD Coin', 6),
    ('Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB', 'USDT', 'Tether USD', 6),
    ('DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263', 'BONK', 'Bonk', 5),
    ('7vfCXTUXx5WJV5JADk17DUJ4ksgau7utNKj4b963voxs', 'ETH', 'Ether (Portal)', 8)
ON CONFLICT (address) DO NOTHING;

-- Insert additional signal rules for different strategies
INSERT INTO signal_rules (name, min_whales, time_window_hours, min_total_sol, is_active) VALUES
    ('Aggressive Signal', 2, 1, 5.0, TRUE),
    ('Conservative Signal', 5, 2, 50.0, TRUE),
    ('Quick Scalp', 2, 0.5, 3.0, FALSE)
ON CONFLICT DO NOTHING;