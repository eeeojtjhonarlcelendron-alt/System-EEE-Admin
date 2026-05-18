-- Recreate dashboard_metrics table with correct schema
-- This will drop the old table and create it with the correct column types

-- Drop existing triggers if they exist
DROP TRIGGER IF EXISTS refresh_dashboard_metrics_after_performance_insert ON performance_records;
DROP TRIGGER IF EXISTS refresh_dashboard_metrics_after_performance_update ON performance_records;
DROP TRIGGER IF EXISTS refresh_dashboard_metrics_after_performance_delete ON performance_records;
DROP TRIGGER IF EXISTS refresh_dashboard_metrics_after_kpi_insert ON kpi_records;
DROP TRIGGER IF EXISTS refresh_dashboard_metrics_after_kpi_update ON kpi_records;
DROP TRIGGER IF EXISTS refresh_dashboard_metrics_after_kpi_delete ON kpi_records;
DROP TRIGGER IF EXISTS update_dashboard_metrics_updated_at ON dashboard_metrics;

-- Drop functions if they exist
DROP FUNCTION IF EXISTS trigger_refresh_dashboard_metrics_performance() CASCADE;
DROP FUNCTION IF EXISTS trigger_refresh_dashboard_metrics_kpi() CASCADE;
DROP FUNCTION IF EXISTS refresh_dashboard_metrics() CASCADE;

-- Drop existing table if it exists
DROP TABLE IF EXISTS dashboard_metrics CASCADE;

-- Create dashboard_metrics table with CORRECT schema
CREATE TABLE dashboard_metrics (
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

-- Create policies
CREATE POLICY "read_dashboard_metrics" ON dashboard_metrics
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "insert_dashboard_metrics" ON dashboard_metrics
  FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "update_dashboard_metrics" ON dashboard_metrics
  FOR UPDATE TO authenticated USING (true);
CREATE POLICY "delete_dashboard_metrics" ON dashboard_metrics
  FOR DELETE TO authenticated USING (true);

-- Add index for faster queries
CREATE INDEX idx_dashboard_metrics_date ON dashboard_metrics(date);
CREATE INDEX idx_dashboard_metrics_hub ON dashboard_metrics(hub);
CREATE INDEX idx_dashboard_metrics_date_hub ON dashboard_metrics(date, hub);

