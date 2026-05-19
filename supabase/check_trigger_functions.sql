SELECT n.nspname AS schema,
       p.proname,
       pg_get_functiondef(p.oid) AS definition
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE p.proname IN ('refresh_dashboard_metrics_trigger', 'refresh_dashboard_metrics', 'refresh_dashboard_metrics_from_raw', 'update_updated_at_column');
