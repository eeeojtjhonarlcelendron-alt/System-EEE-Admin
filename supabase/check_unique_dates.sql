-- Check all unique dates across tables
-- Run this separately in Supabase SQL Editor

SELECT DISTINCT date FROM performance_records WHERE date IS NOT NULL ORDER BY date;
