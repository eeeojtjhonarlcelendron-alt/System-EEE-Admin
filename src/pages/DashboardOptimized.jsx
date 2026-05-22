import { useState, useMemo, useCallback } from 'react'
import { useRecentPerformanceData, useRecentKpiData, useRiderHubStats } from '../hooks'
import { getDashboardMetrics, getDashboardStats, getClusterLeaders } from '../lib/data'
import { 
  SkeletonDashboard,
  SkeletonStatsCard,
  SkeletonChart
} from '../components/Skeleton'
import { 
  TrendingUp, 
  Users, 
  Target, 
  Zap, 
  RefreshCw,
  ChevronLeft,
  ChevronRight
} from 'lucide-react'
import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer
} from 'recharts'

// Stat Card Component
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

function DashboardOptimized() {
  const [selectedHub, setSelectedHub] = useState('')
  const [selectedDate, setSelectedDate] = useState('')
  const [isRefreshing, setIsRefreshing] = useState(false)

  // Use optimized hooks with caching and pagination
  const { data: recentPerformanceData, isLoading: performanceLoading, error: performanceError } = useRecentPerformanceData(30, { hub: selectedHub })
  const { data: recentKpiData, isLoading: kpiLoading, error: kpiError } = useRecentKpiData(30, { operator_hub: selectedHub })
  const { data: hubStats, isLoading: hubStatsLoading } = useRiderHubStats()

  // Still need these for now (can be optimized later)
  const [dashboardMetrics, setDashboardMetrics] = useState([])
  const [stats, setStats] = useState({
    totalDeliveries: 0,
    successRate: 0,
    activeRiders: 0,
    avgKPI: 0
  })
  const [clusterLeaders, setClusterLeaders] = useState([])

  // Fetch remaining data on mount
  useState(() => {
    async function fetchInitialData() {
      try {
        const [metricsResult, statsResult, leadersResult] = await Promise.all([
          getDashboardMetrics(),
          getDashboardStats(),
          getClusterLeaders()
        ])

        if (metricsResult.data) setDashboardMetrics(metricsResult.data)
        if (statsResult.data) setStats(statsResult.data)
        if (leadersResult.data) setClusterLeaders(leadersResult.data)
      } catch (error) {
        console.error('Error fetching initial data:', error)
      }
    }
    fetchInitialData()
  })

  // Process performance data for charts
  const performanceChartData = useMemo(() => {
    if (!recentPerformanceData?.data) return []

    const groupedByDate = recentPerformanceData.data.reduce((acc, item) => {
      const date = item.date?.split('T')[0] || item.date
      if (!acc[date]) {
        acc[date] = { 
          date, 
          delivered: 0, 
          riders: 0,
          success_rate: 0,
          successRateCount: 0
        }
      }
      
      acc[date].delivered += parseInt(item.delivered) || 0
      acc[date].riders += parseInt(item.riders) || 0
      
      if (item.success_rate) {
        acc[date].success_rate += parseFloat(item.success_rate) * 100
        acc[date].successRateCount++
      }
      
      return acc
    }, {})
    
    return Object.values(groupedByDate)
      .sort((a, b) => new Date(a.date) - new Date(b.date))
      .slice(-12)
      .map(item => ({
        month: item.date?.slice(5) || item.date,
        'Delivered': item.delivered,
        'Success Rate': item.successRateCount > 0 ? Math.round(item.success_rate / item.successRateCount) : 0,
        'Riders': item.riders
      }))
  }, [recentPerformanceData])

  // Get unique hubs from hub stats
  const uniqueHubs = useMemo(() => {
    return hubStats?.data?.map(item => item.hub).filter(Boolean) || []
  }, [hubStats])

  // Handle refresh with optimized queries
  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true)
    try {
      // Refetch all queries
      await Promise.all([
        window.queryClient?.invalidateQueries(['recentPerformance']),
        window.queryClient?.invalidateQueries(['recentKpi']),
        window.queryClient?.invalidateQueries(['riderHubStats'])
      ])

      // Re-fetch static data
      const [metricsResult, statsResult] = await Promise.all([
        getDashboardMetrics(),
        getDashboardStats()
      ])

      if (metricsResult.data) setDashboardMetrics(metricsResult.data)
      if (statsResult.data) setStats(statsResult.data)
    } catch (error) {
      console.error('Error refreshing data:', error)
    } finally {
      setIsRefreshing(false)
    }
  }, [])

  const isLoading = performanceLoading || kpiLoading || hubStatsLoading

  if (isLoading && !recentPerformanceData && !recentKpiData && !hubStats) {
    return <SkeletonDashboard />
  }

  return (
    <div className="p-6 bg-slate-900 min-h-screen">
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold text-white">Performance Dashboard</h1>
        <button
          onClick={handleRefresh}
          disabled={isRefreshing}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
        >
          <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* Filters */}
      <div className="flex gap-4 mb-6">
        <select
          value={selectedHub}
          onChange={(e) => setSelectedHub(e.target.value)}
          className="px-4 py-2 bg-slate-800 text-white rounded-lg border border-slate-700 focus:border-blue-500 focus:outline-none"
        >
          <option value="">All Hubs</option>
          {uniqueHubs.map(hub => (
            <option key={hub} value={hub}>{hub}</option>
          ))}
        </select>
        
        <input
          type="date"
          value={selectedDate}
          onChange={(e) => setSelectedDate(e.target.value)}
          className="px-4 py-2 bg-slate-800 text-white rounded-lg border border-slate-700 focus:border-blue-500 focus:outline-none"
        />
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
        <StatCard
          title="Total Deliveries"
          value={stats.totalDeliveries?.toLocaleString() || '0'}
          icon={Target}
          accentColor="bg-blue-600"
        />
        <StatCard
          title="Success Rate"
          value={`${stats.successRate || 0}%`}
          icon={TrendingUp}
          accentColor="bg-green-600"
        />
        <StatCard
          title="Active Riders"
          value={stats.activeRiders?.toLocaleString() || '0'}
          icon={Users}
          accentColor="bg-purple-600"
        />
        <StatCard
          title="Average KPI"
          value={stats.avgKpi || '0'}
          icon={Zap}
          accentColor="bg-orange-600"
        />
      </div>

      {/* Performance Chart */}
      <div className="bg-slate-800 rounded-lg p-6 mb-6">
        <h2 className="text-xl font-semibold text-white mb-4">Performance Trend (Last 30 Days)</h2>
        {performanceChartData.length > 0 ? (
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={performanceChartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis dataKey="month" stroke="#9CA3AF" />
              <YAxis stroke="#9CA3AF" />
              <Tooltip 
                contentStyle={{ backgroundColor: '#1F2937', border: '1px solid #374151' }}
                labelStyle={{ color: '#F3F4F6' }}
              />
              <Line type="monotone" dataKey="Delivered" stroke="#3B82F6" strokeWidth={2} />
              <Line type="monotone" dataKey="Success Rate" stroke="#10B981" strokeWidth={2} />
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <div className="flex items-center justify-center h-64 text-slate-400">
            No performance data available
          </div>
        )}
      </div>

      {/* Hub Performance */}
      {hubStats?.data && (
        <div className="bg-slate-800 rounded-lg p-6">
          <h2 className="text-xl font-semibold text-white mb-4">Hub Performance</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {hubStats.data.slice(0, 9).map((hub, index) => (
              <div key={index} className="bg-slate-700 rounded-lg p-4">
                <h3 className="text-white font-medium mb-2">{hub.hub}</h3>
                <p className="text-slate-300 text-sm">Riders: {hub.riders}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

export default DashboardOptimized
