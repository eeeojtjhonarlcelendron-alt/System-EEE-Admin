import { supabase } from './supabase'

// Function to fetch KPI data by hub and calculate CFR and Scorecard metrics
export async function getKPIMetricsByHub(hubName = null, fromDate = null, toDate = null) {
  try {
    let query = supabase
      .from('kpi_records')
      .select('*')

    // Filter by hub if specified
    if (hubName) {
      query = query.eq('operator_hub', hubName)
    }

    // Filter by date range if specified
    if (fromDate) {
      query = query.gte('date', fromDate)
    }
    if (toDate) {
      query = query.lte('date', toDate)
    }

    const { data, error } = await query.order('date', { ascending: false })

    if (error) {
      console.error('Error fetching KPI metrics:', error)
      return { data: [], error }
    }

    // Group data by hub and calculate metrics
    const hubMetrics = {}
    
    data.forEach(record => {
      const hub = record.operator_hub
      
      if (!hubMetrics[hub]) {
        hubMetrics[hub] = {
          hub: hub,
          totalRecords: 0,
          cfrSum: 0,
          cfrCount: 0,
          srSum: 0,
          srCount: 0,
          scoreSum: 0,
          scoreCount: 0,
          maxCfr: 0,
          minCfr: 100,
          maxSr: 0,
          minSr: 100,
          latestDate: null,
          earliestDate: null
        }
      }
      
      const metrics = hubMetrics[hub]
      metrics.totalRecords++
      
      // Clear Floor Rate (CFR)
      if (record.cfr !== null && record.cfr !== undefined) {
        const cfrValue = parseFloat(record.cfr)
        metrics.cfrSum += cfrValue
        metrics.cfrCount++
        metrics.maxCfr = Math.max(metrics.maxCfr, cfrValue)
        metrics.minCfr = Math.min(metrics.minCfr, cfrValue)
      }
      
      // Score Rate (SR)
      if (record.sr !== null && record.sr !== undefined) {
        const srValue = parseFloat(record.sr)
        metrics.srSum += srValue
        metrics.srCount++
        metrics.maxSr = Math.max(metrics.maxSr, srValue)
        metrics.minSr = Math.min(metrics.minSr, srValue)
      }
      
      // Score
      if (record.score !== null && record.score !== undefined) {
        const scoreValue = parseFloat(record.score)
        metrics.scoreSum += scoreValue
        metrics.scoreCount++
      }
      
      // Track dates
      const recordDate = record.date
      if (!metrics.latestDate || recordDate > metrics.latestDate) {
        metrics.latestDate = recordDate
      }
      if (!metrics.earliestDate || recordDate < metrics.earliestDate) {
        metrics.earliestDate = recordDate
      }
    })
    
    // Calculate final metrics for each hub
    const finalMetrics = Object.values(hubMetrics).map(metrics => ({
      hub: metrics.hub,
      totalRecords: metrics.totalRecords,
      clearFloorRate: metrics.cfrCount > 0 ? Math.round(metrics.cfrSum / metrics.cfrCount) : 0,
      scorecard: metrics.srCount > 0 ? (metrics.srSum / metrics.srCount).toFixed(1) : '0.0',
      avgScore: metrics.scoreCount > 0 ? (metrics.scoreSum / metrics.scoreCount).toFixed(1) : '0.0',
      recordsWithCfr: metrics.cfrCount,
      recordsWithSr: metrics.srCount,
      recordsWithScore: metrics.scoreCount,
      maxCfr: metrics.maxCfr,
      minCfr: metrics.minCfr === 100 ? 0 : metrics.minCfr,
      maxSr: metrics.maxSr,
      minSr: metrics.minSr === 100 ? 0 : metrics.minSr,
      latestDate: metrics.latestDate,
      earliestDate: metrics.earliestDate
    }))
    
    // Sort by clear floor rate (highest first)
    return { data: finalMetrics.sort((a, b) => b.clearFloorRate - a.clearFloorRate), error: null }
    
  } catch (error) {
    console.error('Error in getKPIMetricsByHub:', error)
    return { data: [], error }
  }
}

// Function to get overall KPI metrics (all hubs combined)
export async function getOverallKPIMetrics(fromDate = null, toDate = null) {
  try {
    let query = supabase
      .from('kpi_records')
      .select('*')

    // Filter by date range if specified
    if (fromDate) {
      query = query.gte('date', fromDate)
    }
    if (toDate) {
      query = query.lte('date', toDate)
    }

    const { data, error } = await query

    if (error) {
      console.error('Error fetching overall KPI metrics:', error)
      return { data: null, error }
    }

    if (!data || data.length === 0) {
      return { data: { clearFloorRate: 0, scorecard: '0.0', totalRecords: 0 }, error: null }
    }

    // Calculate overall metrics
    let cfrSum = 0, cfrCount = 0, srSum = 0, srCount = 0
    
    data.forEach(record => {
      if (record.cfr !== null && record.cfr !== undefined) {
        cfrSum += parseFloat(record.cfr)
        cfrCount++
      }
      if (record.sr !== null && record.sr !== undefined) {
        srSum += parseFloat(record.sr)
        srCount++
      }
    })
    
    const overallMetrics = {
      clearFloorRate: cfrCount > 0 ? Math.round(cfrSum / cfrCount) : 0,
      scorecard: srCount > 0 ? (srSum / srCount).toFixed(1) : '0.0',
      totalRecords: data.length,
      recordsWithCfr: cfrCount,
      recordsWithSr: srCount
    }
    
    return { data: overallMetrics, error: null }
    
  } catch (error) {
    console.error('Error in getOverallKPIMetrics:', error)
    return { data: null, error }
  }
}
