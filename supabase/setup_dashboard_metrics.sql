-- ============================================================
-- DASHBOARD METRICS AUTO-UPDATE SETUP
-- Run this in Supabase SQL Editor to enable automatic aggregation
-- ============================================================

-- 1. Create dashboard_metrics table if not exists
CREATE TABLE IF NOT EXISTS dashboard_metrics (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  date DATE NOT NULL,
  hub VARCHAR(100) NOT NULL,
  success_rate DECIMAL(5,2) DEFAULT 0,
  riders INTEGER DEFAULT 0,
  delivered DECIMAL(10,2) DEFAULT 0,
  on_hold DECIMAL(10,2) DEFAULT 0,
  productivity DECIMAL(5,2) DEFAULT 0,
  clear_floor_rate DECIMAL(5,2) DEFAULT 0,
  scorecard DECIMAL(5,2) DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(date, hub)
);

-- Enable RLS
ALTER TABLE dashboard_metrics ENABLE ROW LEVEL SECURITY;

-- Create policies (safe to run multiple times)
DO $$
BEGIN
  -- Drop existing policies to avoid conflicts
  DROP POLICY IF EXISTS "read_dashboard_metrics" ON dashboard_metrics;
  DROP POLICY IF EXISTS "insert_dashboard_metrics" ON dashboard_metrics;
  DROP POLICY IF EXISTS "update_dashboard_metrics" ON dashboard_metrics;
  DROP POLICY IF EXISTS "delete_dashboard_metrics" ON dashboard_metrics;
  
  -- Create new policies
  CREATE POLICY "read_dashboard_metrics" ON dashboard_metrics
    FOR SELECT TO authenticated USING (true);
  CREATE POLICY "insert_dashboard_metrics" ON dashboard_metrics
    FOR INSERT TO authenticated WITH CHECK (true);
  CREATE POLICY "update_dashboard_metrics" ON dashboard_metrics
    FOR UPDATE TO authenticated USING (true);
  CREATE POLICY "delete_dashboard_metrics" ON dashboard_metrics
    FOR DELETE TO authenticated USING (true);
END $$;

-- 2. Create function to refresh dashboard metrics
CREATE OR REPLACE FUNCTION refresh_dashboard_metrics()
RETURNS void AS $$
BEGIN
  -- Delete old aggregated data (use WHERE true to satisfy PostgreSQL requirement)
  DELETE FROM dashboard_metrics WHERE true;
  
  -- Insert aggregated metrics from Performance and KPI data
  INSERT INTO dashboard_metrics (date, hub, success_rate, riders, delivered, on_hold, productivity, clear_floor_rate, scorecard)
  SELECT 
    COALESCE(p.date, k.date) as date,
    COALESCE(p.hub, k.operator_hub) as hub,
    -- Success Rate: from Performance (pecentage)
    COALESCE(
      (SELECT AVG(p2.pecentage) FROM performance_records p2 
       WHERE p2.date = COALESCE(p.date, k.date) AND p2.hub = COALESCE(p.hub, k.operator_hub)),
      0
    ) as success_rate,
    -- Riders: count unique rider_ids from Performance
    (SELECT COUNT(DISTINCT p2.rider_id) FROM performance_records p2 
     WHERE p2.date = COALESCE(p.date, k.date) AND p2.hub = COALESCE(p.hub, k.operator_hub)) as riders,
    -- Delivered: AVERAGE from Performance
    (SELECT AVG(p2.delivered) FROM performance_records p2 
     WHERE p2.date = COALESCE(p.date, k.date) AND p2.hub = COALESCE(p.hub, k.operator_hub)) as delivered,
    -- On-Hold: AVERAGE from Performance
    (SELECT AVG(p2.onhold) FROM performance_records p2 
     WHERE p2.date = COALESCE(p.date, k.date) AND p2.hub = COALESCE(p.hub, k.operator_hub)) as on_hold,
    -- Productivity: AVERAGE of assigned from Performance
    (SELECT AVG(p2.assigned) FROM performance_records p2 
     WHERE p2.date = COALESCE(p.date, k.date) AND p2.hub = COALESCE(p.hub, k.operator_hub)) as productivity,
    -- Clear Floor Rate: average cfr from KPI
    (SELECT AVG(k2.cfr) FROM kpi_records k2 
     WHERE k2.date = COALESCE(p.date, k.date) AND k2.operator_hub = COALESCE(p.hub, k.operator_hub)) as clear_floor_rate,
    -- Scorecard: average score from KPI
    (SELECT AVG(k2.score) FROM kpi_records k2 
     WHERE k2.date = COALESCE(p.date, k.date) AND k2.operator_hub = COALESCE(p.hub, k.operator_hub)) as scorecard
  FROM 
    (SELECT DISTINCT date, hub FROM performance_records WHERE date IS NOT NULL AND hub IS NOT NULL) p
  FULL OUTER JOIN 
    (SELECT DISTINCT date, operator_hub FROM kpi_records WHERE date IS NOT NULL AND operator_hub IS NOT NULL) k
  ON p.date = k.date AND p.hub = k.operator_hub
  WHERE COALESCE(p.date, k.date) IS NOT NULL AND COALESCE(p.hub, k.operator_hub) IS NOT NULL
  ON CONFLICT (date, hub) 
  DO UPDATE SET
    success_rate = COALESCE(EXCLUDED.success_rate, dashboard_metrics.success_rate),
    riders = COALESCE(EXCLUDED.riders, dashboard_metrics.riders),
    delivered = COALESCE(EXCLUDED.delivered, dashboard_metrics.delivered),
    on_hold = COALESCE(EXCLUDED.on_hold, dashboard_metrics.on_hold),
    productivity = COALESCE(EXCLUDED.productivity, dashboard_metrics.productivity),
    clear_floor_rate = COALESCE(EXCLUDED.clear_floor_rate, dashboard_metrics.clear_floor_rate),
    scorecard = COALESCE(EXCLUDED.scorecard, dashboard_metrics.scorecard),
    updated_at = NOW();
