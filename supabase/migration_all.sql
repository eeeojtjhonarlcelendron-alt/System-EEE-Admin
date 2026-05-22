-- Combined migration: optimize_dashboard + refresh wrapper + sync_cluster_to_kpi + alt wrapper
-- Run this file once in your Supabase SQL editor or via the Supabase CLI.

-- =============================
-- 1) optimize_dashboard.sql
-- =============================

-- Step 1: Create indexes for critical columns (10-50x faster queries)
CREATE INDEX IF NOT EXISTS idx_performance_records_date ON performance_records(date DESC);
CREATE INDEX IF NOT EXISTS idx_performance_records_hub ON performance_records(hub);
CREATE INDEX IF NOT EXISTS idx_performance_records_rider_id ON performance_records(rider_id);
CREATE INDEX IF NOT EXISTS idx_kpi_records_date ON kpi_records(date DESC);
CREATE INDEX IF NOT EXISTS idx_kpi_records_operator_hub ON kpi_records(operator_hub);
CREATE INDEX IF NOT EXISTS idx_dashboard_metrics_date_hub ON dashboard_metrics(date DESC, hub);

-- Step 2: Create RPC function to aggregate dashboard metrics (1 SQL query instead of 167k row transfer)
CREATE OR REPLACE FUNCTION aggregate_dashboard_metrics()
RETURNS TABLE (
  date DATE,
  hub VARCHAR,
  success_rate DECIMAL,
  riders INTEGER,
  delivered DECIMAL,
  on_hold DECIMAL,
  productivity DECIMAL,
  clear_floor_rate DECIMAL,
  scorecard DECIMAL
)
LANGUAGE SQL
AS $$
  WITH perf_agg AS (
    SELECT
      date,
      hub,
      AVG(CAST(pecentage AS DECIMAL)) as success_rate,
      COUNT(DISTINCT rider_id) as riders,
      SUM(CAST(delivered AS DECIMAL)) as delivered,
      SUM(CAST(onhold AS DECIMAL)) as on_hold,
      AVG(CAST(assigned AS DECIMAL)) as productivity
    FROM performance_records
    WHERE date IS NOT NULL AND hub IS NOT NULL
    GROUP BY date, hub
  ),
  kpi_agg AS (
    SELECT
      date,
      operator_hub as hub,
      AVG(CAST(cfr AS DECIMAL)) as clear_floor_rate,
      AVG(CAST(score AS DECIMAL)) as scorecard
    FROM kpi_records
    WHERE date IS NOT NULL AND operator_hub IS NOT NULL
    GROUP BY date, operator_hub
  )
  SELECT
    COALESCE(p.date, k.date) as date,
    COALESCE(p.hub, k.hub) as hub,
    ROUND(COALESCE(p.success_rate, 0)::DECIMAL, 2) as success_rate,
    COALESCE(p.riders, 0) as riders,
    ROUND(COALESCE(p.delivered, 0)::DECIMAL, 2) as delivered,
    ROUND(COALESCE(p.on_hold, 0)::DECIMAL, 2) as on_hold,
    ROUND(COALESCE(p.productivity, 0)::DECIMAL, 2) as productivity,
    ROUND(COALESCE(k.clear_floor_rate, 0)::DECIMAL, 2) as clear_floor_rate,
    ROUND(COALESCE(k.scorecard, 0)::DECIMAL, 2) as scorecard
  FROM perf_agg p
  FULL OUTER JOIN kpi_agg k ON p.date = k.date AND p.hub = k.hub
  ORDER BY date DESC, hub;
$$;

-- Step 3: get_dashboard_chart_data
CREATE OR REPLACE FUNCTION get_dashboard_chart_data(days_back INTEGER DEFAULT 150, page_offset INTEGER DEFAULT 0, page_size INTEGER DEFAULT 1000)
RETURNS TABLE (
  date DATE,
  hub VARCHAR,
  success_rate DECIMAL,
  riders INTEGER,
  delivered DECIMAL,
  on_hold DECIMAL,
  productivity DECIMAL,
  clear_floor_rate DECIMAL,
  scorecard DECIMAL
)
LANGUAGE SQL
AS $$
  SELECT
    date,
    hub,
    success_rate,
    riders,
    delivered,
    on_hold,
    productivity,
    clear_floor_rate,
    scorecard
  FROM dashboard_metrics
  WHERE date >= CURRENT_DATE - INTERVAL '1 day' * days_back
  ORDER BY date DESC, hub
  OFFSET page_offset
  LIMIT page_size;
$$;

