-- Direct approach to delete riders with NULL deployment dates
-- Run this in Supabase SQL Editor

-- First, let's see exactly what we're dealing with
SELECT 
    rider_id,
    rider_name,
    deployment_date,
    last_active,
    operator_hub,
    status
FROM riders 
WHERE deployment_date IS NULL
LIMIT 5;

-- Count how many we're deleting
SELECT 
    COUNT(*) as riders_to_delete
FROM riders 
WHERE deployment_date IS NULL;

-- Simple direct delete without subqueries
DELETE FROM riders 
WHERE deployment_date IS NULL;

-- Verify deletion worked
SELECT 
    COUNT(*) as riders_remaining,
    COUNT(CASE WHEN deployment_date IS NULL THEN 1 END) as null_deployment_dates_remaining
FROM riders;
