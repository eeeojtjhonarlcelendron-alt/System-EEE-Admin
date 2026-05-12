-- Thorough approach to delete riders with NULL deployment dates
-- Ensures ALL dependent records are removed completely
-- Run this in Supabase SQL Editor

-- Step 1: Check what riders have NULL deployment dates
SELECT 
    rider_id,
    rider_name,
    deployment_date,
    operator_hub
FROM riders 
WHERE deployment_date IS NULL;

-- Step 2: Check if any fuel transactions still exist for these riders
SELECT 
    r.rider_id,
    r.rider_name,
    COUNT(ft.id) as fuel_transaction_count
FROM riders r
LEFT JOIN fuel_transactions ft ON r.rider_id::text = ft.rider_id::text
WHERE r.deployment_date IS NULL
GROUP BY r.rider_id, r.rider_name
ORDER BY fuel_transaction_count DESC;

-- Step 3: Force delete all fuel transactions for these riders using EXISTS
DELETE FROM fuel_transactions ft
WHERE EXISTS (
    SELECT 1 FROM riders r 
    WHERE r.rider_id::text = ft.rider_id::text 
    AND r.deployment_date IS NULL
);

-- Step 4: Verify fuel transactions are deleted
SELECT 
    COUNT(*) as remaining_fuel_transactions
FROM fuel_transactions ft
WHERE EXISTS (
    SELECT 1 FROM riders r 
    WHERE r.rider_id = ft.rider_id 
    AND r.deployment_date IS NULL
);

-- Step 5: Now delete riders
DELETE FROM riders 
WHERE deployment_date IS NULL;

-- Step 6: Final verification
SELECT 
    COUNT(*) as riders_remaining,
    COUNT(CASE WHEN deployment_date IS NULL THEN 1 END) as null_deployment_dates_remaining
FROM riders;
