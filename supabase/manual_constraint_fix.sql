-- Manual fix for specific foreign key constraint error
-- Delete the specific fuel transaction record that's blocking the deletion
-- Run this in Supabase SQL Editor

-- Step 1: Find the specific fuel transaction causing the constraint error
SELECT 
    ft.id as fuel_transaction_id,
    ft.rider_id,
    r.created_at,
    r.rider_name
FROM fuel_transactions ft
JOIN riders r ON ft.rider_id::text = r.rider_id::text
WHERE r.deployment_date IS NULL
ORDER BY r.created_at DESC
LIMIT 10;

-- Step 2: Delete the specific fuel transaction mentioned in the error
-- Replace '6d7c757d-430f-4041-90dc-6e01f0531ee8' with the actual ID from your error message
DELETE FROM fuel_transactions 
WHERE id = '6d7c757d-430f-4041-90dc-6e01f0531ee8';

-- Step 3: Now try to delete riders with NULL deployment dates
DELETE FROM riders 
WHERE deployment_date IS NULL;

-- Step 4: Verify complete deletion
SELECT 
    COUNT(*) as riders_remaining,
    COUNT(CASE WHEN deployment_date IS NULL THEN 1 END) as null_deployment_dates_remaining
FROM riders;
