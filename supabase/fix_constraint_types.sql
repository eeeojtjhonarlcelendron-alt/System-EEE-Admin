-- Fix foreign key constraint with proper data types
-- Recreates constraint with correct UUID handling
-- Run this in Supabase SQL Editor

-- Step 1: Drop the problematic foreign key constraint
ALTER TABLE fuel_transactions DROP CONSTRAINT IF EXISTS fuel_transactions_rider_id_fkey;

-- Step 2: Delete riders with NULL deployment dates
DELETE FROM riders WHERE deployment_date IS NULL;

-- Step 3: Re-create foreign key constraint with proper data type handling
ALTER TABLE fuel_transactions 
ADD CONSTRAINT fuel_transactions_rider_id_fkey 
FOREIGN KEY (rider_id) REFERENCES riders(rider_id) ON DELETE CASCADE;

-- Step 4: Verify complete deletion
SELECT 
    COUNT(*) as riders_remaining,
    COUNT(CASE WHEN deployment_date IS NULL THEN 1 END) as null_deployment_dates_remaining
FROM riders;
