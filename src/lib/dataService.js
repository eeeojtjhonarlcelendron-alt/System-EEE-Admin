// Google Apps Script Data Service
// Replaces Supabase with direct API fetching and in-memory caching

const GOOGLE_APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbzLPXyqWVoKfSIyCrC2npIwCzHycPC88VAG_v9hJDXLehACxlkiuSlEgo2X0SclBNFhZw/exec'
const GOOGLE_APPS_SCRIPT_URL_KPI = 'https://script.googleusercontent.com/macros/echo?user_content_key=AUkAhnTABVGGXJNJD432l_j22t4I6swIhbfaxbFeTHThuBHVCK24r8LhJt5UI57FKacKz_fXhohUUNmH_4qjAue_-rjqZ0BCD9DfkpH8Ge05zjtrP-MUkkafZyhURqKQUfGoVhhsa6f7HK1C4u2qzhDo0X7SSC97BpGrLOOevyuMPKTeAU-UUdjgw9A6ZfoYUAUZsT2kZ9DhXNRLClGMJHmRXkgKKotahg_9S1l8jTbcYilhp6Ao7ylL2qrp6HqrNS0xpyNSRR1jMBoSCqUGcBV1oYBYEq0rew&lib=MrcdDGzPSjUf-t6od-II_Fq6F0VeJqtgy'

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

let kpiIsLoading = false
let kpiLoadError = null
let kpiLoadPromise = null

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

function formatLocalDate(date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function formatUtcDate(date) {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return null
  const year = date.getUTCFullYear()
  const month = String(date.getUTCMonth() + 1).padStart(2, '0')
  const day = String(date.getUTCDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function addDaysToDate(dateString, days = 1) {
  const date = new Date(`${dateString}T00:00:00Z`)
  if (Number.isNaN(date.getTime())) return null
  date.setUTCDate(date.getUTCDate() + days)
  return formatUtcDate(date)
}

function parseDateValue(value) {
  if (value === null || value === undefined || value === '') return null

  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return null
    return formatLocalDate(value)
  }

  if (typeof value === 'number' && value > 30000 && value < 60000) {
    const excelEpoch = new Date(1900, 0, 1)
    const date = new Date(excelEpoch.getTime() + (value - 2) * 24 * 60 * 60 * 1000)
    return Number.isNaN(date.getTime()) ? null : formatLocalDate(date)
  }

  let dateStr = String(value).trim()
  if (!dateStr) return null

  if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    return dateStr
  }

  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:?\d{2})?$/.test(dateStr)) {
    const parsed = new Date(dateStr)
    return Number.isNaN(parsed.getTime()) ? null : formatLocalDate(parsed)
  }

  const normalized = dateStr.split(' ')[0].replace(/\//g, '-')
  const isoMatch = normalized.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/)
  if (isoMatch) {
    return `${isoMatch[1]}-${isoMatch[2].padStart(2, '0')}-${isoMatch[3].padStart(2, '0')}`
  }

  const mdyMatch = normalized.match(/^(\d{1,2})-(\d{1,2})-(\d{4})$/)
  if (mdyMatch) {
    return `${mdyMatch[3]}-${mdyMatch[1].padStart(2, '0')}-${mdyMatch[2].padStart(2, '0')}`
  }

  const dmyMatch = normalized.match(/^(\d{1,2})-(\d{1,2})-(\d{2})$/)
  if (dmyMatch) {
    const year = Number(dmyMatch[3])
    const fullYear = year < 50 ? 2000 + year : 1900 + year
    return `${fullYear}-${dmyMatch[1].padStart(2, '0')}-${dmyMatch[2].padStart(2, '0')}`
  }

  const parsed = new Date(dateStr)
  return Number.isNaN(parsed.getTime()) ? null : formatLocalDate(parsed)
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

async function ensureKpiDataLoaded() {
  if (cachedData.kpi_records.length > 0 || kpiLoadError) {
    return { data: cachedData.kpi_records, error: kpiLoadError }
  }
  return initializeKpiDataService()
}

