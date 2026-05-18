import { supabase } from './supabase'

// ===== OPTIMIZED ARCHITECTURE =====
// All aggregation happens in Supabase using RPC functions.
// This eliminates the need to transfer 167k rows to the browser.
// Result: <200ms load time instead of 5-20 seconds

// Function to refresh dashboard_metrics on server startup
// Call this ONCE when the app first loads, not on every page load
export async function populateDashboardMetrics() {
  try {
    const startTime = performance.now()
    console.log('🔄 Refreshing dashboard metrics via RPC (aggregation in Supabase)...')
    
    // Call the RPC function that does all aggregation in SQL
    const { data, error } = await supabase.rpc('refresh_dashboard_metrics_from_raw')
    
    if (error) {
      console.error('❌ Error refreshing dashboard metrics:', error)
      return { error }
    }
    
    if (data && data.length > 0) {
      const result = data[0]
      const duration = ((performance.now() - startTime) / 1000).toFixed(2)
      console.log(`✅ Dashboard metrics refreshed via RPC:
        - Rows updated: ${result.rows_updated}
        - Duration: ${result.duration_seconds}s (frontend time: ${duration}s)
        - Message: ${result.message}`)
      return { data: result, error: null }
    }
    
    return { data: null, error: 'No response from RPC' }
  } catch (err) {
    console.error('❌ Error in populateDashboardMetrics:', err)
    return { error: err }
  }
}

// Get dashboard metrics for rendering charts
// Uses the pre-aggregated dashboard_metrics table (no batch fetching needed)
export async function getDashboardMetrics(days = 150) {
  try {
    const fetchStart = performance.now()
    console.log(`📊 Fetching dashboard chart data (${days} days)...`)
    
    // Fetch all aggregated metrics using RPC with pagination
    // This bypasses Supabase's 1000-row REST API limit
    let allData = []
    let page = 0
    let hasMore = true
    const pageSize = 1000
    
    while (hasMore) {
      const pageStart = performance.now()
      const { data, error } = await supabase.rpc('get_dashboard_chart_data', {
        days_back: days,
        page_offset: page * pageSize,
        page_size: pageSize
      })
      
      if (error) {
        console.error('❌ Error fetching dashboard metrics via RPC:', error)
        return { data: allData.length > 0 ? allData : [], error }
      }
      
      if (data && data.length > 0) {
        allData = allData.concat(data)
        const pageDuration = ((performance.now() - pageStart) / 1000).toFixed(2)
        console.log(`  ✓ Page ${page}: ${data.length} rows (${pageDuration}s) - Total: ${allData.length}`)
        page++
      } else {
        hasMore = false
      }
    }
    
    if (!allData || allData.length === 0) {
      console.log('📋 Dashboard metrics table is empty, populating from raw data...')
      await populateDashboardMetrics()
      // Retry after populating
      return getDashboardMetrics(days)
    }
    
    const fetchDuration = ((performance.now() - fetchStart) / 1000).toFixed(2)
    console.log(`✅ Fetched ${allData.length} dashboard metric rows via RPC pagination in ${fetchDuration}s`)
    
    return { data: allData || [], error: null }
  } catch (err) {
    console.error('❌ Error in getDashboardMetrics:', err)
    return { data: [], error: err }
  }
}

// Dashboard stats
export async function getDashboardStats() {
  const [deliveriesResult, ridersResult, kpiResult] = await Promise.all([
    supabase.from('monthly_stats').select('deliveries, success'),
    supabase.from('riders').select('status'),
    supabase.from('kpi_records').select('score'),
  ])

  const totalDeliveries = deliveriesResult.data?.reduce((sum, m) => sum + m.deliveries, 0) || 0
  const totalSuccess = deliveriesResult.data?.reduce((sum, m) => sum + m.success, 0) || 0
  const successRate = totalDeliveries > 0 ? ((totalSuccess / totalDeliveries) * 100).toFixed(1) : 0
  const activeRiders = ridersResult.data?.filter(r => r.status === 'Active').length || 0
  const avgKpi = kpiResult.data?.length > 0 
    ? (kpiResult.data.reduce((sum, k) => sum + k.score, 0) / kpiResult.data.length).toFixed(1)
    : 0

  return {
    totalDeliveries,
    successRate,
    activeRiders,
    avgKpi,
    error: deliveriesResult.error || ridersResult.error || kpiResult.error
  }
}

