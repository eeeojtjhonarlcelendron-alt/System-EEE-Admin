-- Check date ranges in source tables
-- Run this in Supabase SQL Editor to diagnose the data issue

SELECT 
  'performance_records' as table_name,
  COUNT(*) as total_rows,
  MIN(date) as earliest_date,
  MAX(date) as latest_date,
  COUNT(DISTINCT date) as unique_dates
FROM performance_records
WHERE date IS NOT NULL
UNION ALL
SELECT 
  'kpi_records' as table_name,
  COUNT(*) as total_rows,
  MIN(date) as earliest_date,
  MAX(date) as latest_date,
  COUNT(DISTINCT date) as unique_dates
FROM kpi_records
WHERE date IS NOT NULL
UNION ALL
SELECT 
  'dashboard_metrics' as table_name,
  COUNT(*) as total_rows,
  MIN(date) as earliest_date,
  MAX(date) as latest_date,
  COUNT(DISTINCT date) as unique_dates
FROM dashboard_metrics
WHERE date IS NOT NULL;
