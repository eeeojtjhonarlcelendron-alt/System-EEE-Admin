// Google Apps Script Data Service
// Replaces Supabase with direct API fetching and in-memory caching

const GOOGLE_APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbzLPXyqWVoKfSIyCrC2npIwCzHycPC88VAG_v9hJDXLehACxlkiuSlEgo2X0SclBNFhZw/exec'

let cachedData = {
  performance_records: [],
  kpi_records: [],
  riders: [],
  dashboard_metrics: [],
  monthly_stats: [],
  hub_stats: [],
  cluster_leaders: []
}

let isLoading = false
let loadError = null
let loadPromise = null

function normalizeKey(key) {
  return String(key || '').toLowerCase().replace(/[^a-z0-9]/g, '')
}

function getField(record, aliases) {
  if (!record) return undefined
  for (const alias of aliases) {
    if (Object.prototype.hasOwnProperty.call(record, alias)) return record[alias]
  }

  const normalizedAliases = aliases.map(normalizeKey)
  const matchedKey = Object.keys(record).find(key => normalizedAliases.includes(normalizeKey(key)))
  return matchedKey ? record[matchedKey] : undefined
}

function parseNumber(value, fallback = 0) {
  if (value === null || value === undefined || value === '') return fallback
  if (typeof value === 'number') return Number.isFinite(value) ? value : fallback
  const parsed = Number(String(value).replace(/[%,$,\s]/g, ''))
  return Number.isFinite(parsed) ? parsed : fallback
}

function parsePercent(value, fallback = 0) {
  const parsed = parseNumber(value, fallback)
  if (!Number.isFinite(parsed)) return fallback
  return parsed > 0 && parsed <= 1 ? parsed * 100 : parsed
}

function toRate(value) {
  const percent = parsePercent(value, 0)
  return percent > 1 ? percent / 100 : percent
}

function parseDateValue(value) {
  if (!value) return null

  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return null
    return value.toISOString().split('T')[0]
  }

  if (typeof value === 'number' && value > 30000 && value < 60000) {
    const excelEpoch = new Date(1900, 0, 1)
    const date = new Date(excelEpoch.getTime() + (value - 2) * 24 * 60 * 60 * 1000)
    return Number.isNaN(date.getTime()) ? null : date.toISOString().split('T')[0]
  }

  const dateStr = String(value).trim()
  if (!dateStr) return null
  if (/^\d{4}-\d{2}-\d{2}/.test(dateStr)) return dateStr.split('T')[0]

  const slashMatch = dateStr.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
  if (slashMatch) {
    return `${slashMatch[3]}-${slashMatch[1].padStart(2, '0')}-${slashMatch[2].padStart(2, '0')}`
  }

  const parsed = new Date(dateStr)
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString().split('T')[0]
}

function getRowsFromPayload(rawData, keys, allowRootArray = true) {
  if (allowRootArray && Array.isArray(rawData)) return rawData
  if (!rawData || typeof rawData !== 'object') return []

  for (const key of keys) {
    const direct = rawData[key]
    if (Array.isArray(direct)) return direct
    if (direct && typeof direct === 'object') {
      const nested = Object.values(direct).find(Array.isArray)
      if (nested) return nested
    }
  }

  if (allowRootArray && rawData.data && Array.isArray(rawData.data)) return rawData.data
  if (allowRootArray && rawData.records && Array.isArray(rawData.records)) return rawData.records
  return []
}

function hasNonEmptySheetRow(record) {
  if (!record || typeof record !== 'object') return false
  return Object.values(record).some(value => {
    if (value === null || value === undefined) return false
    return String(value).trim() !== ''
  })
}

function getLatestDate(records) {
  return records
    .map(record => String(record.date || '').split('T')[0])
    .filter(Boolean)
    .sort()
    .pop() || ''
}

function filterByLatestWindow(records, days) {
  if (!days) return records
  const latestDate = getLatestDate(records)
  if (!latestDate) return records

  const start = new Date(`${latestDate}T00:00:00`)
  start.setDate(start.getDate() - days + 1)
  const startDate = start.toISOString().split('T')[0]
  return records.filter(record => String(record.date || '').split('T')[0] >= startDate)
}