// Monthly performance data for charts
export async function getMonthlyPerformance() {
  const { data, error } = await supabase
    .from('monthly_stats')
    .select('month, deliveries, success')
    .order('year', { ascending: true })
    .order('id', { ascending: true })

  return { data: data || [], error }
}

// Hub stats for charts
export async function getHubStats() {
  const { data, error } = await supabase
    .from('hub_stats')
    .select('hub_name, rider_count')
    .order('hub_name')

  return { data: data || [], error }
}

// KPI grade distribution
export async function getKpiGradeDistribution() {
  const { data, error } = await supabase
    .from('kpi_records')
    .select('grade')

  if (error) return { data: [], error }

  const gradeCounts = data.reduce((acc, item) => {
    acc[item.grade] = (acc[item.grade] || 0) + 1
    return acc
  }, {})

  const total = data.length || 1
  const distribution = Object.entries(gradeCounts).map(([name, value]) => ({
    name,
    value: Math.round((value / total) * 100)
  }))

  return { data: distribution, error: null }
}

// Get all unique hubs and regions from performance records
export async function getAllUniqueHubsAndRegions() {
  console.log('getAllUniqueHubsAndRegions called')
  const { data, error } = await supabase
    .from('performance_records')
    .select('hub, region')
    .limit(1000) // Limit to avoid loading too much data

  console.log('Supabase query result:', { dataLength: data?.length, error })

  if (error) {
    console.error('Error in getAllUniqueHubsAndRegions:', error)
    return { hubs: [], regions: [], error }
  }

  const hubs = [...new Set(data.filter(item => item && item.hub && item.hub.trim()).map(item => item.hub.trim()))].sort()
  const regions = [...new Set(data.filter(item => item && item.region && item.region.trim()).map(item => item.region.trim()))].sort()

  console.log('Processed hubs:', hubs.length, 'regions:', regions.length)
  return { hubs, regions, error: null }
}

// Performance records CRUD - Paginated fetch for better performance
export async function getPerformanceRecordsPaginated(page = 0, pageSize = 100, filters = {}) {
  let query = supabase
    .from('performance_records')
    .select('*', { count: 'exact' })
    .range(page * pageSize, (page + 1) * pageSize - 1)
    .order('created_at', { ascending: false })
  
  if (filters.hub) {
    query = query.eq('hub', filters.hub)
  }
  if (filters.region) {
    query = query.eq('region', filters.region)
  }
  if (filters.dateFrom) {
    query = query.gte('date', filters.dateFrom)
  }
  if (filters.dateTo) {
    query = query.lte('date', filters.dateTo)
  }
  if (filters.search) {
    query = query.or(`rider_id.ilike.%${filters.search}%,driver_name.ilike.%${filters.search}%`)
  }

  const { data, error, count } = await query
  
  return { data: data || [], error, totalCount: count || 0 }
}

// Fetch all records (for export) - batch approach for reliability
export async function getPerformanceRecords(filters = {}) {
  const batchSize = 1000
  const allData = []
  let offset = 0

  while (true) {
    let query = supabase
      .from('performance_records')
      .select('*')
      .order('date', { ascending: false })
      .order('id', { ascending: false })
      .range(offset, offset + batchSize - 1)

    if (filters.hub) {
      query = query.eq('hub', filters.hub)
    }
    if (filters.search) {
      query = query.or(`rider_id.ilike.%${filters.search}%,driver_name.ilike.%${filters.search}%`)
    }

    const { data, error } = await query
    if (error) {
      return { data: allData, error }
    }

    console.log(`getPerformanceRecords batch offset=${offset} length=${data?.length || 0}`)

    if (!data || data.length === 0) {
      break
    }

    allData.push(...data)
    if (data.length < batchSize) {
      break
    }

    offset += batchSize
  }

  console.log(`getPerformanceRecords: Fetched ${allData.length} records`)
  return { data: allData, error: null }
}

