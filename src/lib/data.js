import { supabase } from './supabase'

// Dashboard metrics from aggregated table
export async function getDashboardMetrics() {
  const { data, error } = await supabase
    .from('dashboard_metrics')
    .select('*')
    .order('date', { ascending: false })

  return { data: data || [], error }
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
  console.log('getPerformanceRecords: Starting batch fetch...')
  
  // First get total count
  const { count: totalCount } = await supabase
    .from('performance_records')
    .select('*', { count: 'exact' })
  
  console.log(`Total records in database: ${totalCount}`)
  
  // Fetch in batches to ensure all records are loaded
  const batchSize = 5000
  const allData = []
  let offset = 0
  let hasMore = true
  
  while (hasMore && offset < totalCount) {
    let query = supabase
      .from('performance_records')
      .select('*')
      .order('date', { ascending: false })
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
    
    if (data && data.length > 0) {
      allData.push(...data)
      offset += data.length
      hasMore = offset < totalCount
      console.log(`Batch ${Math.floor(offset/batchSize) + 1}: Fetched ${data.length} records, total so far: ${allData.length}`)
    } else {
      hasMore = false
    }
  }

  console.log(`getPerformanceRecords: Finished with ${allData.length} total records`)
  return { data: allData, error: null }
}

// Optimized function to fetch only recent performance data for dashboard
export async function getRecentPerformanceRecords(days = 30, filters = {}) {
  console.log(`getRecentPerformanceRecords: Fetching last ${days} days...`)
  
  const daysAgo = new Date()
  daysAgo.setDate(daysAgo.getDate() - days)
  
  let query = supabase
    .from('performance_records')
    .select('*')
    .gte('date', daysAgo.toISOString().split('T')[0])
    .order('date', { ascending: false })
  
  if (filters.hub) {
    query = query.eq('hub', filters.hub)
  }
  if (filters.hubs && filters.hubs.length > 0) {
    query = query.in('hub', filters.hubs)
  }
  
  const { data, error } = await query
  
  console.log(`getRecentPerformanceRecords: Finished with ${data?.length || 0} records`)
  return { data: data || [], error }
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
export async function getKpiRecords(filters = {}) {
  console.log('getKpiRecords: Starting optimized fetch...')
  
  let query = supabase
    .from('kpi_records')
    .select('*')
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

  const { data, error } = await query
  
  console.log(`getKpiRecords: Finished with ${data?.length || 0} records`)
  return { data: data || [], error }
}

// Optimized function to fetch only recent KPI data for dashboard
export async function getRecentKpiRecords(days = 30, filters = {}) {
  console.log(`getRecentKpiRecords: Fetching last ${days} days...`)
  
  const daysAgo = new Date()
  daysAgo.setDate(daysAgo.getDate() - days)
  
  let query = supabase
    .from('kpi_records')
    .select('*')
    .gte('date', daysAgo.toISOString().split('T')[0])
    .order('date', { ascending: false })
  
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
  
  console.log(`getRecentKpiRecords: Finished with ${data?.length || 0} records`)
  return { data: data || [], error }
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
