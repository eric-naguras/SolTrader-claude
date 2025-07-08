# Fix for time_window_hours Column Type Mismatch

## Issue Description

The `time_window_hours` column in the `signal_rules` table was defined as `INTEGER` but the seed data included a decimal value (`0.5` for the "Quick Scalp" strategy). This caused a type mismatch error when trying to insert the seed data.

## Root Cause

- **Database Schema** (`001_initial_schema.sql`): Defined `time_window_hours INTEGER DEFAULT 1`
- **Seed Data** (`003_seed_data.sql`): Tried to insert `0.5` for "Quick Scalp" rule
- **PostgreSQL**: Cannot insert decimal values into INTEGER columns

## Solution

Changed the column type from `INTEGER` to `NUMERIC(5, 2)` to support decimal time windows while maintaining reasonable precision.

### Changes Made

1. **Database Schema** (`database/migrations/001_initial_schema.sql`):
   ```sql
   -- Before
   time_window_hours INTEGER DEFAULT 1,
   
   -- After  
   time_window_hours NUMERIC(5, 2) DEFAULT 1.0,
   ```

2. **OpenAPI Specification** (`api/openapi.yaml`):
   ```yaml
   # Before
   time_window_hours:
     type: integer
     minimum: 1
   
   # After
   time_window_hours:
     type: number
     format: double
     minimum: 0.1
   ```

## Business Justification

Supporting decimal time windows provides important business value:

- **Quick Scalp Strategy**: 0.5 hours (30 minutes) enables detection of rapid coordinated buying
- **Micro Strategies**: 0.25 hours (15 minutes) for high-frequency trading scenarios
- **Flexible Configuration**: Allows fine-tuning of detection windows for different market conditions

## Technical Compatibility

- ✅ **PostgreSQL INTERVAL arithmetic**: Works perfectly with decimal values
- ✅ **Database functions**: Existing `INTERVAL '1 hour' * v_rule.time_window_hours` continues to work
- ✅ **TypeScript types**: Already used `number` which supports decimals
- ✅ **Precision**: `NUMERIC(5, 2)` supports up to 999.99 hours with 2 decimal places

## Testing

Run the test script to verify the fix:

```bash
psql -d your_database -f test_time_window_fix.sql
```

## Migration Notes

For existing databases:
1. This change is backwards compatible (integers are valid NUMERIC values)
2. Existing integer values will continue to work
3. New decimal values can now be inserted

## Examples of Valid Values

- `1` or `1.0` - 1 hour
- `0.5` - 30 minutes  
- `0.25` - 15 minutes
- `0.17` - ~10 minutes
- `2.5` - 2 hours 30 minutes
- `24.0` - 24 hours (maximum recommended)

## References

- Original issue: GitHub PR #2 comment by @Copilot
- Signal processor function: `database/migrations/002_signal_processor.sql`
- API documentation: `api/openapi.yaml`