// Optimized function to fetch only recent performance data for dashboard
export async function getRecentPerformanceRecords(days = 30, filters = {}) {
  console.log(`getRecentPerformanceRecords: Fetching last ${days} days...`)
  
  const daysAgo = new Date()
  daysAgo.setDate(daysAgo.getDate() - days)
  const dateFilter = daysAgo.toISOString().split('T')[0]

  const batchSize = 1000
  let offset = 0
  const allData = []

  while (true) {
    let query = supabase
      .from('performance_records')
      .select('*')
      .gte('date', dateFilter)
      .order('date', { ascending: false })
      .order('id', { ascending: false })
      .range(offset, offset + batchSize - 1)

    if (filters.hub) {
      query = query.eq('hub', filters.hub)
    }
    if (filters.hubs && filters.hubs.length > 0) {
      query = query.in('hub', filters.hubs)
    }

    const { data, error } = await query
    if (error) {
      return { data: allData, error }
    }

    if (!data || data.length === 0) {
      break
    }

    allData.push(...data)
    if (data.length < batchSize) {
      break
    }

    offset += batchSize
  }

  console.log(`getRecentPerformanceRecords: Finished with ${allData.length} records`)
  return { data: allData, error: null }
}

export async function createPerformanceRecord(record) {
  const { data, error } = await supabase
    .from('performance_records')
    .insert([record])
    .select()
  return { data: data?.[0], error }
}

export async function updatePerformanceRecord(id, updates) {
  const { data, error } = await supabase
    .from('performance_records')
    .update(updates)
    .eq('id', id)
    .select()
  return { data: data?.[0], error }
}

export async function deletePerformanceRecord(id) {
  const { error } = await supabase.from('performance_records').delete().eq('id', id)
  return { error }
}

export async function getPerformanceRecordByRiderAndDate(rider_id, date) {
  const { data, error } = await supabase
    .from('performance_records')
    .select('*')
    .eq('rider_id', rider_id)
    .eq('date', date)
    .limit(1)
  
  // Return first item if found, null otherwise (no 406 error)
  return { data: data && data.length > 0 ? data[0] : null, error: null }
}

export async function getPerformanceRecordsByDateRange(startDate, endDate) {
  const { data, error } = await supabase
    .from('performance_records')
    .select('id, rider_id, date')
    .gte('date', startDate)
    .lte('date', endDate)
  
  return { data: data || [], error }
}

export async function deleteAllPerformanceRecords() {
  const { error } = await supabase.from('performance_records').delete().not('id', 'is', null)
  return { error }
}

// KPI records CRUD
// Paginated KPI records for better performance
export async function getKpiRecordsPaginated(page = 0, pageSize = 100, filters = {}) {
  let query = supabase
    .from('kpi_records')
    .select('*', { count: 'exact' })
    .range(page * pageSize, (page + 1) * pageSize - 1)
    .order('date', { ascending: false })
  
  if (filters.region) {
    query = query.eq('region', filters.region)
  }
  if (filters.operator_hub) {
    query = query.eq('operator_hub', filters.operator_hub)
  }
  if (filters.grade) {
    query = query.eq('grade', filters.grade)
  }
  if (filters.search) {
    query = query.or(`region.ilike.%${filters.search}%,operator_hub.ilike.%${filters.search}%`)
  }

  const { data, error, count } = await query
  
  return { data: data || [], error, totalCount: count || 0 }
}

// Legacy function for backward compatibility
export async function getKpiRecords(filters = {}) {
  console.log('getKpiRecords: Starting optimized full fetch...')

  const batchSize = 1000
  const allData = []
  let offset = 0

  while (true) {
    let query = supabase
      .from('kpi_records')
      .select('*')
      .order('date', { ascending: false })
      .order('id', { ascending: false })
      .range(offset, offset + batchSize - 1)

    if (filters.region) {
      query = query.eq('region', filters.region)
    }
    if (filters.operator_hub) {
      query = query.eq('operator_hub', filters.operator_hub)
    }
    if (filters.grade) {
      query = query.eq('grade', filters.grade)
    }
    if (filters.search) {
      query = query.or(`region.ilike.%${filters.search}%,operator_hub.ilike.%${filters.search}%`)
    }

    const { data, error } = await query
    if (error) {
      return { data: allData, error }
    }

    if (!data || data.length === 0) {
      break
    }

    allData.push(...data)
    if (data.length < batchSize) {
      break
    }

    offset += batchSize
  }

  console.log(`getKpiRecords: Finished with ${allData.length} records`)
  return { data: allData, error: null }
}