-- Step 4: get_cluster_stats
CREATE OR REPLACE FUNCTION get_cluster_stats(hub_list TEXT[] DEFAULT NULL)
RETURNS TABLE (
  hub VARCHAR,
  total_riders INTEGER,
  avg_success_rate DECIMAL,
  total_delivered DECIMAL,
  total_on_hold DECIMAL,
  avg_productivity DECIMAL,
  avg_clear_floor_rate DECIMAL,
  avg_scorecard DECIMAL
)
LANGUAGE SQL
AS $$
  SELECT
    hub,
    SUM(riders) as total_riders,
    ROUND(AVG(success_rate)::DECIMAL, 2) as avg_success_rate,
    ROUND(SUM(delivered)::DECIMAL, 2) as total_delivered,
    ROUND(SUM(on_hold)::DECIMAL, 2) as total_on_hold,
    ROUND(AVG(productivity)::DECIMAL, 2) as avg_productivity,
    ROUND(AVG(clear_floor_rate)::DECIMAL, 2) as avg_clear_floor_rate,
    ROUND(AVG(scorecard)::DECIMAL, 2) as avg_scorecard
  FROM dashboard_metrics
  WHERE (hub_list IS NULL OR hub = ANY(hub_list))
    AND date >= CURRENT_DATE - INTERVAL '30 days'
  GROUP BY hub
  ORDER BY avg_success_rate DESC;
$$;

-- Step 5: refresh_dashboard_metrics_from_raw
CREATE OR REPLACE FUNCTION refresh_dashboard_metrics_from_raw()
RETURNS TABLE (
  success BOOLEAN,
  rows_updated INTEGER,
  duration_seconds DECIMAL,
  message TEXT
)
LANGUAGE PLPGSQL
AS $$
DECLARE
  v_rows_affected INTEGER;
  v_start_time TIMESTAMP;
BEGIN
  v_start_time := CLOCK_TIMESTAMP();
  DELETE FROM dashboard_metrics WHERE true;
  WITH perf_agg AS (
    SELECT
      date,
      hub,
      AVG(CAST(pecentage AS DECIMAL)) as success_rate,
      COUNT(DISTINCT rider_id) as riders,
      SUM(CAST(delivered AS DECIMAL)) as delivered,
      SUM(CAST(onhold AS DECIMAL)) as on_hold,
      AVG(CAST(assigned AS DECIMAL)) as productivity
    FROM performance_records
    WHERE date IS NOT NULL AND hub IS NOT NULL
    GROUP BY date, hub
  ),
  kpi_agg AS (
    SELECT
      date,
      operator_hub as hub,
      AVG(CAST(cfr AS DECIMAL)) as clear_floor_rate,
      AVG(CAST(score AS DECIMAL)) as scorecard
    FROM kpi_records
    WHERE date IS NOT NULL AND operator_hub IS NOT NULL
    GROUP BY date, operator_hub
  )
  INSERT INTO dashboard_metrics (date, hub, success_rate, riders, delivered, on_hold, productivity, clear_floor_rate, scorecard)
  SELECT
    COALESCE(p.date, k.date) as date,
    COALESCE(p.hub, k.hub) as hub,
    ROUND(COALESCE(p.success_rate, 0)::DECIMAL, 2) as success_rate,
    COALESCE(p.riders, 0) as riders,
    ROUND(COALESCE(p.delivered, 0)::DECIMAL, 2) as delivered,
    ROUND(COALESCE(p.on_hold, 0)::DECIMAL, 2) as on_hold,
    ROUND(COALESCE(p.productivity, 0)::DECIMAL, 2) as productivity,
    ROUND(COALESCE(k.clear_floor_rate, 0)::DECIMAL, 2) as clear_floor_rate,
    ROUND(COALESCE(k.scorecard, 0)::DECIMAL, 2) as scorecard
  FROM perf_agg p
  FULL OUTER JOIN kpi_agg k ON p.date = k.date AND p.hub = k.hub;
  GET DIAGNOSTICS v_rows_affected = ROW_COUNT;
  RETURN QUERY SELECT
    true as success,
    v_rows_affected as rows_updated,
    ROUND(CAST(EXTRACT(EPOCH FROM (CLOCK_TIMESTAMP() - v_start_time)) AS DECIMAL), 2) as duration_seconds,
    'Dashboard metrics refreshed successfully' as message;
END;
$$;

-- =============================
-- 2) create_refresh_dashboard_metrics_wrapper.sql
-- =============================

-- Wrapper to ensure `refresh_dashboard_metrics()` exists and delegates to the optimized RPC
-- Run this after you've applied the optimized functions (optimize_dashboard.sql)

CREATE OR REPLACE FUNCTION refresh_dashboard_metrics()
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  PERFORM refresh_dashboard_metrics_from_raw();
EXCEPTION WHEN undefined_function THEN
  RAISE WARNING 'refresh_dashboard_metrics_from_raw() not present; please run supabase/optimize_dashboard.sql to install the optimized functions.';
END;
$$;

COMMENT ON FUNCTION refresh_dashboard_metrics() IS 'Wrapper that delegates to refresh_dashboard_metrics_from_raw(); creates the missing function expected by triggers.';

-- =============================
-- 3) sync_cluster_to_kpi.sql
-- =============================

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

-- End of combined migration
