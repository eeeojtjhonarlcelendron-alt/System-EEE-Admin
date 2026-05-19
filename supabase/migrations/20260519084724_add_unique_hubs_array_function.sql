-- Fast RPC to fetch all unique hubs from both performance_records and kpi_records
DROP FUNCTION IF EXISTS get_unique_hubs();

CREATE FUNCTION get_unique_hubs()
RETURNS text[] AS $$
  SELECT array_agg(hub ORDER BY hub)
  FROM (
    SELECT DISTINCT hub FROM performance_records WHERE hub IS NOT NULL AND hub != ''
    UNION
    SELECT DISTINCT operator_hub AS hub FROM kpi_records WHERE operator_hub IS NOT NULL AND operator_hub != ''
  ) combined_hubs;
$$ LANGUAGE sql STABLE;

COMMENT ON FUNCTION get_unique_hubs() IS 'Returns all unique hubs from performance_records.hub and kpi_records.operator_hub as a sorted text array.';
