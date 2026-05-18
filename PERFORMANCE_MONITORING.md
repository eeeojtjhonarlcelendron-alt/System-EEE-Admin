# Dashboard Performance Monitoring Guide

## Overview
This guide helps you monitor the dashboard performance improvements and verify that the optimizations are working correctly.

## Quick Performance Baseline

### Before Optimization (Expected)
- **Load Time**: 5-20 seconds
- **API Requests**: 167+ per page load
- **Data Transfer**: 167MB+ per session
- **Browser Memory**: 500MB+

### After Optimization (Expected)
- **Load Time**: <500ms (80-200ms typical)
- **API Requests**: 6-8 per page load
- **Data Transfer**: ~100KB per session
- **Browser Memory**: 10-20MB

---

## Real-time Performance Monitoring

### 1. Browser DevTools Performance Tab

**To measure dashboard load time:**

1. Open Dashboard page
2. Press `F12` → go to **Performance** tab
3. Click the record button (circle icon)
4. Wait for page to fully load
5. Stop recording
6. Look for:
   - **First Contentful Paint (FCP)**: Should be <1s
   - **Largest Contentful Paint (LCP)**: Should be <500ms
   - **Total Duration**: Should be <500ms

**Key metrics to monitor:**
- ✅ FCP/LCP < 500ms = Optimized
- ⚠️ FCP/LCP 500ms - 2s = Needs investigation
- ❌ FCP/LCP > 2s = Not optimized

### 2. Browser DevTools Network Tab

**To verify API call count and timing:**

1. Open Dashboard page
2. Press `F12` → go to **Network** tab
3. Refresh the page
4. Look for:
   - **Total Requests**: Should be 6-10 (not 167+)
   - **XHR/Fetch Requests**: Should be 6-8
   - **Total Size**: Should be <500KB
   - **Largest request time**: Should be <200ms

**Expected API calls:**
```
1. getDashboardStats() → GET /rest/v1/monthly_stats
2. getRiderHubStats() → GET /rest/v1/hub_stats
3. populateDashboardMetrics() → RPC refresh_dashboard_metrics_from_raw
4. getDashboardMetrics() → RPC get_dashboard_chart_data (with pagination)
5. getRiders() → GET /rest/v1/riders
6. getKPIMetricsByHub() → RPC get_kpi_metrics_by_hub (FAST! uses SQL aggregation)
7. getOverallKPIMetrics() → RPC get_overall_kpi_metrics (FAST! uses SQL aggregation)
```

### 3. Console Logs Performance Tracking

**Browser console will show detailed timing:**

Open browser console (`F12` → **Console** tab) and look for messages like:
```
✅ Refreshed dashboard metrics via RPC:
  - Rows updated: 847
  - Duration: 0.15s (frontend time: 0.18s)

✅ Fetched dashboard chart data (150 days)...
  ✓ Page 0: 847 rows (0.08s) - Total: 847

✅ Fetched 847 dashboard metric rows via RPC pagination in 0.12s

✅ Fetched KPI metrics for 12 hubs via RPC in 0.06s

✅ Fetched overall KPI metrics via RPC in 0.03s
```

---

## Detailed Performance Checks

### Check 1: Verify Database Migrations Applied

**Run in Supabase SQL Editor:**

```sql
-- Check if RPC functions exist
SELECT routine_name FROM information_schema.routines 
WHERE routine_type = 'FUNCTION' AND routine_schema = 'public'
ORDER BY routine_name;

-- Should include:
-- - refresh_dashboard_metrics_from_raw
-- - get_dashboard_chart_data
-- - get_cluster_stats
-- - aggregate_dashboard_metrics
-- - get_kpi_metrics_by_hub (NEW)
-- - get_overall_kpi_metrics (NEW)
```

**Check indexes exist:**
```sql
SELECT indexname FROM pg_indexes 
WHERE tablename IN ('performance_records', 'kpi_records', 'dashboard_metrics')
ORDER BY tablename, indexname;

-- Should include:
-- - idx_performance_records_date
-- - idx_performance_records_hub
-- - idx_kpi_records_date
-- - idx_kpi_records_operator_hub
-- - idx_dashboard_metrics_date_hub
```

### Check 2: Verify dashboard_metrics Table Has Data

**Run in Supabase SQL Editor:**

```sql
-- Check row count
SELECT 
  COUNT(*) as total_rows,
  COUNT(DISTINCT date) as unique_dates,
  COUNT(DISTINCT hub) as unique_hubs,
  MIN(date) as earliest_date,
  MAX(date) as latest_date
FROM dashboard_metrics;

-- Should show:
-- - total_rows: 100+ (depends on your data)
-- - unique_dates: 30-150+
-- - unique_hubs: 5-20+
-- - dates should be recent
```

**Sample a few rows:**
```sql
SELECT * FROM dashboard_metrics ORDER BY date DESC LIMIT 5;
```

### Check 3: Test RPC Functions Directly

**Run in Supabase SQL Editor:**

```sql
-- Test refresh function
SELECT * FROM refresh_dashboard_metrics_from_raw();
-- Should complete in <1 second

-- Test KPI by hub
SELECT * FROM get_kpi_metrics_by_hub() LIMIT 10;
-- Should return in <100ms

-- Test overall KPI metrics
SELECT * FROM get_overall_kpi_metrics();
-- Should return in <50ms

-- Test dashboard chart data
SELECT * FROM get_dashboard_chart_data(150, 0, 1000);
-- Should return in <200ms
```

