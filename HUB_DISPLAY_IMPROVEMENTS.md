# Hub Display Verification and Improvements

## Issue Found
The `getAllUniqueHubs()` function in `src/lib/data.js` was using `.range(0, 9999)` which limits results to the first 10,000 rows. If either the `performance_records` or `kpi_records` tables had more than 10,000 rows, not all unique hubs would be fetched, causing the Clustering page to show incomplete hub lists.

## Solution Implemented

### 1. Improved JavaScript Code (src/lib/data.js)
The `getAllUniqueHubs()` function has been updated to:

**Primary Approach (Most Efficient):**
- Attempts to use a new RPC function `get_unique_hubs()` that retrieves distinct hubs directly from the database
- This is more efficient than fetching all rows and deduplicating on the client

**Fallback Approach (Always Works):**
- If the RPC function doesn't exist, falls back to proper pagination
- Fetches both tables in pages of 1,000 rows at a time
- Continues paginating until fewer results are returned than the page size
- Properly handles any number of rows in the database
- Uses a Set to deduplicate hubs before returning

### 2. New Database Function
Created `get_unique_hubs()` RPC function that:
- Returns all distinct hubs from both tables in a single efficient query
- Combines results from `performance_records.hub` and `kpi_records.operator_hub`
- Returns results ordered alphabetically
- Marked as STABLE for query optimization

### 3. Files Created/Modified

#### Modified:
- `src/lib/data.js` - Updated `getAllUniqueHubs()` with pagination and RPC support

#### Created:
- `supabase/migrations/20260519074721_add_get_unique_hubs_function.sql` - Migration file with RPC function

## Deployment Instructions

### Deploy the Database Function
Run the following command to push the migration to Supabase:

```bash
supabase link  # If not already linked
supabase db push --linked
```

Or manually execute the SQL from `supabase/migrations/20260519074721_add_get_unique_hubs_function.sql` in the Supabase SQL Editor.

## Benefits

✅ **Complete Hub List**: All hubs from both tables are now shown, regardless of table size
✅ **Better Performance**: RPC function approach is more efficient than client-side deduplication
✅ **Better Scalability**: Pagination handles tables of any size
✅ **Backward Compatible**: Falls back gracefully if RPC function isn't available yet
✅ **No Breaking Changes**: Clustering page will automatically use the improved function

## Testing
The Clustering page should now display all available hubs in the "Assign Hubs" modal, and no hubs should be missing from the list.
