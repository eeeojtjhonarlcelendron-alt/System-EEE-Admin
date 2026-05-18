-- Step 1: Create indexes for critical columns (10-50x faster queries)
CREATE INDEX IF NOT EXISTS idx_performance_records_date ON performance_records(date DESC);
CREATE INDEX IF NOT EXISTS idx_performance_records_hub ON performance_records(hub);
CREATE INDEX IF NOT EXISTS idx_performance_records_rider_id ON performance_records(rider_id);
CREATE INDEX IF NOT EXISTS idx_kpi_records_date ON kpi_records(date DESC);
CREATE INDEX IF NOT EXISTS idx_kpi_records_operator_hub ON kpi_records(operator_hub);
CREATE INDEX IF NOT EXISTS idx_dashboard_metrics_date_hub ON dashboard_metrics(date DESC, hub);

-- Step 2: Create RPC function to aggregate dashboard metrics (1 SQL query instead of 167k row transfer)
-- This replaces the JavaScript aggregation logic and returns only aggregated results
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
    -- Aggregate performance records by date-hub
    SELECT
      date,
      hub,
      AVG(CAST(pecentage AS DECIMAL)) as success_rate,
      COUNT(DISTINCT rider_id) as riders,
      AVG(CAST(delivered AS DECIMAL)) as delivered,
      AVG(CAST(onhold AS DECIMAL)) as on_hold,
      AVG(CAST(assigned AS DECIMAL)) as productivity
    FROM performance_records
    WHERE date IS NOT NULL AND hub IS NOT NULL
    GROUP BY date, hub
  ),
  kpi_agg AS (
    -- Aggregate KPI records by date-operator_hub
    SELECT
      date,
      operator_hub as hub,
      AVG(CAST(cfr AS DECIMAL)) as clear_floor_rate,
      AVG(CAST(score AS DECIMAL)) as scorecard
    FROM kpi_records
    WHERE date IS NOT NULL AND operator_hub IS NOT NULL
    GROUP BY date, operator_hub
  )
  -- Join performance and KPI aggregates
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

-- Step 3: Create RPC function to get dashboard metrics for chart rendering with pagination
-- Returns paginated results to bypass Supabase's 1000-row REST API limit
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

-- Step 4: Create RPC function for cluster leader hub stats
-- Returns aggregated stats for cluster leader dashboards
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

-- Step 5: Create RPC function to refresh dashboard metrics from raw data
-- Call this once on server startup or on schedule, NOT on every page load
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
  
  -- Delete old metrics (WHERE clause required for RLS-enabled tables)
  DELETE FROM dashboard_metrics WHERE true;
  
  -- Aggregate from raw tables and insert
  WITH perf_agg AS (
    SELECT
      date,
      hub,
      AVG(CAST(pecentage AS DECIMAL)) as success_rate,
      COUNT(DISTINCT rider_id) as riders,
      AVG(CAST(delivered AS DECIMAL)) as delivered,
      AVG(CAST(onhold AS DECIMAL)) as on_hold,
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

-- Step 6: Comment on functions for clarity
COMMENT ON FUNCTION aggregate_dashboard_metrics() IS 
  'Returns aggregated dashboard metrics from raw performance and KPI data. Uses 1 SQL query instead of 167k row transfer.';

COMMENT ON FUNCTION get_dashboard_chart_data(INTEGER, INTEGER, INTEGER) IS 
  'Returns paginated dashboard metrics for chart rendering. Supports pagination to bypass Supabase 1000-row REST API limit. Parameters: days_back (days of history), page_offset (pagination offset), page_size (rows per page).';

COMMENT ON FUNCTION get_cluster_stats(TEXT[]) IS 
  'Returns aggregated stats by hub for cluster leader dashboards.';

COMMENT ON FUNCTION refresh_dashboard_metrics_from_raw() IS 
  'Refreshes dashboard_metrics table from raw performance/KPI data. Call on server startup, not on every page load.';
