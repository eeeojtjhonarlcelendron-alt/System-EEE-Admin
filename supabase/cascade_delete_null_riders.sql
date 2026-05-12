-- Delete riders with NULL deployment dates using CASCADE
-- This will automatically delete dependent records
-- Run this in Supabase SQL Editor

-- Step 1: Show riders with NULL deployment dates (first 5)
SELECT 
    rider_id,
    rider_name,
    deployment_date,
    operator_hub
FROM riders 
WHERE deployment_date IS NULL
LIMIT 5;

-- Step 2: Count riders to delete
SELECT 
    COUNT(*) as riders_to_delete
FROM riders 
WHERE deployment_date IS NULL;

-- Step 3: Delete riders with CASCADE (this will delete dependent records automatically)
DELETE FROM riders 
WHERE deployment_date IS NULL
CASCADE;

-- Step 4: Verify complete deletion
SELECT 
    COUNT(*) as riders_remaining,
    COUNT(CASE WHEN deployment_date IS NULL THEN 1 END) as null_deployment_dates_remaining
FROM riders;