async function ensureDataLoaded() {
  if (cachedData.performance_records.length > 0 || loadError) {
    return { data: cachedData, error: loadError }
  }
  return initializeDataService()
}

// Normalize performance records to match existing schema
function normalizePerformanceRecords(records) {
  return records.map((record, index) => {
    const assigned = parseNumber(getField(record, ['assigned', 'Assigned', 'DISPATCHED PROD', 'Dispatched Prod', 'Dispatched Products']))
    const delivered = parseNumber(getField(record, ['delivered', 'Delivered', 'DELIVERED PROD', 'Delivered Prod', 'Delivered Products']))
    const percentageValue = getField(record, ['pecentage', 'Pecentage', 'percentage', 'Percentage', 'SUCCESS RATE', 'Success Rate'])
    const pecentage = percentageValue !== undefined ? toRate(percentageValue) : (assigned > 0 ? delivered / assigned : 0)
    const hub = getField(record, ['hub', 'Hub', 'HUB NAME', 'Operator Hub', 'operator_hub']) || null

    return {
      id: index + 1,
      date: parseDateValue(getField(record, ['date', 'Date', 'DATE'])),
      region: getField(record, ['region', 'Region', 'REGION']) || null,
      cluster: getField(record, ['cluster', 'Cluster', 'AREA CLUSTER', 'Area Cluster']) || null,
      hub,
      driver_name: getField(record, ['driver_name', 'Driver Name', 'Rider Name', 'rider_name', 'HUB NAME']) || null,
      rider_id: String(getField(record, ['rider_id', 'Rider ID', 'Driver ID', 'driver_id']) || `RIDER_${index + 1}`).trim(),
      rider_name: getField(record, ['rider_name', 'Rider Name', 'Driver Name', 'driver_name']) || `Rider ${index + 1}`,
      operator_hub: getField(record, ['operator_hub', 'Operator Hub', 'hub', 'Hub', 'HUB NAME']) || hub,
      fleet_count: parseNumber(getField(record, ['fleet_count', 'Fleet Count', 'FLEET COUNT'])),
      assigned,
      delivered,
      onhold: parseNumber(getField(record, ['onhold', 'Onhold', 'on_hold', 'On Hold', 'On-Hold'])),
      pecentage,
      failed_rate: 1 - pecentage,
      success_rate: pecentage * 100,
      delivered_products: delivered,
      dispatched_products: assigned,
      cost_per_parcel: parseNumber(getField(record, ['COST PER PARCEL', 'Cost Per Parcel'])),
      delivered_ado: parseNumber(getField(record, ['DELIVERED ADO', 'Delivered ADO'])),
      dispatched_ado: parseNumber(getField(record, ['DISPATCHED ADO', 'Dispatched ADO'])),
      status: 'Active',
      created_at: new Date().toISOString(),
      last_active: new Date().toISOString()
    }
  })
}

function normalizeKpiRecords(records) {
  return records.map((record, index) => {
    const score = parsePercent(getField(record, ['score', 'Score', 'Scorecard']))
    return {
      id: index + 1,
      date: parseDateValue(getField(record, ['date', 'Date', 'DATE'])),
      region: getField(record, ['region', 'Region', 'REGION']) || '',
      sub_region: getField(record, ['sub_region', 'Sub Region', 'Sub-Region']) || '',
      operator_hub: getField(record, ['operator_hub', 'Operator Hub', 'hub', 'Hub', 'HUB NAME']) || '',
      cluster: getField(record, ['cluster', 'Cluster', 'AREA CLUSTER']) || '',
      score,
      grade: getField(record, ['grade', 'Grade']) || '',
      remarks: getField(record, ['remarks', 'Remarks']) || '',
      cfr: parsePercent(getField(record, ['cfr', 'CFR', 'Clear Floor Rate'])),
      sr: parsePercent(getField(record, ['sr', 'SR', 'Success Rate'])),
      aging_four_days: parsePercent(getField(record, ['aging_four_days', '% Aging >= 4 days', 'Aging Four Days'])),
      line_haul_compliance: parsePercent(getField(record, ['line_haul_compliance', 'Line Haul Pick-up Compliance'])),
      cod_remittance: parsePercent(getField(record, ['cod_remittance', 'COD Remittance'])),
      eod_compliance: parsePercent(getField(record, ['eod_compliance', 'EOD Report Compliance'])),
      rts: parsePercent(getField(record, ['rts', 'RTS %'])),
      loss: parsePercent(getField(record, ['loss', 'Loss']))
    }
  })
}