// Optimized function to fetch only recent KPI data for dashboard
export async function getRecentKpiRecords(days = 30, filters = {}) {
  console.log(`getRecentKpiRecords: Fetching last ${days} days...`)
  
  const daysAgo = new Date()
  daysAgo.setDate(daysAgo.getDate() - days)
  const dateFilter = daysAgo.toISOString().split('T')[0]

  const batchSize = 1000
  let offset = 0
  const allData = []

  while (true) {
    let query = supabase
      .from('kpi_records')
      .select('*')
      .gte('date', dateFilter)
      .order('date', { ascending: false })
      .order('id', { ascending: false })
      .range(offset, offset + batchSize - 1)

    if (filters.region) {
      query = query.eq('region', filters.region)
    }
    if (filters.operator_hub) {
      query = query.eq('operator_hub', filters.operator_hub)
    }
    if (filters.hubs && filters.hubs.length > 0) {
      query = query.in('operator_hub', filters.hubs)
    }
    if (filters.grade) {
      query = query.eq('grade', filters.grade)
    }
    if (filters.search) {
      query = query.or(`region.ilike.%${filters.search}%,operator_hub.ilike.%${filters.search}%`)
    }

    const { data, error } = await query
    if (error) {
      return { data: allData, error }
    }

    if (!data || data.length === 0) {
      break
    }

    allData.push(...data)
    if (data.length < batchSize) {
      break
    }

    offset += batchSize
  }

  console.log(`getRecentKpiRecords: Finished with ${allData.length} records`)
  return { data: allData, error: null }
}

export async function createKpiRecord(record) {
  const { data, error } = await supabase
    .from('kpi_records')
    .insert([record])
    .select()
  return { data: data?.[0], error }
}

export async function updateKpiRecord(id, updates) {
  const { data, error } = await supabase
    .from('kpi_records')
    .update(updates)
    .eq('id', id)
    .select()
  return { data: data?.[0], error }
}

export async function deleteKpiRecord(id) {
  const { error } = await supabase.from('kpi_records').delete().eq('id', id)
  return { error }
}

export async function deleteAllKpiRecords() {
  const { error } = await supabase.from('kpi_records').delete().not('id', 'is', null)
  return { error }
}

// Get rider counts by operator hub from riders table
export async function getRiderHubStats() {
  const { data, error } = await supabase
    .from('riders')
    .select('operator_hub')
  
  if (error) return { data: [], error }
  
  // Count riders per hub
  const hubCounts = data.reduce((acc, item) => {
    const hub = item.operator_hub || 'Unknown'
    acc[hub] = (acc[hub] || 0) + 1
    return acc
  }, {})
  
  // Convert to array format
  const result = Object.entries(hubCounts)
    .map(([hub, riders]) => ({ hub, riders }))
    .sort((a, b) => b.riders - a.riders)
  
  return { data: result, error: null }
}
// Paginated riders for better performance
export async function getRidersPaginated(page = 0, pageSize = 100, filters = {}) {
  let query = supabase
    .from('riders')
    .select('*', { count: 'exact' })
    .range(page * pageSize, (page + 1) * pageSize - 1)
    .order('last_active', { ascending: false })
  
  if (filters.status) {
    query = query.eq('status', filters.status)
  }
  if (filters.search) {
    query = query.or(`rider_id.ilike.%${filters.search}%,rider_name.ilike.%${filters.search}%`)
  }

  const { data, error, count } = await query
  
  return { data: data || [], error, totalCount: count || 0 }
}

// Legacy function for backward compatibility
export async function getRiders(filters = {}) {
  const allData = []
  let page = 0
  const pageSize = 1000
  let hasMore = true
  
  while (hasMore) {
    let query = supabase.from('riders').select('*')
    
    if (filters.status) {
      query = query.eq('status', filters.status)
    }
    if (filters.search) {
      query = query.or(`rider_id.ilike.%${filters.search}%,rider_name.ilike.%${filters.search}%`)
    }

    const { data, error } = await query
      .order('last_active', { ascending: false })
      .range(page * pageSize, (page + 1) * pageSize - 1)
    
    if (error) {
      return { data: allData, error }
    }
    
    if (data && data.length > 0) {
      allData.push(...data)
      page++
      hasMore = data.length === pageSize
    } else {
      hasMore = false
    }
  }
  
  return { data: allData, error: null }
}

export async function getDistinctPerformanceRegions() {
  const { data, error } = await supabase
    .from('performance_records')
    .select('region')
    .not('region', 'is', null)
    .neq('region', '')
    .order('region', { ascending: true })
    .limit(1000)

  if (error) {
    return { data: [], error }
  }

  const regions = [...new Set(data.map(item => item.region).filter(Boolean))]
  return { data: regions, error: null }
}

export async function refreshRiders() {
  const { error } = await supabase.rpc('refresh_riders')
  return { error }
}

