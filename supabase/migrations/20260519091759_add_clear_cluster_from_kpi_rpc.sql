-- Fast RPC to clear cluster values from KPI records for a list of hubs
DROP FUNCTION IF EXISTS clear_cluster_from_kpi(TEXT[]);

CREATE FUNCTION clear_cluster_from_kpi(hub_list TEXT[])
RETURNS INTEGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_rows INTEGER := 0;
BEGIN
  IF hub_list IS NULL OR array_length(hub_list, 1) = 0 THEN
    RETURN 0;
  END IF;

  SET LOCAL statement_timeout = 0;

  UPDATE kpi_records
  SET cluster = ''
  WHERE operator_hub = ANY(hub_list);

  GET DIAGNOSTICS v_rows = ROW_COUNT;
  RETURN v_rows;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'clear_cluster_from_kpi failed: %', SQLERRM;
  RETURN v_rows;
END;
$$;

COMMENT ON FUNCTION clear_cluster_from_kpi(TEXT[]) IS
  'Clears the cluster field for KPI records matching the given list of operator hubs, with no local statement timeout.';

-- Batch variant for very large hubs
DROP FUNCTION IF EXISTS clear_cluster_from_kpi_hub_batch(TEXT, INTEGER);

CREATE FUNCTION clear_cluster_from_kpi_hub_batch(hub TEXT, batch_size INTEGER DEFAULT 100)
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
  SET cluster = ''
  WHERE ctid IN (
    SELECT ctid FROM kpi_records
    WHERE operator_hub = hub
      AND cluster IS DISTINCT FROM ''
    LIMIT batch_size
  );

  GET DIAGNOSTICS v_rows = ROW_COUNT;
  RETURN v_rows;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'clear_cluster_from_kpi_hub_batch failed for %: %', hub, SQLERRM;
  RETURN 0;
END;
$$;

COMMENT ON FUNCTION clear_cluster_from_kpi_hub_batch(TEXT, INTEGER) IS
  'Clears the cluster field for KPI records for a single operator_hub in batch-sized chunks, with no local statement timeout.';