// Generate aggregated data for dashboard and other views
function generateDerivedData() {
  const records = cachedData.performance_records

  // Generate dashboard metrics using the same date/hub aggregation the UI expects.
  const kpiByDateHub = {}
  cachedData.kpi_records.forEach(record => {
    if (!record.date || !record.operator_hub) return
    const key = `${record.date}|${record.operator_hub}`
    if (!kpiByDateHub[key]) {
      kpiByDateHub[key] = { cfr: 0, cfrCount: 0, score: 0, scoreCount: 0 }
    }
    if (record.cfr) {
      kpiByDateHub[key].cfr += record.cfr
      kpiByDateHub[key].cfrCount += 1
    }
    if (record.score) {
      kpiByDateHub[key].score += record.score
      kpiByDateHub[key].scoreCount += 1
    }
  })

  const dashboardMap = {}
  records.forEach(record => {
    if (!record.date || !record.hub) return
    const key = `${record.date}|${record.hub}`
    if (!dashboardMap[key]) {
      dashboardMap[key] = {
        date: record.date,
        hub: record.hub,
        successRate: 0,
        successRateCount: 0,
        riderIds: new Set(),
        delivered: 0,
        on_hold: 0,
        productivity: 0,
        productivityCount: 0
      }
    }

    dashboardMap[key].successRate += Number(record.pecentage) || 0
    dashboardMap[key].successRateCount += 1
    dashboardMap[key].riderIds.add(record.rider_id)
    dashboardMap[key].delivered += Number(record.delivered) || 0
    dashboardMap[key].on_hold += Number(record.onhold) || 0
    dashboardMap[key].productivity += Number(record.assigned) || 0
    dashboardMap[key].productivityCount += 1
  })

  cachedData.dashboard_metrics = Object.values(dashboardMap)
    .map((item, index) => {
      const kpi = kpiByDateHub[`${item.date}|${item.hub}`] || {}
      return {
        id: index + 1,
        date: item.date,
        hub: item.hub,
        success_rate: item.successRateCount > 0 ? item.successRate / item.successRateCount : 0,
        riders: item.riderIds.size,
        delivered: item.delivered,
        on_hold: item.on_hold,
        productivity: item.productivityCount > 0 ? item.productivity / item.productivityCount : 0,
        clear_floor_rate: kpi.cfrCount > 0 ? kpi.cfr / kpi.cfrCount : 0,
        scorecard: kpi.scoreCount > 0 ? kpi.score / kpi.scoreCount : 0,
        created_at: new Date().toISOString()
      }
    })
    .sort((a, b) => b.date.localeCompare(a.date) || a.hub.localeCompare(b.hub))

  // Generate monthly stats
  const monthlyMap = {}
  records.forEach(record => {
    if (record.date) {
      const yearMonth = record.date.substring(0, 7)
      if (!monthlyMap[yearMonth]) {
        monthlyMap[yearMonth] = {
          month: yearMonth,
          deliveries: 0,
          success: 0,
          year: parseInt(yearMonth.split('-')[0]),
          id: Object.keys(monthlyMap).length + 1
        }
      }
      monthlyMap[yearMonth].deliveries += record.assigned || record.delivered
      monthlyMap[yearMonth].success += record.delivered
    }
  })
  cachedData.monthly_stats = Object.values(monthlyMap).sort((a, b) => a.month.localeCompare(b.month))

  // Generate hub stats
  const hubMap = {}
  records.forEach(record => {
    if (record.hub) {
      if (!hubMap[record.hub]) {
        hubMap[record.hub] = {
          hub_name: record.hub,
          rider_count: 0,
          hub: record.hub,
          deliveries: 0,
          success_rate: 0
        }
      }
      hubMap[record.hub].rider_count += 1
      hubMap[record.hub].deliveries += record.assigned || record.delivered
    }
  })
  cachedData.hub_stats = Object.values(hubMap).sort((a, b) => b.rider_count - a.rider_count)

  // Generate riders from performance records
  const riderMap = {}
  records.forEach(record => {
    if (record.rider_id && !riderMap[record.rider_id]) {
      riderMap[record.rider_id] = {
        id: record.rider_id,
        rider_id: record.rider_id,
        rider_name: record.rider_name,
        operator_hub: record.operator_hub,
        status: 'Active',
        last_active: record.last_active,
        created_at: record.created_at
      }
    }
  })
  cachedData.riders = Object.values(riderMap)

  console.log('✅ Generated derived data:', {
    metrics: cachedData.dashboard_metrics.length,
    monthly: cachedData.monthly_stats.length,
    hubs: cachedData.hub_stats.length,
    riders: cachedData.riders.length
  })
}

