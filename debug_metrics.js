import { supabase } from './src/lib/supabase.js'

async function debugMetrics() {
  console.log('====== DEBUGGING DASHBOARD METRICS ======\n')

  // 1. Check performance_records sample data
  console.log('1. PERFORMANCE RECORDS SAMPLE:')
  const { data: perfData, error: perfError } = await supabase
    .from('performance_records')
    .select('date, hub, riders, delivered, onhold, pecentage, assigned')
    .limit(5)
  
  if (perfError) {
    console.log('ERROR fetching performance records:', perfError)
  } else {
    console.log('Sample performance records:', JSON.stringify(perfData, null, 2))
  }

  // 2. Check KPI records sample data
  console.log('\n2. KPI RECORDS SAMPLE:')
  const { data: kpiData, error: kpiError } = await supabase
    .from('kpi_records')
    .select('date, operator_hub, score, cfr')
    .limit(5)
  
  if (kpiError) {
    console.log('ERROR fetching KPI records:', kpiError)
  } else {
    console.log('Sample KPI records:', JSON.stringify(kpiData, null, 2))
  }

  // 3. Check dashboard_metrics current data
  console.log('\n3. DASHBOARD METRICS CURRENT DATA:')
  const { data: dashData, error: dashError } = await supabase
    .from('dashboard_metrics')
    .select('*')
    .limit(10)
  
  if (dashError) {
    console.log('ERROR fetching dashboard metrics:', dashError)
  } else {
    console.log('Current dashboard metrics:', JSON.stringify(dashData, null, 2))
  }

  // 4. Check data counts
  console.log('\n4. DATA COUNTS:')
  const { count: perfCount, error: perfCountError } = await supabase
    .from('performance_records')
    .select('*', { count: 'exact', head: true })
  
  const { count: kpiCount, error: kpiCountError } = await supabase
    .from('kpi_records')
    .select('*', { count: 'exact', head: true })
  
  const { count: dashCount, error: dashCountError } = await supabase
    .from('dashboard_metrics')
    .select('*', { count: 'exact', head: true })
  
  console.log(`Performance Records: ${perfCount || 0} rows`)
  console.log(`KPI Records: ${kpiCount || 0} rows`)
  console.log(`Dashboard Metrics: ${dashCount || 0} rows`)

  // 5. Check performance records with NULL/0 riders
  console.log('\n5. PERFORMANCE RECORDS WITH NULL/0 VALUES:')
  const { data: nullData } = await supabase
    .from('performance_records')
    .select('date, hub, riders, delivered, onhold, pecentage, assigned')
    .or('riders.is.null,riders.eq.0,delivered.is.null,onhold.is.null')
    .limit(5)
  
  if (nullData && nullData.length > 0) {
    console.log('Records with NULL/0 values:', JSON.stringify(nullData, null, 2))
  } else {
    console.log('No records with NULL/0 values found in sample')
  }

  console.log('\n====== END DEBUG ======')
}

debugMetrics().catch(console.error)