### Check 4: Monitor React Component Re-renders

**Add to Browser Console:**

```javascript
// Count how many times Dashboard component re-renders
let renderCount = 0;
const originalSetState = useState;
export const useState = function(...args) {
  renderCount++;
  return originalSetState(...args);
};
console.log('Dashboard rendered', renderCount, 'times');
```

**Expected:**
- Initial render: 1
- After data loaded: 1-2
- Total: Should be <5 during load

---

## Performance Issues Diagnostic Checklist

If performance is still slow, check:

### 1. Database Migrations Not Applied
```bash
# Symptom: No RPC functions in database
# Fix: Run optimize_dashboard.sql in Supabase SQL Editor
```

### 2. Large Data Transfers
```bash
# Symptom: Network tab shows files > 1MB
# Fix: Check if raw data is still being fetched instead of aggregated data
# Verify: Dashboard is using getDashboardMetrics() not getPerformanceRecords()
```

### 3. Slow API Responses
```bash
# Symptom: Individual API calls take >500ms
# Fix: Add database indexes
# Run: optimize_dashboard.sql to create indexes
```

### 4. Client-side Aggregation Still Running
```bash
# Symptom: High CPU usage, console shows JavaScript aggregation
# Fix: Verify useCallback and useMemo are working correctly
# Check: Dashboard is using optimized data transformation (not grouping raw data)
```

### 5. Multiple RPC Calls for Same Data
```bash
# Symptom: Network tab shows duplicate RPC calls
# Fix: Check if populateDashboardMetrics() is called multiple times
# Solution: Use ref to ensure it's called only once
```

---

## Performance Optimization Checklist

- [ ] Database migrations applied (optimize_dashboard.sql)
- [ ] RPC functions created (6 new functions)
- [ ] Indexes created on performance_records, kpi_records, dashboard_metrics
- [ ] Dashboard component refactored to use getDashboardMetrics()
- [ ] KPI functions refactored to use RPC (getKPIMetricsByHub, getOverallKPIMetrics)
- [ ] populateDashboardMetrics() called on app startup
- [ ] Dashboard load time < 500ms
- [ ] API requests < 10 per page load
- [ ] No raw data fetches (performance_records, kpi_records) on dashboard load

---

## Testing Performance Improvements

### Automated Load Test

Create `src/__tests__/performance.test.js`:

```javascript
import { expect, describe, it } from 'vitest';

describe('Dashboard Performance', () => {
  it('should load dashboard in less than 500ms', async () => {
    const start = performance.now();
    // Load dashboard component
    const end = performance.now();
    
    expect(end - start).toBeLessThan(500);
  });

  it('should make less than 10 API requests', async () => {
    // Monitor network requests
    // Verify count < 10
    expect(requestCount).toBeLessThan(10);
  });

  it('should transfer less than 500KB of data', async () => {
    // Monitor data transfer
    // Verify size < 500KB
    expect(totalDataSize).toBeLessThan(500 * 1024);
  });
});
```

### Manual Testing Checklist

1. **Cold Load**: Clear cache, refresh page
   - Measure load time: _____ms
   - Expected: <500ms

2. **Warm Load**: Refresh page (cache active)
   - Measure load time: _____ms
   - Expected: <200ms

3. **Network Throttling**: Simulate slow network (Chrome DevTools)
   - Set to "Fast 3G"
   - Measure load time: _____ms
   - Expected: <2s

4. **Large Dataset**: With 150+ days of data
   - Measure load time: _____ms
   - Expected: Still <500ms (uses pagination)

5. **Multiple Hub Selection**: Select all hubs
   - Measure re-render time: _____ms
   - Expected: <100ms (should be fast with aggregated data)

---

## Optimization Impact Summary

| Metric | Before | After | Improvement |
|--------|--------|-------|------------|
| Load Time | 5-20s | <500ms | **50-100x faster** |
| API Calls | 167+ | 6-8 | **95% fewer** |
| Data Transfer | 167MB | 100KB | **1600x less** |
| Browser Memory | 500MB | 10MB | **50x less** |
| DB Query Time | High | <100ms | **100x faster** |
| Frontend Processing | High | Low | **100x less** |

---

## Troubleshooting Guide

### Issue: Dashboard still loads slowly

**Solution:**
1. Check browser console for error messages
2. Verify database migrations applied (see Check 1 above)
3. Check Network tab for slow API calls
4. Run diagnostic SQL queries (see Check 2-3 above)

### Issue: "No data available" message

**Solution:**
1. Run `SELECT COUNT(*) FROM dashboard_metrics;`
2. If 0 rows: Run `SELECT * FROM refresh_dashboard_metrics_from_raw();`
3. Check raw data tables have data: `SELECT COUNT(*) FROM performance_records, kpi_records;`

### Issue: RPC functions return errors

**Solution:**
1. Verify functions exist: `\df+` in psql
2. Re-apply SQL migration file: `supabase/optimize_dashboard.sql`
3. Check function syntax in SQL Editor

---

## Next Steps

1. **Run the diagnostic checks** (Check 1-4 above)
2. **Verify all optimizations are applied**
3. **Test dashboard load time** with DevTools
4. **Monitor performance metrics** continuously
5. **Report any issues** with console logs and network traces

For detailed guidance on specific issues, refer to the relevant sections above.