// Sync unique riders from performance_records to riders table
export async function syncRidersFromPerformance() {
  // Get all performance records
  const { data: records, error: fetchError } = await supabase
    .from('performance_records')
    .select('rider_id, driver_name, hub')
  
  if (fetchError || !records) {
    return { error: fetchError }
  }
  
  // Get unique riders
  const uniqueRiders = [...new Map(records.map(r => [r.rider_id, {
    rider_id: r.rider_id,
    rider_name: r.driver_name,
    operator_hub: r.hub,
    status: 'Active'
  }])).values()]
  
  // Upsert to riders table
  const { error } = await supabase
    .from('riders')
    .upsert(uniqueRiders, { onConflict: 'rider_id' })
  
  return { data: uniqueRiders.length, error }
}

// Get fuel management riders
export async function getFuelManagementRiders(filters = {}) {
  let query = supabase.from('fuel_management_riders').select('*')
  
  if (filters.status) {
    query = query.eq('status', filters.status)
  }
  if (filters.search) {
    query = query.or(`rider_id.ilike.%${filters.search}%,rider_name.ilike.%${filters.search}%`)
  }

  const { data, error } = await query.order('created_at', { ascending: false })
  return { data: data || [], error }
}

// Get unique riders with aggregated data (much faster than client-side grouping)
export async function getUniqueRiders() {
  const { data, error } = await supabase
    .rpc('get_unique_riders')
  return { data: data || [], error }
}
export async function batchInsertKpiRecords(records, onProgress) {
  // Single record processing to avoid database deadlocks
  const allInserted = []
  const failedRecords = []
  
  // Process one record at a time to prevent database conflicts
  for (let i = 0; i < records.length; i++) {
    const record = records[i]
    let retries = 0
    const maxRetries = 3
    let success = false
    let lastError = null
    
    while (retries < maxRetries && !success) {
      const { error } = await supabase
        .from('kpi_records')
        .insert([record]) // Insert single record
      
      if (!error) {
        allInserted.push(record)
        success = true
      } else {
        lastError = error
        // If deadlock or timeout, wait a bit before retry
        if (error.code === '40P01' || error.code === '57014') {
          await new Promise(resolve => setTimeout(resolve, 10)) // Brief pause
        }
        retries++
      }
    }
    
    if (!success) {
      failedRecords.push({ record, error: lastError })
    }
    
    // Report progress every record
    if (onProgress) {
      onProgress({
        current: i + 1,
        total: records.length,
        status: `Importing ${i + 1} of ${records.length}...`
      })
    }
    
    // No delay to prevent overwhelming the database
    if (i % 50 === 0 && i > 0) {
      await new Promise(resolve => setTimeout(resolve, 0))
    }
  }
  
  if (failedRecords.length > 0) {
    console.log(`${failedRecords.length} records failed to import`)
    return { data: allInserted, error: { message: `${failedRecords.length} records failed`, failedRecords } }
  }
  
  return { data: allInserted, error: null }
}

export async function batchInsertPerformanceRecords(records, onProgress) {
  // Single record processing to avoid database deadlocks
  const allInserted = []
  const failedRecords = []
  
  // Process one record at a time to prevent database conflicts
  for (let i = 0; i < records.length; i++) {
    const record = records[i]
    let retries = 0
    const maxRetries = 3
    let success = false
    let lastError = null
    
    while (retries < maxRetries && !success) {
      const { error } = await supabase
        .from('performance_records')
        .insert([record]) // Insert single record
      
      if (!error) {
        allInserted.push(record)
        success = true
      } else {
        lastError = error
        // If deadlock or timeout, wait a bit before retry
        if (error.code === '40P01' || error.code === '57014') {
          await new Promise(resolve => setTimeout(resolve, 10)) // Brief pause
        }
        retries++
      }
    }
    
    if (!success) {
      failedRecords.push({ record, error: lastError })
    }
    
    // Report progress every record
    if (onProgress) {
      onProgress({
        current: i + 1,
        total: records.length,
        status: `Importing ${i + 1} of ${records.length}...`
      })
    }
    
    // No delay to prevent overwhelming the database
    if (i % 50 === 0 && i > 0) {
      await new Promise(resolve => setTimeout(resolve, 0))
    }
  }
  
  if (failedRecords.length > 0) {
    console.log(`${failedRecords.length} records failed to import`)
    return { data: allInserted, error: { message: `${failedRecords.length} records failed`, failedRecords } }
  }
  
  return { data: allInserted, error: null }
}

