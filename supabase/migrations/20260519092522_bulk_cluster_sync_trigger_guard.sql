-- Disable expensive dashboard refresh trigger work during bulk cluster sync and clear operations

CREATE OR REPLACE FUNCTION public.refresh_dashboard_metrics_trigger()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF COALESCE(current_setting('app.skip_refresh_trigger', true), 'off') = 'on' THEN
    RETURN NEW;
  END IF;

  PERFORM refresh_dashboard_metrics();
  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.refresh_dashboard_metrics_trigger() IS
  'Trigger wrapper that skips dashboard refresh when app.skip_refresh_trigger is enabled.';

CREATE OR REPLACE FUNCTION public.sync_cluster_to_kpi(leader_name text, hub_list text[])
RETURNS integer
LANGUAGE plpgsql
AS $$
DECLARE
  v_rows INTEGER := 0;
  v_total_count INTEGER := 0;
BEGIN
  IF hub_list IS NULL OR array_length(hub_list, 1) = 0 THEN
    RETURN 0;
  END IF;

  PERFORM set_config('app.skip_refresh_trigger', 'on', true);
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

COMMENT ON FUNCTION public.sync_cluster_to_kpi(text, text[]) IS
  'Updates kpi_records.cluster for the given list of operator hubs while skipping dashboard refresh triggers.';

CREATE OR REPLACE FUNCTION public.sync_cluster_to_kpi_hub(leader_name text, hub text)
RETURNS integer
LANGUAGE plpgsql
AS $$
DECLARE
  v_rows INTEGER := 0;
BEGIN
  IF hub IS NULL OR hub = '' THEN
    RETURN 0;
  END IF;

  PERFORM set_config('app.skip_refresh_trigger', 'on', true);
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

COMMENT ON FUNCTION public.sync_cluster_to_kpi_hub(text, text) IS
  'Updates kpi_records.cluster for a single operator_hub while skipping dashboard refresh triggers.';

CREATE OR REPLACE FUNCTION public.sync_cluster_to_kpi_hub_batch(leader_name text, hub text, batch_size integer DEFAULT 100)
RETURNS integer
LANGUAGE plpgsql
AS $$
DECLARE
  v_rows INTEGER := 0;
BEGIN
  IF hub IS NULL OR hub = '' OR batch_size <= 0 THEN
    RETURN 0;
  END IF;

  PERFORM set_config('app.skip_refresh_trigger', 'on', true);
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

COMMENT ON FUNCTION public.sync_cluster_to_kpi_hub_batch(text, text, integer) IS
  'Updates kpi_records.cluster for a single operator_hub in batch chunks while skipping dashboard refresh triggers.';

CREATE OR REPLACE FUNCTION public.clear_cluster_from_kpi(hub_list text[])
RETURNS integer
LANGUAGE plpgsql
AS $$
DECLARE
  v_rows INTEGER := 0;
BEGIN
  IF hub_list IS NULL OR array_length(hub_list, 1) = 0 THEN
    RETURN 0;
  END IF;

  PERFORM set_config('app.skip_refresh_trigger', 'on', true);
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

COMMENT ON FUNCTION public.clear_cluster_from_kpi(text[]) IS
  'Clears kpi_records.cluster for given hubs while skipping dashboard refresh triggers.';

CREATE OR REPLACE FUNCTION public.clear_cluster_from_kpi_hub_batch(hub text, batch_size integer DEFAULT 100)
RETURNS integer
LANGUAGE plpgsql
AS $$
DECLARE
  v_rows INTEGER := 0;
BEGIN
  IF hub IS NULL OR hub = '' OR batch_size <= 0 THEN
    RETURN 0;
  END IF;

  PERFORM set_config('app.skip_refresh_trigger', 'on', true);
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

COMMENT ON FUNCTION public.clear_cluster_from_kpi_hub_batch(text, integer) IS
  'Clears kpi_records.cluster for a single operator_hub in batch chunks while skipping dashboard refresh triggers.';
