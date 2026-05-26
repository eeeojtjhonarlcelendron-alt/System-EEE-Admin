import { getKpiRecords } from './data'

function inDateRange(record, fromDate, toDate) {
  if (!record.date) return false
  if (fromDate && record.date < fromDate) return false
  if (toDate && record.date > toDate) return false
  return true
}

function average(records, key) {
  const values = records.map(record => Number(record[key]) || 0).filter(value => value > 0)
  if (values.length === 0) return 0
  return values.reduce((sum, value) => sum + value, 0) / values.length
}

function latestDate(records) {
  return records.map(record => record.date).filter(Boolean).sort().pop() || null
}

function gradeFromScore(score) {
  if (score >= 95) return 'A+'
  if (score >= 90) return 'A'
  if (score >= 85) return 'B+'
  if (score >= 80) return 'B'
  return 'C'
}

function buildHubMetric(hub, records) {
  const cfrValues = records.map(record => Number(record.cfr) || 0).filter(value => value > 0)
  const scorecard = average(records, 'score')

  return {
    hub,
    totalRecords: records.length,
    clearFloorRate: Math.round(average(records, 'cfr')),
    scorecard: scorecard.toFixed(1),
    avgScore: scorecard.toFixed(1),
    grade: gradeFromScore(scorecard),
    recordsWithCfr: cfrValues.length,
    recordsWithSr: records.filter(record => Number(record.sr) > 0).length,
    recordsWithScore: records.filter(record => Number(record.score) > 0).length,
    maxCfr: Math.round(Math.max(...cfrValues, 0)),
    minCfr: Math.round(cfrValues.length > 0 ? Math.min(...cfrValues) : 0),
    latestDate: latestDate(records)
  }
}

export async function getKPIMetricsByHub(hubName = null, fromDate = null, toDate = null) {
  try {
    const { data, error } = await getKpiRecords()
    if (error || !data) return { data: [], error }

    const filtered = data.filter(record => {
      if (!inDateRange(record, fromDate, toDate)) return false
      if (hubName && record.operator_hub !== hubName) return false
      return Boolean(record.operator_hub)
    })

    const grouped = filtered.reduce((acc, record) => {
      if (!acc[record.operator_hub]) acc[record.operator_hub] = []
      acc[record.operator_hub].push(record)
      return acc
    }, {})

    const metrics = Object.entries(grouped)
      .map(([hub, records]) => buildHubMetric(hub, records))
      .sort((a, b) => a.hub.localeCompare(b.hub))

    return { data: metrics, error: null }
  } catch (error) {
    console.error('Error in getKPIMetricsByHub:', error)
    return { data: [], error }
  }
}

export async function getOverallKPIMetrics(fromDate = null, toDate = null) {
  try {
    const { data, error } = await getKpiRecords()
    if (error || !data) {
      return { data: { clearFloorRate: 0, scorecard: '0.0', totalRecords: 0, totalHubs: 0 }, error }
    }

    const filtered = data.filter(record => inDateRange(record, fromDate, toDate))
    const scorecard = average(filtered, 'score')
    const totalHubs = new Set(filtered.map(record => record.operator_hub).filter(Boolean)).size

    return {
      data: {
        clearFloorRate: Math.round(average(filtered, 'cfr')),
        scorecard: scorecard.toFixed(1),
        totalRecords: filtered.length,
        totalHubs,
        recordsWithCfr: filtered.filter(record => Number(record.cfr) > 0).length,
        recordsWithSr: filtered.filter(record => Number(record.sr) > 0).length,
        latestDate: latestDate(filtered)
      },
      error: null
    }
  } catch (error) {
    console.error('Error in getOverallKPIMetrics:', error)
    return { data: null, error }
  }
}