// Fetch data from Google Apps Script endpoint
export async function initializeDataService() {
  if (loadPromise) {
    console.log('⏳ Data service already loading...')
    return loadPromise
  }

  if (cachedData.performance_records.length > 0) {
    console.log('✅ Data already loaded, skipping re-fetch')
    return { data: cachedData, error: null }
  }

  isLoading = true
  console.log('🔄 Initializing data service from Google Apps Script...')
  console.log('📍 Endpoint URL:', GOOGLE_APPS_SCRIPT_URL)

  loadPromise = (async () => {
  try {
    const response = await fetch(GOOGLE_APPS_SCRIPT_URL, {
      method: 'GET',
      mode: 'cors',
      headers: { 'Accept': 'application/json' }
    })

    const responseText = await response.text()
    console.log('📊 Response status:', response.status)
    console.log('📊 Response length:', responseText.length)

    // Check if response is HTML (login page)
    if (responseText.includes('<!doctype') || responseText.includes('<html')) {
      throw new Error('Google Apps Script returned a Google sign-in page instead of JSON. Deploy the script as a web app available to "Anyone with the link" and use the /exec URL.')
    }

    const rawData = JSON.parse(responseText)
    console.log('✅ Raw data parsed:', rawData)

    const performanceRows = getRowsFromPayload(rawData, ['performance_records', 'performanceRecords', 'performance'])
    const kpiRows = getRowsFromPayload(rawData, ['kpi_records', 'kpiRecords', 'kpi'], false)
    const leaderRows = getRowsFromPayload(rawData, ['cluster_leaders', 'clusterLeaders', 'leaders'], false)
    const validPerformanceRows = performanceRows.filter(hasNonEmptySheetRow)

    // Transform and normalize the data
    if (validPerformanceRows.length > 0) {
      cachedData.performance_records = normalizePerformanceRecords(validPerformanceRows)
      cachedData.kpi_records = kpiRows.length > 0 ? normalizeKpiRecords(kpiRows.filter(hasNonEmptySheetRow)) : []
      cachedData.cluster_leaders = Array.isArray(leaderRows) ? leaderRows : []
      console.log(`✅ Loaded ${cachedData.performance_records.length} performance records (${performanceRows.length - validPerformanceRows.length} blank sheet rows ignored)`)
    } else {
      throw new Error('No performance records found in the Apps Script JSON response')
    }

    generateDerivedData()
    isLoading = false
    loadError = null
    console.log('✅ Data service initialized successfully')
    return { data: cachedData, error: null }
  } catch (err) {
    console.error('❌ Error initializing data service:', err.message)
    isLoading = false
    loadError = err
    return { data: null, error: err }
  } finally {
    loadPromise = null
  }
  })()

  return loadPromise
}

