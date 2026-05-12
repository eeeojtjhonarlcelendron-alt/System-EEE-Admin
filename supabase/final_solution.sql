-- Final solution: Remove foreign key constraint, delete riders, then restore constraint
-- This is the most reliable approach
-- Run this in Supabase SQL Editor

-- Step 1: Drop the foreign key constraint temporarily
ALTER TABLE fuel_transactions DROP CONSTRAINT fuel_transactions_rider_id_fkey;

-- Step 2: Delete riders with NULL deployment dates
DELETE FROM riders WHERE deployment_date IS NULL;

-- Step 3: Re-create the foreign key constraint
ALTER TABLE fuel_transactions 
ADD CONSTRAINT fuel_transactions_rider_id_fkey 
FOREIGN KEY (rider_id) REFERENCES riders(rider_id) ON DELETE CASCADE;

-- Step 4: Verify complete deletion
SELECT 
    COUNT(*) as riders_remaining,
    COUNT(CASE WHEN deployment_date IS NULL THEN 1 END) as null_deployment_dates_remaining
FROM riders;
