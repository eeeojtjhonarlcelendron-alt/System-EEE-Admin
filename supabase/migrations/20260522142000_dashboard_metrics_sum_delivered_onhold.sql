-- Store delivered and on_hold as totals per hub/date instead of averages.
-- Run this migration, then refresh_dashboard_metrics_from_raw() repopulates dashboard_metrics.

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
    'Dashboard metrics refreshed successfully with delivered/on_hold totals' as message;
END;
$$;

CREATE OR REPLACE FUNCTION refresh_dashboard_metrics()
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  PERFORM refresh_dashboard_metrics_from_raw();
END;
$$;

SELECT * FROM refresh_dashboard_metrics_from_raw();