END;
$$ language 'plpgsql';

-- 3. Create trigger functions
CREATE OR REPLACE FUNCTION trigger_refresh_dashboard_metrics_performance()
RETURNS TRIGGER AS $$
BEGIN
  PERFORM refresh_dashboard_metrics();
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE OR REPLACE FUNCTION trigger_refresh_dashboard_metrics_kpi()
RETURNS TRIGGER AS $$
BEGIN
  PERFORM refresh_dashboard_metrics();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- 4. Create triggers (drop existing first to avoid errors)
DROP TRIGGER IF EXISTS refresh_dashboard_metrics_after_performance_insert ON performance_records;
DROP TRIGGER IF EXISTS refresh_dashboard_metrics_after_performance_update ON performance_records;
DROP TRIGGER IF EXISTS refresh_dashboard_metrics_after_performance_delete ON performance_records;
DROP TRIGGER IF EXISTS refresh_dashboard_metrics_after_kpi_insert ON kpi_records;
DROP TRIGGER IF EXISTS refresh_dashboard_metrics_after_kpi_update ON kpi_records;
DROP TRIGGER IF EXISTS refresh_dashboard_metrics_after_kpi_delete ON kpi_records;

CREATE TRIGGER refresh_dashboard_metrics_after_performance_insert
  AFTER INSERT ON performance_records
  FOR EACH ROW
  EXECUTE FUNCTION trigger_refresh_dashboard_metrics_performance();

CREATE TRIGGER refresh_dashboard_metrics_after_performance_update
  AFTER UPDATE ON performance_records
  FOR EACH ROW
  EXECUTE FUNCTION trigger_refresh_dashboard_metrics_performance();

CREATE TRIGGER refresh_dashboard_metrics_after_performance_delete
  AFTER DELETE ON performance_records
  FOR EACH ROW
  EXECUTE FUNCTION trigger_refresh_dashboard_metrics_performance();

CREATE TRIGGER refresh_dashboard_metrics_after_kpi_insert
  AFTER INSERT ON kpi_records
  FOR EACH ROW
  EXECUTE FUNCTION trigger_refresh_dashboard_metrics_kpi();

CREATE TRIGGER refresh_dashboard_metrics_after_kpi_update
  AFTER UPDATE ON kpi_records
  FOR EACH ROW
  EXECUTE FUNCTION trigger_refresh_dashboard_metrics_kpi();

CREATE TRIGGER refresh_dashboard_metrics_after_kpi_delete
  AFTER DELETE ON kpi_records
  FOR EACH ROW
  EXECUTE FUNCTION trigger_refresh_dashboard_metrics_kpi();

-- 5. Run initial refresh to populate the table
SELECT refresh_dashboard_metrics();

-- Success message
SELECT 'Dashboard metrics auto-update setup complete!' as status;
