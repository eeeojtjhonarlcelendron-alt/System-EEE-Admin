import { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import { supabase } from '../lib/supabase'
import html2canvas from 'html2canvas'
import jsPDF from 'jspdf'
import { 
  getDashboardMetrics,
  getDashboardStats,
  getRiderHubStats,
  getPerformanceRecordsPaginated,
  getRecentPerformanceRecords,
  getPerformanceRecordsByRiderId,
  getKpiRecords,
  getKpiRecordsPaginated,
  getRiders,
  getClusterLeaders,
  populateDashboardMetrics
} from '../lib/data'
import { getKPIMetricsByHub, getOverallKPIMetrics } from '../lib/kpiMetrics'
import { 
  SkeletonDashboard,
  SkeletonStatsCard,
  SkeletonChart,
  SkeletonSpinner,
  ProgressBarLoader
} from '../components/Skeleton'
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
  AlertCircle,
  AlertTriangle,
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

// Compact Stat Card Component — Clean Single Layer
function CompactStatCard({ title, value, icon: Icon, accentColor = 'bg-red-600' }) {
  return (
    <div className="flex-1 min-w-0 bg-[hsl(220,20%,14%)] border border-[hsl(220,13%,30%)] rounded-[8px] p-2 shadow-[0_2px_8px_rgba(0,0,0,0.05)] hover:shadow-[0_4px_16px_rgba(0,0,0,0.07)] hover:-translate-y-0.5 transition-all duration-180">
      <div className="flex items-center gap-2">
        <div className={`p-1 rounded-md ${accentColor} shrink-0`}>
          <Icon className="w-3 h-3 text-white" />
        </div>
        <div className="min-w-0">
          <p className="text-[hsl(220,8%,55%)] text-[10px] font-medium tracking-wider uppercase truncate">{title}</p>
          <h3 className="text-sm font-bold text-[hsl(220,15%,95%)] leading-tight">{value}</h3>
        </div>
      </div>
    </div>
  )
}
function StatCard({ title, value, subtext, icon: Icon, trend, accentColor = 'bg-red-600' }) {
  return (
    <div className="bg-[hsl(220,20%,14%)] rounded-[14px] p-6 border border-[hsl(220,13%,30%)] shadow-[0_2px_8px_rgba(0,0,0,0.05)] hover:shadow-[0_4px_16px_rgba(0,0,0,0.07)] hover:-translate-y-0.5 transition-all duration-180">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-[hsl(220,10%,70%)] text-[13px] font-medium">{title}</p>
          <h3 className="text-[30px] font-bold text-[hsl(220,15%,95%)] mt-2">{value}</h3>
          {subtext && <p className="text-[hsl(220,8%,55%)] text-[11px] mt-1">{subtext}</p>}
        </div>
        <div className={`p-3 rounded-[10px] ${accentColor}`}>
          <Icon className="w-6 h-6 text-white" />
        </div>
      </div>
      {trend && (
        <div className="flex items-center gap-1 mt-4">
          <TrendingUp className="w-4 h-4 text-[hsl(142,76%,36%)]" />
          <span className="text-[hsl(142,76%,36%)] text-[13px] font-medium">{trend}</span>
          <span className="text-[hsl(220,8%,55%)] text-[13px]">vs last month</span>
        </div>
      )}
    </div>
  )
}

function Dashboard() {
  const [loading, setLoading] = useState(true)
  const [loadingProgress, setLoadingProgress] = useState(0)
  const [loadingStage, setLoadingStage] = useState('')
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
  const [kpiMetricsByHub, setKpiMetricsByHub] = useState([])
  const [overallKpiMetrics, setOverallKpiMetrics] = useState({
    clearFloorRate: 0,
    scorecard: '0.0',
    totalRecords: 0
  })
  const [selectedRider, setSelectedRider] = useState('')
  const [selectedRiderRecords, setSelectedRiderRecords] = useState([])
  const [selectedRiderLoading, setSelectedRiderLoading] = useState(false)
  const [riderSearchTerm, setRiderSearchTerm] = useState('')
  const [showRiderDropdown, setShowRiderDropdown] = useState(false)
  const [selectedCluster, setSelectedCluster] = useState('')
  const [selectedCategory, setSelectedCategory] = useState('Success Rate')
  const [dashboardView, setDashboardView] = useState('hub') // 'hub', 'rider', or 'overall'
  const [selectedDate, setSelectedDate] = useState('') // empty by default
  const [clusterLeaders, setClusterLeaders] = useState([])
  const [riderTrendRange, setRiderTrendRange] = useState('L7D') // 'L7D', 'P7D', 'MTD', or 'ALL' for Rider Level filter
  const [overallTrendView, setOverallTrendView] = useState('L7D') // 'P7D' or 'L7D' for Overall Delivery Trend
  const [riderTrendMetric, setRiderTrendMetric] = useState('delivered') // 'delivered', 'onHold', 'successRate', 'productivity'
  const [riderFromDate, setRiderFromDate] = useState('') // From date for Rider Level filter
  const [riderToDate, setRiderToDate] = useState('') // To date for Rider Level filter
  const [hubFromDate, setHubFromDate] = useState('') // From date for Hub Level filter
  const [hubToDate, setHubToDate] = useState('') // To date for Hub Level filter
  const [hubCompareDateA, setHubCompareDateA] = useState('') // First compare date for Hub Delivery Trend
  const [hubCompareDateB, setHubCompareDateB] = useState('') // Second compare date for Hub Delivery Trend
  const [hubDeliveryTrendTab, setHubDeliveryTrendTab] = useState('chart') // 'chart' or 'graph' for Hub Delivery Trend
  const [hubDeliveryTrendRange, setHubDeliveryTrendRange] = useState('L7D') // 'L7D', 'P7D', 'MTD', or 'ALL'
  const [riderDeliveryTrendTab, setRiderDeliveryTrendTab] = useState('chart') // 'chart' or 'graph' for Rider Delivery Trend
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [message, setMessage] = useState({ type: '', text: '' })
  const dashboardFetchStartedRef = useRef(false)
  const clusterLeadersFetchedRef = useRef(false)

  useEffect(() => {
    let active = true

    async function fetchSelectedRiderRecords() {
      if (!selectedRider) {
        if (active) setSelectedRiderRecords([])
        return
      }

      if (active) setSelectedRiderLoading(true)
      try {
        const result = await getPerformanceRecordsByRiderId(selectedRider)
        if (!active) return
        setSelectedRiderRecords(result.data || [])
      } catch (error) {
        console.error('Failed to load selected rider records:', error)
        if (active) setSelectedRiderRecords([])
      } finally {
        if (active) setSelectedRiderLoading(false)
      }
    }

    fetchSelectedRiderRecords()

    return () => {
      active = false
    }
  }, [selectedRider])

  const padDate = (value) => String(value).padStart(2, '0')

  const formatDateString = (date) => {
    if (!(date instanceof Date) || Number.isNaN(date.getTime())) return ''
    return `${date.getFullYear()}-${padDate(date.getMonth() + 1)}-${padDate(date.getDate())}`
  }

  const parseDateString = (dateStr) => {
    if (!dateStr) return null
    const normalized = String(dateStr).split('T')[0]
    const [year, month, day] = normalized.split('-').map(Number)
    if (!year || !month || !day) return null
    return new Date(year, month - 1, day)
  }

  const getMaxDateString = (values) => {
    return values
      .map(value => String(value || '').split('T')[0])
      .filter(Boolean)
      .sort()
      .pop() || ''
  }

  const getRangeBounds = (rangeType, latestDateString) => {
    const latestDate = parseDateString(latestDateString)
    if (!latestDate || rangeType === 'ALL') return { start: '', end: '' }

    const start = new Date(latestDate)
    const end = new Date(latestDate)

    if (rangeType === 'L7D') {
      start.setDate(start.getDate() - 6)
    } else if (rangeType === 'P7D') {
      end.setDate(end.getDate() - 7)
      start.setDate(end.getDate() - 6)
    } else if (rangeType === 'MTD') {
      start.setDate(1)
    }

    return {
      start: formatDateString(start),
      end: formatDateString(end)
    }
  }

  const getHubMetricDateRange = ({ selectedHub, hubFromDate, hubToDate, selectedDate, hubDeliveryTrendRange }) => {
    if (hubFromDate && hubToDate) {
      return { start: hubFromDate, end: hubToDate }
    }

    if (selectedDate) {
      return { start: selectedDate, end: selectedDate }
    }

    if (hubDeliveryTrendRange && hubDeliveryTrendRange !== 'ALL') {
      const selectedHubNorm = String(selectedHub || '').trim().toLowerCase()
      const hubMetrics = dashboardMetrics.filter(item => String(item.hub || '').trim().toLowerCase() === selectedHubNorm)
      const latestMetricDate = getMaxDateString(hubMetrics.map(item => item.date?.split('T')[0] || item.date))
      if (!latestMetricDate) {
        return null
      }
      return getRangeBounds(hubDeliveryTrendRange, latestMetricDate)
    }

    return null
  }

  const showMessage = (type, text) => {
    setMessage({ type, text })
    setTimeout(() => setMessage({ type: '', text: '' }), 5000)
  }

  const processPerformanceChartData = useCallback((records) => {
    const groupedByDate = (records || []).reduce((acc, item) => {
      const date = item.date?.split('T')[0] || item.date
      if (!date) return acc

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

      acc[date].delivered += parseInt(item.delivered) || 0
      acc[date].deliveredCount++
      acc[date].riders += parseInt(item.riders) || 0
      acc[date].ridersCount++
      acc[date].on_hold += parseInt(item.onhold || item.on_hold) || 0
      acc[date].onHoldCount++

      if (item.success_rate) {
        acc[date].success_rate += parseFloat(item.success_rate)
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
      .map(item => ({
        month: item.date?.slice(5) || item.date,
        'Success Rate': item.successRateCount > 0 ? Math.round(item.success_rate / item.successRateCount) : 0,
        'Riders': item.ridersCount > 0 ? Math.round(item.riders / item.ridersCount) : 0,
        'Delivered': item.delivered,
        'On-Hold': item.on_hold,
        'Productivity': item.productivityCount > 0 ? Math.round(item.productivity / item.productivityCount) : 0,
        'Clear Floor Rate': item.clearFloorCount > 0 ? Math.round(item.clear_floor_rate / item.clearFloorCount) : 0,
        'Scorecard': item.scoreCount > 0 ? (item.score / item.scoreCount).toFixed(1) : 0
      }))

    setPerformanceData(chartData)
  }, [])

  // Fetch dashboard data
  useEffect(() => {
    if (dashboardFetchStartedRef.current) return
    dashboardFetchStartedRef.current = true
    async function fetchData() {
      try {
        console.log('Dashboard fetchData start')
        setLoading(true)
        setLoadingProgress(0)
        setLoadingStage('Initializing data fetch...')
        
        // Create incremental progress function
        const incrementProgress = async (startProgress, targetProgress, stageText, dataFetchFunction) => {
          setLoadingStage(stageText)
          const steps = targetProgress - startProgress
          
          // Increment by 1% at a time
          for (let i = 1; i <= steps; i++) {
            setLoadingProgress(startProgress + i)
            await new Promise(resolve => setTimeout(resolve, 5)) // Small delay for visibility
          }
          
          return await dataFetchFunction()
        }
        
        let currentProgress = 0
        
        // OPTIMIZATION: Ensure aggregated metrics table is populated on startup
        await incrementProgress(currentProgress, 5, 'Preparing data cache...', () => populateDashboardMetrics())
        currentProgress = 5
        
        // Stage 1: Fetch basic stats (20%)
        const statsResult = await incrementProgress(currentProgress, 20, 'Fetching dashboard statistics...', () => getDashboardStats())
        currentProgress = 20
        
        // Stage 2: Fetch hub stats (35%)
        const hubResult = await incrementProgress(currentProgress, 35, 'Fetching hub performance data...', () => getRiderHubStats())
        currentProgress = 35
        
        // Stage 3: Fetch dashboard metrics (pre-aggregated, very fast!) (50%)
        // This replaces the old Stage 3 & 4 which fetched raw data for ~50% of the load time
        const dashboardResult = await incrementProgress(currentProgress, 50, 'Fetching dashboard metrics...', () => getDashboardMetrics())
        currentProgress = 50
        
        // Stage 4: Fetch riders data (65%)
        const ridersResult = await incrementProgress(currentProgress, 65, 'Loading rider information...', () => getRiders())
        currentProgress = 65
        
        // Stage 5: Fetch recent performance records (70%)
        const performanceResult = await incrementProgress(currentProgress, 70, 'Loading recent performance records...', () => getRecentPerformanceRecords(30))
        currentProgress = 70
        
        // Stage 6: Fetch KPI metrics by hub (80%)
        const kpiMetricsResult = await incrementProgress(currentProgress, 80, 'Fetching KPI metrics by hub...', () => getKPIMetricsByHub())
        currentProgress = 80
        
        // Stage 7: Fetch overall KPI metrics (90%)
        const overallKpiResult = await incrementProgress(currentProgress, 90, 'Fetching overall KPI metrics...', () => getOverallKPIMetrics())
        currentProgress = 90
        
        // Stage 8: Fetch raw KPI records for KPI distribution charts (95%)
        const kpiPageResult = await incrementProgress(currentProgress, 95, 'Fetching KPI records for distribution chart...', () => getKpiRecords())
        currentProgress = 95
        
        // Final stage: Processing (100%)
        setLoadingStage('Processing data...')
        for (let i = 96; i <= 100; i++) {
          setLoadingProgress(i)
          await new Promise(resolve => setTimeout(resolve, 5))
        }

        if (statsResult.data) {
          setStats(statsResult.data)
        }
        
        if (dashboardResult.data) {
          console.log('Dashboard metrics loaded:', dashboardResult.data?.length || 0, 'rows')
          if (dashboardResult.data?.length > 0) {
            console.log('Sample dashboard metric:', dashboardResult.data[0])
          }
          setDashboardMetrics(dashboardResult.data)
          
          // Transform dashboard metrics into chart data
          // Each dashboard metric is already aggregated by date and hub
          const chartData = dashboardResult.data
            .sort((a, b) => new Date(a.date) - new Date(b.date))
            .map(item => ({
              month: item.date?.slice(5) || item.date, // Show MM-DD
              'Success Rate': Math.round(parseFloat(item.success_rate) * 100) || 0,
              'Riders': item.riders || 0,
              'Delivered': Math.round(parseFloat(item.delivered)) || 0,
              'On-Hold': Math.round(parseFloat(item.on_hold)) || 0,
              'Productivity': Math.round(parseFloat(item.productivity)) || 0,
              'Clear Floor Rate': Math.round(parseFloat(item.clear_floor_rate)) || 0,
              'Scorecard': parseFloat(item.scorecard).toFixed(1) || 0
            }))
          
          setPerformanceData(chartData)
        }

        if (performanceResult?.data) {
          setPerformanceRecords(performanceResult.data)
        }
        
        if (ridersResult.data) {
          // No need to enrich with performance records - just use as-is
          // The deployment_date and last_active should already be in riders table
          setRidersData(ridersResult.data)
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
        
        if (kpiMetricsResult.data) {
          setKpiMetricsByHub(kpiMetricsResult.data)
        }
        
        if (overallKpiResult.data) {
          setOverallKpiMetrics(overallKpiResult.data)
        }

        if (kpiPageResult?.data) {
          setKpiData(kpiPageResult.data)
          const subRegions = [...new Set(kpiPageResult.data.map(item => item.sub_region).filter(Boolean))]
          setUniqueRegions(subRegions)
        }
      } catch (error) {
        console.error('Dashboard fetchData error:', error)
        setMessage('error', 'Failed to load dashboard data. Please refresh.')
      } finally {
        setLoading(false)
        console.log('Dashboard fetchData complete')
      }
    }
    
    fetchData()
  }, [])

  // Handle refresh button click
  const handleRefreshMetrics = useCallback(async () => {
    if (isRefreshing) return
    
    setIsRefreshing(true)
    
    try {
      // First populate the dashboard metrics table with aggregated data
      const populateResult = await populateDashboardMetrics()
      if (populateResult.error) {
        console.warn('Error populating dashboard metrics:', populateResult.error)
      }
      
      const [statsResult, hubResult, performancePageResult, kpiPageResult, dashboardResult, ridersResult] = await Promise.all([
        getDashboardStats(),
        getRiderHubStats(),
        getRecentPerformanceRecords(30),
        getKpiRecords(),
        getDashboardMetrics(),
        getRiders()
      ])

      if (statsResult.data) {
        setStats(statsResult.data)
      }
      
      if (dashboardResult.data) {
        setDashboardMetrics(dashboardResult.data)
        processPerformanceChartData(dashboardResult.data)
      }
      
      if (ridersResult.data) {
        setRidersData(ridersResult.data)
      }
      
      if (hubResult.data) {
        setRiderStats(hubResult.data)
        const hubPerf = hubResult.data.map(hub => ({
          name: hub.hub,
          riders: hub.riders,
          deliveryRate: Math.min(95, 70 + Math.random() * 25),
          onTimeRate: Math.min(98, 75 + Math.random() * 23),
          completionRate: Math.min(100, 80 + Math.random() * 20)
        })).slice(0, 5)
        setHubPerformance(hubPerf)
      }
      
      if (performancePageResult.data) {
        setPerformanceRecords(performancePageResult.data)
        processPerformanceChartData(performancePageResult.data)
      }
      
      if (kpiPageResult.data) {
        setKpiData(kpiPageResult.data)
        const subRegions = [...new Set(kpiPageResult.data.map(item => item.sub_region).filter(Boolean))]
        setUniqueRegions(subRegions)
      }
    } catch (error) {
      console.error('Error refreshing metrics:', error)
    } finally {
      setIsRefreshing(false)
    }
  }, [isRefreshing, processPerformanceChartData])

  // Filter data based on selections
  const filteredHubPerformance = useMemo(() => {
    let result = hubPerformance
    if (selectedHub) {
      result = result.filter(h => h.name === selectedHub)
    }
    return result
  }, [hubPerformance, selectedHub])

  // Get unique hubs for filter - from dashboard_metrics and performance records
  const uniqueHubs = useMemo(() => {
    const metricHubs = dashboardMetrics.map(item => item.hub).filter(Boolean)
    const performanceHubs = performanceRecords.map(item => item.hub).filter(Boolean)
    return [...new Set([...metricHubs, ...performanceHubs])].sort()
  }, [dashboardMetrics, performanceRecords])

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
    
    if (!performanceRecords.length) {
      return []
    }

    if (!selectedHub || selectedHub === 'All Hubs') {
      return []
    }
    
    let filtered = ridersData.filter(rider => rider.operator_hub === selectedHub)
    
    let rangeStart = ''
    let rangeEnd = ''

    if (hubFromDate && hubToDate) {
      rangeStart = hubFromDate
      rangeEnd = hubToDate
    } else if (hubDeliveryTrendRange && hubDeliveryTrendRange !== 'ALL') {
      const lastActiveDates = filtered
        .map(rider => rider.last_active?.split('T')[0] || null)
        .filter(Boolean)
      const latestLastActive = getMaxDateString(lastActiveDates)
      const bounds = getRangeBounds(hubDeliveryTrendRange, latestLastActive)
      rangeStart = bounds.start
      rangeEnd = bounds.end
    }

    // For Riders No Route, we want to show ALL riders (including those with no activity)
    // even if they don't fit the date range. This is because riders with no activity
    // are exactly the ones we want to track as "no route"
    
    // Note: We don't apply date range filtering to Riders No Route because:
    // 1. Riders with no last_active (N/A) represent riders who haven't been deployed or have no records
    // 2. These are important to show as "no route" riders
    // 3. The Riders No Route section inherently shows riders outside normal delivery flow
    
    // Find riders with no performance records
    const ridersNoRoute = filtered
      .filter(rider => {
        const riderId = rider.rider_id
        const existsInPerformance = performanceRecords.some(p => p.rider_id === riderId)
        const hasNoRoute = !existsInPerformance
        return hasNoRoute
      })
      .map(rider => ({
        riderId: rider.rider_id,
        riderName: rider.rider_name,
        status: rider.status || 'N/A',
        lastActive: rider.last_active || 'N/A',
        deploymentDate: rider.deployment_date || 'N/A',
        operatorHub: rider.operator_hub || 'N/A'
      }))
      // Sort by last active date first (newest first), then alphabetically by rider name, then rider ID
      .sort((a, b) => {
        // Compare last active date first (newest first)
        const dateA = a.lastActive || ''
        const dateB = b.lastActive || ''
        if (dateA !== dateB && dateA !== 'N/A' && dateB !== 'N/A') {
          return dateB.localeCompare(dateA) // Newest first
        }
        
        // Handle N/A dates - put them last
        if (dateA === 'N/A' && dateB !== 'N/A') return 1
        if (dateA !== 'N/A' && dateB === 'N/A') return -1
        
        // If dates are equal or both N/A, compare rider name
        const nameA = (a.riderName || '').toLowerCase()
        const nameB = (b.riderName || '').toLowerCase()
        if (nameA !== nameB) {
          return nameA.localeCompare(nameB)
        }
        const idA = (a.riderId || '').toLowerCase()
        const idB = (b.riderId || '').toLowerCase()
        return idA.localeCompare(idB)
      })
    
    return ridersNoRoute
  }, [ridersData, performanceRecords, selectedHub, selectedDate, hubFromDate, hubToDate, hubDeliveryTrendRange])

  // Get unique categories for filter
  const uniqueCategories = useMemo(() => {
    return [...new Set(kpiData.map(item => item.category).filter(Boolean))]
  }, [kpiData])

  // Get unique clusters from KPI data
  const uniqueClusters = useMemo(() => {
    return [...new Set(kpiData.map(item => item.cluster).filter(Boolean))]
  }, [kpiData])

  // Fetch cluster leaders on mount
  useEffect(() => {
    if (clusterLeadersFetchedRef.current) return
    clusterLeadersFetchedRef.current = true
    async function fetchClusterLeaders() {
      console.log('Fetching cluster leaders...')
      const { data, error } = await getClusterLeaders()
      console.log('Cluster leaders response:', { data, error })
      if (error) {
        console.error('Failed to fetch cluster leaders:', error)
        setClusterLeaders([])
      } else {
        setClusterLeaders(data || [])
      }
    }
    fetchClusterLeaders()
  }, [])

  // Create hub-to-cluster mapping from KPI data (for Overall view filtering)
  // Uses cluster field from KPI records
  const hubToClusterMap = useMemo(() => {
    const map = {}
    kpiData.forEach(item => {
      // Map both operator_hub and hub field for better matching
      // Use normalized (lowercase) keys for case-insensitive matching
      if (item.operator_hub && item.cluster) {
        map[item.operator_hub.toLowerCase()] = item.cluster
      }
      if (item.hub && item.cluster) {
        map[item.hub.toLowerCase()] = item.cluster
      }
    })
    return map
  }, [kpiData])

  // Create cluster leader to hub mapping for Overall view filtering
  const clusterLeaderHubMap = useMemo(() => {
    const map = {}
    clusterLeaders.forEach(leader => {
      if (leader.hubs && Array.isArray(leader.hubs)) {
        leader.hubs.forEach(hub => {
          map[leader.leader_name] = leader.hubs
        })
      }
    })
    return map
  }, [clusterLeaders])

  // Filtered stats based on hub/cluster and date selection - using dashboard_metrics
  // In Overall view with selectedCluster, shows all hubs in that cluster
  const filteredStats = useMemo(() => {
    // For overall view: if no cluster leader selected, show 0
    if (dashboardView === 'overall' && !selectedCluster) {
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
    
    // For overall view with cluster leader selected, continue with data calculation
    // Don't return early - let the calculation proceed
    
    const normalizeHub = value => String(value || '').trim().toLowerCase()
    const selectedHubNorm = normalizeHub(selectedHub)

    const isHubRangeSelected = Boolean(hubFromDate || hubToDate || selectedDate || (hubDeliveryTrendRange && hubDeliveryTrendRange !== 'ALL'))

    // When a specific hub is selected in hub view and no explicit KPI date range is selected,
    // keep the legacy dashboard_metrics summary as a fallback.
    if (dashboardView === 'hub' && selectedHub && selectedHub !== 'All Hubs' && !isHubRangeSelected) {
      let hubMetrics = dashboardMetrics.filter(m => normalizeHub(m.hub) === selectedHubNorm)

      if (hubMetrics.length === 0) {
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

      const total = hubMetrics.length
      const avgSuccessRate = Math.round(hubMetrics.reduce((sum, item) => sum + ((item.success_rate || 0) * 100), 0) / total)
      const sumRiders = hubMetrics.reduce((sum, item) => sum + (item.riders || 0), 0)
      const sumDelivered = hubMetrics.reduce((sum, item) => sum + (item.delivered || 0), 0)
      const sumOnHold = hubMetrics.reduce((sum, item) => sum + (item.on_hold || 0), 0)
      const avgProductivity = Math.round(hubMetrics.reduce((sum, item) => sum + (item.productivity || 0), 0) / total)
      const avgClearFloor = Math.round(hubMetrics.reduce((sum, item) => sum + (item.clear_floor_rate || 0), 0) / total)
      const avgScorecard = (hubMetrics.reduce((sum, item) => sum + (item.scorecard || 0), 0) / total).toFixed(1)

      return {
        successRate: avgSuccessRate,
        activeRiders: sumRiders,
        delivered: sumDelivered,
        onHold: sumOnHold,
        productivity: avgProductivity,
        clearFloorRate: avgClearFloor,
        scorecard: avgScorecard
      }
    }

    // For hub view with filters: calculate from Performance, KPI, and Rider pages
    if (dashboardView === 'hub' && (selectedHub || selectedDate || hubFromDate || hubToDate || (hubDeliveryTrendRange && hubDeliveryTrendRange !== 'ALL'))) {
      const filterDashboardMetrics = () => {
        let filteredMetrics = dashboardMetrics

        if (selectedHub && selectedHub !== 'All Hubs') {
          filteredMetrics = filteredMetrics.filter(m => normalizeHub(m.hub) === selectedHubNorm)
        }

        if (hubFromDate && hubToDate) {
          filteredMetrics = filteredMetrics.filter(m => {
            const recordDate = m.date?.split('T')[0] || m.date
            return recordDate >= hubFromDate && recordDate <= hubToDate
          })
        } else if (hubDeliveryTrendRange && hubDeliveryTrendRange !== 'ALL') {
          const latestMetricDate = getMaxDateString(filteredMetrics.map(m => m.date?.split('T')[0] || m.date))
          const bounds = getRangeBounds(hubDeliveryTrendRange, latestMetricDate)
          if (bounds.start && bounds.end) {
            filteredMetrics = filteredMetrics.filter(m => {
              const recordDate = m.date?.split('T')[0] || m.date
              return recordDate >= bounds.start && recordDate <= bounds.end
            })
          } else {
            filteredMetrics = []
          }
        } else if (selectedDate) {
          filteredMetrics = filteredMetrics.filter(m => {
            const recordDate = m.date?.split('T')[0] || m.date
            return recordDate === selectedDate
          })
        }

        return filteredMetrics
      }

      const filteredMetrics = filterDashboardMetrics()
      if (!performanceRecords.length && filteredMetrics.length > 0) {
        const total = filteredMetrics.length
        const sumRiders = filteredMetrics.reduce((sum, item) => sum + (item.riders || 0), 0)
        const sumDelivered = filteredMetrics.reduce((sum, item) => sum + (item.delivered || 0), 0)
        const sumOnHold = filteredMetrics.reduce((sum, item) => sum + (item.on_hold || 0), 0)
        const avgSuccessRate = Math.round(filteredMetrics.reduce((sum, item) => sum + ((item.success_rate || 0) * 100), 0) / total)
        const avgProductivity = Math.round(filteredMetrics.reduce((sum, item) => sum + (item.productivity || 0), 0) / total)
        const avgClearFloor = Math.round(filteredMetrics.reduce((sum, item) => sum + (item.clear_floor_rate || 0), 0) / total)
        const avgScorecard = (filteredMetrics.reduce((sum, item) => sum + (item.scorecard || 0), 0) / total).toFixed(1)

        return {
          successRate: avgSuccessRate,
          activeRiders: sumRiders,
          delivered: sumDelivered,
          onHold: sumOnHold,
          productivity: avgProductivity,
          clearFloorRate: avgClearFloor,
          scorecard: avgScorecard
        }
      }

      let filteredPerformance = performanceRecords
      let filteredKPI = kpiData
      
      // Filter by hub
      if (selectedHub && selectedHub !== 'All Hubs') {
        filteredPerformance = filteredPerformance.filter(p => normalizeHub(p.hub) === selectedHubNorm)
        filteredKPI = filteredKPI.filter(k => normalizeHub(k.operator_hub || k.hub) === selectedHubNorm)
      }
      
      // Filter by date range
      if (hubFromDate && hubToDate) {
        filteredPerformance = filteredPerformance.filter(p => {
          const recordDate = p.date?.split('T')[0] || p.date
          return recordDate >= hubFromDate && recordDate <= hubToDate
        })
        filteredKPI = filteredKPI.filter(k => {
          const recordDate = k.date?.split('T')[0] || k.date
          return recordDate >= hubFromDate && recordDate <= hubToDate
        })
      } else if (hubDeliveryTrendRange && hubDeliveryTrendRange !== 'ALL') {
        const latestKpiDate = getMaxDateString(filteredKPI.map(k => k.date?.split('T')[0] || k.date))
        const bounds = getRangeBounds(hubDeliveryTrendRange, latestKpiDate)
        if (bounds.start && bounds.end) {
          filteredPerformance = filteredPerformance.filter(p => {
            const recordDate = p.date?.split('T')[0] || p.date
            return recordDate >= bounds.start && recordDate <= bounds.end
          })
          filteredKPI = filteredKPI.filter(k => {
            const recordDate = k.date?.split('T')[0] || k.date
            return recordDate >= bounds.start && recordDate <= bounds.end
          })
        } else {
          filteredPerformance = []
          filteredKPI = []
        }
      } else if (selectedDate) {
        filteredPerformance = filteredPerformance.filter(p => {
          const recordDate = p.date?.split('T')[0] || p.date
          return recordDate === selectedDate
        })
        filteredKPI = filteredKPI.filter(k => {
          const recordDate = k.date?.split('T')[0] || k.date
          return recordDate === selectedDate
        })
      }
      
      // Calculate averages from Performance and KPI data
      if (filteredPerformance.length === 0 && filteredMetrics.length > 0) {
        const total = filteredMetrics.length
        const avgSuccessRate = Math.round(filteredMetrics.reduce((sum, item) => sum + ((item.success_rate || 0) * 100), 0) / total)
        const sumRiders = filteredMetrics.reduce((sum, item) => sum + (item.riders || 0), 0)
        const sumDelivered = filteredMetrics.reduce((sum, item) => sum + (item.delivered || 0), 0)
        const sumOnHold = filteredMetrics.reduce((sum, item) => sum + (item.on_hold || 0), 0)
        const avgProductivity = Math.round(filteredMetrics.reduce((sum, item) => sum + (item.productivity || 0), 0) / total)
        const avgClearFloor = Math.round(filteredMetrics.reduce((sum, item) => sum + (item.clear_floor_rate || 0), 0) / total)
        const avgScorecard = (filteredMetrics.reduce((sum, item) => sum + (item.scorecard || 0), 0) / total).toFixed(1)

        return {
          successRate: avgSuccessRate,
          activeRiders: sumRiders,
          delivered: sumDelivered,
          onHold: sumOnHold,
          productivity: avgProductivity,
          clearFloorRate: avgClearFloor,
          scorecard: avgScorecard
        }
      }

      if (filteredPerformance.length === 0 && filteredKPI.length === 0) {
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
      
      // Calculate success rate from individual rider performance
      const successRates = []
      const riders = new Set()
      let totalDelivered = 0
      let totalOnHold = 0
      let totalAssigned = 0
      
      filteredPerformance.forEach(record => {
        const assigned = parseInt(record.assigned) || 0
        const delivered = parseInt(record.delivered) || 0
        const onHold = parseInt(record.onhold) || 0
        
        if (assigned > 0) {
          const successRate = (delivered / assigned) * 100
          successRates.push(successRate)
        }
        
        riders.add(record.rider_id)
        totalDelivered += delivered
        totalOnHold += onHold
        totalAssigned += assigned
      })
      
      // Calculate KPI metrics
      let totalClearFloor = 0
      let totalScorecard = 0
      let clearFloorCount = 0
      let scorecardCount = 0
      
      filteredKPI.forEach(record => {
        const cfrValue = parseFloat(record.cfr)
        const srValue = parseFloat(record.sr)
        if (!Number.isNaN(cfrValue)) {
          totalClearFloor += cfrValue
          clearFloorCount++
        }
        if (!Number.isNaN(srValue)) {
          totalScorecard += srValue
          scorecardCount++
        }
      })
      
      // Calculate productivity as average of daily productivity values
      // Group performance records by date and calculate productivity per day, then average
      const productivityByDate = {}
      
      filteredPerformance.forEach(record => {
        const recordDate = record.date?.split('T')[0] || record.date
        if (!productivityByDate[recordDate]) {
          productivityByDate[recordDate] = { totalAssigned: 0, uniqueRiders: new Set() }
        }
        const assigned = parseInt(record.assigned) || 0
        productivityByDate[recordDate].totalAssigned += assigned
        productivityByDate[recordDate].uniqueRiders.add(record.rider_id)
      })
      
      // Calculate average daily productivity
      const dailyProductivities = Object.values(productivityByDate).map(day => 
        day.uniqueRiders.size > 0 ? day.totalAssigned / day.uniqueRiders.size : 0
      )
      const avgProductivity = dailyProductivities.length > 0 
        ? Math.round(dailyProductivities.reduce((sum, val) => sum + val, 0) / dailyProductivities.length)
        : 0
      
      const avgSuccessRate = successRates.length > 0 ? Math.round(successRates.reduce((sum, rate) => sum + rate, 0) / successRates.length) : 0
      const avgClearFloor = clearFloorCount > 0 ? Math.round(totalClearFloor / clearFloorCount) : 0
      const avgScorecard = scorecardCount > 0 ? (totalScorecard / scorecardCount).toFixed(1) : '0.0'
      
      return {
        successRate: avgSuccessRate,
        activeRiders: riders.size,
        delivered: totalDelivered,
        onHold: totalOnHold,
        productivity: avgProductivity,
        clearFloorRate: avgClearFloor,
        scorecard: avgScorecard
      }
    }
    
    // For overall view: process data from cluster leader assigned hubs
    if (dashboardView === 'overall' && selectedCluster) {
      const normalizeHub = (value) => String(value || '').trim().toLowerCase()
      const assignedHubs = clusterLeaderHubMap[selectedCluster] || []
      const assignedHubSet = new Set(assignedHubs.map(normalizeHub))

      let filteredMetrics = dashboardMetrics.filter(m => assignedHubSet.has(normalizeHub(m.hub)))
      if (selectedDate) {
        const selectedDateNorm = selectedDate.split('T')[0]
        filteredMetrics = filteredMetrics.filter(m => {
          const recordDate = m.date?.split('T')[0] || m.date
          return recordDate === selectedDateNorm
        })
      }

      if (!filteredMetrics.length) {
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

      const total = filteredMetrics.length
      const avgSuccessRate = Math.round(filteredMetrics.reduce((sum, item) => sum + ((item.success_rate || 0) * 100), 0) / total)
      const avgRiders = Math.round(filteredMetrics.reduce((sum, item) => sum + (item.riders || 0), 0) / total)
      const avgDelivered = Math.round(filteredMetrics.reduce((sum, item) => sum + (item.delivered || 0), 0) / total)
      const avgOnHold = Math.round(filteredMetrics.reduce((sum, item) => sum + (item.on_hold || 0), 0) / total)
      const avgProductivity = Math.round(filteredMetrics.reduce((sum, item) => sum + (item.productivity || 0), 0) / total)
      const avgClearFloor = Math.round(filteredMetrics.reduce((sum, item) => sum + (item.clear_floor_rate || 0), 0) / total)
      const avgScorecard = (filteredMetrics.reduce((sum, item) => sum + (item.scorecard || 0), 0) / total).toFixed(1)

      return {
        successRate: avgSuccessRate,
        activeRiders: avgRiders,
        delivered: avgDelivered,
        onHold: avgOnHold,
        productivity: avgProductivity,
        clearFloorRate: avgClearFloor,
        scorecard: avgScorecard
      }
    }
    
    // Default case: use dashboard_metrics
    let filtered = dashboardMetrics
    
    // In Overall view with selectedCluster: filter hubs assigned to that cluster leader
    if (dashboardView === 'overall' && selectedCluster) {
      const assignedHubs = clusterLeaderHubMap[selectedCluster] || []
      filtered = filtered.filter(item => assignedHubs.includes(item.hub))
    }
    
    // Filter by date range
    if (selectedDate) {
      filtered = filtered.filter(item => {
        const itemDate = item.date?.split('T')[0] || item.date?.split(' ')[0] || item.date
        return itemDate === selectedDate
      })
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
  }, [dashboardMetrics, performanceRecords, kpiData, selectedHub, selectedDate, dashboardView, selectedCluster, hubToClusterMap, hubFromDate, hubToDate, hubDeliveryTrendRange])

  // KPI spider chart data based on filters
  // In Overall view with selectedCluster, shows KPI data for all hubs in that cluster
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
    
    // For overall view: if no cluster leader selected, show 0
    if (dashboardView === 'overall' && !selectedCluster) {
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
    const normalizeHub = (value) => String(value || '').trim().toLowerCase()
    
    // In Overall view with selectedCluster: filter KPI data for hubs assigned to that cluster leader
    if (dashboardView === 'overall' && selectedCluster) {
      const assignedHubs = clusterLeaderHubMap[selectedCluster] || []
      const assignedHubSet = new Set(assignedHubs.map(normalizeHub))
      filteredKpiData = filteredKpiData.filter(item => assignedHubSet.has(normalizeHub(item.operator_hub || item.hub)))
    }
    // In Hub view with selectedHub: filter by specific hub
    else if (dashboardView === 'hub' && selectedHub && selectedHub !== 'All Hubs') {
      const selectedHubNorm = normalizeHub(selectedHub)
      filteredKpiData = filteredKpiData.filter(item => {
        return normalizeHub(item.operator_hub || item.hub) === selectedHubNorm
      })
    }
    
    // Apply date range filtering
    if (dashboardView === 'hub') {
      // From/To dates take priority
      if (hubFromDate && hubToDate) {
        filteredKpiData = filteredKpiData.filter(item => {
          const itemDate = item.date?.split('T')[0] || item.date?.split(' ')[0] || item.date
          return itemDate >= hubFromDate && itemDate <= hubToDate
        })
      } 
      // Else use trend range (L7D, P7D, MTD)
      else if (hubDeliveryTrendRange && hubDeliveryTrendRange !== 'ALL') {
        const metricRange = getHubMetricDateRange({
          selectedHub,
          hubFromDate,
          hubToDate,
          selectedDate,
          hubDeliveryTrendRange
        })

        if (!metricRange) {
          filteredKpiData = []
        } else {
          filteredKpiData = filteredKpiData.filter(item => {
            const itemDate = item.date?.split('T')[0] || item.date?.split(' ')[0] || item.date
            return itemDate >= metricRange.start && itemDate <= metricRange.end
          })
        }
      } 
      // Fallback to single date if neither range nor trend is set
      else if (selectedDate) {
        filteredKpiData = filteredKpiData.filter(item => {
          const itemDate = item.date?.split('T')[0] || item.date?.split(' ')[0] || item.date
          return itemDate === selectedDate
        })
      }
    } 
    // Overall view - apply date filter if selectedDate is set
    else if (dashboardView === 'overall' && selectedDate) {
      filteredKpiData = filteredKpiData.filter(item => {
        const itemDate = item.date?.split('T')[0] || item.date?.split(' ')[0] || item.date
        return itemDate === selectedDate
      })
    }

    if (!filteredKpiData.length) {
      return []
    }

    const hasClearFloorData = filteredKpiData.some(item => {
      const value = parseFloat(item.cfr)
      return !Number.isNaN(value)
    })
    const hasScorecardData = filteredKpiData.some(item => {
      const value = parseFloat(item.sr)
      return !Number.isNaN(value)
    })

    if (!hasClearFloorData || !hasScorecardData) {
      return []
    }
    
    const kpiFields = [
      { key: 'cfr', label: 'Clear Floor' },
      { key: 'sr', label: 'Success' },
      { key: 'aging_four_days', label: 'Aging 4D' },
      { key: 'line_haul_compliance', label: 'Line Haul' },
      { key: 'cod_remittance', label: 'COD Remit' },
      { key: 'eod_compliance', label: 'EOD' },
      { key: 'rts', label: 'RTS' },
      { key: 'loss', label: 'Loss' }
    ]
    
    const result = kpiFields.map(field => {
      const values = filteredKpiData
        .map(item => item[field.key])
        .filter(val => val !== null && val !== undefined && val !== '')
        .map(val => parsePercentage(val))

      const avg = values.length > 0
        ? Math.round(values.reduce((sum, val) => sum + val, 0) / values.length)
        : 0
      return { name: field.label, value: avg }
    })
    
    return result
  }, [kpiData, selectedHub, selectedDate, dashboardView, selectedCluster, hubToClusterMap, hubFromDate, hubToDate, hubDeliveryTrendRange])

  // Filter chart data based on hub/cluster and date selection - using dashboard_metrics
// In Overall view with selectedCluster, shows chart data for all hubs in that cluster
const filteredChartData = useMemo(() => {
  
  // For overall view: if no cluster leader selected, return empty array
  if (dashboardView === 'overall' && !selectedCluster) {
    return []
  }

  // For overall view with cluster leader selected, continue with data calculation
  // Don't return early - let the calculation proceed

  const getDashboardMetricChartData = () => {
    console.log('getDashboardMetricChartData called with dashboardMetrics:', dashboardMetrics?.length || 0, 'rows')
    
    if (dashboardView === 'hub' && (!selectedHub || selectedHub === 'All Hubs')) {
      console.log('Hub view without selected hub: returning empty chart data')
      return []
    }

    let filtered = dashboardMetrics
    const selectedHubNorm = String(selectedHub || '').trim().toLowerCase()
    const selectedDateNorm = String(selectedDate || '').split('T')[0]

    console.log('Filtering with selectedHub:', selectedHub, 'normalized:', selectedHubNorm)
    console.log('Available hubs in dashboardMetrics:', [...new Set(dashboardMetrics.map(d => d.hub))])

    if (dashboardView === 'hub' && selectedHub && selectedHub !== 'All Hubs') {
      filtered = filtered.filter(item => {
        const itemHubNorm = String(item.hub || '').trim().toLowerCase()
        return itemHubNorm === selectedHubNorm
      })
      console.log('Filtered by hub, remaining rows:', filtered.length)
      if (filtered.length > 0) {
        console.log('Sample filtered row:', filtered[0])
      }
    }

    if (hubCompareDateA && hubCompareDateB) {
      console.log('Applying hub compare dates:', hubCompareDateA, hubCompareDateB)
      filtered = filtered.filter(item => {
        const itemDate = String(item.date || '').split('T')[0]
        return itemDate === hubCompareDateA || itemDate === hubCompareDateB
      })
    } else if (hubDeliveryTrendRange && hubDeliveryTrendRange !== 'ALL' && filtered.length > 0) {
      const parsedDates = filtered
        .map(item => String(item.date || '').split('T')[0])
        .filter(Boolean)
      const latestDateString = parsedDates.reduce((latest, current) => {
        return current > latest ? current : latest
      }, parsedDates[0] || '')

      const parseDateString = (dateStr) => {
        const [year, month, day] = String(dateStr || '').split('-').map(Number)
        if (Number.isInteger(year) && Number.isInteger(month) && Number.isInteger(day)) {
          return new Date(year, month - 1, day)
        }
        return new Date(dateStr)
      }

      const formatLocalDate = (date) => {
        const pad = (value) => String(value).padStart(2, '0')
        return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
      }

      if (latestDateString) {
        const latestDateObj = parseDateString(latestDateString)
        let rangeStart = new Date(latestDateObj)
        let rangeEnd = new Date(latestDateObj)

        if (hubDeliveryTrendRange === 'L7D') {
          rangeStart.setDate(latestDateObj.getDate() - 6)
        } else if (hubDeliveryTrendRange === 'P7D') {
          rangeEnd.setDate(latestDateObj.getDate() - 7)
          rangeStart = new Date(rangeEnd)
          rangeStart.setDate(rangeEnd.getDate() - 6)
        } else if (hubDeliveryTrendRange === 'MTD') {
          rangeStart = new Date(latestDateObj.getFullYear(), latestDateObj.getMonth(), 1)
        }

        const formattedStart = formatLocalDate(rangeStart)
        const formattedEnd = formatLocalDate(rangeEnd)
        console.log('Applying hub trend range:', hubDeliveryTrendRange, formattedStart, 'to', formattedEnd)

        filtered = filtered.filter(item => {
          const itemDate = String(item.date || '').split('T')[0]
          return itemDate >= formattedStart && itemDate <= formattedEnd
        })
      }
    } else if (hubFromDate && hubToDate) {
      console.log('Filtering by date range:', hubFromDate, 'to', hubToDate)
      filtered = filtered.filter(item => {
        const itemDate = String(item.date || '').split('T')[0]
        return itemDate >= hubFromDate && itemDate <= hubToDate
      })
    } else if (selectedDate) {
      filtered = filtered.filter(item => {
        const itemDate = String(item.date || '').split('T')[0]
        return itemDate === selectedDateNorm
      })
    }

    const aggregated = {}

    filtered.forEach(item => {
      const date = item.date?.split('T')[0] || item.date
      if (!date) return

      if (!aggregated[date]) {
        aggregated[date] = {
          date,
          count: 0,
          delivered: 0,
          riders: 0,
          on_hold: 0,
          success_rate: 0,
          productivity: 0,
          clear_floor_rate: 0,
          scorecard: 0
        }
      }

      const entry = aggregated[date]
      entry.delivered += Number(item.delivered) || 0
      entry.riders += Number(item.riders) || 0
      entry.on_hold += Number(item.on_hold) || 0
      entry.success_rate += Number(item.success_rate) || 0
      entry.productivity += Number(item.productivity) || 0
      entry.clear_floor_rate += Number(item.clear_floor_rate) || 0
      entry.scorecard += Number(item.scorecard) || 0
      entry.count += 1
    })

    const chartData = Object.values(aggregated)
      .sort((a, b) => a.date.localeCompare(b.date))
      .map(item => ({
        month: item.date,
        'Success Rate': item.count > 0 ? Number(((item.success_rate / item.count) * 100).toFixed(1)) : 0,
        'Riders': item.riders,
        'Delivered': item.delivered,
        'On-Hold': item.on_hold,
        'Productivity': item.count > 0 ? Number((item.productivity / item.count).toFixed(1)) : 0,
        'Clear Floor Rate': item.count > 0 ? Number((item.clear_floor_rate / item.count).toFixed(1)) : 0,
        'Scorecard': item.count > 0 ? Number((item.scorecard / item.count).toFixed(1)) : 0
      }))
    
    console.log('Final chart data:', chartData?.length || 0, 'rows')
    if (chartData?.length > 0) {
      console.log('Sample chart row:', chartData[0])
    }
    
    return chartData
  }

  if (dashboardView === 'hub') {
    if (!selectedHub || selectedHub === 'All Hubs') {
      return []
    }
    return getDashboardMetricChartData()
  }

  // For overall view: process data from cluster leader assigned hubs with P7D/L7D logic
  if (dashboardView === 'overall' && selectedCluster) {
    const assignedHubs = clusterLeaderHubMap[selectedCluster] || []
    const normalizeHub = (value) => String(value || '').trim().toLowerCase()
    const assignedHubSet = new Set(assignedHubs.map(normalizeHub))

    // Filter data by assigned hubs with normalization
    let filteredPerformance = performanceRecords.filter(p => assignedHubSet.has(normalizeHub(p.hub)))
    let filteredKPI = kpiData.filter(k => assignedHubSet.has(normalizeHub(k.operator_hub || k.hub)))

    const perfDates = filteredPerformance
      .map(item => item.date?.split('T')[0] || item.date)
      .filter(Boolean)
    const perfLatestDate = perfDates.length > 0
      ? new Date(Math.max(...perfDates.map(d => new Date(d).getTime())))
      : new Date()

    const last7DaysEnd = new Date(perfLatestDate)
    const last7DaysStart = new Date(perfLatestDate)
    last7DaysStart.setDate(last7DaysEnd.getDate() - 6)

    const prior7DaysEnd = new Date(last7DaysStart)
    prior7DaysEnd.setDate(prior7DaysEnd.getDate() - 1)
    const prior7DaysStart = new Date(prior7DaysEnd)
    prior7DaysStart.setDate(prior7DaysEnd.getDate() - 6)

    // Filter data by date ranges
    const last7DaysData = filteredPerformance.filter(p => {
      const recordDate = new Date(p.date?.split('T')[0] || p.date)
      return recordDate >= last7DaysStart && recordDate <= last7DaysEnd
    })

    const prior7DaysData = filteredPerformance.filter(p => {
      const recordDate = new Date(p.date?.split('T')[0] || p.date)
      return recordDate >= prior7DaysStart && recordDate <= prior7DaysEnd
    })

    const last7DaysKPI = filteredKPI.filter(k => {
      const recordDate = new Date(k.date?.split('T')[0] || k.date)
      return recordDate >= last7DaysStart && recordDate <= last7DaysEnd
    })

    const prior7DaysKPI = filteredKPI.filter(k => {
      const recordDate = new Date(k.date?.split('T')[0] || k.date)
      return recordDate >= prior7DaysStart && recordDate <= prior7DaysEnd
    })

    // Calculate averages for each period
    const calculatePeriodAverages = (perfData, kpiData) => {
      if (perfData.length === 0) return null
      
      const totals = {
        delivered: 0,
        onHold: 0,
        assigned: 0,
        riders: new Set(),
        successRates: [],
        clearFloorRate: 0,
        scorecard: 0,
        kpiCount: 0
      }

      // Aggregate performance data
      perfData.forEach(record => {
        totals.delivered += parseInt(record.delivered) || 0
        totals.onHold += parseInt(record.onhold) || 0
        totals.assigned += parseInt(record.assigned) || 0
        totals.riders.add(record.rider_id)
        
        if (record.assigned > 0) {
          const successRate = (parseInt(record.delivered) / parseInt(record.assigned)) * 100
          totals.successRates.push(successRate)
        }
      })

      // Aggregate KPI data
      kpiData.forEach(record => {
        totals.clearFloorRate += parseFloat(record.cfr) || 0
        totals.scorecard += parseFloat(record.sr) || 0
        totals.kpiCount++
      })

      // Calculate averages
      const avgSuccessRate = totals.successRates.length > 0 
        ? Math.round(totals.successRates.reduce((sum, rate) => sum + rate, 0) / totals.successRates.length)
        : 0
      
      const avgClearFloorRate = totals.kpiCount > 0
        ? Math.round(totals.clearFloorRate / totals.kpiCount)
        : 0
      
      const avgScorecard = totals.kpiCount > 0
        ? (totals.scorecard / totals.kpiCount).toFixed(1)
        : 0
      
      const avgProductivity = totals.riders.size > 0
        ? Math.round(totals.assigned / totals.riders.size)
        : 0

      return {
        'Success Rate': avgSuccessRate,
        'Riders': totals.riders.size,
        'Delivered': totals.delivered,
        'On-Hold': totals.onHold,
        'Productivity': avgProductivity,
        'Clear Floor Rate': avgClearFloorRate,
        'Scorecard': parseFloat(avgScorecard)
      }
    }

    const l7dAverages = calculatePeriodAverages(last7DaysData, last7DaysKPI)
    const p7dAverages = calculatePeriodAverages(prior7DaysData, prior7DaysKPI)

    // Create bar chart data based on selected view
    if (overallTrendView === 'L7D' && l7dAverages) {
      return [{
        month: 'Last 7 Days',
        ...l7dAverages
      }]
    } else if (overallTrendView === 'P7D' && p7dAverages) {
      return [{
        month: 'Prior 7 Days',
        ...p7dAverages
      }]
    } else if (l7dAverages && p7dAverages) {
      // Show both periods for comparison
      return [
        {
          month: 'Prior 7 Days',
          ...p7dAverages
        },
        {
          month: 'Last 7 Days',
          ...l7dAverages
        }
      ]
    }

    return []
  }

  return []
}, [dashboardMetrics, selectedHub, selectedDate, dashboardView, selectedCluster, hubToClusterMap, hubFromDate, hubToDate, hubCompareDateA, hubCompareDateB, selectedCategory, hubDeliveryTrendRange])

const hubDeliveryTrendDateLabel = useMemo(() => {
  const formatDisplayDate = (dateStr) => {
    const date = new Date(dateStr)
    if (Number.isNaN(date.getTime())) return dateStr
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  }

  if (hubFromDate && hubToDate) {
    return `${formatDisplayDate(hubFromDate)} to ${formatDisplayDate(hubToDate)}`
  }

  if (hubCompareDateA && hubCompareDateB) {
    return `${formatDisplayDate(hubCompareDateA)} vs ${formatDisplayDate(hubCompareDateB)}`
  }

  if (filteredChartData.length > 0) {
    const sortedDates = filteredChartData
      .map(item => item.month)
      .filter(Boolean)
      .sort()
    if (sortedDates.length > 0) {
      return `${formatDisplayDate(sortedDates[0])} to ${formatDisplayDate(sortedDates[sortedDates.length - 1])}`
    }
  }

  if (hubDeliveryTrendRange === 'L7D') return 'Last 7 Days'
  if (hubDeliveryTrendRange === 'P7D') return 'Prior 7 Days'
  if (hubDeliveryTrendRange === 'MTD') return 'Month to Date'
  return 'All Dates'
}, [hubFromDate, hubToDate, hubCompareDateA, hubCompareDateB, hubDeliveryTrendRange, filteredChartData])

const chartDomain = useMemo(() => {
  if (!filteredChartData || filteredChartData.length === 0) {
    return [0, 'auto']
  }

  const values = filteredChartData.map(item => Number(item[selectedCategory]) || 0)
  const maxValue = Math.max(...values, 0)

  if (['Success Rate', 'Productivity', 'Clear Floor Rate', 'Scorecard'].includes(selectedCategory)) {
    const upper = Math.max(10, Math.ceil(maxValue * 1.2))
    return [0, upper]
  }

  return [0, Math.max(10, Math.ceil(maxValue * 1.2))]
}, [filteredChartData, selectedCategory])

// Calculate hub level period comparison data for Graph Comparison
const hubLevelGraphComparison = useMemo(() => {
  if (dashboardView !== 'hub' || !selectedHub || selectedHub === 'All Hubs' || !dashboardMetrics || dashboardMetrics.length === 0) {
    return []
  }

  const selectedHubNorm = String(selectedHub || '').trim().toLowerCase()
  let hubData = dashboardMetrics.filter(item => {
    const itemHubNorm = String(item.hub || '').trim().toLowerCase()
    return itemHubNorm === selectedHubNorm
  })

  if (hubData.length === 0) return []

  // Get latest date for reference
  const dates = hubData.map(item => String(item.date || '').split('T')[0]).filter(Boolean)
  if (dates.length === 0) return []
  
  const latestDate = new Date(dates.reduce((latest, current) => current > latest ? current : latest, dates[0]))
  
  // Calculate date ranges
  const l7dStart = new Date(latestDate)
  l7dStart.setDate(latestDate.getDate() - 6)
  const l7dEnd = new Date(latestDate)

  const p7dEnd = new Date(l7dStart)
  p7dEnd.setDate(p7dEnd.getDate() - 1)
  const p7dStart = new Date(p7dEnd)
  p7dStart.setDate(p7dEnd.getDate() - 6)

  const mtdStart = new Date(latestDate.getFullYear(), latestDate.getMonth(), 1)
  const mtdEnd = new Date(latestDate)

  // Helper to format dates for comparison
  const formatLocalDate = (date) => {
    const pad = (value) => String(value).padStart(2, '0')
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
  }

  const l7dStart_str = formatLocalDate(l7dStart)
  const l7dEnd_str = formatLocalDate(l7dEnd)
  const p7dStart_str = formatLocalDate(p7dStart)
  const p7dEnd_str = formatLocalDate(p7dEnd)
  const mtdStart_str = formatLocalDate(mtdStart)
  const mtdEnd_str = formatLocalDate(mtdEnd)

  // Filter data by periods
  const calculatePeriodAvg = (startDate, endDate) => {
    const filtered = hubData.filter(item => {
      const itemDate = String(item.date || '').split('T')[0]
      return itemDate >= startDate && itemDate <= endDate
    })

    if (filtered.length === 0) return null

    const totals = {
      success_rate: 0,
      riders: 0,
      delivered: 0,
      on_hold: 0,
      productivity: 0,
      clear_floor_rate: 0,
      scorecard: 0,
      count: 0
    }

    filtered.forEach(item => {
      totals.success_rate += Number(item.success_rate) || 0
      totals.riders += Number(item.riders) || 0
      totals.delivered += Number(item.delivered) || 0
      totals.on_hold += Number(item.on_hold) || 0
      totals.productivity += Number(item.productivity) || 0
      totals.clear_floor_rate += Number(item.clear_floor_rate) || 0
      totals.scorecard += Number(item.scorecard) || 0
      totals.count++
    })

    return {
      'Success Rate': totals.count > 0 ? Number(((totals.success_rate / totals.count) * 100).toFixed(1)) : 0,
      'Riders': totals.riders,
      'Delivered': totals.delivered,
      'On-Hold': totals.on_hold,
      'Productivity': totals.count > 0 ? Number((totals.productivity / totals.count).toFixed(1)) : 0,
      'Clear Floor Rate': totals.count > 0 ? Number((totals.clear_floor_rate / totals.count).toFixed(1)) : 0,
      'Scorecard': totals.count > 0 ? Number((totals.scorecard / totals.count).toFixed(1)) : 0
    }
  }

  const l7dAvg = calculatePeriodAvg(l7dStart_str, l7dEnd_str)
  const p7dAvg = calculatePeriodAvg(p7dStart_str, p7dEnd_str)
  const mtdAvg = calculatePeriodAvg(mtdStart_str, mtdEnd_str)

  const result = []
  if (l7dAvg) result.push({ period: 'Last 7 Days', ...l7dAvg })
  if (p7dAvg) result.push({ period: 'Prior 7 Days', ...p7dAvg })
  if (mtdAvg) result.push({ period: 'Month to Date', ...mtdAvg })

  return result
}, [dashboardMetrics, selectedHub, dashboardView])

  // Close hub dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (showHubDropdown && !event.target.closest('.hub-search-container')) {
        setShowHubDropdown(false)
      }
    }
    
    document.addEventListener('mousedown', handleClickOutside)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
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

  // Calculate Retention & Attrition metrics from riders data - filtered by hub and shared hub range filter
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

    // Only show metrics if a specific hub is selected
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

    // Filter by the selected hub
    let filteredRiders = ridersData.filter(r => r.operator_hub === selectedHub)

    // Calculate date range based on hubFromDate/hubToDate or global hub range filter
    let startDate, endDate
    
    if (hubFromDate && hubToDate) {
      // Use custom date range if set
      startDate = new Date(hubFromDate)
      endDate = new Date(hubToDate)
    } else if (hubDeliveryTrendRange && hubDeliveryTrendRange !== 'ALL') {
      const lastActiveDates = filteredRiders
        .map(r => r.last_active?.split('T')[0] || null)
        .filter(Boolean)
      const latestLastActive = getMaxDateString(lastActiveDates)
      const bounds = getRangeBounds(hubDeliveryTrendRange, latestLastActive)
      if (bounds.start && bounds.end) {
        startDate = parseDateString(bounds.start)
        endDate = parseDateString(bounds.end)
      } else {
        startDate = new Date(0)
        endDate = new Date()
      }
    } else {
      // No custom range and no shared hub range: use all available data
      startDate = new Date(0)
      endDate = new Date()
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

    // Helper function to determine if a rider is inactive (same logic as Rider.jsx)
    const isRiderInactive = (rider) => {
      if (!rider.last_active || rider.last_active === 'N/A') {
        return false // Can't determine without last_active date
      }
      
      const lastActiveDate = new Date(rider.last_active)
      const windowStart = new Date(lastActiveDate)
      windowStart.setDate(windowStart.getDate() + 1)
      const windowEnd = new Date(lastActiveDate)
      windowEnd.setDate(windowEnd.getDate() + 30)
      
      const referenceDate = new Date() // Today's date
      
      // Check if there are any performance records in the 30-day window
      const hasRecordInWindow = performanceRecords.some(record => {
        if (String(record.rider_id) !== String(rider.rider_id)) return false
        const recordDate = new Date(record.date)
        return recordDate >= windowStart && recordDate <= windowEnd
      })
      
      // Rider is inactive if: no records in window AND reference date is after the window
      return !hasRecordInWindow && referenceDate > windowEnd
    }

    const totalRiders = filteredRiders.length
    const inactiveRidersList = filteredRiders.filter(r => isRiderInactive(r))
    const inactiveRiders = inactiveRidersList.length
    const activeRiders = totalRiders - inactiveRiders
    const retentionRate = totalRiders > 0 ? Math.round((activeRiders / totalRiders) * 100 * 10) / 10 : 0
    const attritionRate = totalRiders > 0 ? Math.round((inactiveRiders / totalRiders) * 100 * 10) / 10 : 0

    // Get inactive riders for the breakdown table
    const attritionRiders = inactiveRidersList
      .map(r => ({
        id: r.rider_id,
        name: r.rider_name,
        lastActive: r.last_active || 'N/A',
        status: 'Inactive'
      }))

    return {
      totalRiders,
      activeRiders,
      inactiveRiders,
      retentionRate,
      attritionRate,
      attritionRiders
    }
  }, [ridersData, performanceRecords, selectedHub, selectedDate, hubFromDate, hubToDate, hubDeliveryTrendRange])

  // Calculate P7D vs L7D comparison data for Overall view using REAL data
  const getComparisonData = useMemo(() => {
    return () => {
      if (!selectedCluster) {
        return []
      }

      const assignedHubs = clusterLeaderHubMap[selectedCluster] || []
      if (assignedHubs.length === 0) {
        return []
      }

      const normalizeHub = (value) => String(value || '').trim().toLowerCase()
      const assignedHubSet = new Set(assignedHubs.map(normalizeHub))

      const clusterMetrics = dashboardMetrics.filter(item => assignedHubSet.has(normalizeHub(item.hub)))
      if (clusterMetrics.length === 0) {
        return []
      }

      const metricDates = clusterMetrics
        .map(item => item.date?.split('T')[0] || item.date)
        .filter(Boolean)
      const latestMetricDate = metricDates.length > 0
        ? new Date(Math.max(...metricDates.map(d => new Date(d).getTime())))
        : new Date()

      const l7dEnd = new Date(latestMetricDate)
      const l7dStart = new Date(latestMetricDate)
      l7dStart.setDate(l7dEnd.getDate() - 6)

      const p7dEnd = new Date(l7dStart)
      p7dEnd.setDate(p7dEnd.getDate() - 1)
      const p7dStart = new Date(p7dEnd)
      p7dStart.setDate(p7dEnd.getDate() - 6)

      const isInRange = (dateStr, start, end) => {
        const dateValue = new Date(String(dateStr || '').split('T')[0])
        return dateValue >= start && dateValue <= end
      }

      const kpiRecordsByHub = (hubNorm) => kpiData.filter(item => normalizeHub(item.operator_hub || item.hub) === hubNorm)
      const calcKpiAvg = (records, field) => {
        if (!records.length) return 0
        const sum = records.reduce((acc, item) => acc + (parseFloat(item[field]) || 0), 0)
        return Math.round(sum / records.length)
      }

      const avgMetric = (records, field, multiplier = 1) => {
        if (!records.length) return 0
        const sum = records.reduce((acc, item) => acc + ((Number(item[field]) || 0) * multiplier), 0)
        return Math.round(sum / records.length)
      }

      const avgRiderCount = (records) => {
        if (!records.length) return 0
        const sum = records.reduce((acc, item) => acc + (Number(item.riders) || 0), 0)
        return Math.round(sum / records.length)
      }

      const results = assignedHubs.map(hub => {
        const hubNorm = normalizeHub(hub)
        const hubMetrics = clusterMetrics.filter(item => normalizeHub(item.hub) === hubNorm)
        if (!hubMetrics.length) {
          return null
        }

        const l7dMetrics = hubMetrics.filter(item => isInRange(item.date, l7dStart, l7dEnd))
        const p7dMetrics = hubMetrics.filter(item => isInRange(item.date, p7dStart, p7dEnd))

        const hubKpiRecords = kpiRecordsByHub(hubNorm)
        const l7dKpi = hubKpiRecords.filter(item => isInRange(item.date, l7dStart, l7dEnd))
        const p7dKpi = hubKpiRecords.filter(item => isInRange(item.date, p7dStart, p7dEnd))

        const hubShortcuts = {
          'Villaba Leyte Hub': 'Villaba',
          'Calbiga Western Samar Hub': 'Calbiga',
          'Basey Western Samar Hub': 'Basey',
          'Alangalang Leyte Hub': 'Alangalang',
          'Carigara Leyte Hub': 'Carigara',
          'Palo Leyte Hub': 'Palo',
          'Ormoc Leyte Hub': 'Ormoc',
          'Tacloban Leyte Hub': 'Tacloban',
          'Baybay Leyte Hub': 'Baybay',
          'Burauen Leyte Hub': 'Burauen',
          'Cebu Hub': 'Cebu',
          'Mandaue Cebu Hub': 'Mandaue',
          'Lapu-Lapu Cebu Hub': 'Lapu-Lapu'
        }

        const cleanHub = hub.replace('OP ', '').replace(' Cebu Hub', ' Cebu')
        const shortHub = hubShortcuts[cleanHub] || cleanHub.split(' ')[0]

        return {
          hub: shortHub,
          cfrP7D: avgMetric(l7dMetrics, 'clear_floor_rate'),
          cfrL7D: avgMetric(p7dMetrics, 'clear_floor_rate'),
          srP7D: avgMetric(l7dMetrics, 'success_rate', 100),
          srL7D: avgMetric(p7dMetrics, 'success_rate', 100),
          kpiP7D: avgMetric(l7dMetrics, 'scorecard'),
          kpiL7D: avgMetric(p7dMetrics, 'scorecard'),
          prodP7D: avgMetric(l7dMetrics, 'productivity'),
          prodL7D: avgMetric(p7dMetrics, 'productivity'),
          lossP7D: calcKpiAvg(l7dKpi, 'loss'),
          lossL7D: calcKpiAvg(p7dKpi, 'loss'),
          ridersP7D: avgRiderCount(l7dMetrics),
          ridersL7D: avgRiderCount(p7dMetrics)
        }
      }).filter(Boolean)

      return results
    }
  }, [dashboardMetrics, kpiData, performanceRecords, selectedCluster, hubToClusterMap])
    
    // Debug the final comparison data array
    const comparisonData = getComparisonData()

  // Calculate Rider Level data: Individual riders with their metrics
  const riderLevelData = useMemo(() => {
    if (!selectedRider) {
      return []
    }

    const selectedRiderId = String(selectedRider)
    const riderInfo = ridersData.find(r => String(r.rider_id) === selectedRiderId || String(r.id) === selectedRiderId)
    if (!riderInfo) {
      return []
    }

    const sourceRecords = selectedRiderRecords.length > 0
      ? selectedRiderRecords
      : performanceRecords.filter(record => String(record.rider_id) === selectedRiderId)

    const filteredRecords = sourceRecords.filter(record => {
      const recordDate = record.date?.split('T')[0] || record.date
      if (!recordDate) return false
      if (riderFromDate && riderToDate) {
        return recordDate >= riderFromDate && recordDate <= riderToDate
      }
      if (riderTrendRange && riderTrendRange !== 'ALL') {
        const allDates = sourceRecords
          .map(r => r.date?.split('T')[0] || r.date)
          .filter(Boolean)
        const latestDateString = allDates.reduce((latest, current) => {
          return current > latest ? current : latest
        }, allDates[0] || '')

        if (latestDateString) {
          const parseDateString = (dateStr) => {
            const [year, month, day] = String(dateStr || '').split('-').map(Number)
            if (Number.isInteger(year) && Number.isInteger(month) && Number.isInteger(day)) {
              return new Date(year, month - 1, day)
            }
            return new Date(dateStr)
          }

          const formatLocalDate = (date) => {
            const pad = (value) => String(value).padStart(2, '0')
            return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
          }

          const latestDateObj = parseDateString(latestDateString)
          let rangeStart = new Date(latestDateObj)
          let rangeEnd = new Date(latestDateObj)

          if (riderTrendRange === 'L7D') {
            rangeStart.setDate(latestDateObj.getDate() - 6)
          } else if (riderTrendRange === 'P7D') {
            rangeEnd.setDate(latestDateObj.getDate() - 7)
            rangeStart = new Date(rangeEnd)
            rangeStart.setDate(rangeEnd.getDate() - 6)
          } else if (riderTrendRange === 'MTD') {
            rangeStart = new Date(latestDateObj.getFullYear(), latestDateObj.getMonth(), 1)
          }

          const formattedStart = formatLocalDate(rangeStart)
          const formattedEnd = formatLocalDate(rangeEnd)
          return recordDate >= formattedStart && recordDate <= formattedEnd
        }
      }
      if (selectedDate) {
        return recordDate === selectedDate
      }
      return true
    })

    const dateMetrics = filteredRecords.reduce((acc, record) => {
      const date = record.date?.split('T')[0] || record.date
      if (!date) return acc

      const delivered = parseInt(record.delivered) || 0
      const assigned = parseInt(record.assigned) || 0
      const onHold = parseInt(record.onhold) || 0

      if (!acc[date]) {
        acc[date] = { delivered: 0, assigned: 0, onHold: 0, recordCount: 0 }
      }

      acc[date].delivered += delivered
      acc[date].assigned += assigned
      acc[date].onHold += onHold
      acc[date].recordCount += 1
      return acc
    }, {})

    const trendEntries = Object.entries(dateMetrics)
      .sort((a, b) => a[0].localeCompare(b[0]))
      .slice(-7)
      .map(([date, metrics]) => ({ date, delivered: metrics.delivered, assigned: metrics.assigned, onHold: metrics.onHold }))

    const totalDelivered = Object.values(dateMetrics).reduce((sum, metrics) => sum + metrics.delivered, 0)
    const totalAssigned = Object.values(dateMetrics).reduce((sum, metrics) => sum + metrics.assigned, 0)
    const totalOnHold = Object.values(dateMetrics).reduce((sum, metrics) => sum + metrics.onHold, 0)
    const recordCount = Object.values(dateMetrics).reduce((sum, metrics) => sum + metrics.recordCount, 0)

    const successRate = totalAssigned > 0 ? (totalDelivered / totalAssigned) * 100 : 0
    const productivity = recordCount > 0 ? Math.round(totalAssigned / recordCount) : 0

    return [{
      riderId: selectedRiderId,
      riderName: riderInfo.rider_name || riderInfo.name || selectedRiderId,
      hub: riderInfo.operator_hub || 'Unknown',
      delivered: totalDelivered,
      onHold: totalOnHold,
      assigned: totalAssigned,
      successRate,
      productivity,
      trend: trendEntries
    }]
  }, [ridersData, selectedRider, selectedDate, riderFromDate, riderToDate, riderTrendRange, selectedRiderRecords, performanceRecords])

  // Calculate Rider Level chart data for Delivery Trend
  const riderLevelChartData = useMemo(() => {
    if (!selectedRider) {
      return []
    }

    const selectedRiderId = String(selectedRider)
    const sourceRecords = selectedRiderRecords.length > 0
      ? selectedRiderRecords
      : performanceRecords.filter(record => String(record.rider_id) === selectedRiderId)

    const selectedDateNorm = selectedDate ? selectedDate.split('T')[0] : ''
    const useCustomRange = riderFromDate && riderToDate
    const latestRecordDate = getMaxDateString(sourceRecords.map(record => record.date))
    const rangeBounds = (!useCustomRange && riderTrendRange && riderTrendRange !== 'ALL')
      ? getRangeBounds(riderTrendRange, latestRecordDate)
      : { start: '', end: '' }

    let filtered = sourceRecords.filter(record => {
      const recordDate = record.date?.split('T')[0] || record.date
      if (!recordDate) return false
      if (useCustomRange) {
        return recordDate >= riderFromDate && recordDate <= riderToDate
      }
      if (rangeBounds.start && rangeBounds.end) {
        return recordDate >= rangeBounds.start && recordDate <= rangeBounds.end
      }
      if (selectedDateNorm) {
        return recordDate === selectedDateNorm
      }
      return true
    })

    const uniqueDates = [...new Set(filtered.map(r => r.date?.split('T')[0] || r.date).filter(Boolean))].sort()

    const dateSet = new Set(uniqueDates)

    const dateMap = new Map()
    filtered.forEach(record => {
      const date = record.date?.split('T')[0] || record.date
      if (!date || !dateSet.has(date)) return

      const delivered = parseInt(record.delivered) || 0
      const onHold = parseInt(record.onhold) || 0
      const assigned = parseInt(record.assigned) || 0
      let value = 0

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

    return Array.from(dateMap.entries())
      .map(([date, value]) => ({ date, value }))
      .sort((a, b) => a.date.localeCompare(b.date))
  }, [performanceRecords, selectedRider, selectedRiderRecords, riderTrendMetric, riderFromDate, riderToDate, riderTrendRange])

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
      
      // For Hub Level: use From/To date range if set, otherwise calculate L7D range
      if (dashboardView === 'hub') {
        if (hubFromDate && hubToDate) {
          dateRangeStr = `${hubFromDate} to ${hubToDate}`
        } else if (selectedDate) {
          const endDate = new Date(selectedDate)
          const startDate = new Date(selectedDate)
          startDate.setDate(endDate.getDate() - 7)
          const formatDate = (d) => d.toISOString().split('T')[0]
          dateRangeStr = `${formatDate(startDate)} to ${formatDate(endDate)}`
        }
      } else if (dashboardView === 'rider' && selectedRider && riderLevelData.length > 0) {
        // Use From/To date range if set, otherwise use data range
        if (riderFromDate && riderToDate) {
          dateRangeStr = `${riderFromDate} to ${riderToDate}`
        } else if (riderLevelChartData && riderLevelChartData.length > 0) {
          const dates = riderLevelChartData.map(d => d.date).filter(d => d).sort()
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
        filterInfo = [`Cluster: ${selectedCluster || 'All Clusters'}`, `Date Range: ${dateRangeStr}`]
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
          { label: 'Cluster', value: selectedCluster || 'All' }
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

              // Calculate column widths for 4-column table
              const colWidthInactive = (pdfWidth - (margin * 2)) / 4

              pdf.setFillColor(168, 48, 48)
              pdf.rect(margin, startY - 6, pdfWidth - (margin * 2), 10, 'F')
              pdf.setTextColor(255, 255, 255)
              pdf.setFontSize(9)
              pdf.setFont(undefined, 'bold')
              pdf.text('ID', margin + 3, startY)
              pdf.text('Name', margin + colWidthInactive + 3, startY)
              pdf.text('Last Active', margin + (colWidthInactive * 2) + 3, startY)
              pdf.text('Status', margin + (colWidthInactive * 3) + 3, startY)
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
                pdf.text(String(rider.name || 'N/A'), margin + colWidthInactive + 3, startY)
                pdf.text(String(rider.lastActive), margin + (colWidthInactive * 2) + 3, startY)
                pdf.text(String(rider.status), margin + (colWidthInactive * 3) + 3, startY)
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

            // Daily trend data - filter by date range
            let trendData = rider.trend || []
            if (riderFromDate && riderToDate && trendData.length > 0) {
              trendData = trendData.filter(t => {
                const trendDate = t.date?.split('T')[0] || t.date
                return trendDate >= riderFromDate && trendDate <= riderToDate
              })
            }
            
            if (trendData.length > 0) {
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

              trendData.forEach((t, index) => {
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
            pdf.text(String(item.prodP7D), 145, startY)
            pdf.text(String(item.prodL7D), 170, startY)
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
          : `overall-dashboard-${selectedCluster || 'all-clusters'}-${new Date().toISOString().split('T')[0]}.pdf`

      // === FOOTER ===
      pdf.setTextColor(150, 150, 150)
      pdf.setFontSize(8)
      pdf.setFont(undefined, 'normal')
      pdf.text('--- End of Report ---', pdfWidth / 2, pageHeight - 10, { align: 'center' })

      pdf.save(filename)
    } catch (error) {
      console.error('Error exporting PDF:', error)
      showMessage('error', 'Failed to export PDF. Please try again.')
    }
  }, [dashboardView, filteredChartData, filteredRidersNoRoute, riderLevelData, getComparisonData, filteredStats, kpiGradeData, retentionMetrics, selectedHub, selectedCluster, selectedRider, selectedDate, riderFromDate, riderToDate, riderLevelChartData, showMessage])

  const COLORS = ['#a83030', '#c94c4c', '#e07e7e', '#f0b1b1', '#742a2a']

  if (loading) {
    return (
      <div className="space-y-4 relative">
        {/* Skeleton Loading Screen */}
        <SkeletonDashboard />
        {/* Progress Loader - Centered overlay */}
        <ProgressBarLoader progress={loadingProgress} loadingStage={loadingStage} />
      </div>
    )
  }

  return (
    <div className="space-y-4 relative">
      {/* Inline Message Notification */}
      {message.text && (
        <div className={`flex items-center gap-2 px-4 py-3 rounded-lg text-xs font-medium ${
          message.type === 'success' 
            ? 'bg-green-500/10 border border-green-500/30 text-green-400' 
            : message.type === 'error'
            ? 'bg-red-500/10 border border-red-500/30 text-red-400'
            : 'bg-yellow-500/10 border border-yellow-500/30 text-yellow-400'
        }`}>
          {message.type === 'success' && <CheckCircle className="w-4 h-4" />}
          {message.type === 'error' && <AlertCircle className="w-4 h-4" />}
          {message.type === 'warning' && <AlertTriangle className="w-4 h-4" />}
          {message.text}
        </div>
      )}

      {/* Grid Background Pattern */}
      <div className="fixed inset-0 pointer-events-none" style={{
        backgroundImage: `radial-gradient(circle, #334155 0.5px, transparent 0.5px)`,
        backgroundSize: '24px 24px',
        opacity: 0.15
      }}></div>
      
      {/* View Toggle */}
      <div className="bg-[hsl(220,20%,14%)] rounded-[14px] p-2 border border-[hsl(220,13%,30%)]">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setDashboardView('hub')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-[6px] text-[11px] font-medium transition-all duration-180 ${
                dashboardView === 'hub'
                  ? 'bg-[hsl(0,58%,42%)] text-white shadow-[0_2px_8px_rgba(0,0,0,0.05)]'
                  : 'text-[hsl(220,8%,55%)] hover:text-[hsl(220,15%,95%)] hover:bg-[hsl(220,18%,18%)]'
              }`}
            >
              <Building2 className="w-3.5 h-3.5" />
              Hub Level
            </button>
            <button
              onClick={() => setDashboardView('rider')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-[6px] text-[11px] font-medium transition-all duration-180 ${
                dashboardView === 'rider'
                  ? 'bg-[hsl(0,58%,42%)] text-white shadow-[0_2px_8px_rgba(0,0,0,0.05)]'
                  : 'text-[hsl(220,8%,55%)] hover:text-[hsl(220,15%,95%)] hover:bg-[hsl(220,18%,18%)]'
              }`}
            >
              <Users className="w-3.5 h-3.5" />
              Rider Level
            </button>
            <button
              onClick={() => setDashboardView('overall')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-[6px] text-[11px] font-medium transition-all duration-180 ${
                dashboardView === 'overall'
                  ? 'bg-[hsl(0,58%,42%)] text-white shadow-[0_2px_8px_rgba(0,0,0,0.05)]'
                  : 'text-[hsl(220,8%,55%)] hover:text-[hsl(220,15%,95%)] hover:bg-[hsl(220,18%,18%)]'
              }`}
            >
              <Globe className="w-3.5 h-3.5" />
              Overall
            </button>
          </div>
          <button
            onClick={handleExport}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-[hsl(220,18%,18%)] hover:bg-[hsl(220,13%,30%)] text-[hsl(220,15%,95%)] rounded-[6px] transition-all duration-180 font-medium text-[11px] hover:shadow-[0_1px_2px_rgba(0,0,0,0.04)]"
          >
            <Download className="w-3.5 h-3.5" />
            Export
          </button>
        </div>
      </div>

      {/* Filters Bar - Hub View */}
      {dashboardView === 'hub' && (
      <div className="bg-[hsl(220,20%,14%)] rounded-[14px] p-3 border border-[hsl(220,13%,30%)] shadow-[0_2px_8px_rgba(0,0,0,0.05)] z-50">
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-1.5 text-[hsl(220,8%,55%)]">
            <Filter className="w-3.5 h-3.5" />
            <span className="text-[11px] font-medium tracking-wide uppercase">Filters</span>
          </div>
          
          <div className="relative hub-search-container">
            <input 
              type="text"
              placeholder="Search hub..."
              value={hubSearchTerm}
              onChange={(e) => {
                const value = e.target.value
                setHubSearchTerm(value)
                if (value === '') {
                  setSelectedHub('')
                }
                setShowHubDropdown(true)
              }}
              onFocus={() => setShowHubDropdown(true)}
              className="bg-[hsl(220,18%,18%)] border border-[hsl(220,13%,30%)] rounded-[6px] px-2 py-1 text-[11px] text-[hsl(220,15%,95%)] focus:border-[hsl(0,58%,42%)] outline-none w-64"
            />
            {showHubDropdown && (
              <div className="absolute top-full left-0 mt-1 bg-[hsl(220,20%,14%)] border border-[hsl(220,13%,30%)] rounded-[10px] shadow-[0_4px_16px_rgba(0,0,0,0.07)] z-[99999] max-h-40 overflow-y-auto w-64">
                {filteredHubs.length > 0 ? (
                  filteredHubs.map(hub => (
                    <div
                      key={hub}
                      onClick={() => {
                        setSelectedHub(hub)
                        setHubSearchTerm(hub)
                        setShowHubDropdown(false)
                      }}
                      className="px-2 py-1 text-[11px] text-[hsl(220,15%,95%)] hover:bg-[hsl(220,18%,18%)] cursor-pointer"
                    >
                      {hub}
                    </div>
                  ))
                ) : (
                  <div className="px-2 py-1 text-[11px] text-[hsl(220,8%,55%)]">No hubs found</div>
                )}
              </div>
            )}
          </div>
          
          {/* From Date */}
          <div className="flex items-center gap-1.5">
            <span className="text-[11px] text-[hsl(220,8%,55%)]">From:</span>
            <input
              type="date"
              value={hubFromDate}
              onChange={(e) => setHubFromDate(e.target.value)}
              className="bg-[hsl(220,18%,18%)] border border-[hsl(220,13%,30%)] rounded-[6px] px-2 py-1 text-[11px] text-[hsl(220,15%,95%)] focus:border-[hsl(0,58%,42%)] outline-none"
            />
          </div>
          
          {/* To Date */}
          <div className="flex items-center gap-1.5">
            <span className="text-[11px] text-[hsl(220,8%,55%)]">To:</span>
            <input
              type="date"
              value={hubToDate}
              onChange={(e) => setHubToDate(e.target.value)}
              className="bg-[hsl(220,18%,18%)] border border-[hsl(220,13%,30%)] rounded-[6px] px-2 py-1 text-[11px] text-[hsl(220,15%,95%)] focus:border-[hsl(0,58%,42%)] outline-none"
            />
          </div>

          {/* Compare Dates */}
          <div className="flex items-center gap-1.5">
            <span className="text-[11px] text-[hsl(220,8%,55%)]">Compare:</span>
            <input
              type="date"
              value={hubCompareDateA}
              onChange={(e) => setHubCompareDateA(e.target.value)}
              className="bg-[hsl(220,18%,18%)] border border-[hsl(220,13%,30%)] rounded-[6px] px-2 py-1 text-[11px] text-[hsl(220,15%,95%)] focus:border-[hsl(0,58%,42%)] outline-none"
            />
            <input
              type="date"
              value={hubCompareDateB}
              onChange={(e) => setHubCompareDateB(e.target.value)}
              className="bg-[hsl(220,18%,18%)] border border-[hsl(220,13%,30%)] rounded-[6px] px-2 py-1 text-[11px] text-[hsl(220,15%,95%)] focus:border-[hsl(0,58%,42%)] outline-none"
            />
          </div>

          {/* Range Filter */}
          <div className="flex items-center gap-1.5">
            <span className="text-[11px] text-[hsl(220,8%,55%)]">Range:</span>
            <select
              value={hubDeliveryTrendRange}
              onChange={(e) => setHubDeliveryTrendRange(e.target.value)}
              className="bg-[hsl(220,18%,18%)] border border-[hsl(220,13%,30%)] rounded-[6px] px-2 py-1 text-[11px] text-[hsl(220,15%,95%)] focus:border-[hsl(0,58%,42%)] outline-none"
            >
              <option value="ALL">All Data</option>
              <option value="L7D">Last 7 Days</option>
              <option value="P7D">Prior 7 Days</option>
              <option value="MTD">Month to Date</option>
            </select>
          </div>
          
          {/* Refresh Button */}
          <button
            onClick={handleRefreshMetrics}
            disabled={isRefreshing}
            className="ml-auto flex items-center gap-1.5 px-3 py-1.5 bg-[hsl(142,76%,36%)] hover:bg-[hsl(142,76%,42%)] disabled:bg-[hsl(142,76%,25%)] text-white rounded-[6px] text-[11px] font-medium transition-all duration-180 hover:shadow-[0_1px_2px_rgba(0,0,0,0.04)] disabled:cursor-not-allowed"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
            {isRefreshing ? 'Refreshing...' : 'Refresh'}
          </button>
          
                  </div>
      </div>
      )}

      {/* Filters Bar for Rider Level View */}
      {dashboardView === 'rider' && (
      <div className="bg-[hsl(220,20%,14%)] rounded-[14px] p-3 border border-[hsl(220,13%,30%)] shadow-[0_2px_8px_rgba(0,0,0,0.05)] z-50">
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-1.5 text-[hsl(220,8%,55%)]">
            <Filter className="w-3.5 h-3.5" />
            <span className="text-[11px] font-medium tracking-wide uppercase">Filters</span>
          </div>

          <div className="relative rider-search-container">
            <input
              type="text"
              placeholder="Search rider..."
              value={riderSearchTerm}
              onChange={(e) => {
                const value = e.target.value
                setRiderSearchTerm(value)
                if (value === '') {
                  setSelectedRider('')
                }
                setShowRiderDropdown(true)
              }}
              onFocus={() => setShowRiderDropdown(true)}
              className="bg-[hsl(220,18%,18%)] border border-[hsl(220,13%,30%)] rounded-[6px] px-2 py-1 text-[11px] text-[hsl(220,15%,95%)] focus:border-[hsl(0,58%,42%)] outline-none w-64"
            />
            {showRiderDropdown && (
              <div className="absolute top-full left-0 mt-1 bg-[hsl(220,20%,14%)] border border-[hsl(220,13%,30%)] rounded-[10px] shadow-[0_4px_16px_rgba(0,0,0,0.07)] z-[99999] max-h-40 overflow-y-auto w-64">
                {filteredRiders.length > 0 ? (
                  filteredRiders.map(rider => (
                    <div
                      key={rider.id}
                      onClick={() => {
                        setSelectedRider(rider.id)
                        setRiderSearchTerm(rider.name)
                        setShowRiderDropdown(false)
                      }}
                      className="px-2 py-1 text-[11px] text-[hsl(220,15%,95%)] hover:bg-[hsl(220,18%,18%)] cursor-pointer"
                    >
                      {rider.name} ({rider.id})
                    </div>
                  ))
                ) : (
                  <div className="px-2 py-1 text-[11px] text-[hsl(220,8%,55%)]">No riders found</div>
                )}
              </div>
            )}
          </div>
          
          {/* From Date */}
          <div className="flex items-center gap-1.5">
            <span className="text-[11px] text-[hsl(220,8%,55%)]">From:</span>
            <input
              type="date"
              value={riderFromDate}
              onChange={(e) => setRiderFromDate(e.target.value)}
              className="bg-[hsl(220,18%,18%)] border border-[hsl(220,13%,30%)] rounded-[6px] px-2 py-1 text-[11px] text-[hsl(220,15%,95%)] focus:border-[hsl(0,58%,42%)] outline-none"
            />
          </div>
          
          {/* To Date */}
          <div className="flex items-center gap-1.5">
            <span className="text-[11px] text-[hsl(220,8%,55%)]">To:</span>
            <input
              type="date"
              value={riderToDate}
              onChange={(e) => setRiderToDate(e.target.value)}
              className="bg-[hsl(220,18%,18%)] border border-[hsl(220,13%,30%)] rounded-[6px] px-2 py-1 text-[11px] text-[hsl(220,15%,95%)] focus:border-[hsl(0,58%,42%)] outline-none"
            />
          </div>
          
          {/* Range Filter */}
          <div className="flex items-center gap-1.5">
            <span className="text-[11px] text-[hsl(220,8%,55%)]">Range:</span>
            <select
              value={riderTrendRange}
              onChange={(e) => setRiderTrendRange(e.target.value)}
              className="bg-[hsl(220,18%,18%)] border border-[hsl(220,13%,30%)] rounded-[6px] px-2 py-1 text-[11px] text-[hsl(220,15%,95%)] focus:border-[hsl(0,58%,42%)] outline-none"
            >
              <option value="ALL">All Data</option>
              <option value="L7D">Last 7 Days</option>
              <option value="P7D">Prior 7 Days</option>
              <option value="MTD">Month to Date</option>
            </select>
          </div>
          
          {/* Refresh Button */}
          <button
            onClick={handleRefreshMetrics}
            disabled={isRefreshing}
            className="ml-auto flex items-center gap-1.5 px-3 py-1.5 bg-[hsl(142,76%,36%)] hover:bg-[hsl(142,76%,42%)] disabled:bg-[hsl(142,76%,25%)] text-white rounded-[6px] text-[11px] font-medium transition-all duration-180 hover:shadow-[0_1px_2px_rgba(0,0,0,0.04)] disabled:cursor-not-allowed"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
            {isRefreshing ? 'Refreshing...' : 'Refresh'}
          </button>
          
          </div>
      </div>
      )}

      {/* Filters Bar for Overall View */}
      {dashboardView === 'overall' && (
      <div className="bg-[hsl(220,20%,14%)] rounded-[14px] p-3 border border-[hsl(220,13%,30%)] shadow-[0_2px_8px_rgba(0,0,0,0.05)] z-50">
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-1.5 text-[hsl(220,8%,55%)]">
            <Filter className="w-3.5 h-3.5" />
            <span className="text-[11px] font-medium tracking-wide uppercase">Filters</span>
          </div>
          
          {/* Cluster Filter */}
          <select
            value={selectedCluster}
            onChange={(e) => setSelectedCluster(e.target.value)}
            className="bg-[hsl(220,18%,18%)] border border-[hsl(220,13%,30%)] rounded-[6px] px-2 py-1 text-[11px] text-[hsl(220,15%,95%)] focus:border-[hsl(0,58%,42%)] outline-none w-64"
          >
            <option value="">All Clusters</option>
            {clusterLeaders.map(leader => (
              <option key={leader.id} value={leader.leader_name}>{leader.leader_name}</option>
            ))}
          </select>

          
          
          {/* Refresh Button */}
          <button
            onClick={handleRefreshMetrics}
            disabled={isRefreshing}
            className="ml-auto flex items-center gap-1.5 px-3 py-1.5 bg-[hsl(142,76%,36%)] hover:bg-[hsl(142,76%,42%)] disabled:bg-[hsl(142,76%,25%)] text-white rounded-[6px] text-[11px] font-medium transition-all duration-180 hover:shadow-[0_1px_2px_rgba(0,0,0,0.04)] disabled:cursor-not-allowed"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
            {isRefreshing ? 'Refreshing...' : 'Refresh'}
          </button>
          
        </div>
      </div>
      )}

      {/* KPI Stats Row - Symmetrical 7 Metrics - Hub Level Only */}
      {dashboardView === 'hub' && selectedHub && selectedHub !== 'All Hubs' && (
      <div className="flex gap-2">
        <CompactStatCard 
          title="Success Rate" 
          value={`${filteredStats.successRate || 0}%`} 
          icon={CheckCircle}
          accentColor="bg-green-600"
        />
        <CompactStatCard 
          title="Riders" 
          value={filteredStats.activeRiders?.toLocaleString() || '0'} 
          icon={Users}
          accentColor="bg-blue-600"
        />
        <CompactStatCard 
          title="Delivered" 
          value={filteredStats.delivered?.toLocaleString() || '0'} 
          icon={Package}
          accentColor="bg-emerald-600"
        />
        <CompactStatCard 
          title="On-Hold" 
          value={filteredStats.onHold?.toLocaleString() || '0'} 
          icon={PauseCircle}
          accentColor="bg-orange-600"
        />
        <CompactStatCard 
          title="Productivity" 
          value={`${filteredStats.productivity || 0}`} 
          icon={TrendingUp}
          accentColor="bg-cyan-600"
        />
        <CompactStatCard 
          title="Clear Floor" 
          value={`${filteredStats.clearFloorRate || 0}%`} 
          icon={Sparkles}
          accentColor="bg-indigo-600"
        />
        <CompactStatCard 
          title="Scorecard" 
          value={filteredStats.scorecard || '0.0'} 
          icon={Target}
          accentColor="bg-purple-600"
        />
      </div>
      )}

      {/* Charts Row - Horizontal Layout - Hub Level Only */}
      {dashboardView === 'hub' && (
      <div className="space-y-4">
        {/* Top Row: Delivery Trend and Graph Comparison */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Delivery Performance - Area/Bar Chart */}
          <div className="lg:col-span-2 relative bg-slate-800/80 backdrop-blur-sm rounded-lg p-3 border border-slate-600/50 hover:border-slate-500/50 transition-all duration-300 shadow-[0_0_20px_rgba(0,0,0,0.2)]">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <div className="w-1 h-4 bg-maroon-500 rounded-full shadow-[0_0_10px_rgba(168,48,48,0.5)]"></div>
                <h3 className="text-sm font-semibold text-white tracking-wide">Delivery Trend</h3>
              </div>
              <div className="flex items-center gap-2">
                {/* Tabs */}
                <div className="flex items-center gap-2">
                  <div className="flex bg-slate-700/50 rounded-lg p-1">
                    <button
                      onClick={() => setHubDeliveryTrendTab('chart')}
                      className={`px-3 py-1 rounded text-xs font-medium transition-all ${
                        hubDeliveryTrendTab === 'chart'
                          ? 'bg-maroon-500 text-white'
                          : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      Chart
                    </button>
                    <button
                      onClick={() => setHubDeliveryTrendTab('graph')}
                      className={`px-3 py-1 rounded text-xs font-medium transition-all ${
                        hubDeliveryTrendTab === 'graph'
                          ? 'bg-maroon-500 text-white'
                          : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      Graph
                    </button>
                  </div>
                </div>
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
              hubDeliveryTrendTab === 'chart' ? (
                (() => {
                  console.log('🎨 Rendering Delivery Trend Area chart with:', {
                    dataRows: filteredChartData.length,
                    selectedCategory,
                    firstRow: filteredChartData[0],
                    lastRow: filteredChartData[filteredChartData.length - 1]
                  })
                  return (
                    <AreaChart 
                      key={`area-${selectedHub}-${hubDeliveryTrendRange}-${selectedCategory}`}
                      data={filteredChartData}
                      margin={{ top: 10, right: 30, left: 0, bottom: 50 }}
                      isAnimationActive={true}
                      animationDuration={1200}
                    >
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
                        angle={0}
                        textAnchor="middle"
                        interval={0}
                        height={60}
                        tickFormatter={(value) => {
                          const date = new Date(value)
                          return Number.isNaN(date.getTime())
                            ? value
                            : date.toLocaleDateString('en-US', { weekday: 'long' })
                        }}
                      />
                      <YAxis 
                        stroke="#94a3b8" 
                        fontSize={9} 
                        tickLine={false} 
                        axisLine={false} 
                        width={50}
                        domain={chartDomain}
                        isAnimationActive={true}
                        animationDuration={1200}
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
                        fillOpacity={0.3} 
                        fill="url(#colorDeliveries)"
                        animationDuration={1200}
                        animationEasing="ease-in-out"
                        isAnimationActive={true}
                      >
                        <LabelList dataKey={selectedCategory} position="top" fill="#f87171" fontSize={8} />
                      </Area>
                      <Line
                        type="monotone"
                        dataKey={selectedCategory}
                        stroke="#f87171"
                        strokeWidth={2}
                        dot={false}
                        activeDot={{ r: 3, fill: '#f87171' }}
                        animationDuration={1200}
                        animationEasing="ease-in-out"
                        isAnimationActive={true}
                      />
                    </AreaChart>
                  )
                })()
              ) : (
                <BarChart 
                  key={`bar-${selectedHub}-${hubDeliveryTrendRange}-${selectedCategory}`} 
                  data={filteredChartData}
                  isAnimationActive={true}
                  animationDuration={1200}
                >
                  <defs>
                    <linearGradient id="colorBar" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#a83030" stopOpacity={0.8}/>
                      <stop offset="95%" stopColor="#a83030" stopOpacity={0.4}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.5} />
                  <XAxis 
                    dataKey="month" 
                    stroke="#94a3b8" 
                    fontSize={8} 
                    tickLine={false} 
                    axisLine={false}
                    interval={0}
                    angle={0}
                    textAnchor="middle"
                    height={40}
                    tickFormatter={(value) => {
                      const date = new Date(value)
                      return Number.isNaN(date.getTime())
                        ? value
                        : date.toLocaleDateString('en-US', { weekday: 'long' })
                    }}
                  />
                  <YAxis 
                    stroke="#94a3b8" 
                    fontSize={9} 
                    tickLine={false} 
                    axisLine={false} 
                    width={40}
                    domain={chartDomain}
                    isAnimationActive={true}
                    animationDuration={1200}
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
                  <Bar 
                    dataKey={selectedCategory}
                    fill="url(#colorBar)"
                    animationDuration={1200}
                    animationEasing="ease-in-out"
                    isAnimationActive={true}
                    radius={[4, 4, 0, 0]}
                  >
                    <LabelList dataKey={selectedCategory} position="top" fill="#f87171" fontSize={8} />
                  </Bar>
                </BarChart>
              )
            ) : (
              <div className="flex items-center justify-center h-full">
                <span className="text-slate-400 text-sm">
                  {dashboardView === 'hub' ? 'Select hub and date to view trend' : 'Select region and date to view trend'}
                </span>
              </div>
            )}
          </ResponsiveContainer>
            {hubDeliveryTrendDateLabel && (
              <div className="flex justify-center mt-3">
                <span className="text-slate-400 text-[12px] font-medium">
                  {hubDeliveryTrendDateLabel}
                </span>
              </div>
            )}
          </div>

          {/* Graph Comparison - Period Comparison Bar Chart */}
          <div className="relative bg-slate-800/80 backdrop-blur-sm rounded-lg p-3 border border-slate-600/50 hover:border-slate-500/50 transition-all duration-300 shadow-[0_0_20px_rgba(0,0,0,0.2)]">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <div className="w-1 h-4 bg-maroon-500 rounded-full shadow-[0_0_10px_rgba(168,48,48,0.5)]"></div>
                <h3 className="text-sm font-semibold text-white tracking-wide">Graph Comparison</h3>
              </div>
              {/* Category Filter for Comparison */}
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
            <ResponsiveContainer width="100%" height={320}>
              {hubLevelGraphComparison.length > 0 ? (
                <BarChart
                  data={hubLevelGraphComparison}
                  margin={{ top: 10, right: 30, left: 0, bottom: 30 }}
                  isAnimationActive={true}
                  animationDuration={1200}
                >
                  <defs>
                    <linearGradient id="colorCompare" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#a83030" stopOpacity={0.8}/>
                      <stop offset="95%" stopColor="#a83030" stopOpacity={0.4}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.5} />
                  <XAxis 
                    dataKey="period" 
                    stroke="#94a3b8" 
                    fontSize={8} 
                    tickLine={false} 
                    axisLine={false}
                    angle={-15}
                    textAnchor="end"
                    height={60}
                  />
                  <YAxis 
                    stroke="#94a3b8" 
                    fontSize={9} 
                    tickLine={false} 
                    axisLine={false} 
                    width={50}
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
                  <Bar 
                    dataKey={selectedCategory}
                    fill="url(#colorCompare)"
                    animationDuration={1200}
                    animationEasing="ease-in-out"
                    isAnimationActive={true}
                    radius={[4, 4, 0, 0]}
                  >
                    <LabelList dataKey={selectedCategory} position="top" fill="#f87171" fontSize={9} />
                  </Bar>
                </BarChart>
              ) : (
                <div className="flex items-center justify-center h-full">
                  <span className="text-slate-400 text-sm">
                    Select hub and date to view comparison
                  </span>
                </div>
              )}
            </ResponsiveContainer>
          </div>
        </div>

        {/* KPI Distribution Section - Full Width Below */}
        {selectedHub && selectedHub !== 'All Hubs' ? (
        <div className="relative bg-slate-800/80 backdrop-blur-sm rounded-lg p-3 border border-slate-600/50 hover:border-slate-500/50 transition-all duration-300 shadow-[0_0_20px_rgba(0,0,0,0.2)]">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-1 h-4 bg-maroon-500 rounded-full shadow-[0_0_10px_rgba(168,48,48,0.5)]"></div>
            <h3 className="text-sm font-semibold text-white tracking-wide">KPI Distribution</h3>
          </div>
          {kpiGradeData.length > 0 ? (
            <>
              <ResponsiveContainer width="100%" height={300}>
                <RadarChart cx="50%" cy="50%" outerRadius="55%" data={kpiGradeData}>
                  <PolarGrid stroke="#334155" />
                  <PolarAngleAxis
                    dataKey="name"
                    tick={{ fill: '#94a3b8', fontSize: 8 }}
                    tickFormatter={(value) => {
                      const item = kpiGradeData.find(kpi => kpi.name === value)
                      return item ? `${value} ${item.value}%` : value
                    }}
                  />
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
                  {kpiGradeData.map((kpi) => (
                    <div key={kpi.name} className="flex items-center justify-between bg-slate-700/30 rounded px-2 py-1">
                      <span className="text-slate-400 truncate">{kpi.name}</span>
                      <span className="text-white font-mono font-semibold">{kpi.value}%</span>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <div className="flex items-center justify-center rounded-lg bg-slate-800/80 border border-slate-600/50 p-6 text-center text-slate-400">
                No KPI distribution data available for this hub and selected range.
              </div>
            )}
        </div>
        ) : (
        <div className="flex items-center justify-center rounded-lg bg-slate-800/80 border border-slate-600/50 p-6 text-center text-slate-400">
          Select a hub to view KPI distribution.
        </div>
        )}
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
              {selectedHub && selectedHub !== 'All Hubs' ? filteredRidersNoRoute.length : 0}
            </span>
          </div>
          
          <div className="bg-slate-700/30 rounded-lg overflow-hidden backdrop-blur-sm border border-slate-600/30">
            <div className="max-h-[300px] overflow-y-auto scrollbar-thin scrollbar-thumb-slate-600 scrollbar-track-slate-800">
              {selectedHub && selectedHub !== 'All Hubs' ? (
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
                          <span className="text-slate-300 font-mono">{rider.deploymentDate}</span>
                        </td>
                        <td className="px-3 py-2 text-center">
                          <span className="text-emerald-400 font-mono">{rider.lastActive}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <div className="p-4 text-center text-slate-400 text-xs">Select a hub filter to view Riders No Route.</div>
              )}
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
            <p className="text-slate-500 text-[10px] text-right font-mono">{hubDeliveryTrendRange === 'ALL' ? 'All Dates' : hubDeliveryTrendRange === 'MTD' ? 'Month-to-Date' : hubDeliveryTrendRange === 'P7D' ? 'Prior 7 Days' : 'Last 7 Days'}</p>
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
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-maroon-500" />
                Delivery Trend
              </h3>
              {/* Tabs */}
              <div className="flex bg-slate-700/50 rounded-lg p-1">
                <button
                  onClick={() => setRiderDeliveryTrendTab('chart')}
                  className={`px-3 py-1 rounded text-xs font-medium transition-all ${
                    riderDeliveryTrendTab === 'chart'
                      ? 'bg-maroon-500 text-white'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Chart
                </button>
                <button
                  onClick={() => setRiderDeliveryTrendTab('graph')}
                  className={`px-3 py-1 rounded text-xs font-medium transition-all ${
                    riderDeliveryTrendTab === 'graph'
                      ? 'bg-maroon-500 text-white'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Graph
                </button>
              </div>
            </div>
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
          
          <div className="h-36">
            {riderLevelChartData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                {riderDeliveryTrendTab === 'chart' ? (
                  <AreaChart data={riderLevelChartData} margin={{ top: 24, right: 20, left: 0, bottom: 0 }}>
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
                      interval={0}
                      minTickGap={0}
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
                    >
                      <LabelList 
                        dataKey="value" 
                        position="top" 
                        dy={-8}
                        formatter={(value) => riderTrendMetric === 'successRate' ? `${value.toFixed(1)}%` : value}
                        fill="#ef4444" 
                        fontSize={10} 
                      />
                    </Area>
                  </AreaChart>
                ) : (
                  <BarChart data={riderLevelChartData} margin={{ top: 24, right: 20, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="riderBarGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor={riderTrendMetric === 'successRate' ? '#3b82f6' : riderTrendMetric === 'onHold' ? '#f59e0b' : riderTrendMetric === 'productivity' ? '#a855f7' : '#10b981'} stopOpacity={0.8}/>
                        <stop offset="95%" stopColor={riderTrendMetric === 'successRate' ? '#3b82f6' : riderTrendMetric === 'onHold' ? '#f59e0b' : riderTrendMetric === 'productivity' ? '#a855f7' : '#10b981'} stopOpacity={0.4}/>
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
                    <Bar 
                      dataKey="value"
                      fill="url(#riderBarGradient)"
                      radius={[4, 4, 0, 0]}
                    >
                      <LabelList 
                        dataKey="value" 
                        position="top" 
                        dy={-8}
                        formatter={(value) => riderTrendMetric === 'successRate' ? `${value.toFixed(1)}%` : value}
                        fill="#ef4444" 
                        fontSize={10} 
                      />
                    </Bar>
                  </BarChart>
                )}
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
          <h2 className="text-xl font-bold text-white">{selectedCluster || 'All Clusters'}</h2>
        </div>
        
        {/* Charts Grid - P7D vs L7D */}
        <div className="grid grid-cols-1 gap-4">
          {/* Avg KPI Chart */}
          <div className="relative bg-slate-800/80 backdrop-blur-sm rounded-lg p-4 border border-slate-600/50">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-white">AVG KPI</h3>
              <div className="flex items-center gap-3 text-xs">
                <div className="flex items-center gap-1">
                  <div className="w-3 h-3 bg-[#a83030] rounded"></div>
                  <span className="text-slate-300">P7D</span>
                </div>
                <div className="flex items-center gap-1">
                  <div className="w-3 h-3 bg-[#eb6262] rounded"></div>
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
                <Bar dataKey="kpiP7D" fill="#a83030" name="P7D" radius={[4, 4, 0, 0]}>
                  <LabelList dataKey="kpiP7D" position="top" formatter={(value) => `${value}%`} fill="#fff" fontSize={10} />
                </Bar>
                <Bar dataKey="kpiL7D" fill="#eb6262" name="L7D" radius={[4, 4, 0, 0]}>
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
                  <div className="w-3 h-3 bg-[#a83030] rounded"></div>
                  <span className="text-slate-300">P7D</span>
                </div>
                <div className="flex items-center gap-1">
                  <div className="w-3 h-3 bg-[#eb6262] rounded"></div>
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
                <Bar dataKey="cfrP7D" fill="#a83030" name="P7D" radius={[4, 4, 0, 0]}>
                  <LabelList dataKey="cfrP7D" position="top" formatter={(value) => `${value}%`} fill="#fff" fontSize={10} />
                </Bar>
                <Bar dataKey="cfrL7D" fill="#eb6262" name="L7D" radius={[4, 4, 0, 0]}>
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
                  <div className="w-3 h-3 bg-[#a83030] rounded"></div>
                  <span className="text-slate-300">P7D</span>
                </div>
                <div className="flex items-center gap-1">
                  <div className="w-3 h-3 bg-[#eb6262] rounded"></div>
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
                <Bar dataKey="srP7D" fill="#a83030" name="P7D" radius={[4, 4, 0, 0]}>
                  <LabelList dataKey="srP7D" position="top" formatter={(value) => `${value}%`} fill="#fff" fontSize={10} />
                </Bar>
                <Bar dataKey="srL7D" fill="#eb6262" name="L7D" radius={[4, 4, 0, 0]}>
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
                  <div className="w-3 h-3 bg-[#a83030] rounded"></div>
                  <span className="text-slate-300">P7D</span>
                </div>
                <div className="flex items-center gap-1">
                  <div className="w-3 h-3 bg-[#eb6262] rounded"></div>
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
                  domain={[0, 'auto']}
                  tickFormatter={(value) => String(value)}
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
                  formatter={(value) => [String(value), '']}
                />
                <Bar dataKey="prodP7D" fill="#a83030" name="P7D" radius={[4, 4, 0, 0]}>
                  <LabelList dataKey="prodP7D" position="top" formatter={(value) => String(value)} fill="#fff" fontSize={10} />
                </Bar>
                <Bar dataKey="prodL7D" fill="#eb6262" name="L7D" radius={[4, 4, 0, 0]}>
                  <LabelList dataKey="prodL7D" position="top" formatter={(value) => String(value)} fill="#fff" fontSize={10} />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Loss Chart */}
        <div className="relative bg-slate-800/80 backdrop-blur-sm rounded-lg p-4 border border-slate-600/50">
          <div className="flex items-center justify-between mb-4">
            <h4 className="text-sm font-medium text-slate-300">Loss </h4>
            <div className="flex gap-3 text-xs">
              <span className="flex items-center gap-1 text-[#a83030]">
                <span className="w-3 h-3 bg-[#a83030] rounded"></span>
                P7D
              </span>
              <span className="flex items-center gap-1 text-[#eb6262]">
                <span className="w-3 h-3 bg-[#eb6262] rounded"></span>
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
                <Bar dataKey="lossP7D" fill="#a83030" name="P7D" radius={[4, 4, 0, 0]}>
                  <LabelList dataKey="lossP7D" position="top" fill="#fff" fontSize={10} />
                </Bar>
                <Bar dataKey="lossL7D" fill="#eb6262" name="L7D" radius={[4, 4, 0, 0]}>
                  <LabelList dataKey="lossL7D" position="top" fill="#fff" fontSize={10} />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Rider Count Chart */}
        <div className="relative bg-slate-800/80 backdrop-blur-sm rounded-lg p-4 border border-slate-600/50">
          <div className="flex items-center justify-between mb-4">
            <h4 className="text-sm font-medium text-slate-300">Rider Count </h4>
            <div className="flex gap-3 text-xs">
              <span className="flex items-center gap-1 text-[#a83030]">
                <span className="w-3 h-3 bg-[#a83030] rounded"></span>
                P7D
              </span>
              <span className="flex items-center gap-1 text-[#eb6262]">
                <span className="w-3 h-3 bg-[#eb6262] rounded"></span>
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
                <Bar dataKey="ridersP7D" fill="#a83030" name="P7D" radius={[4, 4, 0, 0]}>
                  <LabelList dataKey="ridersP7D" position="top" fill="#fff" fontSize={10} />
                </Bar>
                <Bar dataKey="ridersL7D" fill="#eb6262" name="L7D" radius={[4, 4, 0, 0]}>
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
