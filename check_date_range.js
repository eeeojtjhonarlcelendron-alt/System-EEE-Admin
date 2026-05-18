import { supabase } from './src/lib/supabase.js'

async function checkDataDateRange() {
  console.log('====== CHECKING DATE RANGES IN SOURCE TABLES ======\n')

  // 1. Check performance_records date range
  console.log('1. PERFORMANCE RECORDS DATE RANGE:')
  const { data: perfStats, error: perfError } = await supabase
    .from('performance_records')
    .select('date', { count: 'exact' })
    .order('date', { ascending: true })
  
  if (perfError) {
    console.log('ERROR:', perfError)
  } else {
    const minDate = perfStats?.[0]?.date
    const maxDate = perfStats?.[perfStats.length - 1]?.date
    console.log(`Performance records: ${perfStats?.length || 0} total rows`)
    console.log(`Date range: ${minDate} to ${maxDate}`)
  }

  // 2. Check KPI records date range
  console.log('\n2. KPI RECORDS DATE RANGE:')
  const { data: kpiStats, error: kpiError } = await supabase
    .from('kpi_records')
    .select('date', { count: 'exact' })
    .order('date', { ascending: true })
  
  if (kpiError) {
    console.log('ERROR:', kpiError)
  } else {
    const minDate = kpiStats?.[0]?.date
    const maxDate = kpiStats?.[kpiStats.length - 1]?.date
    console.log(`KPI records: ${kpiStats?.length || 0} total rows`)
    console.log(`Date range: ${minDate} to ${maxDate}`)
  }

  // 3. Check unique dates in performance_records
  console.log('\n3. UNIQUE DATES IN PERFORMANCE_RECORDS:')
  const { data: perfDates, error: perfDatesError } = await supabase
    .from('performance_records')
    .select('date')
    .not('date', 'is', null)
  
  if (!perfDatesError && perfDates) {
    const uniqueDates = [...new Set(perfDates.map(r => r.date))].sort()
    console.log(`Total unique dates: ${uniqueDates.length}`)
    console.log('Dates:', uniqueDates)
  }

  // 4. Check unique dates in KPI records
  console.log('\n4. UNIQUE DATES IN KPI_RECORDS:')
  const { data: kpiDates, error: kpiDatesError } = await supabase
    .from('kpi_records')
    .select('date')
    .not('date', 'is', null)
  
  if (!kpiDatesError && kpiDates) {
    const uniqueDates = [...new Set(kpiDates.map(r => r.date))].sort()
    console.log(`Total unique dates: ${uniqueDates.length}`)
    console.log('Dates:', uniqueDates)
  }

  console.log('\n====== END CHECK ======')
}

checkDataDateRange().catch(console.error)
