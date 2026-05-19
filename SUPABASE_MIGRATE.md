Run the combined migration directly in the Supabase SQL editor:

**CRITICAL: Function Overloading Fix**

If you see the error: `"Could not choose the best candidate function between..."` for `sync_cluster_to_kpi`, you need to drop the alternate function signature that was causing the conflict. Run this cleanup first:

1. Open your Supabase project SQL Editor → **New Query**
2. Paste the contents of `supabase/cleanup_alt_function.sql`
3. Run it
4. This drops the conflicting alternate signature and leaves only the canonical function

**CRITICAL: Statement Timeout Fix (if updates are timing out)**

If you see "canceling statement due to statement timeout" (code 57014) errors when creating cluster leaders, run this update:

1. Open your Supabase project SQL Editor → **New Query**
2. Paste the contents of `supabase/update_sync_cluster_batching.sql`
3. Run it
4. This updates `sync_cluster_to_kpi` and adds `sync_cluster_to_kpi_hub`, which allows hub-level RPC updates with no local statement timeout

If the full-list RPC still fails, the client now falls back to `sync_cluster_to_kpi_hub` per hub automatically.

**Option 1: Supabase Dashboard SQL Editor (RECOMMENDED - simplest)**

1. Go to your Supabase project dashboard
2. Click **SQL Editor** in the left sidebar
3. Click **New Query**
4. Copy the entire contents of `supabase/migration_all.sql` from this repo
5. Paste it into the SQL editor
6. Click **Run** button
7. Confirm all statements executed successfully (you should see no errors)

**Option 2: Supabase CLI (if you link your project)**

```powershell
# Link CLI to your cloud project (requires project URL and API key)
supabase link --project-ref <your-project-id>

# Run the combined migration
supabase db push --file=./supabase/migration_all.sql
```

After running, reload the app and test creating a cluster leader again.

Alternative: run a single combined migration file

1. supabase/migration_all.sql (contains optimize + wrapper + sync RPCs)

2. supabase/cleanup_alt_function.sql (if you see function overloading errors, run this to drop the conflicting alternate signature)

Supabase CLI (single file):

```bash
# run the combined migration file
supabase db query --file=./supabase/migration_all.sql
```

If you see PGRST203 "Could not choose the best candidate function", run the cleanup:

```bash
supabase db query --file=./supabase/cleanup_alt_function.sql
```

Verification checklist (after running migrations):

1. If you see `PGRST203 "Could not choose the best candidate function..."` error:
   - Run `supabase/cleanup_alt_function.sql` in the SQL editor to drop the conflicting alternate function
   - Reload the app and retry creating a Cluster Leader

2. Confirm the functions exist via the SQL editor:
   - `SELECT proname FROM pg_proc WHERE proname LIKE 'sync_cluster_to_kpi%';`
   - Should return: `sync_cluster_to_kpi` (only one, the canonical function)
   - `SELECT proname FROM pg_proc WHERE proname = 'refresh_dashboard_metrics';`

3. In the app, create a Cluster Leader and observe:
   - No PGRST203 / "Could not choose the best candidate function" (run cleanup if you see this).
   - No PGRST202 / "function not found" for `rpc/sync_cluster_to_kpi`.
   - No Postgres 42883 error for `refresh_dashboard_metrics()` in console logs.
   - No statement timeout (57014) errors on PATCH operations.
   - KPI column updates without errors.

4. Optionally, manually invoke the RPC from SQL editor to verify:

```sql
-- example: sync cluster name to one hub
SELECT sync_cluster_to_kpi('Leader Name', ARRAY['Hub A']);
SELECT refresh_dashboard_metrics();
```

If you'd like, I can attempt to run the Supabase CLI here now (requires CLI installed and project configured). Otherwise, run the commands above and tell me the results.
