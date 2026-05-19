SELECT proname, pg_get_functiondef(p.oid) AS definition
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE proname IN (
  'sync_cluster_to_kpi',
  'sync_cluster_to_kpi_hub',
  'sync_cluster_to_kpi_hub_batch',
  'clear_cluster_from_kpi',
  'clear_cluster_from_kpi_hub_batch'
)
ORDER BY proname;
