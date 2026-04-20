import { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import { supabase } from '../lib/supabase'
import html2canvas from 'html2canvas'
import jsPDF from 'jspdf'
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
  ArrowUpRight, 
  ArrowDownRight, 
  Calendar,
  Search,
  X,
  Filter,
  MapPin,
  Building2,
  ChevronDown,
  ChevronUp,
  Globe,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  FileSpreadsheet,
  Download,
  Loader2, 
  Package,
  CheckCircle,
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
  const [selectedRider, setSelectedRider] = useState('')
  const [riderSearchTerm, setRiderSearchTerm] = useState('')
  const [showRiderDropdown, setShowRiderDropdown] = useState(false)
  const [selectedRegion, setSelectedRegion] = useState('')
  const [selectedCategory, setSelectedCategory] = useState('All')
  const [dashboardView, setDashboardView] = useState('hub') // 'hub', 'rider', or 'overall'
  const [selectedDate, setSelectedDate] = useState('') // empty by default
  const [retentionView, setRetentionView] = useState('MTD') // 'MTD' or 'L7D' for Retention & Attrition
  const [riderTrendView, setRiderTrendView] = useState('MTD') // 'MTD' or 'L7D' for Rider Delivery Trend
  const [riderTrendMetric, setRiderTrendMetric] = useState('delivered') // 'delivered', 'onHold', 'successRate', 'productivity'
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
        // Error fetching dashboard data
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

  // Get unique riders for filter - from ridersData
  const uniqueRiders = useMemo(() => {
    const riders = ridersData.map(rider => ({
      id: rider.rider_id,
      name: rider.rider_name
    })).filter(r => r.id && r.name)
    // Remove duplicates by ID
    const seen = new Set()
    return riders.filter(rider => {
      if (seen.has(rider.id)) return false
      seen.add(rider.id)
      return true
    }).sort((a, b) => a.name.localeCompare(b.name))
  }, [ridersData])

  // Filter riders based on search term
  const filteredRiders = useMemo(() => {
    if (!riderSearchTerm) return uniqueRiders
    
    const filtered = uniqueRiders.filter(rider => 
      rider.name.toLowerCase().includes(riderSearchTerm.toLowerCase()) ||
      String(rider.id).toLowerCase().includes(riderSearchTerm.toLowerCase())
    )
    return filtered
  }, [uniqueRiders, riderSearchTerm])

  // Calculate Riders No Route: Show riders from Rider table NOT in Performance table
  const filteredRidersNoRoute = useMemo(() => {
    if (!ridersData.length) {
      return []
    }
    
    // Only show data when both hub and date are selected
    if (!selectedHub || !selectedDate) {
      return []
    }
    
    let filtered = ridersData
    
    // Filter by hub
    filtered = filtered.filter(rider => rider.operator_hub === selectedHub)
    
    // Filter performance records by date
    let performanceToCheck = performanceRecords.filter(p => {
      const recordDate = p.date?.split('T')[0] || p.date
      return recordDate === selectedDate
    })
    
    // Create Set of rider IDs that exist in performance records
    const ridersInPerformance = new Set()
    performanceToCheck.forEach(p => {
      if (p.rider_id) ridersInPerformance.add(String(p.rider_id))
      if (p.driver_name) ridersInPerformance.add(p.driver_name)
      if (p.operator_id) ridersInPerformance.add(String(p.operator_id))
    })
    
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
        return hasNoRoute
      })
      .map(rider => ({
        riderId: rider.rider_id,
        riderName: rider.rider_name,
        status: rider.status || 'N/A',
        deployedDate: rider.deployment_date || 'N/A',
        lastActiveDate: rider.last_active || 'N/A',
        hub: rider.operator_hub || 'Unknown'
      }))
    
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
    
    let filtered = dashboardMetrics
    
    // In Overall view with selectedRegion: filter hubs in that region
    if (dashboardView === 'overall' && selectedRegion) {
      filtered = filtered.filter(item => hubToRegionMap[item.hub] === selectedRegion)
    }
    // In Hub view with selectedHub: filter by specific hub
    else if (dashboardView === 'hub' && selectedHub && selectedHub !== 'All Hubs') {
      filtered = filtered.filter(item => item.hub === selectedHub)
    }
    
    // Filter by date if selected
    if (selectedDate) {
      filtered = filtered.filter(item => {
        const itemDate = item.date?.split('T')[0] || item.date?.split(' ')[0] || item.date
        return itemDate === selectedDate
      })
    }
    
    // For hub view: if no filters selected, show 0
    if (dashboardView === 'hub' && !selectedHub && !selectedDate) {
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
        // Error refreshing dashboard metrics
      } else {
          // Refetch data to get updated metrics
        window.location.reload()
      }
    } catch (error) {
      // Error occurred
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

  // Normalize chart data for smooth animations - always uses "value" as dataKey
  const normalizedChartData = useMemo(() => {
    return filteredChartData.map(item => ({
      month: item.month,
      value: item[selectedCategory] || 0
    }))
  }, [filteredChartData, selectedCategory])

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

  // Close rider dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (showRiderDropdown && !event.target.closest('.rider-search-container')) {
        setShowRiderDropdown(false)
      }
    }
    
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [showRiderDropdown])

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
      // If no region or date is selected, return empty data
      if (!selectedRegion && !selectedDate) {
        return []
      }
      
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
        
        // Calculate sum helper for totals
        const calcSum = (records, field) => {
          return records.reduce((acc, item) => acc + (item[field] || 0), 0)
        }
        
        // Count unique riders
        const countRiders = (records) => {
          const uniqueRiders = new Set(records.map(r => r.rider_id || r.operator_id).filter(Boolean))
          return uniqueRiders.size
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
          prodL7D: calcAvg(l7dRecords, 'productivity', true),
          // Loss (on_hold total)
          lossP7D: calcSum(p7dRecords, 'on_hold'),
          lossL7D: calcSum(l7dRecords, 'on_hold'),
          // Rider Count
          ridersP7D: countRiders(p7dRecords),
          ridersL7D: countRiders(l7dRecords)
        }
      }).filter(hub => hub.cfrL7D > 0 || hub.srL7D > 0 || hub.kpiL7D > 0 || hub.prodL7D > 0 || hub.lossL7D > 0 || hub.ridersL7D > 0) // Only show hubs with data
    }
  }, [dashboardMetrics, selectedRegion, hubToRegionMap])

  // Calculate Rider Level data: Individual riders with their metrics
  const riderLevelData = useMemo(() => {
    // If no rider is selected, return empty array
    if (!selectedRider) {
      return []
    }

    // Filter performance records by date
    let filtered = performanceRecords

    if (selectedDate) {
      filtered = filtered.filter(p => {
        const recordDate = p.date?.split('T')[0] || p.date
        return recordDate === selectedDate
      })
    }

    // Create a map of performance data by rider_id
    const performanceMap = new Map()
    filtered.forEach(record => {
      const riderId = record.rider_id
      if (!riderId) return

      if (!performanceMap.has(riderId)) {
        performanceMap.set(riderId, {
          delivered: 0,
          onHold: 0,
          assigned: 0,
          recordCount: 0
        })
      }

      const metrics = performanceMap.get(riderId)
      metrics.delivered += parseInt(record.delivered) || 0
      metrics.onHold += parseInt(record.onhold) || 0
      metrics.assigned += parseInt(record.assigned) || 0
      metrics.recordCount++
    })

    // Create delivery trend data (daily delivered counts for last 7 days with data)
    const trendData = new Map()
    performanceRecords.forEach(record => {
      const riderId = record.rider_id
      if (!riderId) return

      if (!trendData.has(riderId)) {
        trendData.set(riderId, {})
      }
      const riderTrend = trendData.get(riderId)
      const date = record.date?.split('T')[0] || record.date
      riderTrend[date] = (riderTrend[date] || 0) + (parseInt(record.delivered) || 0)
    })

    // Build rider list from ridersData (Rider page), enriched with performance metrics
    let riders = ridersData.map(rider => {
      const riderId = rider.rider_id
      const metrics = performanceMap.get(riderId) || {
        delivered: 0,
        onHold: 0,
        assigned: 0,
        recordCount: 0
      }

      // Get trend data (last 7 dates with data, sorted)
      const trend = trendData.get(riderId) || {}
      const trendEntries = Object.entries(trend)
        .sort((a, b) => a[0].localeCompare(b[0]))
        .slice(-7)
        .map(([date, delivered]) => ({ date, delivered }))

      // Calculate success rate (percentage) and productivity (average assigned per day)
      const successRate = metrics.assigned > 0 ? (metrics.delivered / metrics.assigned) * 100 : 0
      const productivity = metrics.recordCount > 0 ? Math.round(metrics.assigned / metrics.recordCount) : 0

      return {
        riderId: riderId,
        riderName: rider.rider_name,
        hub: rider.operator_hub || 'Unknown',
        delivered: metrics.delivered,
        onHold: metrics.onHold,
        assigned: metrics.assigned,
        successRate,
        productivity,
        trend: trendEntries
      }
    })

    // Filter by selected rider
    riders = riders.filter(r => String(r.riderId) === String(selectedRider))

    // Sort by delivered descending
    return riders.sort((a, b) => b.delivered - a.delivered)
  }, [ridersData, performanceRecords, selectedRider, selectedDate])

  // Calculate Rider Level chart data for Delivery Trend
  const riderLevelChartData = useMemo(() => {
    // If no rider is selected, return empty array (no data shown)
    if (!selectedRider) {
      return []
    }
    
    // Aggregate counts by date across all riders (or filtered riders)
    const dateMap = new Map()
    
    let filtered = performanceRecords
    
    // Filter by selected rider
    filtered = filtered.filter(p => p.rider_id === selectedRider)
    
    // Get unique dates from filtered records and sort them
    const uniqueDates = [...new Set(filtered.map(r => r.date?.split('T')[0] || r.date).filter(Boolean))].sort()
    
    // Limit date range based on view (last N dates with data)
    let dateLimit = riderTrendView === 'L7D' ? 7 : 30
    const recentDates = uniqueDates.slice(-dateLimit)
    const dateSet = new Set(recentDates)
    
    filtered.forEach(record => {
      const date = record.date?.split('T')[0] || record.date
      if (!date) return
      
      // Skip if not in recent dates set
      if (!dateSet.has(date)) return
      
      // Aggregate based on selected metric
      let value = 0
      const delivered = parseInt(record.delivered) || 0
      const onHold = parseInt(record.onhold) || 0
      const assigned = parseInt(record.assigned) || 0
      
      switch (riderTrendMetric) {
        case 'delivered':
          value = delivered
          break
        case 'onHold':
          value = onHold
          break
        case 'successRate':
          value = assigned > 0 ? (delivered / assigned) * 100 : 0
          break
        case 'productivity':
          value = assigned
          break
        default:
          value = delivered
      }
      
      const current = dateMap.get(date) || 0
      dateMap.set(date, current + value)
    })
    
    // Convert to array and sort by date
    const result = Array.from(dateMap.entries())
      .map(([date, value]) => ({ 
        date, 
        value: value 
      }))
      .sort((a, b) => a.date.localeCompare(b.date))
    
    return result
  }, [performanceRecords, selectedRider, riderTrendView, riderTrendMetric])

  // Handle export of filtered chart data to PDF
  const handleExport = useCallback(() => {
    try {
      // Create PDF
      const pdf = new jsPDF('p', 'mm', 'a4')
      const pdfWidth = pdf.internal.pageSize.getWidth()
      const pageHeight = pdf.internal.pageSize.getHeight()
      const margin = 15
      let currentY = margin

      // === HEADER SECTION ===
      pdf.setFillColor(168, 48, 48)
      pdf.rect(0, 0, pdfWidth, 35, 'F')
      
      pdf.setTextColor(255, 255, 255)
      pdf.setFontSize(20)
      pdf.setFont(undefined, 'bold')
      pdf.text('DASHBOARD REPORT', margin, 22)
      
      pdf.setFontSize(10)
      pdf.setFont(undefined, 'normal')
      pdf.text(`Generated on: ${new Date().toLocaleString()}`, margin, 30)

      currentY = 45

      // Report Title & Filters
      pdf.setTextColor(51, 65, 85)
      pdf.setFontSize(14)
      pdf.setFont(undefined, 'bold')
      
      let reportTitle = ''
      let filterInfo = []
      
      // Calculate date range for display
      let dateRangeStr = 'All Dates'
      
      // For Hub Level: calculate L7D range (selected date - 7 days)
      if (dashboardView === 'hub') {
        if (selectedDate) {
          const endDate = new Date(selectedDate)
          const startDate = new Date(selectedDate)
          startDate.setDate(endDate.getDate() - 7)
          const formatDate = (d) => d.toISOString().split('T')[0]
          dateRangeStr = `${formatDate(startDate)} to ${formatDate(endDate)}`
        }
      } else if (dashboardView === 'rider' && selectedRider && riderLevelData.length > 0) {
        const rider = riderLevelData[0]
        if (rider.trend && rider.trend.length > 0) {
          const dates = rider.trend.map(t => t.date).filter(d => d).sort()
          dateRangeStr = `${dates[0]} to ${dates[dates.length - 1]}`
        } else if (selectedDate) {
          dateRangeStr = selectedDate
        }
      } else if (selectedDate) {
        dateRangeStr = selectedDate
      }
      
      if (dashboardView === 'hub') {
        reportTitle = 'Hub Level Dashboard'
        filterInfo = [`Hub: ${selectedHub || 'All Hubs'}`, `Date Range: ${dateRangeStr}`]
      } else if (dashboardView === 'rider') {
        reportTitle = 'Rider Level Dashboard'
        filterInfo = [
          selectedRider ? `Rider: ${riderLevelData[0]?.riderName || selectedRider}` : 'Rider: All Riders',
          `Date Range: ${dateRangeStr}`
        ]
      } else if (dashboardView === 'overall') {
        reportTitle = 'Overall Dashboard'
        filterInfo = [`Region: ${selectedRegion || 'All Regions'}`, `Date Range: ${dateRangeStr}`]
      }
      
      pdf.text(reportTitle, margin, currentY)
      currentY += 8

      // Filters box
      pdf.setFillColor(241, 245, 249)
      pdf.rect(margin, currentY - 3, pdfWidth - (margin * 2), 12, 'F')
      pdf.setFontSize(9)
      pdf.setTextColor(100, 116, 139)
      pdf.text(`Filters: ${filterInfo.join(' | ')}`, margin + 3, currentY + 4)
      currentY += 18

      // === SUMMARY STATS SECTION ===
      const comparisonData = dashboardView === 'overall' ? getComparisonData() : []
      
      pdf.setTextColor(51, 65, 85)
      pdf.setFontSize(12)
      pdf.setFont(undefined, 'bold')
      pdf.text('Summary Statistics', margin, currentY)
      currentY += 8

      // Get summary data based on view
      let summaryStats = []
      if (dashboardView === 'hub' && filteredStats) {
        summaryStats = [
          { label: 'Success Rate', value: `${filteredStats.successRate || 0}%` },
          { label: 'Active Riders', value: String(filteredStats.activeRiders || 0) },
          { label: 'Delivered', value: String(filteredStats.delivered || 0) },
          { label: 'On-Hold', value: String(filteredStats.onHold || 0) }
        ]
      } else if (dashboardView === 'rider' && selectedRider && riderLevelData.length > 0) {
        const rider = riderLevelData[0]
        summaryStats = [
          { label: 'Delivered', value: String(rider.delivered || 0) },
          { label: 'On-Hold', value: String(rider.onHold || 0) },
          { label: 'Success Rate', value: `${rider.successRate?.toFixed(1) || 0}%` },
          { label: 'Productivity', value: String(rider.productivity || 0) }
        ]
      } else if (dashboardView === 'overall') {
        const totalHubs = comparisonData.length
        summaryStats = [
          { label: 'Total Hubs', value: String(totalHubs) },
          { label: 'Region', value: selectedRegion || 'All' }
        ]
      }

      // Draw summary boxes
      const boxWidth = 42
      const boxHeight = 20
      const boxSpacing = 3
      let boxX = margin

      summaryStats.forEach((stat, index) => {
        if (boxX + boxWidth > pdfWidth - margin) {
          boxX = margin
          currentY += boxHeight + boxSpacing + 5
        }
        
        // Box background
        pdf.setFillColor(254, 242, 242)
        pdf.rect(boxX, currentY, boxWidth, boxHeight, 'F')
        pdf.setDrawColor(168, 48, 48)
        pdf.rect(boxX, currentY, boxWidth, boxHeight, 'S')
        
        // Label
        pdf.setFontSize(8)
        pdf.setTextColor(100, 116, 139)
        pdf.setFont(undefined, 'normal')
        pdf.text(String(stat.label), boxX + 3, currentY + 7)
        
        // Value
        pdf.setFontSize(11)
        pdf.setTextColor(168, 48, 48)
        pdf.setFont(undefined, 'bold')
        pdf.text(String(stat.value), boxX + 3, currentY + 15)
        
        boxX += boxWidth + boxSpacing
      })

      currentY += boxHeight + 15

      // === DATA TABLE SECTION ===
      const dataToExport = dashboardView === 'hub' 
        ? filteredChartData 
        : dashboardView === 'rider' 
          ? (selectedRider ? riderLevelData : filteredRidersNoRoute)
          : comparisonData

      if (dataToExport.length > 0) {
        pdf.setTextColor(51, 65, 85)
        pdf.setFontSize(12)
        pdf.setFont(undefined, 'bold')
        pdf.text('Detailed Data', margin, currentY)
        currentY += 10

        // Table header background
        pdf.setFillColor(168, 48, 48)
        pdf.rect(margin, currentY - 6, pdfWidth - (margin * 2), 10, 'F')
        pdf.setTextColor(255, 255, 255)
        pdf.setFontSize(9)
        pdf.setFont(undefined, 'bold')

        const colWidth = (pdfWidth - (margin * 2)) / 8
        let startY = currentY

        if (dashboardView === 'hub') {
          pdf.text('Date', margin + 3, startY)
          pdf.text('Success Rate', margin + colWidth + 3, startY)
          pdf.text('Riders', margin + (colWidth * 2) + 3, startY)
          pdf.text('Delivered', margin + (colWidth * 3) + 3, startY)
          pdf.text('On-Hold', margin + (colWidth * 4) + 3, startY)
          pdf.text('Productivity', margin + (colWidth * 5) + 3, startY)
          pdf.text('CFR', margin + (colWidth * 6) + 3, startY)
          pdf.text('Scorecard', margin + (colWidth * 7) + 3, startY)
          startY += 8

          pdf.setTextColor(51, 65, 85)
          pdf.setFont(undefined, 'normal')
          pdf.setFontSize(7)

          filteredChartData.forEach((item, index) => {
            if (startY > 280) {
              pdf.addPage()
              startY = 15
            }
            if (index % 2 === 0) {
              pdf.setFillColor(248, 250, 252)
              pdf.rect(margin, startY - 4, pdfWidth - (margin * 2), 6, 'F')
            }
            const dateStr = item.month ? String(item.month) : 'N/A'
            const successRate = item['Success Rate'] != null ? `${item['Success Rate']}%` : '0%'
            const riders = item['Riders'] != null ? String(item['Riders']) : '0'
            const delivered = item['Delivered'] != null ? String(item['Delivered']) : '0'
            const onHold = item['On-Hold'] != null ? String(item['On-Hold']) : '0'
            const productivity = item['Productivity'] != null ? String(item['Productivity']) : '0'
            const cfr = item['Clear Floor Rate'] != null ? `${item['Clear Floor Rate']}%` : '0%'
            const scorecard = item['Scorecard'] != null ? String(item['Scorecard']) : 'N/A'
            pdf.text(dateStr, margin + 3, startY)
            pdf.text(successRate, margin + colWidth + 3, startY)
            pdf.text(riders, margin + (colWidth * 2) + 3, startY)
            pdf.text(delivered, margin + (colWidth * 3) + 3, startY)
            pdf.text(onHold, margin + (colWidth * 4) + 3, startY)
            pdf.text(productivity, margin + (colWidth * 5) + 3, startY)
            pdf.text(cfr, margin + (colWidth * 6) + 3, startY)
            pdf.text(scorecard, margin + (colWidth * 7) + 3, startY)
            startY += 6
          })

          // === KPI DISTRIBUTION SECTION ===
          startY += 15
          if (startY > 250) {
            pdf.addPage()
            startY = 15
          }
          pdf.setTextColor(51, 65, 85)
          pdf.setFontSize(12)
          pdf.setFont(undefined, 'bold')
          pdf.text('KPI Distribution', margin, startY)
          startY += 10

          if (kpiGradeData && kpiGradeData.length > 0) {
            pdf.setFillColor(168, 48, 48)
            pdf.rect(margin, startY - 6, pdfWidth - (margin * 2), 10, 'F')
            pdf.setTextColor(255, 255, 255)
            pdf.setFontSize(9)
            pdf.setFont(undefined, 'bold')
            pdf.text('Metric', margin + 3, startY)
            pdf.text('Value', margin + colWidth + 3, startY)
            startY += 8

            pdf.setTextColor(51, 65, 85)
            pdf.setFont(undefined, 'normal')
            pdf.setFontSize(8)

            kpiGradeData.forEach((kpi, index) => {
              if (startY > 280) {
                pdf.addPage()
                startY = 15
              }
              if (index % 2 === 0) {
                pdf.setFillColor(248, 250, 252)
                pdf.rect(margin, startY - 4, pdfWidth - (margin * 2), 6, 'F')
              }
              pdf.text(String(kpi.name), margin + 3, startY)
              pdf.text(`${kpi.value}%`, margin + colWidth + 3, startY)
              startY += 6
            })
          } else {
            pdf.setTextColor(100, 116, 139)
            pdf.setFontSize(9)
            pdf.setFont(undefined, 'normal')
            pdf.text('No KPI data available', margin + 3, startY)
            startY += 6
          }

          // === RIDERS NO ROUTE SECTION ===
          startY += 15
          if (startY > 250) {
            pdf.addPage()
            startY = 15
          }
          pdf.setTextColor(51, 65, 85)
          pdf.setFontSize(12)
          pdf.setFont(undefined, 'bold')
          pdf.text('Riders No Route', margin, startY)
          startY += 10

          if (filteredRidersNoRoute && filteredRidersNoRoute.length > 0) {
            const ridersColWidth = (pdfWidth - (margin * 2)) / 3
            pdf.setFillColor(168, 48, 48)
            pdf.rect(margin, startY - 6, pdfWidth - (margin * 2), 10, 'F')
            pdf.setTextColor(255, 255, 255)
            pdf.setFontSize(9)
            pdf.setFont(undefined, 'bold')
            pdf.text('Rider ID', margin + 3, startY)
            pdf.text('Rider Name', margin + ridersColWidth + 3, startY)
            pdf.text('Status', margin + (ridersColWidth * 2) + 3, startY)
            startY += 8

            pdf.setTextColor(51, 65, 85)
            pdf.setFont(undefined, 'normal')
            pdf.setFontSize(8)

            filteredRidersNoRoute.forEach((rider, index) => {
              if (startY > 280) {
                pdf.addPage()
                startY = 15
              }
              if (index % 2 === 0) {
                pdf.setFillColor(248, 250, 252)
                pdf.rect(margin, startY - 4, pdfWidth - (margin * 2), 6, 'F')
              }
              pdf.text(String(rider.riderId || ''), margin + 3, startY)
              pdf.text(String(rider.riderName || 'N/A'), margin + ridersColWidth + 3, startY)
              pdf.text(String(rider.status || 'N/A'), margin + (ridersColWidth * 2) + 3, startY)
              startY += 6
            })

          } else {
            pdf.setTextColor(100, 116, 139)
            pdf.setFontSize(9)
            pdf.setFont(undefined, 'normal')
            pdf.text('No riders without route', margin + 3, startY)
            startY += 6
          }

          // === RETENTION & ATTRITION SECTION ===
          startY += 15
          if (startY > 250) {
            pdf.addPage()
            startY = 15
          }
          pdf.setTextColor(51, 65, 85)
          pdf.setFontSize(12)
          pdf.setFont(undefined, 'bold')
          pdf.text('Retention & Attrition Rate', margin, startY)
          startY += 10

          if (retentionMetrics && retentionMetrics.totalRiders > 0) {
            const retentionColWidth = (pdfWidth - (margin * 2)) / 4
            pdf.setFillColor(168, 48, 48)
            pdf.rect(margin, startY - 6, pdfWidth - (margin * 2), 10, 'F')
            pdf.setTextColor(255, 255, 255)
            pdf.setFontSize(9)
            pdf.setFont(undefined, 'bold')
            pdf.text('Hub', margin + 3, startY)
            pdf.text('Total', margin + retentionColWidth + 3, startY)
            pdf.text('Active', margin + (retentionColWidth * 2) + 3, startY)
            pdf.text('Attrition', margin + (retentionColWidth * 3) + 3, startY)
            startY += 8

            pdf.setTextColor(51, 65, 85)
            pdf.setFont(undefined, 'normal')
            pdf.setFontSize(8)

            // Display single retention metrics row
            pdf.setFillColor(248, 250, 252)
            pdf.rect(margin, startY - 4, pdfWidth - (margin * 2), 6, 'F')
            pdf.text(String(selectedHub || 'N/A'), margin + 3, startY)
            pdf.text(String(retentionMetrics.totalRiders || 0), margin + retentionColWidth + 3, startY)
            pdf.text(String(retentionMetrics.activeRiders || 0), margin + (retentionColWidth * 2) + 3, startY)
            pdf.text(String(retentionMetrics.inactiveRiders || 0), margin + (retentionColWidth * 3) + 3, startY)

            // Show attrition riders if any
            if (retentionMetrics.attritionRiders && retentionMetrics.attritionRiders.length > 0) {
              startY += 15
              if (startY > 250) {
                pdf.addPage()
                startY = 15
              }
              pdf.setFontSize(10)
              pdf.setFont(undefined, 'bold')
              pdf.text('Inactive Riders Breakdown', margin, startY)
              startY += 8

              pdf.setFillColor(168, 48, 48)
              pdf.rect(margin, startY - 6, pdfWidth - (margin * 2), 10, 'F')
              pdf.setTextColor(255, 255, 255)
              pdf.setFontSize(9)
              pdf.setFont(undefined, 'bold')
              pdf.text('ID', margin + 3, startY)
              pdf.text('Name', margin + colWidth + 3, startY)
              pdf.text('Last Active', margin + (colWidth * 2) + 3, startY)
              pdf.text('Status', margin + (colWidth * 3) + 3, startY)
              startY += 8

              pdf.setTextColor(51, 65, 85)
              pdf.setFont(undefined, 'normal')
              pdf.setFontSize(8)

              retentionMetrics.attritionRiders.slice(0, 15).forEach((rider, index) => {
                if (startY > 280) {
                  pdf.addPage()
                  startY = 15
                }
                if (index % 2 === 0) {
                  pdf.setFillColor(248, 250, 252)
                  pdf.rect(margin, startY - 4, pdfWidth - (margin * 2), 6, 'F')
                }
                pdf.text(String(rider.id), margin + 3, startY)
                pdf.text(String(rider.name || 'N/A'), margin + colWidth + 3, startY)
                pdf.text(String(rider.lastActive), margin + (colWidth * 2) + 3, startY)
                pdf.text(String(rider.status), margin + (colWidth * 3) + 3, startY)
                startY += 6
              })

              if (retentionMetrics.attritionRiders.length > 15) {
                pdf.setTextColor(100, 116, 139)
                pdf.text(`... and ${retentionMetrics.attritionRiders.length - 15} more`, margin + 3, startY)
              }
            }
          }
        } else if (dashboardView === 'rider') {
          if (selectedRider && riderLevelData.length > 0) {
            const rider = riderLevelData[0]
            const metrics = [
              { label: 'Rider ID', value: rider.riderId },
              { label: 'Rider Name', value: rider.riderName },
              { label: 'Hub', value: rider.hub },
              { label: 'Delivered', value: rider.delivered },
              { label: 'On-Hold', value: rider.onHold },
              { label: 'Success Rate', value: `${rider.successRate?.toFixed(1) || 0}%` },
              { label: 'Productivity', value: rider.productivity }
            ]

            pdf.setTextColor(51, 65, 85)
            pdf.setFont(undefined, 'normal')
            pdf.setFontSize(8)

            metrics.forEach((metric, index) => {
              if (startY > 280) {
                pdf.addPage()
                startY = 15
              }
              if (index % 2 === 0) {
                pdf.setFillColor(248, 250, 252)
                pdf.rect(margin, startY - 4, pdfWidth - (margin * 2), 6, 'F')
              }
              pdf.setFont(undefined, 'bold')
              pdf.text(String(metric.label), margin + 3, startY)
              pdf.setFont(undefined, 'normal')
              pdf.text(String(metric.value), margin + colWidth + 3, startY)
              startY += 6
            })

            // Daily trend data
            if (rider.trend && rider.trend.length > 0) {
              startY += 10
              pdf.setFillColor(168, 48, 48)
              pdf.rect(margin, startY - 6, pdfWidth - (margin * 2), 10, 'F')
              pdf.setTextColor(255, 255, 255)
              pdf.setFontSize(9)
              pdf.setFont(undefined, 'bold')
              pdf.text('Date', margin + 3, startY)
              pdf.text('Delivered', margin + colWidth + 3, startY)
              startY += 8

              pdf.setTextColor(51, 65, 85)
              pdf.setFont(undefined, 'normal')
              pdf.setFontSize(8)

              rider.trend.forEach((t, index) => {
                if (startY > 280) {
                  pdf.addPage()
                  startY = 15
                }
                if (index % 2 === 0) {
                  pdf.setFillColor(248, 250, 252)
                  pdf.rect(margin, startY - 4, pdfWidth - (margin * 2), 6, 'F')
                }
                pdf.text(String(t.date), margin + 3, startY)
                pdf.text(String(t.delivered), margin + colWidth + 3, startY)
                startY += 6
              })
            }
          } else {
            pdf.text('Rider ID', margin + 3, startY)
            pdf.text('Rider Name', margin + colWidth + 3, startY)
            pdf.text('Hub', margin + (colWidth * 2) + 3, startY)
            pdf.text('Status', margin + (colWidth * 3) + 3, startY)
            startY += 8

            pdf.setTextColor(51, 65, 85)
            pdf.setFont(undefined, 'normal')
            pdf.setFontSize(8)

            filteredRidersNoRoute.forEach((rider, index) => {
              if (startY > 280) {
                pdf.addPage()
                startY = 15
              }
              if (index % 2 === 0) {
                pdf.setFillColor(248, 250, 252)
                pdf.rect(margin, startY - 4, pdfWidth - (margin * 2), 6, 'F')
              }
              pdf.text(String(rider.riderId || ''), margin + 3, startY)
              pdf.text(String(rider.riderName || 'N/A'), margin + colWidth + 3, startY)
              pdf.text(String(rider.hub || 'N/A'), margin + (colWidth * 2) + 3, startY)
              pdf.text(String(rider.status || 'N/A'), margin + (colWidth * 3) + 3, startY)
              startY += 6
            })
          }
        } else if (dashboardView === 'overall') {
          // Headers for comparison data
          pdf.setFont(undefined, 'bold')
          pdf.text('Hub', 10, startY)
          pdf.text('CFR P7D', 45, startY)
          pdf.text('CFR L7D', 70, startY)
          pdf.text('SR P7D', 95, startY)
          pdf.text('SR L7D', 120, startY)
          pdf.text('Prod P7D', 145, startY)
          pdf.text('Prod L7D', 170, startY)
          pdf.setFont(undefined, 'normal')
          startY += 6

          comparisonData.forEach((item, index) => {
            if (startY > 280) {
              pdf.addPage()
              startY = 15
            }
            pdf.text(item.hub, 10, startY)
            pdf.text(`${item.cfrP7D}%`, 45, startY)
            pdf.text(`${item.cfrL7D}%`, 70, startY)
            pdf.text(`${item.srP7D}%`, 95, startY)
            pdf.text(`${item.srL7D}%`, 120, startY)
            pdf.text(`${item.prodP7D}%`, 145, startY)
            pdf.text(`${item.prodL7D}%`, 170, startY)
            startY += 5
          })
        }
      }

      // Download the PDF
      const filename = dashboardView === 'hub' 
        ? `hub-level-dashboard-${selectedHub || 'all'}-${new Date().toISOString().split('T')[0]}.pdf`
        : dashboardView === 'rider'
          ? (selectedRider 
            ? `rider-dashboard-${riderLevelData[0]?.riderName || selectedRider}-${new Date().toISOString().split('T')[0]}.pdf`
            : `riders-list-${selectedHub || 'all'}-${new Date().toISOString().split('T')[0]}.pdf`)
          : `overall-dashboard-${selectedRegion || 'all-regions'}-${new Date().toISOString().split('T')[0]}.pdf`

      // === FOOTER ===
      pdf.setTextColor(150, 150, 150)
      pdf.setFontSize(8)
      pdf.setFont(undefined, 'normal')
      pdf.text('--- End of Report ---', pdfWidth / 2, pageHeight - 10, { align: 'center' })

      pdf.save(filename)
    } catch (error) {
      console.error('Error exporting PDF:', error)
      alert('Failed to export PDF. Please try again.')
    }
  }, [dashboardView, filteredChartData, filteredRidersNoRoute, riderLevelData, getComparisonData, filteredStats, kpiGradeData, retentionMetrics, selectedHub, selectedRegion, selectedRider, selectedDate])

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
        <div className="flex items-center justify-between">
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
          <button
            onClick={handleExport}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-all duration-200 font-medium text-xs hover:shadow-md"
          >
            <Download className="w-3.5 h-3.5" />
            Export
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
              value={hubSearchTerm}
              onChange={(e) => {
                const value = e.target.value
                setHubSearchTerm(value)
                // Clear selected hub when input is cleared
                if (value === '') {
                  setSelectedHub('')
                }
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
                        setHubSearchTerm(hub)
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

      {/* Filters Bar for Rider Level View - Rider Filter Only */}
      {dashboardView === 'rider' && (
      <div className="relative bg-slate-800/80 backdrop-blur-md rounded-lg p-3 border border-slate-600/50 hover:border-slate-500/80 transition-all duration-300 shadow-[0_0_30px_rgba(0,0,0,0.3)] z-50">
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-1.5 text-slate-400">
            <Filter className="w-3.5 h-3.5" />
            <span className="text-xs font-medium tracking-wide uppercase">Filters</span>
          </div>

          <div className="relative rider-search-container">
            <input
              type="text"
              placeholder="Search rider..."
              value={riderSearchTerm}
              onChange={(e) => {
                const value = e.target.value
                setRiderSearchTerm(value)
                // Clear selected rider when input is cleared
                if (value === '') {
                  setSelectedRider('')
                }
                setShowRiderDropdown(true)
              }}
              onFocus={() => setShowRiderDropdown(true)}
              className="bg-slate-700/80 border border-slate-600/50 rounded px-2 py-1 text-xs text-white focus:ring-1 focus:ring-maroon-500/50 outline-none backdrop-blur-sm w-64"
            />
            {showRiderDropdown && (
              <div className="absolute top-full left-0 mt-1 bg-slate-700/95 border border-slate-600/50 rounded shadow-lg z-[99999] max-h-40 overflow-y-auto w-64">
                {filteredRiders.length > 0 ? (
                  filteredRiders.map(rider => (
                    <div
                      key={rider.id}
                      onClick={() => {
                        setSelectedRider(rider.id)
                        setRiderSearchTerm(rider.name)
                        setShowRiderDropdown(false)
                      }}
                      className="px-2 py-1 text-xs text-white hover:bg-slate-600/50 cursor-pointer"
                    >
                      {rider.name} ({rider.id})
                    </div>
                  ))
                ) : (
                  <div className="px-2 py-1 text-xs text-slate-400">No riders found</div>
                )}
              </div>
            )}
          </div>
          
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
            <AreaChart data={normalizedChartData} layout="horizontal">
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
                dataKey="value" 
                stroke="#a83030" 
                strokeWidth={2}
                fillOpacity={1} 
                fill="url(#colorDeliveries)"
                animationDuration={800}
                animationEasing="ease-in-out"
                isAnimationActive={true}
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
            title="Avg Success Rate" 
            value={`${riderLevelData.length > 0 
              ? (riderLevelData.reduce((sum, r) => sum + (r.successRate || 0), 0) / riderLevelData.length).toFixed(1)
              : 0}%`} 
            icon={TrendingUp}
          />
          <CompactStatCard 
            title="Delivered" 
            value={riderLevelData.reduce((sum, r) => sum + r.delivered, 0)} 
            icon={Package}
          />
          <CompactStatCard 
            title="On-Hold" 
            value={riderLevelData.reduce((sum, r) => sum + r.onHold, 0)} 
            icon={Package}
          />
          <CompactStatCard 
            title="Avg Productivity" 
            value={riderLevelData.length > 0 
              ? (riderLevelData.reduce((sum, r) => sum + (r.productivity || 0), 0) / riderLevelData.length).toFixed(1) + '%'
              : '0.0%'} 
            icon={TrendingUp}
          />
        </div>

        {/* Delivery Trend Chart - Only show Riders Information when a rider is selected */}
        <div className="bg-slate-800/80 backdrop-blur-sm rounded-lg p-4 border border-slate-600/50 hover:border-slate-500/50 transition-all duration-300 shadow-[0_0_20px_rgba(0,0,0,0.2)]">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-white flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-maroon-500" />
              Delivery Trend
            </h3>
            <div className="flex items-center gap-2">
              {/* Metric Filter */}
              <div className="flex gap-1">
                <button
                  onClick={() => setRiderTrendMetric('successRate')}
                  className={`px-2 py-1 text-[10px] font-medium rounded transition-colors ${
                    riderTrendMetric === 'successRate'
                      ? 'bg-blue-600 text-white'
                      : 'bg-slate-700 text-slate-400 hover:bg-slate-600'
                  }`}
                >
                  Success Rate
                </button>
                <button
                  onClick={() => setRiderTrendMetric('delivered')}
                  className={`px-2 py-1 text-[10px] font-medium rounded transition-colors ${
                    riderTrendMetric === 'delivered'
                      ? 'bg-emerald-600 text-white'
                      : 'bg-slate-700 text-slate-400 hover:bg-slate-600'
                  }`}
                >
                  Delivered
                </button>
                <button
                  onClick={() => setRiderTrendMetric('onHold')}
                  className={`px-2 py-1 text-[10px] font-medium rounded transition-colors ${
                    riderTrendMetric === 'onHold'
                      ? 'bg-amber-600 text-white'
                      : 'bg-slate-700 text-slate-400 hover:bg-slate-600'
                  }`}
                >
                  On-Hold
                </button>
                <button
                  onClick={() => setRiderTrendMetric('productivity')}
                  className={`px-2 py-1 text-[10px] font-medium rounded transition-colors ${
                    riderTrendMetric === 'productivity'
                      ? 'bg-purple-600 text-white'
                      : 'bg-slate-700 text-slate-400 hover:bg-slate-600'
                  }`}
                >
                  Productivity
                </button>
              </div>
              <div className="w-px h-4 bg-slate-600 mx-1"></div>
              {/* Time Range Filter */}
              <div className="flex gap-1">
                <button
                  onClick={() => setRiderTrendView('MTD')}
                  className={`px-3 py-1 text-[10px] font-medium rounded transition-colors ${
                    riderTrendView === 'MTD'
                      ? 'bg-maroon-500 text-white'
                      : 'bg-slate-700 text-slate-400 hover:bg-slate-600'
                  }`}
                >
                  MTD
                </button>
                <button
                  onClick={() => setRiderTrendView('L7D')}
                  className={`px-3 py-1 text-[10px] font-medium rounded transition-colors ${
                    riderTrendView === 'L7D'
                      ? 'bg-maroon-500 text-white'
                      : 'bg-slate-700 text-slate-400 hover:bg-slate-600'
                  }`}
                >
                  L7D
                </button>
              </div>
            </div>
          </div>
          
          {/* Riders Information - Only shown when a rider is selected */}
          {selectedRider && riderLevelData.length > 0 && (
            <div className="mb-4 p-3 bg-slate-700/50 rounded-lg border border-slate-600">
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-xs font-semibold text-white flex items-center gap-2">
                  <Users className="w-3 h-3 text-maroon-500" />
                  Riders Information
                </h4>
                <span className="text-[10px] text-slate-400">{riderLevelData.length} rider(s)</span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-slate-600">
                      <th className="text-left py-1 px-2 text-[10px] font-medium text-slate-400 uppercase">Rider ID</th>
                      <th className="text-left py-1 px-2 text-[10px] font-medium text-slate-400 uppercase">Name</th>
                      <th className="text-left py-1 px-2 text-[10px] font-medium text-slate-400 uppercase">Hub</th>
                    </tr>
                  </thead>
                  <tbody className="text-xs">
                    {riderLevelData.slice(0, 10).map((rider, index) => (
                      <tr key={rider.riderId} className={`border-b border-slate-700/30 ${index % 2 === 0 ? 'bg-slate-800/20' : ''}`}>
                        <td className="py-1 px-2 text-slate-300">{rider.riderId}</td>
                        <td className="py-1 px-2 text-white font-medium">{rider.riderName}</td>
                        <td className="py-1 px-2 text-slate-400">{rider.hub}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
          
          <div className="h-48">
            {riderLevelChartData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={riderLevelChartData}>
                  <defs>
                    <linearGradient id="riderDeliveredGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={riderTrendMetric === 'successRate' ? '#3b82f6' : riderTrendMetric === 'onHold' ? '#f59e0b' : riderTrendMetric === 'productivity' ? '#a855f7' : '#10b981'} stopOpacity={0.3}/>
                      <stop offset="95%" stopColor={riderTrendMetric === 'successRate' ? '#3b82f6' : riderTrendMetric === 'onHold' ? '#f59e0b' : riderTrendMetric === 'productivity' ? '#a855f7' : '#10b981'} stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                  <XAxis 
                    dataKey="date" 
                    stroke="#64748b"
                    fontSize={10}
                    tickFormatter={(value) => new Date(value).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                  />
                  <YAxis stroke="#64748b" fontSize={10} />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: '#1e293b', 
                      border: '1px solid #475569',
                      borderRadius: '6px',
                      fontSize: '12px'
                    }}
                    labelFormatter={(value) => new Date(value).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
                    formatter={(value) => {
                      if (riderTrendMetric === 'successRate') {
                        return [`${value.toFixed(1)}%`, 'Success Rate']
                      }
                      return [value, riderTrendMetric]
                    }}
                  />
                  <Area 
                    type="monotone" 
                    dataKey="value"
                    stroke={riderTrendMetric === 'successRate' ? '#3b82f6' : riderTrendMetric === 'onHold' ? '#f59e0b' : riderTrendMetric === 'productivity' ? '#a855f7' : '#10b981'}
                    strokeWidth={2}
                    fillOpacity={1} 
                    fill="url(#riderDeliveredGradient)" 
                  />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-full text-slate-400 text-sm">
                No chart data available
              </div>
            )}
          </div>
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
              <h3 className="text-sm font-semibold text-white">AVG KPI</h3>
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
                  cursor={false}
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
              <h3 className="text-sm font-semibold text-white">CLEAR FLOOR RATE</h3>
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
                  cursor={false}
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
              <h3 className="text-sm font-semibold text-white">SUCCESS RATE</h3>
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
                  cursor={false}
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
              <h3 className="text-sm font-semibold text-white">PRODUCTIVITY</h3>
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
                  cursor={false}
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

        {/* Loss Chart */}
        <div className="bg-slate-800 rounded-lg p-4 border border-slate-700">
          <div className="flex items-center justify-between mb-4">
            <h4 className="text-sm font-medium text-slate-300">Loss </h4>
            <div className="flex gap-3 text-xs">
              <span className="flex items-center gap-1 text-blue-400">
                <span className="w-2 h-2 rounded-full bg-blue-500"></span>
                P7D
              </span>
              <span className="flex items-center gap-1 text-red-400">
                <span className="w-2 h-2 rounded-full bg-red-500"></span>
                L7D
              </span>
            </div>
          </div>
          <div className="h-[250px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={getComparisonData()} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                <XAxis 
                  dataKey="hub" 
                  stroke="#64748b" 
                  fontSize={10}
                  tickLine={false}
                />
                <YAxis 
                  stroke="#64748b" 
                  fontSize={10}
                  tickLine={false}
                />
                <Tooltip 
                  cursor={false}
                  contentStyle={{ 
                    backgroundColor: '#1e293b', 
                    border: '1px solid #475569',
                    borderRadius: '6px',
                    fontSize: '12px'
                  }}
                />
                <Bar dataKey="lossP7D" fill="#3b82f6" name="P7D" radius={[4, 4, 0, 0]}>
                  <LabelList dataKey="lossP7D" position="top" fill="#fff" fontSize={10} />
                </Bar>
                <Bar dataKey="lossL7D" fill="#ef4444" name="L7D" radius={[4, 4, 0, 0]}>
                  <LabelList dataKey="lossL7D" position="top" fill="#fff" fontSize={10} />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Rider Count Chart */}
        <div className="bg-slate-800 rounded-lg p-4 border border-slate-700">
          <div className="flex items-center justify-between mb-4">
            <h4 className="text-sm font-medium text-slate-300">Rider Count </h4>
            <div className="flex gap-3 text-xs">
              <span className="flex items-center gap-1 text-blue-400">
                <span className="w-2 h-2 rounded-full bg-blue-500"></span>
                P7D
              </span>
              <span className="flex items-center gap-1 text-emerald-400">
                <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                L7D
              </span>
            </div>
          </div>
          <div className="h-[250px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={getComparisonData()} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                <XAxis 
                  dataKey="hub" 
                  stroke="#64748b" 
                  fontSize={10}
                  tickLine={false}
                />
                <YAxis 
                  stroke="#64748b" 
                  fontSize={10}
                  tickLine={false}
                />
                <Tooltip 
                  cursor={false}
                  contentStyle={{ 
                    backgroundColor: '#1e293b', 
                    border: '1px solid #475569',
                    borderRadius: '6px',
                    fontSize: '12px'
                  }}
                />
                <Bar dataKey="ridersP7D" fill="#3b82f6" name="P7D" radius={[4, 4, 0, 0]}>
                  <LabelList dataKey="ridersP7D" position="top" fill="#fff" fontSize={10} />
                </Bar>
                <Bar dataKey="ridersL7D" fill="#10b981" name="L7D" radius={[4, 4, 0, 0]}>
                  <LabelList dataKey="ridersL7D" position="top" fill="#fff" fontSize={10} />
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
