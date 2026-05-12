-- Script to safely delete riders with NULL deployment dates
-- Handles foreign key constraints by deleting dependent records first
-- Run this in Supabase SQL Editor

-- Check current state
SELECT 
    COUNT(*) as total_riders,
    COUNT(CASE WHEN deployment_date IS NULL THEN 1 END) as null_deployment_dates
FROM riders;

-- Show riders with NULL deployment dates that will be deleted
SELECT 
    r.rider_id,
    r.rider_name,
    r.deployment_date,
    ft.transaction_count
FROM riders r
LEFT JOIN (
    SELECT rider_id::text, COUNT(*) as transaction_count
    FROM fuel_transactions 
    GROUP BY rider_id::text
) ft ON r.rider_id::text = ft.rider_id
WHERE r.deployment_date IS NULL;

-- First, delete fuel transactions for riders with NULL deployment dates
DELETE FROM fuel_transactions 
WHERE rider_id::text IN (
    SELECT rider_id::text FROM riders WHERE deployment_date IS NULL
);

-- Now delete riders with NULL deployment dates
-- WARNING: This will permanently delete these records!
-- Uncomment the line below after reviewing the results above

-- DELETE FROM riders WHERE deployment_date IS NULL;

-- Verify deletion
SELECT 
    COUNT(*) as total_riders_remaining,
    COUNT(CASE WHEN deployment_date IS NULL THEN 1 END) as null_deployment_dates_remaining
FROM riders;
