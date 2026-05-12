-- Delete ALL fuel transactions for riders with NULL deployment dates
-- This removes all blocking records at once
-- Run this in Supabase SQL Editor

-- Step 1: Show how many fuel transactions will be deleted
SELECT 
    COUNT(*) as fuel_transactions_to_delete
FROM fuel_transactions ft
WHERE EXISTS (
    SELECT 1 FROM riders r 
    WHERE r.rider_id::text = ft.rider_id::text 
    AND r.deployment_date IS NULL
);

-- Step 2: Delete ALL fuel transactions for riders with NULL deployment dates
DELETE FROM fuel_transactions 
WHERE rider_id::text IN (
    SELECT rider_id::text FROM riders WHERE deployment_date IS NULL
);

-- Step 3: Verify fuel transactions are deleted
SELECT 
    COUNT(*) as remaining_fuel_transactions
FROM fuel_transactions ft
WHERE EXISTS (
    SELECT 1 FROM riders r 
    WHERE r.rider_id::text = ft.rider_id::text 
    AND r.deployment_date IS NULL
);

-- Step 4: Now delete riders with NULL deployment dates
DELETE FROM riders 
WHERE deployment_date IS NULL;

-- Step 5: Final verification
SELECT 
    COUNT(*) as riders_remaining,
    COUNT(CASE WHEN deployment_date IS NULL THEN 1 END) as null_deployment_dates_remaining
FROM riders;
