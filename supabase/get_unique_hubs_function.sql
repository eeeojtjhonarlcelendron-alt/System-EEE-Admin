-- Create efficient function to get all unique hubs from both tables
CREATE OR REPLACE FUNCTION get_unique_hubs()
RETURNS TABLE(hub TEXT) AS $$
BEGIN
  RETURN QUERY
  SELECT DISTINCT hub FROM (
    SELECT DISTINCT hub FROM performance_records 
    WHERE hub IS NOT NULL AND hub != ''
    UNION ALL
    SELECT DISTINCT operator_hub as hub FROM kpi_records 
    WHERE operator_hub IS NOT NULL AND operator_hub != ''
  ) combined_hubs
  ORDER BY hub;
END;
$$ LANGUAGE plpgsql STABLE;

COMMENT ON FUNCTION get_unique_hubs() IS 'Returns all unique hubs from both performance_records (hub column) and kpi_records (operator_hub column)';
