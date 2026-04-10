-- Debug query to check date values
SELECT 
  rider_id,
  driver_name,
  date,
  created_at,
  date::date as date_cast,
  created_at::date as created_at_cast
FROM performance_records 
ORDER BY date DESC 
LIMIT 20;

-- Check max date
SELECT MAX(date) as max_date, MAX(date)::date as max_date_cast FROM performance_records;

-- Check date 7 days ago from max
SELECT (MAX(date) - INTERVAL '7 days')::date as cutoff_date FROM performance_records;
