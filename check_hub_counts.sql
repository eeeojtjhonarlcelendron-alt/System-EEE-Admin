-- Count unique hubs from performance_records
SELECT 'performance_records' as source, COUNT(*) as unique_hub_count 
FROM (SELECT DISTINCT hub FROM performance_records WHERE hub IS NOT NULL AND hub != '') t1
UNION ALL
-- Count unique hubs from kpi_records
SELECT 'kpi_records' as source, COUNT(*) as unique_hub_count 
FROM (SELECT DISTINCT operator_hub FROM kpi_records WHERE operator_hub IS NOT NULL AND operator_hub != '') t2
UNION ALL
-- Count total combined unique hubs
SELECT 'combined_total' as source, COUNT(DISTINCT hub) as unique_hub_count
FROM (
  SELECT DISTINCT hub FROM performance_records WHERE hub IS NOT NULL AND hub != ''
  UNION ALL
  SELECT DISTINCT operator_hub as hub FROM kpi_records WHERE operator_hub IS NOT NULL AND operator_hub != ''
) t3;