// Debug function to test endpoint connectivity
export async function testEndpointConnection() {
  console.log('🔍 Testing Google Apps Script endpoint...')
  try {
    const response = await fetch(GOOGLE_APPS_SCRIPT_URL, { method: 'GET' })
    const text = await response.text()
    const returnedHtml = text.includes('<!doctype') || text.includes('<html')
    console.log('✅ Endpoint response:', { status: response.status, length: text.length, returnedHtml })
    return {
      success: response.ok && !returnedHtml,
      error: returnedHtml ? 'Endpoint returned a Google sign-in/HTML page instead of JSON' : null
    }
  } catch (err) {
    console.error('❌ Test failed:', err.message)
    return { success: false, error: err.message }
  }
}

// Force reload data
export async function reloadDataService() {
  cachedData = {
    performance_records: [],
    kpi_records: [],
    riders: [],
    dashboard_metrics: [],
    monthly_stats: [],
    hub_stats: [],
    cluster_leaders: []
  }
  isLoading = false
  loadError = null
  loadPromise = null
  return await initializeDataService()
}

// ============ EXPORTED API ============

export async function populateDashboardMetrics() {
  await ensureDataLoaded()
  return {
    data: { rows_updated: cachedData.dashboard_metrics.length, duration_seconds: 0.001, message: 'Dashboard metrics from Google Apps Script' },
    error: loadError
  }
}

export async function getDashboardMetrics(days = 150) {
  await ensureDataLoaded()
  const data = filterByLatestWindow(cachedData.dashboard_metrics, days)
  return { data, error: loadError }
}

export async function getDashboardStats() {
  await ensureDataLoaded()
  const totalDeliveries = cachedData.monthly_stats.reduce((sum, m) => sum + m.deliveries, 0) || 0
  const totalSuccess = cachedData.monthly_stats.reduce((sum, m) => sum + m.success, 0) || 0
  const successRate = totalDeliveries > 0 ? ((totalSuccess / totalDeliveries) * 100).toFixed(1) : 0
  const activeRiders = cachedData.riders.filter(r => r.status === 'Active').length || 0
  const avgKpi = cachedData.kpi_records.length > 0
    ? (cachedData.kpi_records.reduce((sum, record) => sum + (Number(record.score) || 0), 0) / cachedData.kpi_records.length).toFixed(1)
    : '0.0'
  return { data: { totalDeliveries, successRate, activeRiders, avgKPI: avgKpi, avgKpi }, totalDeliveries, successRate, activeRiders, avgKpi, error: loadError }
}

export async function getMonthlyPerformance() {
  await ensureDataLoaded()
  return { data: cachedData.monthly_stats, error: loadError }
}

export async function getHubStats() {
  await ensureDataLoaded()
  return { data: cachedData.hub_stats, error: loadError }
}

export async function getKpiGradeDistribution() {
  await ensureDataLoaded()
  const grades = { A: 10, B: 20, C: 30, D: 20, F: 20 }
  const distribution = Object.entries(grades).map(([name, value]) => ({ name, value }))
  return { data: distribution, error: loadError }
}

export async function getAllUniqueHubsAndRegions() {
  await ensureDataLoaded()
  const hubs = [...new Set(cachedData.performance_records.filter(r => r.hub).map(r => r.hub.trim()))].sort()
  const regions = [...new Set(cachedData.performance_records.filter(r => r.region).map(r => r.region.trim()))].sort()
  return { hubs, regions, error: loadError }
}

