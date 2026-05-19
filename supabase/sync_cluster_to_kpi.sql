-- Server-side RPC to sync cluster name to KPI records for a list of hubs
-- Uses an unlimited timeout for the update to avoid statement_timeout failures.
-- Usage: SELECT sync_cluster_to_kpi('Leader Name', ARRAY['Hub A','Hub B']);

CREATE OR REPLACE FUNCTION sync_cluster_to_kpi(leader_name TEXT, hub_list TEXT[])
RETURNS INTEGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_rows INTEGER := 0;
  v_total_count INTEGER := 0;
BEGIN
  IF hub_list IS NULL OR array_length(hub_list, 1) = 0 THEN
    RETURN 0;
  END IF;

  SET LOCAL statement_timeout = 0;

  UPDATE kpi_records
  SET cluster = COALESCE(leader_name, '')
  WHERE operator_hub = ANY(hub_list);

  GET DIAGNOSTICS v_rows = ROW_COUNT;
  v_total_count := v_rows;

  RETURN v_total_count;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'sync_cluster_to_kpi failed: %', SQLERRM;
  RETURN v_total_count;
END;
$$;

COMMENT ON FUNCTION sync_cluster_to_kpi(TEXT, TEXT[]) IS
  'Updates kpi_records.cluster for the given list of operator hubs with no local statement timeout. Returns number of rows updated.';

CREATE OR REPLACE FUNCTION sync_cluster_to_kpi_hub(leader_name TEXT, hub TEXT)
RETURNS INTEGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_rows INTEGER := 0;
BEGIN
  IF hub IS NULL OR hub = '' THEN
    RETURN 0;
  END IF;

  SET LOCAL statement_timeout = 0;

  UPDATE kpi_records
  SET cluster = COALESCE(leader_name, '')
  WHERE operator_hub = hub;

  GET DIAGNOSTICS v_rows = ROW_COUNT;
  RETURN v_rows;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'sync_cluster_to_kpi_hub failed for %: %', hub, SQLERRM;
  RETURN 0;
END;
$$;

COMMENT ON FUNCTION sync_cluster_to_kpi_hub(TEXT, TEXT) IS
  'Updates kpi_records.cluster for a single operator_hub with no local statement timeout. Returns number of rows updated.';

CREATE OR REPLACE FUNCTION sync_cluster_to_kpi_hub_batch(leader_name TEXT, hub TEXT, batch_size INTEGER DEFAULT 100)
RETURNS INTEGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_rows INTEGER := 0;
BEGIN
  IF hub IS NULL OR hub = '' OR batch_size <= 0 THEN
    RETURN 0;
  END IF;

  SET LOCAL statement_timeout = 0;

  UPDATE kpi_records
  SET cluster = COALESCE(leader_name, '')
  WHERE ctid IN (
    SELECT ctid FROM kpi_records
    WHERE operator_hub = hub
      AND (cluster IS NULL OR cluster != COALESCE(leader_name, ''))
    LIMIT batch_size
  );

  GET DIAGNOSTICS v_rows = ROW_COUNT;
  RETURN v_rows;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'sync_cluster_to_kpi_hub_batch failed for %: %', hub, SQLERRM;
  RETURN 0;
END;
$$;

COMMENT ON FUNCTION sync_cluster_to_kpi_hub_batch(TEXT, TEXT, INTEGER) IS
  'Updates kpi_records.cluster for a single operator_hub in batch-sized chunks. Returns number of rows updated.';

CREATE OR REPLACE FUNCTION sync_cluster_to_kpi_hub(leader_name TEXT, hub TEXT)
RETURNS INTEGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_rows INTEGER := 0;
BEGIN
  IF hub IS NULL OR hub = '' THEN
    RETURN 0;
  END IF;

  SET LOCAL statement_timeout = 0;

  UPDATE kpi_records
  SET cluster = COALESCE(leader_name, '')
  WHERE operator_hub = hub;

  GET DIAGNOSTICS v_rows = ROW_COUNT;
  RETURN v_rows;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'sync_cluster_to_kpi_hub failed for %: %', hub, SQLERRM;
  RETURN 0;
END;
$$;

COMMENT ON FUNCTION sync_cluster_to_kpi_hub(TEXT, TEXT) IS
  'Updates kpi_records.cluster for a single operator_hub with no local statement timeout. Returns number of rows updated.';
