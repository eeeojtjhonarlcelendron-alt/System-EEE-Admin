-- Delete riders with NULL deployment dates by temporarily disabling foreign key constraints
-- Run this in Supabase SQL Editor

-- Step 1: Disable foreign key constraints
ALTER TABLE fuel_transactions DISABLE TRIGGER ALL;
ALTER TABLE performance_records DISABLE TRIGGER ALL;
ALTER TABLE kpi_records DISABLE TRIGGER ALL;

-- Step 2: Delete riders with NULL deployment dates
DELETE FROM riders WHERE deployment_date IS NULL;

-- Step 3: Re-enable foreign key constraints
ALTER TABLE fuel_transactions ENABLE TRIGGER ALL;
ALTER TABLE performance_records ENABLE TRIGGER ALL;
ALTER TABLE kpi_records ENABLE TRIGGER ALL;

-- Step 4: Verify complete deletion
SELECT 
    COUNT(*) as riders_remaining,
    COUNT(CASE WHEN deployment_date IS NULL THEN 1 END) as null_deployment_dates_remaining
FROM riders;
