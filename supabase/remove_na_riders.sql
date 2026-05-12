-- Script to remove riders with N/A deployment dates from Supabase
-- Run this in Supabase SQL Editor

-- First, let's see which riders have deployment issues
SELECT 
    rider_id,
    rider_name,
    deployment_date,
    last_active,
    operator_hub,
    status,
    CASE 
        WHEN deployment_date IS NULL THEN 'NULL'
        WHEN deployment_date < '1900-01-01' THEN 'Invalid Date'
        ELSE 'Valid'
    END as date_status
FROM riders 
WHERE deployment_date IS NULL OR deployment_date < '1900-01-01'
ORDER BY deployment_date;

-- Alternative: Find riders who might have invalid deployment dates
-- Check for very old dates or NULL values
SELECT 
    COUNT(*) as total_riders,
    COUNT(CASE WHEN deployment_date IS NULL THEN 1 END) as null_dates,
    COUNT(CASE WHEN deployment_date < '1900-01-01' THEN 1 END) as invalid_dates
FROM riders;

-- Delete riders with NULL deployment dates
-- WARNING: This will permanently delete these records!
-- Uncomment the line below after reviewing the results above

-- DELETE FROM riders WHERE deployment_date IS NULL;

-- Delete riders with invalid deployment dates (before 1900)
-- WARNING: This will permanently delete these records!
-- Uncomment the line below after reviewing the results above

-- DELETE FROM riders WHERE deployment_date < '1900-01-01';

-- After deletion, verify cleanup
SELECT 
    COUNT(*) as total_riders,
    COUNT(CASE WHEN deployment_date IS NULL THEN 1 END) as null_dates_remaining,
    COUNT(CASE WHEN deployment_date < '1900-01-01' THEN 1 END) as invalid_dates_remaining
FROM riders;
