-- Script to delete riders with NULL deployment dates
-- Run this in Supabase SQL Editor

-- Check current state
SELECT 
    COUNT(*) as total_riders,
    COUNT(CASE WHEN deployment_date IS NULL THEN 1 END) as null_deployment_dates,
    COUNT(CASE WHEN deployment_date IS NOT NULL THEN 1 END) as valid_deployment_dates
FROM riders;

-- Show riders with NULL deployment dates (if any)
SELECT 
    rider_id,
    rider_name,
    deployment_date,
    last_active,
    operator_hub,
    status
FROM riders 
WHERE deployment_date IS NULL;

-- Delete riders with NULL deployment dates
-- WARNING: This will permanently delete these records!
-- Uncomment the line below after reviewing the results above

-- DELETE FROM riders WHERE deployment_date IS NULL;

-- Verify deletion
SELECT 
    COUNT(*) as total_riders_remaining,
    COUNT(CASE WHEN deployment_date IS NULL THEN 1 END) as null_deployment_dates_remaining
FROM riders;