export async function initializeKpiDataService() {
  if (kpiLoadPromise) {
    console.log('⏳ KPI data service already loading...')
    return kpiLoadPromise
  }

  if (cachedData.kpi_records.length > 0) {
    console.log('✅ KPI data already loaded, skipping re-fetch')
    return { data: cachedData.kpi_records, error: null }
  }

  kpiIsLoading = true
  console.log('🔄 Initializing KPI data service from Google Apps Script...')
  console.log('📍 KPI Endpoint URL:', GOOGLE_APPS_SCRIPT_URL_KPI)

  kpiLoadPromise = (async () => {
    try {
      const response = await fetch(GOOGLE_APPS_SCRIPT_URL_KPI, {
        method: 'GET',
        mode: 'cors',
        headers: { 'Accept': 'application/json' }
      })

      const responseText = await response.text()
      console.log('📊 KPI response status:', response.status)
      console.log('📊 KPI response length:', responseText.length)

      if (responseText.includes('<!doctype') || responseText.includes('<html')) {
        throw new Error('Google Apps Script KPI endpoint returned a Google sign-in page or HTML instead of JSON.')
      }

      const rawData = JSON.parse(responseText)
      const kpiRows = getRowsFromPayload(rawData, ['kpi_records', 'kpiRecords', 'kpi'])
      cachedData.kpi_records = kpiRows.length > 0 ? normalizeKpiRecords(kpiRows.filter(hasNonEmptySheetRow)) : []
      kpiIsLoading = false
      kpiLoadError = null
      console.log(`✅ KPI data loaded (${cachedData.kpi_records.length} records)`)
      return { data: cachedData.kpi_records, error: null }
    } catch (err) {
      console.error('❌ Error initializing KPI data service:', err.message)
      kpiIsLoading = false
      kpiLoadError = err
      return { data: null, error: err }
    } finally {
      kpiLoadPromise = null
    }
  })()

  return kpiLoadPromise
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
      clustering: getField(record, ['clustering', 'Clustering', 'CLUSTERING']) || null,
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
    const subRegion = getField(record, ['sub_region', 'Sub Region', 'Sub-Region']) || ''
    
    // Extract region from sub-region if available (e.g., "SOL4 MIMAROPA" -> "MIMAROPA")
    const region = getField(record, ['region', 'Region', 'REGION']) || (subRegion ? subRegion.split(' ').pop() : '')
    
    // Create normalized record with all endpoint fields preserved
    const normalized = {
      id: index + 1,
      date: parseDateValue(getField(record, ['date', 'Date', 'DATE'])),
      region,
      sub_region: subRegion,
      operator_hub: getField(record, ['operator_hub', 'Operator Hub', 'Operator Hubs', 'hub', 'Hub', 'HUB NAME']) || '',
      cluster: getField(record, ['cluster', 'Cluster', 'AREA CLUSTER', 'CLUSTERING', 'Clustering']) || '',
      score,
      grade: getField(record, ['grade', 'Grade']) || '',
      remarks: getField(record, ['remarks', 'Remarks']) || '',
      cfr: parsePercent(getField(record, ['cfr', 'CFR', 'Clear Floor Rate', 'LM Clear Floor Rate Actual', 'LM Clear Floor Rate Ach %'])),
      sr: parsePercent(getField(record, ['sr', 'SR', 'Success Rate', 'Delivery Success Rate Actual', 'Delivery Success Rate Ach % to get A'])),
      aging_four_days: parsePercent(getField(record, ['aging_four_days', '% Aging >= 4 days', 'Aging Four Days'])),
      line_haul_compliance: parsePercent(getField(record, ['line_haul_compliance', 'Line Haul Pick-up Compliance', 'Line Haul Pick-up Compliance Actual', 'Line Haul Pick-up Compliance Ach %'])),
      cod_remittance: parsePercent(getField(record, ['cod_remittance', 'COD Remittance', 'COD Compliance Actual', 'COD Compliance Ach %'])),
      eod_compliance: parsePercent(getField(record, ['eod_compliance', 'EOD Report Compliance', 'Process Compliance Actual', 'Process Compliance Ach %'])),
      rts: parsePercent(getField(record, ['rts', 'RTS % Ach %', 'RTS %', 'RTS % Actual'])),
      loss: parsePercent(getField(record, ['loss', 'Loss % Ach %', 'Loss', 'Loss % Actual'])),
      expedite: parsePercent(getField(record, ['expedite', 'Expedite Delivery Performance Ach %', 'Expedite Delivery Performance Ach Percent', 'Expedite Delivery Performance']))
    }
    
    // Preserve all other endpoint fields, including raw endpoint keys such as `Date` and `Sub-Region`
    Object.entries(record).forEach(([key, value]) => {
      if (key.trim() === '') return
      if (!normalized.hasOwnProperty(key)) {
        if (key === 'Date') {
          const parsed = parseDateValue(value)
          normalized[key] = parsed || value
        } else {
          normalized[key] = value
        }
      }
    })
    
    return normalized
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
        productivityCount: 0,
        cost_per_parcel: 0,
        costPerParcelCount: 0,
        delivered_ado: 0,
        dispatched_ado: 0,
        fleet_count: 0
      }
    }

    dashboardMap[key].successRate += Number(record.pecentage) || 0
    dashboardMap[key].successRateCount += 1
    dashboardMap[key].riderIds.add(record.rider_id)
    dashboardMap[key].delivered += Number(record.delivered) || 0
    dashboardMap[key].on_hold += Number(record.onhold) || 0
    dashboardMap[key].productivity += Number(record.assigned) || 0
    dashboardMap[key].productivityCount += 1
    dashboardMap[key].cost_per_parcel += Number(record.cost_per_parcel) || 0
    if (Number(record.cost_per_parcel) > 0) {
      dashboardMap[key].costPerParcelCount += 1
    }
    dashboardMap[key].delivered_ado += Number(record.delivered_ado) || 0
    dashboardMap[key].dispatched_ado += Number(record.dispatched_ado) || 0
    dashboardMap[key].fleet_count += Number(record.fleet_count) || 0
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
        cost_per_parcel: item.costPerParcelCount > 0 ? item.cost_per_parcel / item.costPerParcelCount : 0,
        delivered_ado: item.delivered_ado,
        dispatched_ado: item.dispatched_ado,
        fleet_count: item.fleet_count,
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
  kpiIsLoading = false
  kpiLoadError = null
  kpiLoadPromise = null
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
  await ensureKpiDataLoaded()
  const grades = { A: 10, B: 20, C: 30, D: 20, F: 20 }
  const distribution = Object.entries(grades).map(([name, value]) => ({ name, value }))
  return { data: distribution, error: kpiLoadError }
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
      String(r.cluster || '').toLowerCase().includes(search) ||
      String(r.clustering || '').toLowerCase().includes(search)
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
  await ensureKpiDataLoaded()
  let filtered = cachedData.kpi_records
  if (filters.region) filtered = filtered.filter(k => k.region === filters.region)
  if (filters.operator_hub) filtered = filtered.filter(k => k.operator_hub === filters.operator_hub)
  const start = page * pageSize
  return { data: filtered.slice(start, start + pageSize), error: kpiLoadError, totalCount: filtered.length }
}

