-- Script to update deployment dates in riders table from performance records
-- Run this in Supabase SQL Editor

-- First, let's see current state
SELECT 
    COUNT(*) as total_riders,
    COUNT(CASE WHEN deployment_date IS NULL THEN 1 END) as null_deployment_dates
FROM riders;

-- Update deployment_date for riders based on their earliest performance record
UPDATE riders 
SET deployment_date = subquery.earliest_date
FROM (
    SELECT 
        p.rider_id,
        MIN(p.date) as earliest_date
    FROM performance_records p
    WHERE p.date IS NOT NULL
    GROUP BY p.rider_id
) subquery
WHERE riders.rider_id = subquery.rider_id
AND riders.deployment_date IS NULL;

-- Update last_active for riders based on their latest performance record  
UPDATE riders 
SET last_active = subquery.latest_date
FROM (
    SELECT 
        p.rider_id,
        MAX(p.date) as latest_date
    FROM performance_records p
    WHERE p.date IS NOT NULL
    GROUP BY p.rider_id
) subquery
WHERE riders.rider_id = subquery.rider_id
AND (riders.last_active IS NULL OR riders.last_active < subquery.latest_date);

-- Verify updates
SELECT 
    COUNT(*) as total_riders,
    COUNT(CASE WHEN deployment_date IS NULL THEN 1 END) as null_deployment_dates_remaining,
    COUNT(CASE WHEN last_active IS NULL THEN 1 END) as null_last_active_remaining,
    COUNT(CASE WHEN deployment_date IS NOT NULL AND last_active IS NOT NULL THEN 1 END) as complete_records
FROM riders;

-- Show sample of updated records
SELECT 
    rider_id,
    rider_name,
    deployment_date,
    last_active,
    operator_hub
FROM riders 
WHERE deployment_date IS NOT NULL
ORDER BY deployment_date DESC
LIMIT 10;
