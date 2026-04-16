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

// Fetch all records (for export) - use sparingly
export async function getPerformanceRecords(filters = {}) {
  const allData = []
  let page = 0
  const pageSize = 1000
  let hasMore = true

  console.log('getPerformanceRecords: Starting fetch...')

  while (hasMore) {
    let query = supabase
      .from('performance_records')
      .select('*')
      .range(page * pageSize, (page + 1) * pageSize - 1)
      .order('created_at', { ascending: false })
    
    if (filters.hub) {
      query = query.eq('hub', filters.hub)
    }
    if (filters.search) {
      query = query.or(`rider_id.ilike.%${filters.search}%,driver_name.ilike.%${filters.search}%`)
    }

    const { data, error } = await query
    
    console.log(`getPerformanceRecords: Page ${page}, fetched ${data?.length || 0} records, error:`, error)
    
    if (error) {
      return { data: allData, error }
    }
    
    if (data && data.length > 0) {
      allData.push(...data)
      page++
      hasMore = data.length === pageSize
      console.log(`getPerformanceRecords: Total so far: ${allData.length}, hasMore: ${hasMore}`)
    } else {
      hasMore = false
    }
  }

  console.log(`getPerformanceRecords: Finished with ${allData.length} total records`)
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
export async function getKpiRecords(filters = {}) {
  let query = supabase.from('kpi_records').select('*')
  
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

  const { data, error } = await query.order('date', { ascending: false })
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

// Get unique riders with aggregated data (much faster than client-side grouping)
export async function getUniqueRiders() {
  const { data, error } = await supabase
    .rpc('get_unique_riders')
  return { data: data || [], error }
}
export async function batchInsertKpiRecords(records) {
  const { data, error } = await supabase
    .from('kpi_records')
    .insert(records)
    .select()
  return { data, error }
}

export async function batchInsertPerformanceRecords(records) {
  // Try upsert to handle conflicts automatically
  const { data, error } = await supabase
    .from('performance_records')
    .upsert(records, { onConflict: 'rider_id,date' })
    .select()
  return { data, error }
}

export async function insertSinglePerformanceRecord(record) {
  const { data, error } = await supabase
    .from('performance_records')
    .insert(record)
    .select()
  // Return first item if found
  return { data: data && data.length > 0 ? data[0] : null, error }
}
