-- Create a function to get unique riders with their first/last dates and status
CREATE OR REPLACE FUNCTION get_unique_riders()
RETURNS TABLE (
  rider_id TEXT,
  rider_name TEXT,
  operator_hub TEXT,
  deployment_date DATE,
  last_active DATE,
  status TEXT
) AS $$
DECLARE
  max_date DATE;
  seven_days_before DATE;
BEGIN
  -- Find the maximum date in all performance records
  SELECT MAX(date) INTO max_date FROM performance_records;
  
  -- Calculate 7 days before max date
  seven_days_before := max_date - INTERVAL '7 days';
  
  -- Return unique riders with aggregated data
  RETURN QUERY
  SELECT 
    pr.rider_id,
    (SELECT driver_name FROM performance_records WHERE rider_id = pr.rider_id ORDER BY date DESC LIMIT 1) as rider_name,
    (SELECT hub FROM performance_records WHERE rider_id = pr.rider_id ORDER BY date DESC LIMIT 1) as operator_hub,
    MIN(pr.date)::DATE as deployment_date,
    MAX(pr.date)::DATE as last_active,
    CASE 
      WHEN MAX(pr.date) >= seven_days_before THEN 'Active'
      ELSE 'Inactive'
    END::TEXT as status
  FROM performance_records pr
  GROUP BY pr.rider_id
  ORDER BY MAX(pr.date) DESC;
END;
$$ LANGUAGE plpgsql;