export async function insertSinglePerformanceRecord(record) {
  const { data, error } = await supabase
    .from('performance_records')
    .insert(record)
    .select()
  // Return first item if found
  return { data: data && data.length > 0 ? data[0] : null, error }
}

// Cluster Leaders CRUD
export async function getClusterLeaders() {
  try {
    const { data, error } = await supabase
      .from('cluster_leaders')
      .select('*')
      .order('created_at', { ascending: false })
    
    // If table doesn't exist, return empty array
    if (error && error.code === 'PGRST116') {
      return { data: [], error: null }
    }
    
    return { data: data || [], error }
  } catch (err) {
    return { data: [], error: err }
  }
}

export async function createClusterLeader(record) {
  const { data, error } = await supabase
    .from('cluster_leaders')
    .insert([record])
    .select()
  return { data: data?.[0], error }
}

export async function updateClusterLeader(id, updates) {
  const { data, error } = await supabase
    .from('cluster_leaders')
    .update(updates)
    .eq('id', id)
    .select()
  return { data: data?.[0], error }
}

export async function deleteClusterLeader(id) {
  const { error } = await supabase
    .from('cluster_leaders')
    .delete()
    .eq('id', id)
  return { error }
}

// Get unique hubs from performance records efficiently
export async function getUniqueHubs() {
  const { data, error } = await supabase
    .from('performance_records')
    .select('hub')
    .not('hub', 'is', null)
    .not('hub', 'eq', '')
    .order('hub')
  
  if (error) {
    console.error('getUniqueHubs error:', error)
    return { data: [], error }
  }
  
  // Extract unique hubs
  const uniqueHubs = [...new Set(data?.map(item => item.hub).filter(Boolean) || [])]
  return { data: uniqueHubs, error }
}

// Sync cluster names to KPI records based on hub assignments
export async function syncClusterToKpiRecords(leaderName, hubs) {
  if (!hubs || hubs.length === 0) return { error: null, count: 0 }

  let totalCount = 0
  let lastError = null

  // Process hubs in batches of 2 to avoid timeout
  const batchSize = 2
  for (let i = 0; i < hubs.length; i += batchSize) {
    const batch = hubs.slice(i, i + batchSize)
    
    try {
      const { data, error, count } = await supabase
        .from('kpi_records')
        .update({ cluster: leaderName })
        .in('operator_hub', batch)
        .select('id', { count: 'exact' })

      if (error) {
        console.error(`Sync error for batch ${i}-${i + batchSize}:`, error)
        lastError = error
      } else {
        totalCount += count || 0
        console.log(`Synced batch ${i}-${i + batchSize}: ${count || 0} records`)
      }
    } catch (err) {
      console.error(`Sync error for batch ${i}-${i + batchSize}:`, err)
      lastError = err
    }
  }

  console.log(`Synced cluster "${leaderName}" to ${totalCount} total KPI records for hubs:`, hubs)
  return { error: lastError, count: totalCount }
}

// Clear cluster name from KPI records for specific hubs
export async function clearClusterFromKpiRecords(hubs) {
  if (!hubs || hubs.length === 0) return { error: null }

  let lastError = null

  // Process hubs in batches of 2 to avoid timeout
  const batchSize = 2
  for (let i = 0; i < hubs.length; i += batchSize) {
    const batch = hubs.slice(i, i + batchSize)
    
    try {
      const { error } = await supabase
        .from('kpi_records')
        .update({ cluster: '' })
        .in('operator_hub', batch)

      if (error) {
        console.error(`Clear error for batch ${i}-${i + batchSize}:`, error)
        lastError = error
      }
    } catch (err) {
      console.error(`Clear error for batch ${i}-${i + batchSize}:`, err)
      lastError = err
    }
  }

  return { error: lastError }
}

// Check which hubs exist in KPI records
export async function checkHubsInKpiRecords(hubs) {
  if (!hubs || hubs.length === 0) return { found: [], notFound: [] }

  const { data, error } = await supabase
    .from('kpi_records')
    .select('operator_hub')
    .in('operator_hub', hubs)

  if (error) {
    return { found: [], notFound: hubs, error }
  }

  const foundHubs = [...new Set(data?.map(r => r.operator_hub) || [])]
  const notFoundHubs = hubs.filter(hub => !foundHubs.includes(hub))

  return { found: foundHubs, notFound: notFoundHubs }
}
