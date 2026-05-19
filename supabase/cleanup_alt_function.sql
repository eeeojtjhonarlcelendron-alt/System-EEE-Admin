-- Drop the problematic alternate signature function that caused PostgREST overloading conflicts
-- The canonical sync_cluster_to_kpi(leader_name TEXT, hub_list TEXT[]) is sufficient

DROP FUNCTION IF EXISTS sync_cluster_to_kpi(hub_list TEXT[], leader_name TEXT) CASCADE;

-- Verify only the canonical function remains
-- SELECT proname, pronargs FROM pg_proc WHERE proname = 'sync_cluster_to_kpi';
-- Should return only: sync_cluster_to_kpi | 2
