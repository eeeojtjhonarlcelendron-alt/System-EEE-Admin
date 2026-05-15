-- Admin System Database Schema for Supabase

-- Riders Table
CREATE TABLE riders (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  rider_id VARCHAR(50) UNIQUE NOT NULL,
  rider_name VARCHAR(255) NOT NULL,
  operator_hub VARCHAR(100) NOT NULL,
  deployment_date DATE,
  last_active DATE,
  status VARCHAR(20) DEFAULT 'Active' CHECK (status IN ('Active', 'Inactive')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Performance Records Table
CREATE TABLE performance_records (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  date DATE,
  rider_id VARCHAR(50) NOT NULL,
  driver_name VARCHAR(255) NOT NULL,
  hub VARCHAR(100) NOT NULL,
  assigned INTEGER DEFAULT 0,
  delivered INTEGER DEFAULT 0,
  onhold INTEGER DEFAULT 0,
  pecentage DECIMAL(5,2) DEFAULT 0,
  failed_rate DECIMAL(5,2) DEFAULT 0,
  region VARCHAR(100),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- KPI Records Table
CREATE TABLE kpi_records (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  date DATE NOT NULL,
  region VARCHAR(100) NOT NULL,
  sub_region VARCHAR(100),
  operator_hub VARCHAR(100) NOT NULL,
  score INTEGER DEFAULT 0,
  grade VARCHAR(1) CHECK (grade IN ('A', 'B', 'C', 'D', 'F')),
  remarks TEXT,
  cfr DECIMAL(5,2) DEFAULT 0,
  sr DECIMAL(5,2) DEFAULT 0,
  aging_four_days DECIMAL(5,2) DEFAULT 0,
  line_haul_compliance DECIMAL(5,2) DEFAULT 0,
  cod_remittance DECIMAL(5,2) DEFAULT 0,
  eod_compliance DECIMAL(5,2) DEFAULT 0,
  rts DECIMAL(5,2) DEFAULT 0,
  loss DECIMAL(5,2) DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Dashboard Aggregated Metrics Table (combines Performance and KPI data)
CREATE TABLE dashboard_metrics (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  date DATE NOT NULL,
  hub VARCHAR(100) NOT NULL,
  success_rate DECIMAL(5,2) DEFAULT 0,
  riders INTEGER DEFAULT 0,
  delivered INTEGER DEFAULT 0,
  on_hold INTEGER DEFAULT 0,
  productivity DECIMAL(5,2) DEFAULT 0,
  clear_floor_rate DECIMAL(5,2) DEFAULT 0,
  scorecard DECIMAL(5,2) DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(date, hub)
);

-- Enable Row Level Security
ALTER TABLE dashboard_metrics ENABLE ROW LEVEL SECURITY;

-- Create policies for authenticated users
CREATE POLICY "Authenticated users can read dashboard_metrics" ON dashboard_metrics
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can insert dashboard_metrics" ON dashboard_metrics
  FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated users can update dashboard_metrics" ON dashboard_metrics
  FOR UPDATE TO authenticated USING (true);

CREATE POLICY "Authenticated users can delete dashboard_metrics" ON dashboard_metrics
  FOR DELETE TO authenticated USING (true);

-- Add trigger for updated_at
CREATE TRIGGER update_dashboard_metrics_updated_at BEFORE UPDATE ON dashboard_metrics
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Monthly Stats Table (for dashboard)
CREATE TABLE monthly_stats (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  month VARCHAR(20) NOT NULL,
  year INTEGER NOT NULL,
  deliveries INTEGER DEFAULT 0,
  success INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(month, year)
);

-- Hub Stats Table (for dashboard)
CREATE TABLE hub_stats (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  hub_name VARCHAR(100) NOT NULL UNIQUE,
  rider_count INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable Row Level Security on all tables
ALTER TABLE riders ENABLE ROW LEVEL SECURITY;
ALTER TABLE performance_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE kpi_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE monthly_stats ENABLE ROW LEVEL SECURITY;
ALTER TABLE hub_stats ENABLE ROW LEVEL SECURITY;

-- Create policies for authenticated users
CREATE POLICY "Authenticated users can read riders" ON riders
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can insert riders" ON riders
  FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated users can update riders" ON riders
  FOR UPDATE TO authenticated USING (true);

CREATE POLICY "Authenticated users can delete riders" ON riders
  FOR DELETE TO authenticated USING (true);

CREATE POLICY "Authenticated users can read performance" ON performance_records
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can insert performance" ON performance_records
  FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated users can update performance" ON performance_records
  FOR UPDATE TO authenticated USING (true);

CREATE POLICY "Authenticated users can delete performance" ON performance_records
  FOR DELETE TO authenticated USING (true);

CREATE POLICY "Authenticated users can read kpi" ON kpi_records
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can insert kpi" ON kpi_records
  FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated users can update kpi" ON kpi_records
  FOR UPDATE TO authenticated USING (true);

CREATE POLICY "Authenticated users can delete kpi" ON kpi_records
  FOR DELETE TO authenticated USING (true);

CREATE POLICY "Authenticated users can read monthly_stats" ON monthly_stats
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can insert monthly_stats" ON monthly_stats
  FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated users can read hub_stats" ON hub_stats
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can insert hub_stats" ON hub_stats
  FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated users can update hub_stats" ON hub_stats
  FOR UPDATE TO authenticated USING (true);

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Function to refresh riders from performance records
CREATE OR REPLACE FUNCTION refresh_riders()
RETURNS void AS $$
BEGIN
  WITH rider_agg AS (
    SELECT
      rider_id,
      MIN(date) AS deployment_date,
      MAX(date) AS last_active
    FROM performance_records
    WHERE rider_id IS NOT NULL
      AND rider_id <> ''
      AND date IS NOT NULL
    GROUP BY rider_id
  ), latest_rider AS (
    SELECT DISTINCT ON (rider_id)
      rider_id,
      driver_name,
      hub
    FROM performance_records
    WHERE rider_id IS NOT NULL
      AND rider_id <> ''
    ORDER BY rider_id, date DESC
  ), merged AS (
    SELECT
      a.rider_id,
      COALESCE(lr.driver_name, '') AS rider_name,
      COALESCE(lr.hub, '') AS operator_hub,
      'Active'::VARCHAR(20) AS status,
      a.deployment_date,
      a.last_active
    FROM rider_agg a
    LEFT JOIN latest_rider lr USING (rider_id)
  )
  INSERT INTO riders (rider_id, rider_name, operator_hub, status, deployment_date, last_active)
  SELECT rider_id, rider_name, operator_hub, status, deployment_date, last_active
  FROM merged
  ON CONFLICT (rider_id) DO UPDATE
  SET
    rider_name = EXCLUDED.rider_name,
    operator_hub = EXCLUDED.operator_hub,
    status = EXCLUDED.status,
    deployment_date = LEAST(COALESCE(riders.deployment_date, EXCLUDED.deployment_date), EXCLUDED.deployment_date),
    last_active = GREATEST(COALESCE(riders.last_active, EXCLUDED.last_active), EXCLUDED.last_active);
END;
$$ language 'plpgsql';

-- Add triggers for updated_at
CREATE TRIGGER update_riders_updated_at BEFORE UPDATE ON riders
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_performance_records_updated_at BEFORE UPDATE ON performance_records
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_kpi_records_updated_at BEFORE UPDATE ON kpi_records
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_hub_stats_updated_at BEFORE UPDATE ON hub_stats
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Function to refresh dashboard metrics from Performance and KPI records
CREATE OR REPLACE FUNCTION refresh_dashboard_metrics()
RETURNS void AS $$
BEGIN
  -- Delete old aggregated data
  DELETE FROM dashboard_metrics;
  
  -- Insert aggregated metrics combining Performance and KPI data
  INSERT INTO dashboard_metrics (date, hub, success_rate, riders, delivered, on_hold, productivity, clear_floor_rate, scorecard)
  SELECT 
    COALESCE(p.date, k.date) as date,
    COALESCE(p.hub, k.operator_hub) as hub,
    -- Success Rate: prefer KPI sr, fallback to Performance pecentage average
    COALESCE(
      (SELECT AVG(k2.sr) FROM kpi_records k2 
       WHERE k2.date = COALESCE(p.date, k.date) AND k2.operator_hub = COALESCE(p.hub, k.operator_hub)),
      (SELECT AVG(p2.pecentage) FROM performance_records p2 
       WHERE p2.date = COALESCE(p.date, k.date) AND p2.hub = COALESCE(p.hub, k.operator_hub)),
      0
    ) as success_rate,
    -- Riders: count unique rider_ids from Performance
    (SELECT COUNT(DISTINCT p2.rider_id) FROM performance_records p2 
     WHERE p2.date = COALESCE(p.date, k.date) AND p2.hub = COALESCE(p.hub, k.operator_hub)) as riders,
    -- Delivered: average from Performance
    (SELECT AVG(p2.delivered) FROM performance_records p2 
     WHERE p2.date = COALESCE(p.date, k.date) AND p2.hub = COALESCE(p.hub, k.operator_hub)) as delivered,
    -- On-Hold: average from Performance
    (SELECT AVG(p2.onhold) FROM performance_records p2 
     WHERE p2.date = COALESCE(p.date, k.date) AND p2.hub = COALESCE(p.hub, k.operator_hub)) as on_hold,
    -- Productivity: average of assigned from Performance
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
    success_rate = EXCLUDED.success_rate,
    riders = EXCLUDED.riders,
    delivered = EXCLUDED.delivered,
    on_hold = EXCLUDED.on_hold,
    productivity = EXCLUDED.productivity,
    clear_floor_rate = EXCLUDED.clear_floor_rate,
    scorecard = EXCLUDED.scorecard,
    updated_at = NOW();
END;
$$ language 'plpgsql';

-- Trigger function to auto-refresh dashboard metrics after performance insert/update
CREATE OR REPLACE FUNCTION trigger_refresh_dashboard_metrics_performance()
RETURNS TRIGGER AS $$
BEGIN
  -- Refresh dashboard metrics for the affected date and hub
  PERFORM refresh_dashboard_metrics();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger function to auto-refresh dashboard metrics after KPI insert/update
CREATE OR REPLACE FUNCTION trigger_refresh_dashboard_metrics_kpi()
RETURNS TRIGGER AS $$
BEGIN
  -- Refresh dashboard metrics for the affected date and hub
  PERFORM refresh_dashboard_metrics();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Add triggers to auto-update dashboard_metrics
CREATE TRIGGER refresh_dashboard_metrics_after_performance_insert
  AFTER INSERT ON performance_records
  FOR EACH ROW
  EXECUTE FUNCTION trigger_refresh_dashboard_metrics_performance();

CREATE TRIGGER refresh_dashboard_metrics_after_performance_update
  AFTER UPDATE ON performance_records
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

-- Insert sample data (optional - remove for production)
INSERT INTO riders (rider_id, rider_name, operator_hub, deployment_date, last_active, status) VALUES
('R001', 'John Smith', 'Hub A', '2024-01-15', '2024-03-10', 'Active'),
('R002', 'Jane Doe', 'Hub B', '2024-02-01', '2024-03-12', 'Active'),
('R003', 'Mike Johnson', 'Hub A', '2024-01-20', '2024-02-28', 'Inactive'),
('R004', 'Sarah Wilson', 'Hub C', '2024-02-10', '2024-03-12', 'Active'),
('R005', 'Tom Brown', 'Hub B', '2024-01-25', '2024-03-09', 'Active'),
('R006', 'Emily Davis', 'Hub D', '2024-02-15', '2024-02-20', 'Inactive'),
('R007', 'Chris Martinez', 'Hub C', '2024-03-01', '2024-03-11', 'Active'),
('R008', 'Lisa Anderson', 'Hub A', '2024-01-10', '2024-03-08', 'Active');

INSERT INTO monthly_stats (month, year, deliveries, success) VALUES
('Jan', 2024, 4000, 3800),
('Feb', 2024, 4200, 4050),
('Mar', 2024, 4500, 4300),
('Apr', 2024, 4800, 4600),
('May', 2024, 5200, 5000),
('Jun', 2024, 5500, 5300);

INSERT INTO hub_stats (hub_name, rider_count) VALUES
('Hub A', 45),
('Hub B', 38),
('Hub C', 52),
('Hub D', 30),
('Hub E', 42);
