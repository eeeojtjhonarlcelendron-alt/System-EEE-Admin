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
RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  -- Delete old aggregated data
  DELETE FROM dashboard_metrics;
  
  -- Get all unique date-hub combinations from both tables
  WITH date_hub_pairs AS (
    SELECT DISTINCT p.date, p.hub
    FROM performance_records p
    WHERE p.date IS NOT NULL AND p.hub IS NOT NULL
    UNION
    SELECT DISTINCT k.date, k.operator_hub as hub
    FROM kpi_records k
    WHERE k.date IS NOT NULL AND k.operator_hub IS NOT NULL
  )
  INSERT INTO dashboard_metrics (date, hub, success_rate, riders, delivered, on_hold, productivity, clear_floor_rate, scorecard)
  SELECT 
    dh.date,
    dh.hub,
    COALESCE(AVG(p.pecentage), 0) as success_rate,
    COALESCE(COUNT(DISTINCT p.rider_id), 0) as riders,
    COALESCE(SUM(p.delivered), 0) as delivered,
    COALESCE(SUM(p.onhold), 0) as on_hold,
    COALESCE(AVG(p.assigned), 0) as productivity,
    COALESCE(AVG(k.cfr), 0) as clear_floor_rate,
    COALESCE(AVG(k.score), 0) as scorecard
  FROM date_hub_pairs dh
  LEFT JOIN performance_records p ON dh.date = p.date AND dh.hub = p.hub
  LEFT JOIN kpi_records k ON dh.date = k.date AND dh.hub = k.operator_hub
  GROUP BY dh.date, dh.hub;
END;
$$;

-- 3. Create trigger functions
CREATE OR REPLACE FUNCTION trigger_refresh_dashboard_metrics_performance()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  PERFORM refresh_dashboard_metrics();
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION trigger_refresh_dashboard_metrics_kpi()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  PERFORM refresh_dashboard_metrics();
  RETURN NEW;
END;
$$;

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