export async function getKpiRecords(filters = {}) {
  await ensureKpiDataLoaded()
  let filtered = cachedData.kpi_records
  if (filters.region) filtered = filtered.filter(k => k.region === filters.region)
  if (filters.operator_hub) filtered = filtered.filter(k => k.operator_hub === filters.operator_hub)
  return { data: filtered, error: kpiLoadError }
}

export async function getRecentKpiRecords(days = 30, filters = {}) {
  await ensureKpiDataLoaded()
  let filtered = filterByLatestWindow(cachedData.kpi_records, days)
  if (filters.region) filtered = filtered.filter(k => k.region === filters.region)
  if (filters.operator_hub) filtered = filtered.filter(k => k.operator_hub === filters.operator_hub)
  return { data: filtered, error: kpiLoadError }
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
  // Create a new cluster leader in the in-memory cache
  try {
    await ensureDataLoaded()
    const id = (cachedData.cluster_leaders.length > 0 ? Math.max(...cachedData.cluster_leaders.map(r => Number(r.id) || 0)) : 0) + 1
    const newRecord = {
      id,
      leader_name: record.leader_name || '',
      hubs: Array.isArray(record.hubs) ? record.hubs : []
    }
    cachedData.cluster_leaders = [newRecord, ...cachedData.cluster_leaders]
    return { data: newRecord, error: null }
  } catch (err) {
    return { data: null, error: err }
  }
}

export async function updateClusterLeader(id, updates) {
  try {
    await ensureDataLoaded()
    const idx = cachedData.cluster_leaders.findIndex(r => String(r.id) === String(id))
    if (idx === -1) return { data: null, error: { message: 'Not found' } }
    const existing = cachedData.cluster_leaders[idx]
    const updated = {
      ...existing,
      leader_name: updates.leader_name !== undefined ? updates.leader_name : existing.leader_name,
      hubs: Array.isArray(updates.hubs) ? updates.hubs : existing.hubs
    }
    cachedData.cluster_leaders[idx] = updated
    return { data: updated, error: null }
  } catch (err) {
    return { data: null, error: err }
  }
}

export async function deleteClusterLeader(id) {
  try {
    await ensureDataLoaded()
    const idx = cachedData.cluster_leaders.findIndex(r => String(r.id) === String(id))
    if (idx === -1) return { error: { message: 'Not found' } }
    const removed = cachedData.cluster_leaders.splice(idx, 1)
    return { error: null }
  } catch (err) {
    return { error: err }
  }
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
  try {
    await ensureDataLoaded()
    if (!Array.isArray(hubs) || hubs.length === 0) return { error: null, count: 0 }
    let count = 0
    const hubSet = new Set(hubs.map(h => String(h)))
    cachedData.kpi_records.forEach(k => {
      if (hubSet.has(String(k.operator_hub))) {
        k.cluster = leaderName
        count++
      }
    })
    // regenerate derived data that depends on kpi_records
    generateDerivedData()
    return { error: null, count }
  } catch (err) {
    return { error: err, count: 0 }
  }
}

export async function clearClusterFromKpiRecords(hubs) {
  try {
    await ensureDataLoaded()
    if (!Array.isArray(hubs) || hubs.length === 0) return { error: null }
    const hubSet = new Set(hubs.map(h => String(h)))
    cachedData.kpi_records.forEach(k => {
      if (hubSet.has(String(k.operator_hub))) {
        k.cluster = ''
      }
    })
    generateDerivedData()
    return { error: null }
  } catch (err) {
    return { error: err }
  }
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
