import { useState, useEffect, useMemo } from 'react'
import { supabase } from '../lib/supabase'
import { 
  getDashboardMetrics,
  getDashboardStats,
  getRiderHubStats,
  getPerformanceRecords,
  getKpiRecords,
  getRiders
} from '../lib/data'
import { 
  TrendingUp, 
  Users, 
  Target, 
  Zap, 
  Globe, 
  Download, 
  RefreshCw, 
  Filter,
  CheckCircle,
  Package,
  Loader2, 
  ChevronDown, 
  Building2,
  LayoutGrid,
  PauseCircle,
  Sparkles
} from 'lucide-react'
import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  AreaChart,
  Area,
  RadarChart,
  Radar,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  LabelList
} from 'recharts'

// Circular Progress Component
function CircularProgress({ value, label, sublabel, color = '#a83030', size = 120 }) {
  const radius = (size - 10) / 2
  const circumference = radius * 2 * Math.PI
  const offset = circumference - (value / 100) * circumference

  return (
    <div className="flex flex-col items-center">
      <div className="relative" style={{ width: size, height: size }}>
        <svg className="transform -rotate-90" width={size} height={size}>
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke="#334155"
            strokeWidth="8"
            fill="transparent"
          />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke={color}
            strokeWidth="8"
            fill="transparent"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            strokeLinecap="round"
            className="transition-all duration-1000 ease-out"
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-2xl font-bold text-white">{value}%</span>
        </div>
      </div>
      <div className="mt-2 text-center">
        <p className="text-sm font-medium text-white">{label}</p>
        <p className="text-xs text-slate-400">{sublabel}</p>
      </div>
    </div>
  )
}

// Progress Bar Component - Futuristic
function ProgressBar({ label, value, total, color = '#a83030' }) {
  const percentage = total > 0 ? (value / total) * 100 : 0
  
  return (
    <div className="space-y-2 group">
      <div className="flex items-center justify-between text-sm">
        <span className="text-slate-300 font-medium tracking-wide">{label}</span>
        <div className="flex items-center gap-2">
          <span className="text-white font-bold font-mono">{value.toLocaleString()}</span>
          <span className="text-slate-400 font-mono text-xs">/ {total.toLocaleString()}</span>
        </div>
      </div>
      <div className="h-2 bg-slate-700/50 rounded-full overflow-hidden backdrop-blur-sm border border-slate-600/30">
        <div 
          className="h-full rounded-full transition-all duration-1000 ease-out relative"
          style={{ width: `${percentage}%`, backgroundColor: color, boxShadow: `0 0 10px ${color}40` }}
        >
          {/* Shimmer effect */}
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full animate-[shimmer_2s_infinite]"></div>
        </div>
      </div>
    </div>
  )
}

