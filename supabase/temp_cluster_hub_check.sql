SELECT
  (SELECT json_agg(row_to_json(t)) FROM (SELECT id, leader_name, hubs FROM cluster_leaders) t) AS cluster_leaders,
  (SELECT COUNT(DISTINCT hub) FROM cluster_leaders, LATERAL unnest(hubs) AS hub) AS assigned_hub_count,
  (SELECT COUNT(DISTINCT hub) FROM performance_records WHERE hub IS NOT NULL AND hub != '') AS perf_hub_count,
  (SELECT COUNT(DISTINCT operator_hub) FROM kpi_records WHERE operator_hub IS NOT NULL AND operator_hub != '') AS kpi_hub_count;