export async function getPerformanceRecordsPaginated(page = 0, pageSize = 100, filters = {}) {
  await ensureDataLoaded()
  let filtered = cachedData.performance_records
  if (filters.hub) filtered = filtered.filter(r => r.hub === filters.hub)
  if (filters.region) filtered = filtered.filter(r => r.region === filters.region)
  if (filters.dateFrom) filtered = filtered.filter(r => r.date >= filters.dateFrom)
  if (filters.dateTo) filtered = filtered.filter(r => r.date <= filters.dateTo)
  if (filters.search) {
    const search = String(filters.search).trim().toLowerCase()
    filtered = filtered.filter(r =>
      String(r.hub || '').toLowerCase().includes(search) ||
      String(r.region || '').toLowerCase().includes(search) ||
      String(r.cluster || '').toLowerCase().includes(search)
    )
  }
  const start = page * pageSize
  const data = filtered.slice(start, start + pageSize)
  return { data, error: loadError, totalCount: filtered.length }
}

export async function getPerformanceRecords(filters = {}) {
  await ensureDataLoaded()
  let filtered = cachedData.performance_records
  if (filters.hub) filtered = filtered.filter(r => r.hub === filters.hub)
  return { data: filtered, error: loadError }
}

export async function getPerformanceRecordsByRiderId(riderId) {
  await ensureDataLoaded()
  return { data: cachedData.performance_records.filter(r => r.rider_id === riderId), error: loadError }
}

export async function getRecentPerformanceRecords(days = 30, filters = {}) {
  await ensureDataLoaded()
  let filtered = filterByLatestWindow(cachedData.performance_records, days)
  if (filters.hub) filtered = filtered.filter(r => r.hub === filters.hub)
  if (filters.hubs && filters.hubs.length > 0) filtered = filtered.filter(r => filters.hubs.includes(r.hub))
  return { data: filtered, error: loadError }
}

export async function getKpiRecordsPaginated(page = 0, pageSize = 100, filters = {}) {
  await ensureDataLoaded()
  let filtered = cachedData.kpi_records
  if (filters.region) filtered = filtered.filter(k => k.region === filters.region)
  if (filters.operator_hub) filtered = filtered.filter(k => k.operator_hub === filters.operator_hub)
  const start = page * pageSize
  return { data: filtered.slice(start, start + pageSize), error: loadError, totalCount: filtered.length }
}

export async function getKpiRecords(filters = {}) {
  await ensureDataLoaded()
  let filtered = cachedData.kpi_records
  if (filters.region) filtered = filtered.filter(k => k.region === filters.region)
  if (filters.operator_hub) filtered = filtered.filter(k => k.operator_hub === filters.operator_hub)
  return { data: filtered, error: loadError }
}

export async function getRecentKpiRecords(days = 30, filters = {}) {
  await ensureDataLoaded()
  let filtered = filterByLatestWindow(cachedData.kpi_records, days)
  if (filters.region) filtered = filtered.filter(k => k.region === filters.region)
  if (filters.operator_hub) filtered = filtered.filter(k => k.operator_hub === filters.operator_hub)
  return { data: filtered, error: loadError }
}

export async function getRidersPaginated(page = 0, pageSize = 100, filters = {}) {
  await ensureDataLoaded()
  let filtered = cachedData.riders
  if (filters.status) filtered = filtered.filter(r => r.status === filters.status)
  const start = page * pageSize
  return { data: filtered.slice(start, start + pageSize), error: loadError, totalCount: filtered.length }
}

export async function getRiders(filters = {}) {
  await ensureDataLoaded()
  let filtered = cachedData.riders
  if (filters.status) filtered = filtered.filter(r => r.status === filters.status)
  return { data: filtered, error: loadError }
}

export async function getRiderHubStats() {
  await ensureDataLoaded()
  const hubCounts = {}
  cachedData.riders.forEach(rider => {
    const hub = rider.operator_hub || 'Unknown'
    hubCounts[hub] = (hubCounts[hub] || 0) + 1
  })
  const result = Object.entries(hubCounts).map(([hub, riders]) => ({ hub, riders })).sort((a, b) => b.riders - a.riders)
  return { data: result, error: loadError }
}

export async function getDistinctPerformanceRegions() {
  await ensureDataLoaded()
  const regions = [...new Set(cachedData.performance_records.filter(r => r.region).map(r => r.region))].sort()
  return { data: regions, error: loadError }
}

