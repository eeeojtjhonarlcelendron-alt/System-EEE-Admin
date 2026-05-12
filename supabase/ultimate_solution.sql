-- Ultimate solution: Use TRUNCATE to bypass all foreign key issues
-- This completely empties the riders table and repopulates it
-- Run this in Supabase SQL Editor

-- Step 1: Backup riders with valid deployment dates to a temporary table
CREATE TEMPORARY TABLE valid_riders AS
SELECT * FROM riders WHERE deployment_date IS NOT NULL;

-- Step 2: Truncate the entire riders table (removes all records including NULL ones)
TRUNCATE TABLE riders;

-- Step 3: Restore only riders with valid deployment dates
INSERT INTO riders 
SELECT * FROM valid_riders;

-- Step 4: Clean up temporary table
DROP TABLE IF EXISTS valid_riders;

-- Step 5: Verify the result
SELECT 
    COUNT(*) as total_riders,
    COUNT(CASE WHEN deployment_date IS NULL THEN 1 END) as null_deployment_dates_remaining
FROM riders;
