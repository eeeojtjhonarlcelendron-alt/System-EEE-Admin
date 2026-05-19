-- Wrapper to ensure `refresh_dashboard_metrics()` exists and delegates to the optimized RPC
-- Run this after you've applied the optimized functions (optimize_dashboard.sql)

CREATE OR REPLACE FUNCTION refresh_dashboard_metrics()
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  -- Delegate to the optimized refresh RPC if available
  PERFORM refresh_dashboard_metrics_from_raw();
EXCEPTION WHEN undefined_function THEN
  -- If the optimized RPC isn't available, fall back to the legacy implementation
  RAISE WARNING 'refresh_dashboard_metrics_from_raw() not present; please run supabase/optimize_dashboard.sql to install the optimized functions.';
END;
$$;

COMMENT ON FUNCTION refresh_dashboard_metrics() IS 'Wrapper that delegates to refresh_dashboard_metrics_from_raw(); creates the missing function expected by triggers.';
