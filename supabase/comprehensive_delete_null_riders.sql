-- Comprehensive script to delete riders with NULL deployment dates
-- Handles ALL foreign key constraints by deleting from all dependent tables
-- Run this in Supabase SQL Editor

-- Check current state
SELECT 
    COUNT(*) as riders_to_delete
FROM riders 
WHERE deployment_date IS NULL;

-- Delete from all tables that reference riders (in correct order)
-- 1. Delete from fuel_transactions first
DELETE FROM fuel_transactions 
WHERE rider_id::text IN (
    SELECT rider_id::text FROM riders WHERE deployment_date IS NULL
);

-- 2. Delete from any other tables that might reference riders
-- (Uncomment if these tables exist and have foreign key constraints)
-- DELETE FROM performance_records WHERE rider_id::text IN (SELECT rider_id::text FROM riders WHERE deployment_date IS NULL);
-- DELETE FROM kpi_records WHERE rider_id::text IN (SELECT rider_id::text FROM riders WHERE deployment_date IS NULL);

-- 3. Finally delete the riders
DELETE FROM riders 
WHERE deployment_date IS NULL;

-- Verify complete deletion
SELECT 
    COUNT(*) as riders_remaining,
    COUNT(CASE WHEN deployment_date IS NULL THEN 1 END) as null_deployment_dates_remaining
FROM riders;

-- Check if any orphaned records remain
SELECT 'fuel_transactions' as table_name, COUNT(*) as orphaned_records
FROM fuel_transactions 
WHERE rider_id NOT IN (SELECT rider_id FROM riders)
UNION ALL
SELECT 'performance_records' as table_name, COUNT(*) as orphaned_records
FROM performance_records 
WHERE rider_id NOT IN (SELECT rider_id FROM riders)
UNION ALL
SELECT 'kpi_records' as table_name, COUNT(*) as orphaned_records
FROM kpi_records 
WHERE rider_id NOT IN (SELECT rider_id FROM riders);