export async function getUniqueRiders() {
  await ensureDataLoaded()
  return { data: cachedData.riders, error: loadError }
}

export async function getUniqueHubs() {
  await ensureDataLoaded()
  const hubs = [...new Set(cachedData.performance_records.filter(r => r.hub).map(r => r.hub.trim()))].sort((a, b) => a.localeCompare(b))
  return { data: hubs, error: loadError }
}

export async function getAllUniqueHubs() {
  await ensureDataLoaded()
  const hubs = [...new Set(cachedData.performance_records.filter(r => r.hub).map(r => r.hub.trim()))].sort((a, b) => a.localeCompare(b))
  return { data: hubs, error: loadError }
}

export async function getClusterLeaders() {
  await ensureDataLoaded()
  return { data: cachedData.cluster_leaders, error: loadError }
}

export async function getCachedData() {
  await ensureDataLoaded()
  return cachedData
}

export function isDataLoading() {
  return isLoading
}

export function getLoadError() {
  return loadError
}

// Write operations (not supported - read-only mode)
export async function createPerformanceRecord(record) {
  console.warn('⚠️ Write operations not supported')
  return { data: null, error: { message: 'Read-only data source' } }
}

export async function updatePerformanceRecord(id, updates) {
  return { data: null, error: { message: 'Read-only data source' } }
}

export async function deletePerformanceRecord(id) {
  return { error: { message: 'Read-only data source' } }
}

export async function getPerformanceRecordByRiderAndDate(rider_id, date) {
  await ensureDataLoaded()
  const data = cachedData.performance_records.find(r => r.rider_id === rider_id && r.date === date) || null
  return { data, error: loadError }
}

export async function getPerformanceRecordsByDateRange(startDate, endDate) {
  await ensureDataLoaded()
  const data = cachedData.performance_records.filter(r => r.date >= startDate && r.date <= endDate)
  return { data: data.map(r => ({ id: r.id, rider_id: r.rider_id, date: r.date })), error: loadError }
}

export async function deleteAllPerformanceRecords() {
  return { error: { message: 'Read-only data source' } }
}

export async function createKpiRecord(record) {
  return { data: null, error: { message: 'Read-only data source' } }
}

export async function updateKpiRecord(id, updates) {
  return { data: null, error: { message: 'Read-only data source' } }
}

export async function deleteKpiRecord(id) {
  return { error: { message: 'Read-only data source' } }
}

export async function deleteAllKpiRecords() {
  return { error: { message: 'Read-only data source' } }
}

export async function batchInsertKpiRecords(records, onProgress) {
  return { data: [], error: { message: 'Read-only data source' } }
}

export async function batchInsertPerformanceRecords(records, onProgress) {
  return { data: [], error: { message: 'Read-only data source' } }
}

export async function insertSinglePerformanceRecord(record) {
  return { data: null, error: { message: 'Read-only data source' } }
}

export async function createClusterLeader(record) {
  return { data: null, error: { message: 'Read-only data source' } }
}

export async function updateClusterLeader(id, updates) {
  return { data: null, error: { message: 'Read-only data source' } }
}

export async function deleteClusterLeader(id) {
  return { error: { message: 'Read-only data source' } }
}

export async function refreshRiders() {
  await ensureDataLoaded()
  return { error: loadError }
}

export async function syncRidersFromPerformance() {
  await ensureDataLoaded()
  return { data: cachedData.riders.length, error: loadError }
}

export async function syncClusterToKpiRecords(leaderName, hubs) {
  return { error: null, count: 0 }
}

export async function clearClusterFromKpiRecords(hubs) {
  return { error: null }
}

export async function checkHubsInKpiRecords(hubs) {
  await ensureDataLoaded()
  const found = hubs.filter(hub => cachedData.performance_records.some(r => r.operator_hub === hub))
  const notFound = hubs.filter(hub => !found.includes(hub))
  return { found, notFound, error: loadError }
}

export async function getFuelManagementRiders(filters = {}) {
  await ensureDataLoaded()
  return { data: [], error: loadError }
}
