-- Performance optimization indexes for 28,000+ records
-- Run these in Supabase SQL Editor

-- Performance records table indexes
CREATE INDEX IF NOT EXISTS idx_performance_records_date ON performance_records(date);
CREATE INDEX IF NOT EXISTS idx_performance_records_rider_id ON performance_records(rider_id);
CREATE INDEX IF NOT EXISTS idx_performance_records_hub ON performance_records(hub);
CREATE INDEX IF NOT EXISTS idx_performance_records_region ON performance_records(region);
CREATE INDEX IF NOT EXISTS idx_performance_records_driver_name ON performance_records(driver_name);
CREATE INDEX IF NOT EXISTS idx_performance_records_created_at ON performance_records(created_at);

-- Composite indexes for common queries
CREATE INDEX IF NOT EXISTS idx_performance_records_hub_date ON performance_records(hub, date);
CREATE INDEX IF NOT EXISTS idx_performance_records_rider_date ON performance_records(rider_id, date);
CREATE INDEX IF NOT EXISTS idx_performance_records_region_date ON performance_records(region, date);

-- KPI records table indexes
CREATE INDEX IF NOT EXISTS idx_kpi_records_date ON kpi_records(date);
CREATE INDEX IF NOT EXISTS idx_kpi_records_operator_hub ON kpi_records(operator_hub);
CREATE INDEX IF NOT EXISTS idx_kpi_records_region ON kpi_records(region);
CREATE INDEX IF NOT EXISTS idx_kpi_records_cluster ON kpi_records(cluster);
CREATE INDEX IF NOT EXISTS idx_kpi_records_grade ON kpi_records(grade);

-- Composite indexes for KPI queries
CREATE INDEX IF NOT EXISTS idx_kpi_records_hub_date ON kpi_records(operator_hub, date);
CREATE INDEX IF NOT EXISTS idx_kpi_records_cluster_date ON kpi_records(cluster, date);
CREATE INDEX IF NOT EXISTS idx_kpi_records_region_date ON kpi_records(region, date);

-- Riders table indexes
CREATE INDEX IF NOT EXISTS idx_riders_rider_id ON riders(rider_id);
CREATE INDEX IF NOT EXISTS idx_riders_operator_hub ON riders(operator_hub);
CREATE INDEX IF NOT EXISTS idx_riders_status ON riders(status);
CREATE INDEX IF NOT EXISTS idx_riders_last_active ON riders(last_active);

-- Composite indexes for rider queries
CREATE INDEX IF NOT EXISTS idx_riders_hub_status ON riders(operator_hub, status);
CREATE INDEX IF NOT EXISTS idx_riders_status_active ON riders(status, last_active);

-- Dashboard metrics indexes
CREATE INDEX IF NOT EXISTS idx_dashboard_metrics_date ON dashboard_metrics(date);
CREATE INDEX IF NOT EXISTS idx_dashboard_metrics_hub ON dashboard_metrics(hub);

-- Cluster leaders indexes
CREATE INDEX IF NOT EXISTS idx_cluster_leaders_leader_name ON cluster_leaders(leader_name);

-- Text search indexes for better search performance
CREATE INDEX IF NOT EXISTS idx_performance_records_rider_search ON performance_records USING gin(to_tsvector('english', rider_id || ' ' || driver_name));
CREATE INDEX IF NOT EXISTS idx_kpi_records_search ON kpi_records USING gin(to_tsvector('english', operator_hub || ' ' || region));

-- Analyze tables to update statistics
ANALYZE performance_records;
ANALYZE kpi_records;
ANALYZE riders;
ANALYZE dashboard_metrics;
ANALYZE cluster_leaders;