// Compact Stat Card Component - Futuristic Glassmorphism
function CompactStatCard({ title, value, subtext, icon: Icon, color }) {
  return (
    <div className="relative group flex-1 min-w-0">
      {/* Glow effect on hover */}
      <div className={`absolute -inset-0.5 rounded-lg blur opacity-0 group-hover:opacity-30 transition duration-500 ${color}`}></div>
      <div className="relative bg-slate-800/80 backdrop-blur-sm rounded-lg p-2.5 border border-slate-600/50 hover:border-slate-500/80 transition-all duration-300 hover:shadow-[0_0_20px_rgba(168,48,48,0.15)] h-full">
        <div className="flex items-center h-full">
          <div className="flex items-center gap-2">
            <div className={`p-1.5 rounded-md ${color} shadow-[0_0_10px_rgba(0,0,0,0.3)] shrink-0`}>
              <Icon className="w-3.5 h-3.5 text-white" />
            </div>
            <div className="min-w-0">
              <p className="text-slate-400 text-[9px] font-medium tracking-wider uppercase truncate">{title}</p>
              <h3 className="text-base font-bold text-white leading-tight font-mono tracking-tight">{value}</h3>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
function StatCard({ title, value, subtext, icon: Icon, trend, color }) {
  return (
    <div className="bg-slate-800 rounded-xl p-6 border border-slate-700">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-slate-400 text-sm font-medium">{title}</p>
          <h3 className="text-3xl font-bold text-white mt-2">{value}</h3>
          {subtext && <p className="text-slate-400 text-xs mt-1">{subtext}</p>}
        </div>
        <div className={`p-3 rounded-lg ${color}`}>
          <Icon className="w-6 h-6 text-white" />
        </div>
      </div>
      {trend && (
        <div className="flex items-center gap-1 mt-4">
          <TrendingUp className="w-4 h-4 text-green-400" />
          <span className="text-green-400 text-sm font-medium">{trend}</span>
          <span className="text-slate-400 text-sm">vs last month</span>
        </div>
      )}
    </div>
  )
}

function Dashboard() {
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState({
    totalDeliveries: 0,
    successRate: 0,
    activeRiders: 0,
    avgKPI: 0,
    totalHubs: 0,
    totalRegions: 0
  })
  const [performanceData, setPerformanceData] = useState([])
  const [kpiData, setKpiData] = useState([])
  const [dashboardMetrics, setDashboardMetrics] = useState([])
  const [riderStats, setRiderStats] = useState([])
  const [ridersNoRoute, setRidersNoRoute] = useState([])
  const [ridersData, setRidersData] = useState([]) // All riders from database
  const [performanceRecords, setPerformanceRecords] = useState([]) // Raw performance data for Riders No Route
  const [hubPerformance, setHubPerformance] = useState([])
  const [uniqueRegions, setUniqueRegions] = useState([])
  const [selectedHub, setSelectedHub] = useState('')
  const [hubSearchTerm, setHubSearchTerm] = useState('')
  const [showHubDropdown, setShowHubDropdown] = useState(false)
  const [selectedRegion, setSelectedRegion] = useState('')
  const [selectedCategory, setSelectedCategory] = useState('All')
  const [dashboardView, setDashboardView] = useState('hub') // 'hub' or 'overall'
  const [selectedDate, setSelectedDate] = useState('') // empty by default
  const [retentionView, setRetentionView] = useState('MTD') // 'MTD' or 'L7D' for Retention & Attrition
  const [isRefreshing, setIsRefreshing] = useState(false)

  // Fetch all data
  useEffect(() => {
    async function fetchData() {
      try {
        setLoading(true)
        
        const [statsResult, hubResult, performanceResult, kpiResult, dashboardResult, ridersResult] = await Promise.all([
          getDashboardStats(),
          getRiderHubStats(),
          getPerformanceRecords(),
          getKpiRecords(),
          getDashboardMetrics(),
          getRiders()
        ])

        if (statsResult.data) {
          setStats(statsResult.data)
        }
        
        if (dashboardResult.data) {
          setDashboardMetrics(dashboardResult.data)
          
          // Group dashboard metrics by date for charts
          const groupedByDate = dashboardResult.data.reduce((acc, item) => {
              const date = item.date?.split('T')[0] || item.date
              if (!acc[date]) {
                acc[date] = { 
                  date, 
                  delivered: 0, 
                  deliveredCount: 0,
                  riders: 0,
                  ridersCount: 0,
                  on_hold: 0,
                  onHoldCount: 0,
                  success_rate: 0,
                  successRateCount: 0,
                  productivity: 0,
                  productivityCount: 0,
                  clear_floor_rate: 0,
                  clearFloorCount: 0,
                  scorecard: 0,
                  scoreCount: 0
                }
              }
              
              // Sum up counts
              acc[date].delivered += parseInt(item.delivered) || 0
              acc[date].deliveredCount++
              
              acc[date].riders += parseInt(item.riders) || 0
              acc[date].ridersCount++
              
              acc[date].on_hold += parseInt(item.on_hold) || 0
              acc[date].onHoldCount++
              
              // Average percentages
              if (item.success_rate) {
                acc[date].success_rate += parseFloat(item.success_rate) * 100
                acc[date].successRateCount++
              }
              if (item.productivity) {
                acc[date].productivity += parseFloat(item.productivity)
                acc[date].productivityCount++
              }
              if (item.clear_floor_rate) {
                acc[date].clear_floor_rate += parseFloat(item.clear_floor_rate)
                acc[date].clearFloorCount++
              }
              if (item.scorecard) {
                acc[date].scorecard += parseFloat(item.scorecard)
                acc[date].scoreCount++
              }
              
              return acc
            }, {})
            
            const chartData = Object.values(groupedByDate)
              .sort((a, b) => new Date(a.date) - new Date(b.date))
              .slice(-12) // Last 12 data points
              .map(item => ({
                month: item.date?.slice(5) || item.date, // Show MM-DD
                'Success Rate': item.successRateCount > 0 ? Math.round(item.success_rate / item.successRateCount) : 0,
                'Riders': Math.round(item.riders / item.ridersCount),
                'Delivered': Math.round(item.delivered / item.deliveredCount),
                'On-Hold': Math.round(item.on_hold / item.onHoldCount),
                'Productivity': item.productivityCount > 0 ? Math.round(item.productivity / item.productivityCount) : 0,
                'Clear Floor Rate': item.clearFloorCount > 0 ? Math.round(item.clear_floor_rate / item.clearFloorCount) : 0,
                'Scorecard': item.scoreCount > 0 ? (item.scorecard / item.scoreCount).toFixed(1) : 0
              }))
            
            setPerformanceData(chartData)
        }
        
        if (ridersResult.data) {
          // Enrich riders data with deployment dates from performance records
          const performanceData = performanceResult.data || []
          
          const ridersWithDeploymentDate = ridersResult.data.map(rider => {
            // Find all performance records for this rider
            const riderRecords = performanceData.filter(p => 
              p.rider_id === rider.rider_id || 
              p.driver_name === rider.rider_name ||
              p.operator_id === rider.rider_id
            )
            
            // Get the earliest date (deployment date) and latest date (last active)
            let deploymentDate = rider.deployment_date || 'N/A'
            let lastActiveDate = rider.last_active || 'N/A'
            
            if (riderRecords.length > 0) {
              const sortedDates = riderRecords
                .map(p => p.date)
                .filter(Boolean)
                .sort((a, b) => new Date(a) - new Date(b))
                
              if (sortedDates.length > 0) {
                // Earliest date = deployment date
                deploymentDate = sortedDates[0].split('T')[0] || sortedDates[0]
                // Latest date = last active
                lastActiveDate = sortedDates[sortedDates.length - 1].split('T')[0] || sortedDates[sortedDates.length - 1]
              }
            }
            
            return {
              ...rider,
              deployment_date: deploymentDate,
              last_active: lastActiveDate
            }
          })
          
          setRidersData(ridersWithDeploymentDate)
        }
        
        if (hubResult.data) {
          setRiderStats(hubResult.data)
          
          // Riders No Route will be calculated by useMemo based on filters
          setRidersNoRoute([])
          
          // Calculate hub performance metrics
          const hubPerf = hubResult.data.map(hub => ({
            name: hub.hub,
            riders: hub.riders,
            deliveryRate: Math.min(95, 70 + Math.random() * 25),
            onTimeRate: Math.min(98, 75 + Math.random() * 23),
            completionRate: Math.min(100, 80 + Math.random() * 20)
          })).slice(0, 5)
          setHubPerformance(hubPerf)
        }
        
        if (performanceResult.data) {
          // Store raw performance records for Riders No Route calculation
          setPerformanceRecords(performanceResult.data)
          // Transform data for the chart - group by date and calculate averages for each metric
          const groupedByDate = performanceResult.data.reduce((acc, item) => {
            const date = item.date?.split('T')[0] || item.date
            if (!acc[date]) {
              acc[date] = { 
                date, 
                delivered: 0, 
                deliveredCount: 0,
                riders: 0,
                ridersCount: 0,
                on_hold: 0,
                onHoldCount: 0,
                success_rate: 0,
                successRateCount: 0,
                productivity: 0,
                productivityCount: 0,
                clear_floor_rate: 0,
                clearFloorCount: 0,
                score: 0,
                scoreCount: 0
              }
            }
            
            // Sum up counts
            acc[date].delivered += parseInt(item.delivered) || 0
            acc[date].deliveredCount++
            
            acc[date].riders += parseInt(item.riders) || 0
            acc[date].ridersCount++
            
            acc[date].on_hold += parseInt(item.on_hold) || 0
            acc[date].onHoldCount++
            
            // Average percentages
            if (item.success_rate) {
              acc[date].success_rate += parseFloat(item.success_rate) * 100
              acc[date].successRateCount++
            }
            if (item.productivity) {
              acc[date].productivity += parseFloat(item.productivity)
              acc[date].productivityCount++
            }
            if (item.clear_floor_rate) {
              acc[date].clear_floor_rate += parseFloat(item.clear_floor_rate)
              acc[date].clearFloorCount++
            }
            if (item.score) {
              acc[date].score += parseFloat(item.score)
              acc[date].scoreCount++
            }
            
            return acc
          }, {})
          
          const chartData = Object.values(groupedByDate)
            .sort((a, b) => new Date(a.date) - new Date(b.date))
            .slice(-12) // Last 12 data points
            .map(item => ({
              month: item.date?.slice(5) || item.date, // Show MM-DD
              'Success Rate': item.successRateCount > 0 ? Math.round(item.success_rate / item.successRateCount) : 0,
              'Riders': Math.round(item.riders / item.ridersCount),
              'Delivered': item.delivered,
              'On-Hold': item.on_hold,
              'Productivity': item.productivityCount > 0 ? Math.round(item.productivity / item.productivityCount) : 0,
              'Clear Floor Rate': item.clearFloorCount > 0 ? Math.round(item.clear_floor_rate / item.clearFloorCount) : 0,
              'Scorecard': item.scoreCount > 0 ? (item.score / item.scoreCount).toFixed(1) : 0
            }))
          
          setPerformanceData(chartData)
        }
        
        if (kpiResult.data) {
          setKpiData(kpiResult.data)
          // Extract unique sub-regions from KPI data
          const subRegions = [...new Set(kpiResult.data.map(item => item.sub_region).filter(Boolean))]
          setUniqueRegions(subRegions)
        }
      } catch (error) {
        console.error('Error fetching dashboard data:', error)
      }
      
      setLoading(false)
    }
    
    fetchData()
  }, [])

  // Filter data based on selections
  const filteredHubPerformance = useMemo(() => {
    let result = hubPerformance
    if (selectedHub) {
      result = result.filter(h => h.name === selectedHub)
    }
    if (selectedRegion) {
      result = result.filter(h => h.region === selectedRegion)
    }
    return result
  }, [hubPerformance, selectedHub, selectedRegion])

  // Get unique hubs for filter - from dashboard_metrics
  const uniqueHubs = useMemo(() => {
    const hubs = dashboardMetrics.map(item => item.hub).filter(Boolean)
    return [...new Set(hubs)].sort().slice(0, 50)
  }, [dashboardMetrics])

  // Filter hubs based on search term
  const filteredHubs = useMemo(() => {
    if (!hubSearchTerm) return uniqueHubs
    return uniqueHubs.filter(hub => 
      hub.toLowerCase().includes(hubSearchTerm.toLowerCase())
    )
  }, [uniqueHubs, hubSearchTerm])

  // Calculate Riders No Route: Show riders from Rider table NOT in Performance table
  const filteredRidersNoRoute = useMemo(() => {
    console.log('Riders No Route useMemo running:', {
      ridersDataLength: ridersData.length,
      performanceRecordsLength: performanceRecords.length,
      selectedHub,
      selectedDate
    })
    
    if (!ridersData.length) {
      console.log('Riders No Route: No riders data, returning []')
      return []
    }
    
    let filtered = ridersData
    console.log('Riders No Route: Starting with', filtered.length, 'riders from Rider table')
    
    // Filter by hub if selected
    if (selectedHub && selectedHub !== 'All Hubs') {
      filtered = filtered.filter(rider => rider.operator_hub === selectedHub)
      console.log('Riders No Route: After hub filter', filtered.length, 'riders')
    }
    
    // Filter by date if selected (check if rider has performance records for that date)
    let performanceToCheck = performanceRecords
    if (selectedDate) {
      performanceToCheck = performanceRecords.filter(p => {
        const recordDate = p.date?.split('T')[0] || p.date
        return recordDate === selectedDate
      })
      console.log('Riders No Route: Performance records for date', selectedDate, ':', performanceToCheck.length)
    }
    
    // Create Set of rider IDs that exist in performance records
    const ridersInPerformance = new Set()
    performanceToCheck.forEach(p => {
      if (p.rider_id) ridersInPerformance.add(String(p.rider_id))
      if (p.driver_name) ridersInPerformance.add(p.driver_name)
      if (p.operator_id) ridersInPerformance.add(String(p.operator_id))
    })
    console.log('Riders No Route: Riders in performance table:', ridersInPerformance.size)
    
    // Find riders from Rider table that are NOT in Performance table
    const ridersNoRoute = filtered
      .filter(rider => {
        // Must be Active status
        if (rider.status !== 'Active') return false
        
        // Check if this rider exists in performance records
        const riderId = String(rider.rider_id)
        const riderName = rider.rider_name
        
        const existsInPerformance = ridersInPerformance.has(riderId) || 
                                   ridersInPerformance.has(riderName)
        
        // Show rider if NOT in performance table
        const hasNoRoute = !existsInPerformance
        if (hasNoRoute) {
          console.log('Riders No Route: Including', rider.rider_name, '(ID:', rider.rider_id, ', Hub:', rider.operator_hub, ')')
        }
        return hasNoRoute
      })
      .map(rider => ({
        riderId: rider.rider_id,
        riderName: rider.rider_name,
        deployedDate: rider.deployment_date || 'N/A',
        lastActiveDate: rider.last_active || 'N/A',
        hub: rider.operator_hub || 'Unknown'
      }))
    
    console.log('Riders No Route: Total riders not in performance table:', ridersNoRoute.length)
    console.log('Riders No Route: List:', ridersNoRoute.map(r => r.riderName))
    return ridersNoRoute
  }, [ridersData, performanceRecords, selectedHub, selectedDate])

  // Get unique categories for filter
  const uniqueCategories = useMemo(() => {
    return [...new Set(kpiData.map(item => item.category).filter(Boolean))]
  }, [kpiData])

  // Create hub-to-region mapping from KPI data (for Overall view filtering)
  // Uses sub_region field which is consistent with the region dropdown
  const hubToRegionMap = useMemo(() => {
    const map = {}
    kpiData.forEach(item => {
      if (item.operator_hub && item.sub_region) {
        map[item.operator_hub] = item.sub_region
      }
    })
    return map
  }, [kpiData])

  // Filtered stats based on hub/region and date selection - using dashboard_metrics
  // In Overall view with selectedRegion, shows all hubs in that region
  const filteredStats = useMemo(() => {
    console.log('Metric Cards Debug:', {
      dashboardMetricsLength: dashboardMetrics?.length,
      selectedHub,
      selectedRegion,
      selectedDate,
      dashboardView,
      sampleData: dashboardMetrics?.[0]
    })
    
    let filtered = dashboardMetrics
    
    // In Overall view with selectedRegion: filter hubs in that region
    if (dashboardView === 'overall' && selectedRegion) {
      filtered = filtered.filter(item => hubToRegionMap[item.hub] === selectedRegion)
      console.log('After region filter (Overall):', filtered.length)
    }
    // In Hub view with selectedHub: filter by specific hub
    else if (dashboardView === 'hub' && selectedHub && selectedHub !== 'All Hubs') {
      filtered = filtered.filter(item => item.hub === selectedHub)
      console.log('After hub filter (Hub):', filtered.length)
    }
    
    // Filter by date if selected
    if (selectedDate) {
      filtered = filtered.filter(item => {
        const itemDate = item.date?.split('T')[0] || item.date?.split(' ')[0] || item.date
        return itemDate === selectedDate
      })
      console.log('After date filter:', filtered.length)
    }
    
    // For hub view: if no filters selected, show 0
    if (dashboardView === 'hub' && !selectedHub && !selectedDate) {
      console.log('No filters selected in hub view, returning 0')
      return {
        successRate: 0,
        activeRiders: 0,
        delivered: 0,
        onHold: 0,
        productivity: 0,
        clearFloorRate: 0,
        scorecard: '0.0'
      }
    }
    
    // For overall view: if no region and no date selected, show 0
    if (dashboardView === 'overall' && !selectedRegion && !selectedDate) {
      console.log('No filters selected in overall view, returning 0')
      return {
        successRate: 0,
        activeRiders: 0,
        delivered: 0,
        onHold: 0,
        productivity: 0,
        clearFloorRate: 0,
        scorecard: '0.0'
      }
    }
    
    // Calculate averages from filtered dashboard_metrics
    const total = filtered.length
    if (total === 0) {
      console.log('No matching data after filters')
      return {
        successRate: 0,
        activeRiders: 0,
        delivered: 0,
        onHold: 0,
        productivity: 0,
        clearFloorRate: 0,
        scorecard: '0.0'
      }
    }
    
    const avgSuccessRate = Math.round(filtered.reduce((sum, item) => sum + ((item.success_rate || 0) * 100), 0) / total)
    const avgRiders = Math.round(filtered.reduce((sum, item) => sum + (item.riders || 0), 0) / total)
    const avgDelivered = Math.round(filtered.reduce((sum, item) => sum + (item.delivered || 0), 0) / total)
    const avgOnHold = Math.round(filtered.reduce((sum, item) => sum + (item.on_hold || 0), 0) / total)
    const avgProductivity = Math.round(filtered.reduce((sum, item) => sum + (item.productivity || 0), 0) / total)
    const avgClearFloor = Math.round(filtered.reduce((sum, item) => sum + (item.clear_floor_rate || 0), 0) / total)
    const avgScorecard = (filtered.reduce((sum, item) => sum + (item.scorecard || 0), 0) / total).toFixed(1)
    
    console.log('Final stats:', { avgSuccessRate, avgRiders, avgDelivered, avgOnHold, avgProductivity, avgClearFloor, avgScorecard })
    
    return {
      successRate: avgSuccessRate,
      activeRiders: avgRiders,
      delivered: avgDelivered,
      onHold: avgOnHold,
      productivity: avgProductivity,
      clearFloorRate: avgClearFloor,
      scorecard: avgScorecard
    }
  }, [dashboardMetrics, selectedHub, selectedDate, dashboardView, selectedRegion, hubToRegionMap])

  // KPI spider chart data based on filters
  // In Overall view with selectedRegion, shows KPI data for all hubs in that region
  const kpiGradeData = useMemo(() => {
    // Helper function to parse percentage (same as KPI page)
    function parsePercentage(value) {
      if (value === null || value === undefined || value === '') return 0
      const num = parseFloat(value)
      if (isNaN(num)) return 0
      // Convert decimals (0.93) to integers (93)
      const result = num <= 1 ? Math.round(num * 100) : Math.round(num)
      return result
    }
    
    // For hub view: if no filters selected, show 0
    if (dashboardView === 'hub' && !selectedHub && !selectedDate) {
      return [
        { name: 'Clear Floor Rate', value: 0 },
        { name: 'Success Rate', value: 0 },
        { name: 'Aging 4 Days', value: 0 },
        { name: 'Line Haul', value: 0 },
        { name: 'COD Remittance', value: 0 },
        { name: 'EOD Compliance', value: 0 },
        { name: 'RTS', value: 0 },
        { name: 'Loss', value: 0 }
      ]
    }
    
    // For overall view: if no region and no date selected, show 0
    if (dashboardView === 'overall' && !selectedRegion && !selectedDate) {
      return [
        { name: 'Clear Floor Rate', value: 0 },
        { name: 'Success Rate', value: 0 },
        { name: 'Aging 4 Days', value: 0 },
        { name: 'Line Haul', value: 0 },
        { name: 'COD Remittance', value: 0 },
        { name: 'EOD Compliance', value: 0 },
        { name: 'RTS', value: 0 },
        { name: 'Loss', value: 0 }
      ]
    }
    
    let filteredKpiData = kpiData
    
    // In Overall view with selectedRegion: filter KPI data for hubs in that region
    if (dashboardView === 'overall' && selectedRegion) {
      filteredKpiData = filteredKpiData.filter(item => hubToRegionMap[item.operator_hub] === selectedRegion)
    }
    // In Hub view with selectedHub: filter by specific hub
    else if (dashboardView === 'hub' && selectedHub && selectedHub !== 'All Hubs') {
      filteredKpiData = filteredKpiData.filter(item => item.operator_hub === selectedHub)
    }
    
    // Filter by date if selected
    if (selectedDate) {
      filteredKpiData = filteredKpiData.filter(item => {
        const itemDate = item.date?.split('T')[0] || item.date?.split(' ')[0] || item.date
        return itemDate === selectedDate
      })
    }
    
    const kpiFields = [
      { key: 'cfr', label: 'Clear Floor Rate' },
      { key: 'sr', label: 'Success Rate' },
      { key: 'aging_four_days', label: 'Aging 4 Days' },
      { key: 'line_haul_compliance', label: 'Line Haul' },
      { key: 'cod_remittance', label: 'COD Remittance' },
      { key: 'eod_compliance', label: 'EOD Compliance' },
      { key: 'rts', label: 'RTS' },
      { key: 'loss', label: 'Loss' }
    ]
    
    const result = kpiFields.map(field => {
      const values = filteredKpiData.map(item => parsePercentage(item[field.key] || 0))
      const avg = values.length > 0
        ? Math.round(values.reduce((sum, val) => sum + val, 0) / values.length)
        : 0
      return { name: field.label, value: avg }
    })
    
    return result
  }, [kpiData, selectedHub, selectedDate, dashboardView, selectedRegion, hubToRegionMap])

  // Function to refresh dashboard metrics
  const handleRefreshMetrics = async () => {
    setIsRefreshing(true)
    try {
      // Call the refresh function via Supabase RPC
      const { data, error } = await supabase.rpc('refresh_dashboard_metrics')
      if (error) {
        console.error('Error refreshing dashboard metrics:', error)
      } else {
        console.log('Dashboard metrics refreshed successfully')
        // Refetch data to get updated metrics
        window.location.reload()
      }
    } catch (error) {
      console.error('Error:', error)
    } finally {
      setIsRefreshing(false)
    }
  }

  // Filter chart data based on hub/region and date selection - using dashboard_metrics
  // In Overall view with selectedRegion, shows chart data for all hubs in that region
  const filteredChartData = useMemo(() => {
    // For hub view: if no filters selected, return empty array
    if (dashboardView === 'hub' && !selectedHub && !selectedDate) {
      return []
    }
    
    // For overall view: if no region and no date selected, return empty array
    if (dashboardView === 'overall' && !selectedRegion && !selectedDate) {
      return []
    }
    
    // Use dashboard_metrics as primary source (pre-aggregated)
    if (!dashboardMetrics.length) {
      return []
    }
    
    let filtered = dashboardMetrics
    
    // In Overall view with selectedRegion: filter hubs in that region
    if (dashboardView === 'overall' && selectedRegion) {
      filtered = filtered.filter(item => hubToRegionMap[item.hub] === selectedRegion)
    }
    // In Hub view with selectedHub: filter by specific hub
    else if (dashboardView === 'hub' && selectedHub && selectedHub !== 'All Hubs') {
      filtered = filtered.filter(item => item.hub === selectedHub)
    }
    
    // Filter by date: show last 7 days from selected date
    if (selectedDate) {
      const endDate = new Date(selectedDate)
      const startDate = new Date(selectedDate)
      startDate.setDate(endDate.getDate() - 7) // 7 days back
      
      filtered = filtered.filter(item => {
        const itemDate = item.date?.split('T')[0] || item.date?.split(' ')[0] || item.date
        if (!itemDate) return false
        const date = new Date(itemDate)
        return date >= startDate && date <= endDate
      })
    }
    
    // Sort by date and format for chart
    return filtered
      .sort((a, b) => new Date(a.date) - new Date(b.date))
      .map(item => ({
        month: item.date?.slice(0, 10) || item.date, // Show YYYY-MM-DD
        'Success Rate': Math.round((item.success_rate || 0) * 100),
        'Riders': item.riders || 0,
        'Delivered': item.delivered || 0,
        'On-Hold': item.on_hold || 0,
        'Productivity': Math.round(item.productivity || 0),
        'Clear Floor Rate': Math.round(item.clear_floor_rate || 0),
        'Scorecard': (item.scorecard || 0).toFixed(1)
      }))
  }, [dashboardMetrics, selectedHub, selectedDate, dashboardView, selectedRegion, hubToRegionMap])

  // Close hub dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (showHubDropdown && !event.target.closest('.hub-search-container')) {
        setShowHubDropdown(false)
      }
    }
    
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [showHubDropdown])

  // Calculate Retention & Attrition metrics from riders data - filtered by hub and MTD/L7D
  const retentionMetrics = useMemo(() => {
    if (!ridersData.length) {
      return {
        totalRiders: 0,
        activeRiders: 0,
        inactiveRiders: 0,
        retentionRate: 0,
        attritionRate: 0,
        attritionRiders: []
      }
    }

    // Filter by hub if selected
    let filteredRiders = ridersData
    if (selectedHub && selectedHub !== 'All Hubs') {
      filteredRiders = filteredRiders.filter(r => r.operator_hub === selectedHub)
    }

    // If no hub selected, return empty
    if (!selectedHub || selectedHub === 'All Hubs') {
      return {
        totalRiders: 0,
        activeRiders: 0,
        inactiveRiders: 0,
        retentionRate: 0,
        attritionRate: 0,
        attritionRiders: []
      }
    }

    // Calculate date range based on retentionView (MTD or L7D)
    const endDate = selectedDate ? new Date(selectedDate) : new Date()
    const startDate = new Date(endDate)
    
    if (retentionView === 'MTD') {
      // Month-to-Date: from 1st of month to selected date
      startDate.setDate(1)
    } else {
      // L7D: Last 7 days from selected date
      startDate.setDate(endDate.getDate() - 7)
    }

    // Filter riders who have activity within the date range
    // (based on last_active date or deployment_date)
    filteredRiders = filteredRiders.filter(r => {
      const lastActive = r.last_active ? new Date(r.last_active) : null
      const deployed = r.deployment_date ? new Date(r.deployment_date) : null
      
      // Include if rider was active during the period
      if (lastActive && lastActive >= startDate && lastActive <= endDate) return true
      // Include if rider was deployed during the period
      if (deployed && deployed <= endDate) return true
      
      return false
    })

    const totalRiders = filteredRiders.length
    const activeRiders = filteredRiders.filter(r => r.status === 'Active').length
    const inactiveRiders = totalRiders - activeRiders
    const retentionRate = totalRiders > 0 ? Math.round((activeRiders / totalRiders) * 100 * 10) / 10 : 0
    const attritionRate = totalRiders > 0 ? Math.round((inactiveRiders / totalRiders) * 100 * 10) / 10 : 0

    // Get inactive riders for the breakdown table
    const attritionRiders = filteredRiders
      .filter(r => r.status !== 'Active')
      .map(r => ({
        id: r.rider_id,
        name: r.rider_name,
        lastActive: r.last_active || 'N/A',
        status: r.status || 'Inactive'
      }))

    return {
      totalRiders,
      activeRiders,
      inactiveRiders,
      retentionRate,
      attritionRate,
      attritionRiders
    }
  }, [ridersData, selectedHub, retentionView, selectedDate])

  // Calculate P7D vs L7D comparison data for Overall view using REAL data
  const getComparisonData = useMemo(() => {
    return () => {
      // Get all unique hubs from dashboardMetrics
      let hubs = [...new Set(dashboardMetrics.map(item => item.hub).filter(Boolean))]
      
      // Filter by selected region if specified
      if (selectedRegion) {
        hubs = hubs.filter(hub => {
          const hubData = dashboardMetrics.find(item => item.hub === hub)
          return hubData?.region === selectedRegion || hubToRegionMap[hub] === selectedRegion
        })
      }
      
      // Find the latest date in the data
      const dates = dashboardMetrics.map(item => item.date?.split('T')[0] || item.date).filter(Boolean)
      const latestDate = dates.length > 0 ? new Date(Math.max(...dates.map(d => new Date(d).getTime()))) : new Date()
      
      // Calculate date ranges
      // L7D: Last 7 days (today - 6 days back)
      const l7dEnd = new Date(latestDate)
      const l7dStart = new Date(latestDate)
      l7dStart.setDate(l7dEnd.getDate() - 6)
      
      // P7D: Prior 7 days (7-13 days ago from today)
      const p7dEnd = new Date(latestDate)
      p7dEnd.setDate(p7dEnd.getDate() - 7)
      const p7dStart = new Date(latestDate)
      p7dStart.setDate(p7dStart.getDate() - 13)
      
      // Helper to check if date is in range
      const isInRange = (dateStr, start, end) => {
        const date = new Date(dateStr?.split('T')[0] || dateStr)
        return date >= start && date <= end
      }
      
      // Calculate averages for each hub
      return hubs.slice(0, 6).map(hub => {
        // Get all records for this hub
        const hubRecords = dashboardMetrics.filter(item => item.hub === hub)
        
        // L7D records (last 7 days)
        const l7dRecords = hubRecords.filter(item => isInRange(item.date, l7dStart, l7dEnd))
        
        // P7D records (prior 7 days, days 8-14)
        const p7dRecords = hubRecords.filter(item => isInRange(item.date, p7dStart, p7dEnd))
        
        // Calculate averages helper
        const calcAvg = (records, field, isPercent = false) => {
          if (records.length === 0) return 0
          const sum = records.reduce((acc, item) => {
            const val = item[field] || 0
            return acc + (isPercent && val <= 1 ? val * 100 : val)
          }, 0)
          return Math.round(sum / records.length)
        }
        
        return {
          hub: hub.replace('OP ', '').replace(' Cebu Hub', ''),
          // Clear Floor Rate
          cfrP7D: calcAvg(p7dRecords, 'clear_floor_rate', true),
          cfrL7D: calcAvg(l7dRecords, 'clear_floor_rate', true),
          // Success Rate
          srP7D: calcAvg(p7dRecords, 'success_rate', true),
          srL7D: calcAvg(l7dRecords, 'success_rate', true),
          // KPI (using scorecard as proxy)
          kpiP7D: calcAvg(p7dRecords, 'scorecard', false),
          kpiL7D: calcAvg(l7dRecords, 'scorecard', false),
          // Productivity
          prodP7D: calcAvg(p7dRecords, 'productivity', true),
          prodL7D: calcAvg(l7dRecords, 'productivity', true)
        }
      }).filter(hub => hub.cfrL7D > 0 || hub.srL7D > 0 || hub.kpiL7D > 0 || hub.prodL7D > 0) // Only show hubs with data
    }
  }, [dashboardMetrics, selectedRegion, hubToRegionMap])

  // Calculate Rider Level data: Individual riders with their metrics
  const riderLevelData = useMemo(() => {
    if (!performanceRecords.length) return []
    
    // Filter performance records by hub and date
    let filtered = performanceRecords
    
    if (selectedHub && selectedHub !== 'All Hubs') {
      filtered = filtered.filter(p => p.operator_hub === selectedHub)
    }
    
    if (selectedDate) {
      filtered = filtered.filter(p => {
        const recordDate = p.date?.split('T')[0] || p.date
        return recordDate === selectedDate
      })
    }
    
    // Group by rider and calculate metrics
    const riderMap = new Map()
    
    filtered.forEach(record => {
      const riderId = record.rider_id || record.driver_name || record.operator_id
      if (!riderId) return
      
      if (!riderMap.has(riderId)) {
        riderMap.set(riderId, {
          riderId: riderId,
          riderName: record.driver_name || record.rider_name || riderId,
          hub: record.operator_hub || 'Unknown',
          delivered: 0,
          onHold: 0,
          assigned: 0,
          successRate: 0,
          productivity: 0,
          recordCount: 0
        })
      }
      
      const rider = riderMap.get(riderId)
      rider.delivered += parseInt(record.delivered) || 0
      rider.onHold += parseInt(record.onhold) || 0
      rider.assigned += parseInt(record.assigned) || 0
      rider.successRate += parseFloat(record.pecentage) || parseFloat(record.percentage) || 0
      rider.productivity += parseFloat(record.productivity) || 0
      rider.recordCount++
    })
    
    // Calculate averages and format
    return Array.from(riderMap.values()).map(rider => ({
      ...rider,
      successRate: rider.recordCount > 0 ? Math.round(rider.successRate / rider.recordCount) : 0,
      productivity: rider.recordCount > 0 ? Math.round(rider.productivity / rider.recordCount) : 0
    })).sort((a, b) => b.delivered - a.delivered) // Sort by delivered descending
  }, [performanceRecords, selectedHub, selectedDate])

  const COLORS = ['#a83030', '#c94c4c', '#e07e7e', '#f0b1b1', '#742a2a']

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="w-10 h-10 animate-spin text-maroon-500" />
      </div>
    )
  }

  return (
    <div className="space-y-4 relative">
      {/* Grid Background Pattern */}
      <div className="fixed inset-0 pointer-events-none" style={{
        backgroundImage: `radial-gradient(circle, #334155 0.5px, transparent 0.5px)`,
        backgroundSize: '24px 24px',
        opacity: 0.15
      }}></div>
      
      {/* View Toggle */}
      <div className="relative bg-slate-800/80 backdrop-blur-md rounded-lg p-2 border border-slate-600/50">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setDashboardView('hub')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium transition-all duration-300 ${
              dashboardView === 'hub'
                ? 'bg-maroon-600 text-white shadow-[0_0_10px_rgba(168,48,48,0.5)]'
                : 'text-slate-400 hover:text-white hover:bg-slate-700/50'
            }`}
          >
            <Building2 className="w-3.5 h-3.5" />
            Hub Level
          </button>
          <button
            onClick={() => setDashboardView('rider')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium transition-all duration-300 ${
              dashboardView === 'rider'
                ? 'bg-maroon-600 text-white shadow-[0_0_10px_rgba(168,48,48,0.5)]'
                : 'text-slate-400 hover:text-white hover:bg-slate-700/50'
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            Rider Level
          </button>
          <button
            onClick={() => setDashboardView('overall')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium transition-all duration-300 ${
              dashboardView === 'overall'
                ? 'bg-maroon-600 text-white shadow-[0_0_10px_rgba(168,48,48,0.5)]'
                : 'text-slate-400 hover:text-white hover:bg-slate-700/50'
            }`}
          >
            <Globe className="w-3.5 h-3.5" />
            Overall
          </button>
        </div>
      </div>

      {/* Filters Bar - Glassmorphism - Hub filter for Hub view, Region filter for Overall view */}
      {dashboardView === 'hub' && (
      <div className="relative bg-slate-800/80 backdrop-blur-md rounded-lg p-3 border border-slate-600/50 hover:border-slate-500/80 transition-all duration-300 shadow-[0_0_30px_rgba(0,0,0,0.3)] z-50">
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-1.5 text-slate-400">
            <Filter className="w-3.5 h-3.5" />
            <span className="text-xs font-medium tracking-wide uppercase">Filters</span>
          </div>
          
          <div className="relative hub-search-container">
            <input 
              type="text"
              placeholder="Search hub..."
              value={hubSearchTerm || selectedHub}
              onChange={(e) => {
                setHubSearchTerm(e.target.value)
                setShowHubDropdown(true)
              }}
              onFocus={() => setShowHubDropdown(true)}
              className="bg-slate-700/80 border border-slate-600/50 rounded px-2 py-1 text-xs text-white focus:ring-1 focus:ring-maroon-500/50 outline-none backdrop-blur-sm w-64"
            />
            {showHubDropdown && (
              <div className="absolute top-full left-0 mt-1 bg-slate-700/95 border border-slate-600/50 rounded shadow-lg z-[99999] max-h-40 overflow-y-auto w-64">
                {filteredHubs.length > 0 ? (
                  filteredHubs.map(hub => (
                    <div
                      key={hub}
                      onClick={() => {
                        setSelectedHub(hub)
                        setHubSearchTerm('')
                        setShowHubDropdown(false)
                      }}
                      className="px-2 py-1 text-xs text-white hover:bg-slate-600/50 cursor-pointer"
                    >
                      {hub}
                    </div>
                  ))
                ) : (
                  <div className="px-2 py-1 text-xs text-slate-400">No hubs found</div>
                )}
              </div>
            )}
          </div>
          
          <input 
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="bg-slate-700/80 border border-slate-600/50 rounded px-2 py-1 text-xs text-white focus:ring-1 focus:ring-maroon-500/50 outline-none backdrop-blur-sm"
          />
          
          {/* Refresh Button */}
          <button
            onClick={handleRefreshMetrics}
            disabled={isRefreshing}
            className="ml-auto flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600/90 hover:bg-emerald-500 disabled:bg-emerald-700/50 text-white rounded text-xs font-medium transition-all duration-300 hover:shadow-[0_0_15px_rgba(16,185,129,0.4)] backdrop-blur-sm border border-emerald-500/30 disabled:cursor-not-allowed"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
            {isRefreshing ? 'Refreshing...' : 'Refresh'}
          </button>
          
                  </div>
      </div>
      )}

      {/* Filters Bar for Rider Level View - Hub and Date Filters */}
      {dashboardView === 'rider' && (
      <div className="relative bg-slate-800/80 backdrop-blur-md rounded-lg p-3 border border-slate-600/50 hover:border-slate-500/80 transition-all duration-300 shadow-[0_0_30px_rgba(0,0,0,0.3)] z-50">
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-1.5 text-slate-400">
            <Filter className="w-3.5 h-3.5" />
            <span className="text-xs font-medium tracking-wide uppercase">Filters</span>
          </div>
          
          <div className="relative hub-search-container">
            <input 
              type="text"
              placeholder="Search hub..."
              value={hubSearchTerm || selectedHub}
              onChange={(e) => {
                setHubSearchTerm(e.target.value)
                setShowHubDropdown(true)
              }}
              onFocus={() => setShowHubDropdown(true)}
              className="bg-slate-700/80 border border-slate-600/50 rounded px-2 py-1 text-xs text-white focus:ring-1 focus:ring-maroon-500/50 outline-none backdrop-blur-sm w-64"
            />
            {showHubDropdown && (
              <div className="absolute top-full left-0 mt-1 bg-slate-700/95 border border-slate-600/50 rounded shadow-lg z-[99999] max-h-40 overflow-y-auto w-64">
                {filteredHubs.length > 0 ? (
                  filteredHubs.map(hub => (
                    <div
                      key={hub}
                      onClick={() => {
                        setSelectedHub(hub)
                        setHubSearchTerm('')
                        setShowHubDropdown(false)
                      }}
                      className="px-2 py-1 text-xs text-white hover:bg-slate-600/50 cursor-pointer"
                    >
                      {hub}
                    </div>
                  ))
                ) : (
                  <div className="px-2 py-1 text-xs text-slate-400">No hubs found</div>
                )}
              </div>
            )}
          </div>
          
          <input 
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="bg-slate-700/80 border border-slate-600/50 rounded px-2 py-1 text-xs text-white focus:ring-1 focus:ring-maroon-500/50 outline-none backdrop-blur-sm"
          />
          
          {/* Refresh Button */}
          <button
            onClick={handleRefreshMetrics}
            disabled={isRefreshing}
            className="ml-auto flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600/90 hover:bg-emerald-500 disabled:bg-emerald-700/50 text-white rounded text-xs font-medium transition-all duration-300 hover:shadow-[0_0_15px_rgba(16,185,129,0.4)] backdrop-blur-sm border border-emerald-500/30 disabled:cursor-not-allowed"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
            {isRefreshing ? 'Refreshing...' : 'Refresh'}
          </button>
          
          </div>
      </div>
      )}

      {/* Filters Bar for Overall View - Region Filter */}
      {dashboardView === 'overall' && (
      <div className="relative bg-slate-800/80 backdrop-blur-md rounded-lg p-3 border border-slate-600/50 hover:border-slate-500/80 transition-all duration-300 shadow-[0_0_30px_rgba(0,0,0,0.3)] z-50">
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-1.5 text-slate-400">
            <Filter className="w-3.5 h-3.5" />
            <span className="text-xs font-medium tracking-wide uppercase">Filters</span>
          </div>
          
          {/* Region Filter */}
          <select
            value={selectedRegion}
            onChange={(e) => setSelectedRegion(e.target.value)}
            className="bg-slate-700/80 border border-slate-600/50 rounded px-2 py-1 text-xs text-white focus:ring-1 focus:ring-maroon-500/50 outline-none backdrop-blur-sm w-64"
          >
            <option value="">All Regions</option>
            {uniqueRegions.map(region => (
              <option key={region} value={region}>{region}</option>
            ))}
          </select>
          
          {/* Refresh Button */}
          <button
            onClick={handleRefreshMetrics}
            disabled={isRefreshing}
            className="ml-auto flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600/90 hover:bg-emerald-500 disabled:bg-emerald-700/50 text-white rounded text-xs font-medium transition-all duration-300 hover:shadow-[0_0_15px_rgba(16,185,129,0.4)] backdrop-blur-sm border border-emerald-500/30 disabled:cursor-not-allowed"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
            {isRefreshing ? 'Refreshing...' : 'Refresh'}
          </button>
          
        </div>
      </div>
      )}

      {/* KPI Stats Row - Symmetrical 7 Metrics - Hub Level Only */}
      {dashboardView === 'hub' && (
      <div className="flex gap-2">
        <CompactStatCard 
          title="Success Rate" 
          value={`${filteredStats.successRate || 0}%`} 
          icon={CheckCircle}
          color="bg-green-600"
        />
        <CompactStatCard 
          title="Riders" 
          value={filteredStats.activeRiders?.toLocaleString() || '0'} 
          icon={Users}
          color="bg-blue-600"
        />
        <CompactStatCard 
          title="Delivered" 
          value={filteredStats.delivered?.toLocaleString() || '0'} 
          icon={Package}
          color="bg-emerald-600"
        />
        <CompactStatCard 
          title="On-Hold" 
          value={filteredStats.onHold?.toLocaleString() || '0'} 
          icon={PauseCircle}
          color="bg-orange-600"
        />
        <CompactStatCard 
          title="Productivity" 
          value={`${filteredStats.productivity || 0}%`} 
          icon={TrendingUp}
          color="bg-cyan-600"
        />
        <CompactStatCard 
          title="Clear Floor" 
          value={`${filteredStats.clearFloorRate || 0}%`} 
          icon={Sparkles}
          color="bg-indigo-600"
        />
        <CompactStatCard 
          title="Scorecard" 
          value={filteredStats.scorecard || '0.0'} 
          icon={Target}
          color="bg-purple-600"
        />
      </div>
      )}

      {/* Charts Row - Horizontal Layout - Hub Level Only */}
      {dashboardView === 'hub' && (
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Delivery Performance - Horizontal Bar Chart */}
        <div className="relative bg-slate-800/80 backdrop-blur-sm rounded-lg p-3 border border-slate-600/50 hover:border-slate-500/50 transition-all duration-300 shadow-[0_0_20px_rgba(0,0,0,0.2)] lg:col-span-2">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <div className="w-1 h-4 bg-maroon-500 rounded-full shadow-[0_0_10px_rgba(168,48,48,0.5)]"></div>
              <h3 className="text-sm font-semibold text-white tracking-wide">Delivery Trend</h3>
            </div>
            <div className="flex items-center gap-2">
              {/* Category Filter */}
              <select 
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="bg-slate-700/80 border border-slate-600/50 rounded px-2 py-1 text-xs text-white focus:ring-1 focus:ring-maroon-500/50 outline-none backdrop-blur-sm"
              >
                <option value="Success Rate">Success Rate</option>
                <option value="Riders">Riders</option>
                <option value="Delivered">Delivered</option>
                <option value="On-Hold">On-Hold</option>
                <option value="Productivity">Productivity</option>
                <option value="Clear Floor Rate">Clear Floor Rate</option>
                <option value="Scorecard">Scorecard</option>
              </select>
            </div>
          </div>
          <ResponsiveContainer width="100%" height={320}>
            {filteredChartData.length > 0 ? (
            <AreaChart data={filteredChartData} layout="horizontal">
              <defs>
                <linearGradient id="colorDeliveries" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#a83030" stopOpacity={0.3}/>
                  <stop offset="95%" stopColor="#a83030" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.5} />
              <XAxis 
                dataKey="month" 
                stroke="#94a3b8" 
                fontSize={8} 
                tickLine={false} 
                axisLine={false}
                interval={filteredChartData.length > 6 ? Math.floor(filteredChartData.length / 5) : 0}
                angle={-45}
                textAnchor="end"
                height={60}
              />
              <YAxis 
                stroke="#94a3b8" 
                fontSize={9} 
                tickLine={false} 
                axisLine={false} 
                width={40}
                domain={['Success Rate', 'Productivity', 'Clear Floor Rate', 'Scorecard'].includes(selectedCategory) ? [0, 100] : [0, 'auto']}
              />
              <Tooltip 
                contentStyle={{ 
                  backgroundColor: '#1e293b', 
                  border: '1px solid #334155', 
                  borderRadius: '6px',
                  color: '#fff',
                  fontSize: '11px',
                  boxShadow: '0 0 20px rgba(0,0,0,0.5)'
                }} 
              />
              <Area 
                type="monotone" 
                dataKey={selectedCategory} 
                stroke="#a83030" 
                strokeWidth={2}
                fillOpacity={1} 
                fill="url(#colorDeliveries)" 
              />
            </AreaChart>
            ) : (
              <div className="flex items-center justify-center h-full">
                <span className="text-slate-400 text-sm">
                  {dashboardView === 'hub' ? 'Select hub and date to view trend' : 'Select region and date to view trend'}
                </span>
              </div>
            )}
          </ResponsiveContainer>
        </div>

        {/* Charts Column - KPI Distribution Only */}
        <div className="flex flex-col">
          {/* KPI Grade Distribution - Spider/Radar Chart */}
          <div className="relative bg-slate-800/80 backdrop-blur-sm rounded-lg p-3 border border-slate-600/50 hover:border-slate-500/50 transition-all duration-300 shadow-[0_0_20px_rgba(0,0,0,0.2)] flex-1 h-full">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-1 h-4 bg-maroon-500 rounded-full shadow-[0_0_10px_rgba(168,48,48,0.5)]"></div>
              <h3 className="text-sm font-semibold text-white tracking-wide">KPI Distribution</h3>
            </div>
            <ResponsiveContainer width="100%" height={300}>
              <RadarChart cx="50%" cy="50%" outerRadius="70%" data={kpiGradeData}>
                <PolarGrid stroke="#334155" />
                <PolarAngleAxis dataKey="name" tick={{ fill: '#94a3b8', fontSize: 9 }} />
                <PolarRadiusAxis angle={30} domain={[0, 100]} tick={false} axisLine={false} />
                <Radar
                  name="KPI"
                  dataKey="value"
                  stroke="#a83030"
                  strokeWidth={2}
                  fill="#a83030"
                  fillOpacity={0.3}
                />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: '#1e293b', 
                    border: '1px solid #334155', 
                    borderRadius: '6px',
                    color: '#fff',
                    fontSize: '11px',
                    boxShadow: '0 0 20px rgba(0,0,0,0.5)'
                  }} 
                />
              </RadarChart>
            </ResponsiveContainer>
            {/* KPI Percentage Labels */}
            <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
              {kpiGradeData.map((kpi, index) => (
                <div key={kpi.name} className="flex items-center justify-between bg-slate-700/30 rounded px-2 py-1">
                  <span className="text-slate-400 truncate">{kpi.name}</span>
                  <span className="text-white font-mono font-semibold">{kpi.value}%</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
      )}

      {/* Rider Stats Section - Hub Level Only */}
      {dashboardView === 'hub' && (
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Riders No Route */}
        <div className="relative bg-slate-800/80 backdrop-blur-sm rounded-lg p-4 border border-slate-600/50 hover:border-slate-500/50 transition-all duration-300 shadow-[0_0_20px_rgba(0,0,0,0.2)]">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <div className="w-1 h-4 bg-maroon-500 rounded-full shadow-[0_0_10px_rgba(168,48,48,0.5)]"></div>
              <Users className="w-4 h-4 text-maroon-400" />
              <h3 className="text-sm font-semibold text-white tracking-wide">Riders No Route</h3>
            </div>
            <span className="text-lg font-bold text-maroon-400 font-mono">
              {filteredRidersNoRoute.length}
            </span>
          </div>
          
          <div className="bg-slate-700/30 rounded-lg overflow-hidden backdrop-blur-sm border border-slate-600/30">
            <div className="max-h-[300px] overflow-y-auto scrollbar-thin scrollbar-thumb-slate-600 scrollbar-track-slate-800">
              <table className="w-full text-xs">
                <thead className="sticky top-0 z-10">
                  <tr className="bg-slate-700/80 backdrop-blur-sm">
                    <th className="px-3 py-2 text-left font-semibold text-slate-300 uppercase text-[10px] tracking-wider">Rider ID</th>
                    <th className="px-3 py-2 text-left font-semibold text-slate-300 uppercase text-[10px] tracking-wider">Rider Name</th>
                    <th className="px-3 py-2 text-center font-semibold text-slate-300 uppercase text-[10px] tracking-wider">Deployed Date</th>
                    <th className="px-3 py-2 text-center font-semibold text-slate-300 uppercase text-[10px] tracking-wider">Last Active Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-700/50">
                  {filteredRidersNoRoute.map((rider, index) => (
                    <tr key={rider.riderId} className="hover:bg-slate-700/30 transition">
                      <td className="px-3 py-2">
                        <span className="text-white font-medium font-mono">{rider.riderId}</span>
                      </td>
                      <td className="px-3 py-2">
                        <span className="text-white font-medium truncate max-w-[150px] block" title={rider.riderName}>
                          {rider.riderName}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-center">
                        <span className="text-slate-300 font-mono">{rider.deployedDate}</span>
                      </td>
                      <td className="px-3 py-2 text-center">
                        <span className="text-emerald-400 font-mono">{rider.lastActiveDate}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          <p className="text-slate-500 text-[10px] mt-2 text-right font-mono">As of {selectedDate}</p>
        </div>

        {/* Retention & Attrition Rate */}
        <div className="relative bg-slate-800/80 backdrop-blur-sm rounded-lg p-4 border border-slate-600/50 hover:border-slate-500/50 transition-all duration-300 shadow-[0_0_20px_rgba(0,0,0,0.2)]">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <div className="w-1 h-4 bg-blue-500 rounded-full shadow-[0_0_10px_rgba(59,130,246,0.5)]"></div>
              <svg className="w-4 h-4 text-blue-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
                <circle cx="9" cy="7" r="4" />
                <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
                <path d="M16 3.13a4 4 0 0 1 0 7.75" />
              </svg>
              <h3 className="text-sm font-semibold text-white tracking-wide">Retention & Attrition Rate</h3>
            </div>
            {/* Retention View Filter */}
            <select 
              value={retentionView}
              onChange={(e) => setRetentionView(e.target.value)}
              className="bg-slate-700/80 border border-slate-600/50 rounded px-2 py-1 text-xs text-white focus:ring-1 focus:ring-blue-500/50 outline-none backdrop-blur-sm"
            >
              <option value="MTD">MTD</option>
              <option value="L7D">L7D</option>
            </select>
          </div>
          
          <div className="space-y-3">
            {/* Summary Cards - 3 columns */}
            <div className="grid grid-cols-3 gap-2">
              <div className="bg-slate-700/30 rounded-lg p-2 border border-slate-600/30">
                <p className="text-slate-400 text-[8px] uppercase tracking-wider mb-1">Total Riders</p>
                <span className="text-lg font-bold text-white font-mono">{retentionMetrics.totalRiders}</span>
              </div>
              <div className="bg-slate-700/30 rounded-lg p-2 border border-slate-600/30">
                <p className="text-slate-400 text-[8px] uppercase tracking-wider mb-1">Retention</p>
                <span className="text-lg font-bold text-emerald-400 font-mono">{retentionMetrics.activeRiders}</span>
                <span className="text-emerald-500 text-[9px] ml-1">{retentionMetrics.retentionRate}%</span>
              </div>
              <div className="bg-slate-700/30 rounded-lg p-2 border border-slate-600/30">
                <p className="text-slate-400 text-[8px] uppercase tracking-wider mb-1">Attrition</p>
                <span className="text-lg font-bold text-red-400 font-mono">{retentionMetrics.inactiveRiders}</span>
                <span className="text-red-500 text-[9px] ml-1">{retentionMetrics.attritionRate}%</span>
              </div>
            </div>
            
            {/* Attrition Riders Breakdown */}
            <div className="bg-slate-700/30 rounded-lg overflow-hidden backdrop-blur-sm border border-slate-600/30">
              <p className="text-slate-400 text-[9px] uppercase tracking-wider px-3 py-2 bg-slate-700/50 border-b border-slate-600/30">Attrition Riders Breakdown</p>
              <div className="max-h-[200px] overflow-y-auto scrollbar-thin scrollbar-thumb-slate-600 scrollbar-track-slate-800">
                <table className="w-full text-xs">
                  <thead className="sticky top-0 z-10">
                    <tr className="bg-slate-700/80 backdrop-blur-sm">
                      <th className="px-3 py-2 text-left font-semibold text-slate-300 uppercase text-[10px] tracking-wider">Rider ID</th>
                      <th className="px-3 py-2 text-left font-semibold text-slate-300 uppercase text-[10px] tracking-wider">Rider Name</th>
                      <th className="px-3 py-2 text-center font-semibold text-slate-300 uppercase text-[10px] tracking-wider">Last Active</th>
                      <th className="px-3 py-2 text-center font-semibold text-slate-300 uppercase text-[10px] tracking-wider">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-700/50">
                    {retentionMetrics.attritionRiders.length > 0 ? (
                      retentionMetrics.attritionRiders.map((rider) => (
                        <tr key={rider.id} className="hover:bg-slate-700/30 transition">
                          <td className="px-3 py-2">
                            <span className="text-white font-medium font-mono">{rider.id}</span>
                          </td>
                          <td className="px-3 py-2">
                            <span className="text-white truncate max-w-[100px] block" title={rider.name}>{rider.name}</span>
                          </td>
                          <td className="px-3 py-2 text-center">
                            <span className="text-slate-400 font-mono">{rider.lastActive}</span>
                          </td>
                          <td className="px-3 py-2 text-center">
                            <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-medium ${
                              rider.status === 'Inactive' ? 'bg-red-900/30 text-red-400' : 'bg-orange-900/30 text-orange-400'
                            }`}>{rider.status}</span>
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan="4" className="px-3 py-4 text-center text-slate-400 text-xs">
                          No attrition riders found
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
            <p className="text-slate-500 text-[10px] text-right font-mono">{retentionView === 'MTD' ? 'Month-to-Date' : 'Last 7 Days'}</p>
          </div>
        </div>
      </div>
      )}

      {/* Rider Level View - Individual Riders Table */}
      {dashboardView === 'rider' && (
      <div className="space-y-4">
        {/* Stats Summary */}
        <div className="flex gap-2">
          <CompactStatCard 
            title="Total Riders" 
            value={riderLevelData.length} 
            icon={Users}
          />
          <CompactStatCard 
            title="Total Delivered" 
            value={riderLevelData.reduce((sum, r) => sum + r.delivered, 0)} 
            icon={Package}
          />
          <CompactStatCard 
            title="Avg Success Rate" 
            value={`${riderLevelData.length > 0 ? Math.round(riderLevelData.reduce((sum, r) => sum + r.successRate, 0) / riderLevelData.length) : 0}%`} 
            icon={TrendingUp}
          />
        </div>
        
        {/* Riders Table */}
        <div className="relative bg-slate-800/80 backdrop-blur-sm rounded-lg p-4 border border-slate-600/50 hover:border-slate-500/50 transition-all duration-300 shadow-[0_0_20px_rgba(0,0,0,0.2)]">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-white flex items-center gap-2">
              <Users className="w-4 h-4 text-maroon-500" />
              Rider Performance
            </h3>
            <span className="text-xs text-slate-400">{riderLevelData.length} riders found</span>
          </div>
          
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-700">
                  <th className="text-left px-3 py-2 text-[10px] font-medium text-slate-400 uppercase tracking-wider">Rider ID</th>
                  <th className="text-left px-3 py-2 text-[10px] font-medium text-slate-400 uppercase tracking-wider">Rider Name</th>
                  <th className="text-left px-3 py-2 text-[10px] font-medium text-slate-400 uppercase tracking-wider">Hub</th>
                  <th className="text-right px-3 py-2 text-[10px] font-medium text-slate-400 uppercase tracking-wider">Delivered</th>
                  <th className="text-right px-3 py-2 text-[10px] font-medium text-slate-400 uppercase tracking-wider">On-Hold</th>
                  <th className="text-right px-3 py-2 text-[10px] font-medium text-slate-400 uppercase tracking-wider">Success Rate</th>
                  <th className="text-right px-3 py-2 text-[10px] font-medium text-slate-400 uppercase tracking-wider">Productivity</th>
                </tr>
              </thead>
              <tbody className="text-xs">
                {riderLevelData.length > 0 ? (
                  riderLevelData.slice(0, 50).map((rider, index) => (
                    <tr key={rider.riderId} className={`border-b border-slate-700/50 hover:bg-slate-700/30 transition ${index % 2 === 0 ? 'bg-slate-800/20' : ''}`}>
                      <td className="px-3 py-2 text-slate-300">{rider.riderId}</td>
                      <td className="px-3 py-2 text-white font-medium">{rider.riderName}</td>
                      <td className="px-3 py-2 text-slate-400">{rider.hub}</td>
                      <td className="px-3 py-2 text-right text-emerald-400">{rider.delivered}</td>
                      <td className="px-3 py-2 text-right text-amber-400">{rider.onHold}</td>
                      <td className="px-3 py-2 text-right">
                        <span className={`${rider.successRate >= 90 ? 'text-emerald-400' : rider.successRate >= 70 ? 'text-amber-400' : 'text-red-400'}`}>
                          {rider.successRate}%
                        </span>
                      </td>
                      <td className="px-3 py-2 text-right text-slate-300">{rider.productivity}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan="7" className="px-3 py-8 text-center text-slate-400 text-xs">
                      {selectedHub || selectedDate 
                        ? 'No riders found for the selected filters' 
                        : 'Please select a Hub and Date to view rider data'}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          
          {riderLevelData.length > 50 && (
            <p className="text-slate-500 text-[10px] mt-2 text-right">
              Showing top 50 of {riderLevelData.length} riders
            </p>
          )}
        </div>
      </div>
      )}

      {/* Overall Dashboard View - P7D vs L7D Comparison Charts */}
      {dashboardView === 'overall' && (
      <div className="space-y-4">
        {/* Region Title */}
        <div className="text-center">
          <h2 className="text-xl font-bold text-white">{selectedRegion || 'All Regions'}</h2>
        </div>
        
        {/* Charts Grid - P7D vs L7D */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Avg KPI Chart */}
          <div className="relative bg-slate-800/80 backdrop-blur-sm rounded-lg p-4 border border-slate-600/50">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-white">AVG KPI (P7D vs L7D)</h3>
              <div className="flex items-center gap-3 text-xs">
                <div className="flex items-center gap-1">
                  <div className="w-3 h-3 bg-blue-500 rounded"></div>
                  <span className="text-slate-300">P7D</span>
                </div>
                <div className="flex items-center gap-1">
                  <div className="w-3 h-3 bg-red-500 rounded"></div>
                  <span className="text-slate-300">L7D</span>
                </div>
              </div>
            </div>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={getComparisonData()} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                <XAxis 
                  dataKey="hub" 
                  stroke="#94a3b8" 
                  fontSize={10}
                  angle={-15}
                  textAnchor="end"
                  height={60}
                />
                <YAxis 
                  stroke="#94a3b8" 
                  fontSize={10}
                  domain={[0, 100]}
                  tickFormatter={(value) => `${value}%`}
                />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: '#1e293b', 
                    border: '1px solid #334155', 
                    borderRadius: '6px',
                    color: '#fff',
                    fontSize: '11px'
                  }}
                  formatter={(value) => [`${value}%`, '']}
                />
                <Bar dataKey="kpiP7D" fill="#3b82f6" name="P7D" radius={[4, 4, 0, 0]}>
                  <LabelList dataKey="kpiP7D" position="top" formatter={(value) => `${value}%`} fill="#fff" fontSize={10} />
                </Bar>
                <Bar dataKey="kpiL7D" fill="#ef4444" name="L7D" radius={[4, 4, 0, 0]}>
                  <LabelList dataKey="kpiL7D" position="top" formatter={(value) => `${value}%`} fill="#fff" fontSize={10} />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Clear Floor Rate Chart */}
          <div className="relative bg-slate-800/80 backdrop-blur-sm rounded-lg p-4 border border-slate-600/50">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-white">CLEAR FLOOR RATE (P7D vs L7D)</h3>
              <div className="flex items-center gap-3 text-xs">
                <div className="flex items-center gap-1">
                  <div className="w-3 h-3 bg-blue-500 rounded"></div>
                  <span className="text-slate-300">P7D</span>
                </div>
                <div className="flex items-center gap-1">
                  <div className="w-3 h-3 bg-red-500 rounded"></div>
                  <span className="text-slate-300">L7D</span>
                </div>
              </div>
            </div>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={getComparisonData()} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                <XAxis 
                  dataKey="hub" 
                  stroke="#94a3b8" 
                  fontSize={10}
                  angle={-15}
                  textAnchor="end"
                  height={60}
                />
                <YAxis 
                  stroke="#94a3b8" 
                  fontSize={10}
                  domain={[0, 100]}
                  tickFormatter={(value) => `${value}%`}
                />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: '#1e293b', 
                    border: '1px solid #334155', 
                    borderRadius: '6px',
                    color: '#fff',
                    fontSize: '11px'
                  }}
                  formatter={(value) => [`${value}%`, '']}
                />
                <Bar dataKey="cfrP7D" fill="#3b82f6" name="P7D" radius={[4, 4, 0, 0]}>
                  <LabelList dataKey="cfrP7D" position="top" formatter={(value) => `${value}%`} fill="#fff" fontSize={10} />
                </Bar>
                <Bar dataKey="cfrL7D" fill="#ef4444" name="L7D" radius={[4, 4, 0, 0]}>
                  <LabelList dataKey="cfrL7D" position="top" formatter={(value) => `${value}%`} fill="#fff" fontSize={10} />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Success Rate Chart */}
          <div className="relative bg-slate-800/80 backdrop-blur-sm rounded-lg p-4 border border-slate-600/50">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-white">SUCCESS RATE (P7D vs L7D)</h3>
              <div className="flex items-center gap-3 text-xs">
                <div className="flex items-center gap-1">
                  <div className="w-3 h-3 bg-blue-500 rounded"></div>
                  <span className="text-slate-300">P7D</span>
                </div>
                <div className="flex items-center gap-1">
                  <div className="w-3 h-3 bg-red-500 rounded"></div>
                  <span className="text-slate-300">L7D</span>
                </div>
              </div>
            </div>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={getComparisonData()} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                <XAxis 
                  dataKey="hub" 
                  stroke="#94a3b8" 
                  fontSize={10}
                  angle={-15}
                  textAnchor="end"
                  height={60}
                />
                <YAxis 
                  stroke="#94a3b8" 
                  fontSize={10}
                  domain={[0, 100]}
                  tickFormatter={(value) => `${value}%`}
                />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: '#1e293b', 
                    border: '1px solid #334155', 
                    borderRadius: '6px',
                    color: '#fff',
                    fontSize: '11px'
                  }}
                  formatter={(value) => [`${value}%`, '']}
                />
                <Bar dataKey="srP7D" fill="#3b82f6" name="P7D" radius={[4, 4, 0, 0]}>
                  <LabelList dataKey="srP7D" position="top" formatter={(value) => `${value}%`} fill="#fff" fontSize={10} />
                </Bar>
                <Bar dataKey="srL7D" fill="#ef4444" name="L7D" radius={[4, 4, 0, 0]}>
                  <LabelList dataKey="srL7D" position="top" formatter={(value) => `${value}%`} fill="#fff" fontSize={10} />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Productivity Chart */}
          <div className="relative bg-slate-800/80 backdrop-blur-sm rounded-lg p-4 border border-slate-600/50">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-white">PRODUCTIVITY (P7D vs L7D)</h3>
              <div className="flex items-center gap-3 text-xs">
                <div className="flex items-center gap-1">
                  <div className="w-3 h-3 bg-blue-500 rounded"></div>
                  <span className="text-slate-300">P7D</span>
                </div>
                <div className="flex items-center gap-1">
                  <div className="w-3 h-3 bg-red-500 rounded"></div>
                  <span className="text-slate-300">L7D</span>
                </div>
              </div>
            </div>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={getComparisonData()} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                <XAxis 
                  dataKey="hub" 
                  stroke="#94a3b8" 
                  fontSize={10}
                  angle={-15}
                  textAnchor="end"
                  height={60}
                />
                <YAxis 
                  stroke="#94a3b8" 
                  fontSize={10}
                  domain={[0, 100]}
                  tickFormatter={(value) => `${value}%`}
                />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: '#1e293b', 
                    border: '1px solid #334155', 
                    borderRadius: '6px',
                    color: '#fff',
                    fontSize: '11px'
                  }}
                  formatter={(value) => [`${value}%`, '']}
                />
                <Bar dataKey="prodP7D" fill="#3b82f6" name="P7D" radius={[4, 4, 0, 0]}>
                  <LabelList dataKey="prodP7D" position="top" formatter={(value) => `${value}%`} fill="#fff" fontSize={10} />
                </Bar>
                <Bar dataKey="prodL7D" fill="#ef4444" name="L7D" radius={[4, 4, 0, 0]}>
                  <LabelList dataKey="prodL7D" position="top" formatter={(value) => `${value}%`} fill="#fff" fontSize={10} />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
      )}
    </div>
  )
}

export default Dashboard
