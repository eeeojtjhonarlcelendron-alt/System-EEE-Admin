-- Alternate signature for sync_cluster_to_kpi to accommodate different parameter ordering
-- Some clients / gateways may send RPC parameters in different orders; create this wrapper
-- to ensure PostgREST finds a matching function signature.

CREATE OR REPLACE FUNCTION sync_cluster_to_kpi(hub_list TEXT[], leader_name TEXT)
RETURNS INTEGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_rows INTEGER := 0;
BEGIN
  RETURN sync_cluster_to_kpi(leader_name, hub_list);
EXCEPTION WHEN undefined_function THEN
  UPDATE kpi_records
  SET cluster = COALESCE(leader_name, '')
  WHERE operator_hub = ANY(hub_list);
  GET DIAGNOSTICS v_rows = ROW_COUNT;
  RETURN v_rows;
END;
$$;

COMMENT ON FUNCTION sync_cluster_to_kpi(TEXT[], TEXT) IS
  'Alternate signature wrapper: sync_cluster_to_kpi(hub_list, leader_name) -> delegates to canonical function or updates directly.';
