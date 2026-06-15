import { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import { supabase } from '../lib/supabase'
import jsPDF from 'jspdf'
import { 
  getDashboardMetrics,
  getDashboardStats,
  getRiderHubStats,
  getPerformanceRecordsPaginated,
  getPerformanceRecords,
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
  SkeletonSpinner
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
  Legend,
  LabelList,
  ReferenceLine
} from 'recharts'

const PDF_THEME = {
  maroon: [168, 48, 48],
  maroonLight: [235, 98, 98],
  ink: [51, 65, 85],
  muted: [100, 116, 139],
  line: [203, 213, 225],
  grid: [226, 232, 240],
  panel: [248, 250, 252],
  white: [255, 255, 255],
  blue: [59, 130, 246],
  amber: [245, 158, 11],
  purple: [168, 85, 247],
  green: [16, 185, 129]
}

const HUB_EXPORT_METRICS = [
  { key: 'Success Rate', label: 'Success Rate', suffix: '%' },
  { key: 'Riders', label: 'Riders' },
  { key: 'Delivered', label: 'Delivered' },
  { key: 'On-Hold', label: 'On-Hold' },
  { key: 'Productivity', label: 'Productivity' },
  { key: 'Clear Floor Rate', label: 'Clear Floor Rate', suffix: '%' },
  { key: 'Scorecard', label: 'Scorecard' }
]

const RIDER_EXPORT_METRICS = [
  { key: 'delivered', label: 'Delivered', color: PDF_THEME.green },
  { key: 'onHold', label: 'On-Hold', color: PDF_THEME.amber },
  { key: 'successRate', label: 'Success Rate', suffix: '%', color: PDF_THEME.blue },
  { key: 'productivity', label: 'Productivity', color: PDF_THEME.purple }
]

const OVERALL_EXPORT_CHARTS = [
  { title: 'AVG KPI', p7dKey: 'kpiP7D', l7dKey: 'kpiL7D', suffix: '%', max: 100 },
  { title: 'Clear Floor Rate', p7dKey: 'cfrP7D', l7dKey: 'cfrL7D', suffix: '%', max: 100 },
  { title: 'Success Rate', p7dKey: 'srP7D', l7dKey: 'srL7D', suffix: '%', max: 100 },
  { title: 'Productivity', p7dKey: 'prodP7D', l7dKey: 'prodL7D' },
  { title: 'Loss', p7dKey: 'lossP7D', l7dKey: 'lossL7D' },
  { title: 'Rider Count', p7dKey: 'ridersP7D', l7dKey: 'ridersL7D' }
]

const formatPdfNumber = (value, suffix = '') => {
  const numeric = Number(value)
  if (!Number.isFinite(numeric)) return suffix ? `0${suffix}` : '0'
  const rounded = Number.isInteger(numeric) ? numeric : Number(numeric.toFixed(1))
  return `${rounded}${suffix}`
}

const formatPdfDateLabel = (value) => {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return String(value)
  return date.toLocaleDateString('en-US', { weekday: 'short' })
}

const drawNoData = (pdf, x, y, width, height, title, message = 'No graph data available') => {
  pdf.setFillColor(...PDF_THEME.panel)
  pdf.roundedRect(x, y, width, height, 2, 2, 'F')
  pdf.setDrawColor(...PDF_THEME.line)
  pdf.roundedRect(x, y, width, height, 2, 2, 'S')
  pdf.setTextColor(...PDF_THEME.ink)
  pdf.setFontSize(10)
  pdf.setFont(undefined, 'bold')
  pdf.text(title, x + 5, y + 8)
  pdf.setTextColor(...PDF_THEME.muted)
  pdf.setFontSize(8)
  pdf.setFont(undefined, 'normal')
  pdf.text(message, x + width / 2, y + height / 2, { align: 'center' })
}

const drawChartTitle = (pdf, x, y, width, title, subtitle = '') => {
  pdf.setTextColor(...PDF_THEME.ink)
  pdf.setFontSize(10)
  pdf.setFont(undefined, 'bold')
  pdf.text(title, x + 5, y + 8)
  if (subtitle) {
    pdf.setTextColor(...PDF_THEME.muted)
    pdf.setFontSize(7)
    pdf.setFont(undefined, 'normal')
    pdf.text(String(subtitle), x + width - 5, y + 8, { align: 'right' })
  }
}

const drawChartShell = (pdf, x, y, width, height, title, subtitle = '') => {
  pdf.setFillColor(...PDF_THEME.white)
  pdf.roundedRect(x, y, width, height, 2, 2, 'F')
  pdf.setDrawColor(...PDF_THEME.line)
  pdf.roundedRect(x, y, width, height, 2, 2, 'S')
  drawChartTitle(pdf, x, y, width, title, subtitle)
}

const drawYAxisGrid = (pdf, plot, maxValue, suffix = '') => {
  const gridLines = 4
  pdf.setDrawColor(...PDF_THEME.grid)
  pdf.setTextColor(...PDF_THEME.muted)
  pdf.setFontSize(6)
  pdf.setFont(undefined, 'normal')

  for (let i = 0; i <= gridLines; i += 1) {
    const ratio = i / gridLines
    const y = plot.bottom - (plot.height * ratio)
    const value = maxValue * ratio
    pdf.line(plot.left, y, plot.right, y)
    pdf.text(formatPdfNumber(value, suffix), plot.left - 2, y + 1.5, { align: 'right' })
  }
}

const getChartMax = (data, keys, explicitMax) => {
  if (explicitMax) return explicitMax
  const values = data.flatMap(item => keys.map(key => Number(item[key]) || 0))
  const maxValue = Math.max(...values, 0)
  if (maxValue <= 0) return 10
  return Math.ceil(maxValue * 1.2)
}

const drawSingleBarChart = (pdf, { x, y, width, height, title, subtitle, data, xKey, yKey, suffix = '', color = PDF_THEME.maroon, max, target }) => {
  if (!data || data.length === 0) {
    drawNoData(pdf, x, y, width, height, title)
    return
  }

  drawChartShell(pdf, x, y, width, height, title, subtitle)
  const plot = {
    left: x + 18,
    right: x + width - 7,
    top: y + 18,
    bottom: y + height - 14
  }
  plot.width = plot.right - plot.left
  plot.height = plot.bottom - plot.top

  const maxValue = getChartMax(data, [yKey], max)
  drawYAxisGrid(pdf, plot, maxValue, suffix)

  // Draw target line if provided and valid
  const targetVal = Number(target)
  if (Number.isFinite(targetVal) && targetVal > 0 && maxValue > 0) {
    const targetY = plot.bottom - (Math.min(targetVal, maxValue) / maxValue) * plot.height
    pdf.setDrawColor(...PDF_THEME.green)
    pdf.setLineWidth(0.6)
    pdf.line(plot.left, targetY, plot.right, targetY)
    pdf.setFontSize(6)
    pdf.setTextColor(...PDF_THEME.green)
    pdf.text(formatPdfNumber(targetVal, suffix), plot.right + 3, targetY + 1.5, { align: 'left' })
    pdf.setTextColor(...PDF_THEME.ink)
    pdf.setLineWidth(0.4)
  }

  const gap = Math.max(1.5, plot.width / Math.max(data.length, 1) * 0.25)
  const barWidth = Math.max(2, (plot.width - gap * (data.length + 1)) / data.length)

  data.forEach((item, index) => {
    const value = Number(item[yKey]) || 0
    const barHeight = maxValue > 0 ? (value / maxValue) * plot.height : 0
    const barX = plot.left + gap + index * (barWidth + gap)
    const barY = plot.bottom - barHeight

    pdf.setFillColor(...color)
    pdf.rect(barX, barY, barWidth, barHeight, 'F')
    pdf.setTextColor(...PDF_THEME.ink)
    pdf.setFontSize(6)
    pdf.text(formatPdfNumber(value, suffix), barX + barWidth / 2, Math.max(plot.top + 4, barY - 2), { align: 'center' })

    if (index % Math.ceil(data.length / 8 || 1) === 0 || data.length <= 8) {
      pdf.setTextColor(...PDF_THEME.muted)
      pdf.setFontSize(5)
      pdf.text(formatPdfDateLabel(item[xKey]), barX + barWidth / 2, plot.bottom + 5, { align: 'center', angle: data.length > 8 ? 35 : 0 })
    }
  })
}

const drawLineChart = (pdf, { x, y, width, height, title, subtitle, data, xKey, yKey, suffix = '', color = PDF_THEME.maroon, max, target }) => {
  if (!data || data.length === 0) {
    drawNoData(pdf, x, y, width, height, title)
    return
  }

  drawChartShell(pdf, x, y, width, height, title, subtitle)
  const plot = {
    left: x + 18,
    right: x + width - 7,
    top: y + 18,
    bottom: y + height - 14
  }
  plot.width = plot.right - plot.left
  plot.height = plot.bottom - plot.top

  const maxValue = getChartMax(data, [yKey], max)
  drawYAxisGrid(pdf, plot, maxValue, suffix)

  // Draw target line if provided
  const targetVal = Number(target)
  if (Number.isFinite(targetVal) && targetVal > 0 && maxValue > 0) {
    const targetY = plot.bottom - (Math.min(targetVal, maxValue) / maxValue) * plot.height
    pdf.setDrawColor(...PDF_THEME.green)
    pdf.setLineWidth(0.6)
    pdf.line(plot.left, targetY, plot.right, targetY)
    pdf.setFontSize(6)
    pdf.setTextColor(...PDF_THEME.green)
    pdf.text(formatPdfNumber(targetVal, suffix), plot.right + 3, targetY + 1.5, { align: 'left' })
    pdf.setTextColor(...PDF_THEME.ink)
    pdf.setLineWidth(0.4)
  }

  const pointCount = data.length
  const step = pointCount > 1 ? plot.width / (pointCount - 1) : 0
  const points = data.map((item, index) => {
    const value = Number(item[yKey]) || 0
    return {
      x: pointCount > 1 ? plot.left + (index * step) : plot.left + plot.width / 2,
      y: plot.bottom - ((value / maxValue) * plot.height),
      value,
      label: item[xKey]
    }
  })

  pdf.setDrawColor(...color)
  pdf.setLineWidth(0.6)
  for (let i = 1; i < points.length; i += 1) {
    pdf.line(points[i - 1].x, points[i - 1].y, points[i].x, points[i].y)
  }

  points.forEach((point, index) => {
    pdf.setFillColor(...color)
    pdf.circle(point.x, point.y, 1.2, 'F')
    pdf.setTextColor(...PDF_THEME.ink)
    pdf.setFontSize(6)
    pdf.text(formatPdfNumber(point.value, suffix), point.x, Math.max(plot.top + 4, point.y - 3), { align: 'center' })

    if (index % Math.ceil(points.length / 8 || 1) === 0 || points.length <= 8) {
      pdf.setTextColor(...PDF_THEME.muted)
      pdf.setFontSize(5)
      pdf.text(formatPdfDateLabel(point.label), point.x, plot.bottom + 5, { align: 'center', angle: points.length > 8 ? 35 : 0 })
    }
  })
}

const drawGroupedBarChart = (pdf, { x, y, width, height, title, data, xKey, firstKey, secondKey, firstLabel = 'P7D', secondLabel = 'L7D', suffix = '', max, target }) => {
  if (!data || data.length === 0) {
    drawNoData(pdf, x, y, width, height, title)
    return
  }

  drawChartShell(pdf, x, y, width, height, title)
  const legendY = y + 8
  pdf.setFillColor(...PDF_THEME.maroon)
  pdf.rect(x + width - 34, legendY - 3, 3, 3, 'F')
  pdf.setFillColor(...PDF_THEME.maroonLight)
  pdf.rect(x + width - 18, legendY - 3, 3, 3, 'F')
  pdf.setTextColor(...PDF_THEME.muted)
  pdf.setFontSize(6)
  pdf.text(firstLabel, x + width - 30, legendY)
  pdf.text(secondLabel, x + width - 14, legendY)

  const plot = {
    left: x + 18,
    right: x + width - 7,
    top: y + 18,
    bottom: y + height - 16
  }
  plot.width = plot.right - plot.left
  plot.height = plot.bottom - plot.top

  const maxValue = getChartMax(data, [firstKey, secondKey], max)
  drawYAxisGrid(pdf, plot, maxValue, suffix)

  // Draw target line if provided
  const targetVal = Number(target)
  if (Number.isFinite(targetVal) && targetVal > 0 && maxValue > 0) {
    const targetY = plot.bottom - (Math.min(targetVal, maxValue) / maxValue) * plot.height
    pdf.setDrawColor(...PDF_THEME.green)
    pdf.setLineWidth(0.6)
    pdf.line(plot.left, targetY, plot.right, targetY)
    pdf.setFontSize(6)
    pdf.setTextColor(...PDF_THEME.green)
    pdf.text(formatPdfNumber(targetVal, suffix), plot.right + 3, targetY + 1.5, { align: 'left' })
    pdf.setTextColor(...PDF_THEME.ink)
    pdf.setLineWidth(0.4)
  }

  const groupGap = Math.max(2, plot.width / Math.max(data.length, 1) * 0.25)
  const groupWidth = Math.max(5, (plot.width - groupGap * (data.length + 1)) / data.length)
  const barWidth = groupWidth / 2.4

  data.forEach((item, index) => {
    const groupX = plot.left + groupGap + index * (groupWidth + groupGap)
    const values = [
      { key: firstKey, color: PDF_THEME.maroon, offset: 0 },
      { key: secondKey, color: PDF_THEME.maroonLight, offset: barWidth + 0.7 }
    ]

    values.forEach(series => {
      const value = Number(item[series.key]) || 0
      const barHeight = maxValue > 0 ? (value / maxValue) * plot.height : 0
      const barX = groupX + series.offset
      const barY = plot.bottom - barHeight
      pdf.setFillColor(...series.color)
      pdf.rect(barX, barY, barWidth, barHeight, 'F')
      pdf.setTextColor(...PDF_THEME.ink)
      pdf.setFontSize(5)
      pdf.text(formatPdfNumber(value, suffix), barX + barWidth / 2, Math.max(plot.top + 3, barY - 1.5), { align: 'center' })
    })

    pdf.setTextColor(...PDF_THEME.muted)
    pdf.setFontSize(5)
    pdf.text(String(item[xKey] || ''), groupX + groupWidth / 2, plot.bottom + 5, { align: 'center', angle: data.length > 5 ? 25 : 0 })
  })
}

const drawRadarChartPdf = (pdf, { x, y, width, height, title, data }) => {
  if (!data || data.length === 0) {
    drawNoData(pdf, x, y, width, height, title)
    return
  }

  drawChartShell(pdf, x, y, width, height, title)
  const centerX = x + width / 2
  const centerY = y + height / 2 + 6
  const radius = Math.min(width, height) * 0.27
  const levels = 4

  pdf.setDrawColor(...PDF_THEME.grid)
  for (let level = 1; level <= levels; level += 1) {
    const r = (radius * level) / levels
    const ring = data.map((_, index) => {
      const angle = (-Math.PI / 2) + (index * 2 * Math.PI) / data.length
      return [centerX + Math.cos(angle) * r, centerY + Math.sin(angle) * r]
    })
    for (let i = 0; i < ring.length; i += 1) {
      const next = ring[(i + 1) % ring.length]
      pdf.line(ring[i][0], ring[i][1], next[0], next[1])
    }
  }

  const points = data.map((item, index) => {
    const angle = (-Math.PI / 2) + (index * 2 * Math.PI) / data.length
    const outerX = centerX + Math.cos(angle) * radius
    const outerY = centerY + Math.sin(angle) * radius
    const valueRadius = radius * Math.max(0, Math.min(100, Number(item.value) || 0)) / 100
    const pointX = centerX + Math.cos(angle) * valueRadius
    const pointY = centerY + Math.sin(angle) * valueRadius

    pdf.line(centerX, centerY, outerX, outerY)
    pdf.setTextColor(...PDF_THEME.muted)
    pdf.setFontSize(6)
    pdf.text(`${item.name} ${formatPdfNumber(item.value, '%')}`, outerX, outerY, { align: outerX < centerX ? 'right' : 'left' })
    return [pointX, pointY]
  })

  pdf.setDrawColor(...PDF_THEME.maroon)
  pdf.setLineWidth(0.7)
  for (let i = 0; i < points.length; i += 1) {
    const next = points[(i + 1) % points.length]
    pdf.line(points[i][0], points[i][1], next[0], next[1])
  }
  points.forEach(point => {
    pdf.setFillColor(...PDF_THEME.maroon)
    pdf.circle(point[0], point[1], 1.2, 'F')
  })
}

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

function GraphComparisonPeriodLabel({ viewBox = {}, value }) {
  if (!value) return null

  const { x = 0, y = 0, width = 0, height = 0 } = viewBox
  const centerX = Number(x) + Number(width) / 2
  const labelY = Number(y) + Number(height) + 16

  if (![centerX, labelY].every(Number.isFinite)) return null

  return (
    <text
      x={centerX}
      y={labelY}
      className="recharts-text recharts-label"
      textAnchor="middle"
      fill="#cbd5e1"
      fontSize={10}
      fontWeight={600}
      pointerEvents="none"
    >
      <tspan x={centerX} dy="0em">{value}</tspan>
    </text>
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
  const [clusterSearchTerm, setClusterSearchTerm] = useState('')
  const [showClusterDropdown, setShowClusterDropdown] = useState(false)
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
  const [selectedCategory, setSelectedCategory] = useState('Cost Per Parcel')
  const [dashboardView, setDashboardView] = useState('hub') // 'hub', 'rider', or 'overall'
  const [hubViewMode, setHubViewMode] = useState('performance') // 'performance' or 'kpi'
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
  const [targets, setTargets] = useState({}) // Target percentages from localStorage
  const dashboardFetchStartedRef = useRef(false)

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

  // Load targets from localStorage
  useEffect(() => {
    const loadTargets = () => {
      try {
        const stored = localStorage.getItem('dashboard_targets')
        if (stored) {
          setTargets(JSON.parse(stored))
        }
      } catch (error) {
        console.error('Error loading targets:', error)
      }
    }
    loadTargets()
  }, [])

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

  const formatCompactDateTick = (value) => {
    const date = parseDateString(value)
    if (!date) return value
    return `${date.getMonth() + 1}-${date.getDate()}`
  }

  const getMaxDateString = (values) => {
    return values
      .map(value => String(value || '').split('T')[0])
      .filter(Boolean)
      .sort()
      .pop() || ''
  }

  const parseKpiNumber = (value) => {
    if (value === null || value === undefined || value === '') return 0
    const numeric = Number(String(value).replace(/%/g, '').trim())
    if (!Number.isFinite(numeric)) return 0
    return numeric > 0 && numeric <= 1 ? numeric * 100 : numeric
  }

  const mapKpiTrendRow = (item) => ({
    'Scorecard': item.count > 0 ? roundGraphValue(item.score / item.count) : 0,
    'LM Clear Floor Rate Ach %': item.cfrCount > 0 ? roundGraphValue(item.cfr / item.cfrCount) : 0,
    'Delivery Success Rate Actual': item.srCount > 0 ? roundGraphValue(item.sr / item.srCount) : 0,
    'Line Haul Pick-up Compliance Ach %': item.lineHaulCount > 0 ? roundGraphValue(item.line_haul_compliance / item.lineHaulCount) : 0,
    'COD Compliance Ach %': item.codCount > 0 ? roundGraphValue(item.cod_remittance / item.codCount) : 0,
    'Process Compliance Ach %': item.eodCount > 0 ? roundGraphValue(item.eod_compliance / item.eodCount) : 0,
    'RTS % Ach %': item.rtsCount > 0 ? roundGraphValue(item.rts / item.rtsCount) : 0,
    'Loss % Ach %': item.lossCount > 0 ? roundGraphValue(item.loss / item.lossCount) : 0,
    'Expedite Delivery Performance Ach %': item.expediteCount > 0 ? roundGraphValue(item.expedite / item.expediteCount) : 0
  })

  const aggregateKpiRowsByDate = (rows) => {
    const aggregated = {}
    ;(rows || []).forEach(item => {
      const date = String(item.date || '').split('T')[0]
      if (!date) return

      if (!aggregated[date]) {
        aggregated[date] = {
          date,
          count: 0,
          score: 0,
          scoreCount: 0,
          cfr: 0,
          cfrCount: 0,
          sr: 0,
          srCount: 0,
          line_haul_compliance: 0,
          lineHaulCount: 0,
          cod_remittance: 0,
          codCount: 0,
          eod_compliance: 0,
          eodCount: 0,
          rts: 0,
          rtsCount: 0,
          loss: 0,
          lossCount: 0,
          expedite: 0,
          expediteCount: 0
        }
      }

      const entry = aggregated[date]
      const scoreValue = parseKpiNumber(item.score)
      if (item.score !== undefined && item.score !== null && String(item.score).trim() !== '') {
        entry.score += scoreValue
        entry.scoreCount += 1
      }
      const cfrValue = parseKpiNumber(item.cfr)
      if (item.cfr !== undefined && item.cfr !== null && String(item.cfr).trim() !== '') {
        entry.cfr += cfrValue
        entry.cfrCount += 1
      }
      const srValue = parseKpiNumber(item.sr)
      if (item.sr !== undefined && item.sr !== null && String(item.sr).trim() !== '') {
        entry.sr += srValue
        entry.srCount += 1
      }
      const lineHaulValue = parseKpiNumber(item.line_haul_compliance)
      if (item.line_haul_compliance !== undefined && item.line_haul_compliance !== null && String(item.line_haul_compliance).trim() !== '') {
        entry.line_haul_compliance += lineHaulValue
        entry.lineHaulCount += 1
      }
      const codValue = parseKpiNumber(item.cod_remittance)
      if (item.cod_remittance !== undefined && item.cod_remittance !== null && String(item.cod_remittance).trim() !== '') {
        entry.cod_remittance += codValue
        entry.codCount += 1
      }
      const eodValue = parseKpiNumber(item.eod_compliance)
      if (item.eod_compliance !== undefined && item.eod_compliance !== null && String(item.eod_compliance).trim() !== '') {
        entry.eod_compliance += eodValue
        entry.eodCount += 1
      }
      const rtsValue = parseKpiNumber(item['RTS % Ach %'] ?? item.rts)
      if ((item['RTS % Ach %'] !== undefined && item['RTS % Ach %'] !== null && String(item['RTS % Ach %']).trim() !== '') ||
          (item.rts !== undefined && item.rts !== null && String(item.rts).trim() !== '')) {
        entry.rts += rtsValue
        entry.rtsCount += 1
      }
      const lossValue = parseKpiNumber(item['Loss % Ach %'] ?? item.loss)
      if ((item['Loss % Ach %'] !== undefined && item['Loss % Ach %'] !== null && String(item['Loss % Ach %']).trim() !== '') ||
          (item.loss !== undefined && item.loss !== null && String(item.loss).trim() !== '')) {
        entry.loss += lossValue
        entry.lossCount += 1
      }
      const expediteValue = parseKpiNumber(item['Expedite Delivery Performance Ach %'] ?? item['Expedite Delivery Performance Ach Percent'] ?? item['Expedite Delivery Performance'] ?? item.expedite)
      if ((item['Expedite Delivery Performance Ach %'] !== undefined && item['Expedite Delivery Performance Ach %'] !== null && String(item['Expedite Delivery Performance Ach %']).trim() !== '') ||
          (item['Expedite Delivery Performance Ach Percent'] !== undefined && item['Expedite Delivery Performance Ach Percent'] !== null && String(item['Expedite Delivery Performance Ach Percent']).trim() !== '') ||
          (item['Expedite Delivery Performance'] !== undefined && item['Expedite Delivery Performance'] !== null && String(item['Expedite Delivery Performance']).trim() !== '') ||
          (item.expedite !== undefined && item.expedite !== null && String(item.expedite).trim() !== '')) {
        entry.expedite += expediteValue
        entry.expediteCount += 1
      }
      entry.count += 1
    })

    return Object.values(aggregated).sort((a, b) => a.date.localeCompare(b.date))
  }

  const calculateKpiPeriodAverages = (rows) => {
    const aggregated = aggregateKpiRowsByDate(rows)
    if (!aggregated.length) return null

    const totals = KPI_TREND_OPTIONS.reduce((acc, key) => {
      acc[key] = 0
      return acc
    }, {})

    aggregated.forEach(item => {
      const mapped = mapKpiTrendRow(item)
      KPI_TREND_OPTIONS.forEach(key => {
        totals[key] += mapped[key]
      })
    })

    const count = aggregated.length
    return KPI_TREND_OPTIONS.reduce((acc, key) => {
      acc[key] = count > 0 ? roundGraphValue(totals[key] / count) : 0
      return acc
    }, {})
  }

  const buildKpiSevenDayComparisonData = (hubRows, selectedCategory) => {
    const latestDateString = getMaxDateString(hubRows.map(item => String(item.date || '').split('T')[0]))
    if (!latestDateString) return []

    const lastRange = getRangeBounds('L7D', latestDateString)
    const priorRange = getRangeBounds('P7D', latestDateString)

    const lastAggregated = aggregateKpiRowsByDate(hubRows.filter(item => {
      const itemDate = String(item.date || '').split('T')[0]
      return itemDate >= lastRange.start && itemDate <= lastRange.end
    }))

    const priorAggregated = aggregateKpiRowsByDate(hubRows.filter(item => {
      const itemDate = String(item.date || '').split('T')[0]
      return itemDate >= priorRange.start && itemDate <= priorRange.end
    }))

    const priorByIndex = new Map(priorAggregated.map((item, index) => [index, mapKpiTrendRow(item)]))
    const currentLabel = formatShortRangeLabel(lastRange.start, lastRange.end)
    const priorLabel = formatShortRangeLabel(priorRange.start, priorRange.end)

    return lastAggregated.map((item, originalIndex) => {
      const current = mapKpiTrendRow(item)
      const prior = priorByIndex.get(originalIndex) || {}
      const date = parseDateString(item.date)
      return {
        month: date ? date.toLocaleDateString('en-US', { weekday: 'short' }) : item.date,
        currentPeriod: current[selectedCategory] || 0,
        priorPeriod: prior[selectedCategory] || 0,
        currentLabel,
        priorLabel
      }
    })
  }

  const buildKpiGraphComparisonData = (hubRows, selectedCategory) => {
    const dates = hubRows.map(item => String(item.date || '').split('T')[0]).filter(Boolean)
    if (!dates.length) return []

    const latestDate = new Date(dates.reduce((latest, current) => current > latest ? current : latest, dates[0]))
    const l7dStart = new Date(latestDate)
    l7dStart.setDate(latestDate.getDate() - 6)
    const l7dEnd = new Date(latestDate)

    const p7dEnd = new Date(l7dStart)
    p7dEnd.setDate(p7dEnd.getDate() - 1)
    const p7dStart = new Date(p7dEnd)
    p7dStart.setDate(p7dEnd.getDate() - 6)

    const mtdStart = new Date(latestDate.getFullYear(), latestDate.getMonth(), 1)

    const formatLocalDate = (date) => {
      const pad = (value) => String(value).padStart(2, '0')
      return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
    }

    const calculateAverage = (startDate, endDate) => {
      const filtered = hubRows.filter(item => {
        const itemDate = String(item.date || '').split('T')[0]
        return itemDate >= startDate && itemDate <= endDate
      })
      if (!filtered.length) return null
      return calculateKpiPeriodAverages(filtered)
    }

    const l7dAvg = calculateAverage(formatLocalDate(l7dStart), formatLocalDate(l7dEnd))
    const p7dAvg = calculateAverage(formatLocalDate(p7dStart), formatLocalDate(p7dEnd))
    const mtdAvg = calculateAverage(formatLocalDate(mtdStart), formatLocalDate(latestDate))

    const result = []
    if (l7dAvg) result.push({ period: 'Last 7 Days', selectedValue: l7dAvg[selectedCategory] || 0, ...l7dAvg })
    if (p7dAvg) result.push({ period: 'Prior 7 Days', selectedValue: p7dAvg[selectedCategory] || 0, ...p7dAvg })
    if (mtdAvg) result.push({ period: 'Month to Date', selectedValue: mtdAvg[selectedCategory] || 0, ...mtdAvg })
    return result
  }

  const formatShortRangeLabel = (startDate, endDate) => {
    const formatPart = (dateStr) => {
      const date = parseDateString(dateStr)
      if (!date) return dateStr
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    }
    return `${formatPart(startDate)} to ${formatPart(endDate)}`
  }

  const getRangeBounds = (rangeType, latestDateString) => {
    const latestDate = parseDateString(latestDateString)
    if (!latestDate || rangeType === 'ALL') return { start: '', end: '' }

    let start = new Date(latestDate)
    const end = new Date(latestDate)

    if (rangeType === 'L7D') {
      start.setDate(start.getDate() - 6)
    } else if (rangeType === 'P7D') {
      end.setDate(end.getDate() - 7)
      start = new Date(end)
      start.setDate(start.getDate() - 6)
    } else if (rangeType === 'MTD') {
      start.setDate(1)
    }

    return {
      start: formatDateString(start),
      end: formatDateString(end)
    }
  }

  const getHubMetricDateRange = ({ selectedHub, hubFromDate, hubToDate, selectedDate, hubDeliveryTrendRange, metricRows }) => {
    if (hubFromDate && hubToDate) {
      return { start: hubFromDate, end: hubToDate }
    }

    if (selectedDate) {
      return { start: selectedDate, end: selectedDate }
    }

    if (hubDeliveryTrendRange && hubDeliveryTrendRange !== 'ALL') {
      const rows = Array.isArray(metricRows) ? metricRows : dashboardMetrics
      const selectedHubNorm = String(selectedHub || '').trim().toLowerCase()
      const filteredRows = selectedHub
        ? rows.filter(item => String((item.operator_hub || item.hub || '')).trim().toLowerCase() === selectedHubNorm)
        : rows
      const latestMetricDate = getMaxDateString(filteredRows.map(item => item.date?.split('T')[0] || item.date))
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

  const KPI_TREND_OPTIONS = [
    'Scorecard',
    'LM Clear Floor Rate Ach %',
    'Delivery Success Rate Actual',
    'Line Haul Pick-up Compliance Ach %',
    'COD Compliance Ach %',
    'Process Compliance Ach %',
    'RTS % Ach %',
    'Loss % Ach %',
    'Expedite Delivery Performance Ach %'
  ]

  const PERFORMANCE_TREND_OPTIONS = [
    'Cost Per Parcel',
    'Delivered Ado',
    'Dispatched Ado',
    'Success Rate',
    'Delivered Prod',
    'Assigned Prod',
    'Fleet Count'
  ]

  const roundGraphValue = (value) => {
    const numeric = Number(value)
    return Number.isFinite(numeric) ? Math.round(numeric) : 0
  }

  const getHubLevelTopKpisForExport = () => {
    const normalizeHub = v => String(v || '').trim().toLowerCase()
    const selectedHubNorm = normalizeHub(selectedHub)

    let perf = Array.isArray(performanceRecords) ? performanceRecords.slice() : []
    let metrics = Array.isArray(dashboardMetrics) ? dashboardMetrics.slice() : []
    let kpi = Array.isArray(kpiData) ? kpiData.slice() : []

    if (selectedHub && selectedHub !== 'All Hubs') {
      perf = perf.filter(p => normalizeHub(p.hub) === selectedHubNorm)
      metrics = metrics.filter(m => normalizeHub(m.hub) === selectedHubNorm)
      kpi = kpi.filter(k => normalizeHub(k.operator_hub || k.hub) === selectedHubNorm)
    }

    if (hubFromDate && hubToDate) {
      perf = perf.filter(p => (p.date?.split('T')[0] || p.date) >= hubFromDate && (p.date?.split('T')[0] || p.date) <= hubToDate)
      metrics = metrics.filter(m => (m.date?.split('T')[0] || m.date) >= hubFromDate && (m.date?.split('T')[0] || m.date) <= hubToDate)
      kpi = kpi.filter(k => (k.date?.split('T')[0] || k.date) >= hubFromDate && (k.date?.split('T')[0] || k.date) <= hubToDate)
    } else if (selectedDate) {
      perf = perf.filter(p => (p.date?.split('T')[0] || p.date) === selectedDate)
      metrics = metrics.filter(m => (m.date?.split('T')[0] || m.date) === selectedDate)
      kpi = kpi.filter(k => (k.date?.split('T')[0] || k.date) === selectedDate)
    } else if (hubDeliveryTrendRange && hubDeliveryTrendRange !== 'ALL') {
      const metricRange = getHubMetricDateRange({
        selectedHub,
        hubFromDate,
        hubToDate,
        selectedDate,
        hubDeliveryTrendRange,
        metricRows: hubViewMode === 'kpi' ? kpi : metrics
      })
      if (metricRange && metricRange.start && metricRange.end) {
        perf = perf.filter(p => (p.date?.split('T')[0] || p.date) >= metricRange.start && (p.date?.split('T')[0] || p.date) <= metricRange.end)
        metrics = metrics.filter(m => (m.date?.split('T')[0] || m.date) >= metricRange.start && (m.date?.split('T')[0] || m.date) <= metricRange.end)
        kpi = kpi.filter(k => (k.date?.split('T')[0] || k.date) >= metricRange.start && (k.date?.split('T')[0] || k.date) <= metricRange.end)
      } else {
        perf = []
        metrics = []
        kpi = []
      }
    }

    let costSum = 0, costCount = 0
    let delAdo = 0, dispAdo = 0, deliveredTotal = 0, assignedTotal = 0
    let prodSum = 0, prodCount = 0
    let fleetSum = 0, fleetCount = 0

    const activeRecords = hubViewMode === 'kpi' ? kpi : perf
    if (activeRecords.length > 0) {
      activeRecords.forEach(r => {
        const cp = Number(r.cost_per_parcel) || 0
        if (cp > 0) { costSum += cp; costCount++ }
        delAdo += Number(r.delivered_ado) || 0
        dispAdo += Number(r.dispatched_ado) || 0
        deliveredTotal += Number(r.delivered) || 0
        assignedTotal += Number(r.assigned) || 0
        prodSum += Number(r.productivity) || 0
        if (Number(r.fleet_count)) { fleetSum += Number(r.fleet_count); fleetCount++ }
      })
    } else if (metrics.length > 0) {
      metrics.forEach(m => {
        const cp = Number(m.cost_per_parcel) || 0
        if (cp > 0) { costSum += cp; costCount++ }
        delAdo += Number(m.delivered_ado) || 0
        dispAdo += Number(m.dispatched_ado) || 0
        deliveredTotal += Number(m.delivered) || 0
        assignedTotal += Number(m.productivity) || 0
        prodSum += Number(m.productivity) || 0
        prodCount++
        if (Number(m.fleet_count)) { fleetSum += Number(m.fleet_count); fleetCount++ }
      })
    }

    const costPerParcel = costCount > 0 ? Math.round(costSum / costCount) : 0
    const deliveredAdo = Math.round(delAdo)
    const dispatchedAdo = Math.round(dispAdo)
    const deliveredProd = (perf.length > 0 || metrics.length > 0) ? Math.round(deliveredTotal / Math.max(1, (perf.length || metrics.length))) : 0
    const assignedProd = perf.length > 0 ? Math.round(assignedTotal / Math.max(1, perf.length)) : (prodCount > 0 ? Math.round(prodSum / prodCount) : 0)
    const fleetCountAvg = fleetCount > 0 ? Math.round(fleetSum / fleetCount) : 0

    if (hubViewMode === 'kpi') {
      let scoreSum = 0, scoreCount = 0
      let cfrSum = 0, cfrCount = 0
      let srSum = 0, srCount = 0
      let lineHaulSum = 0, lineHaulCount = 0
      let codSum = 0, codCount = 0
      let eodSum = 0, eodCount = 0
      let rtsSum = 0, rtsCount = 0
      let lossSum = 0, lossCount = 0
      let expediteSum = 0, expediteCount = 0

      kpi.forEach(record => {
        const scoreValue = parseKpiNumber(record.score)
        if (record.score !== undefined && record.score !== null && String(record.score).trim() !== '') { scoreSum += scoreValue; scoreCount += 1 }
        const cfrValue = parseKpiNumber(record.cfr)
        if (record.cfr !== undefined && record.cfr !== null && String(record.cfr).trim() !== '') { cfrSum += cfrValue; cfrCount += 1 }
        const srValue = parseKpiNumber(record.sr)
        if (record.sr !== undefined && record.sr !== null && String(record.sr).trim() !== '') { srSum += srValue; srCount += 1 }
        const lineHaulValue = parseKpiNumber(record.line_haul_compliance)
        if (record.line_haul_compliance !== undefined && record.line_haul_compliance !== null && String(record.line_haul_compliance).trim() !== '') { lineHaulSum += lineHaulValue; lineHaulCount += 1 }
        const codValue = parseKpiNumber(record.cod_remittance)
        if (record.cod_remittance !== undefined && record.cod_remittance !== null && String(record.cod_remittance).trim() !== '') { codSum += codValue; codCount += 1 }
        const eodValue = parseKpiNumber(record.eod_compliance)
        if (record.eod_compliance !== undefined && record.eod_compliance !== null && String(record.eod_compliance).trim() !== '') { eodSum += eodValue; eodCount += 1 }
        const rtsValue = parseKpiNumber(record['RTS % Ach %'] ?? record.rts)
        if ((record['RTS % Ach %'] !== undefined && record['RTS % Ach %'] !== null && String(record['RTS % Ach %']).trim() !== '') || (record.rts !== undefined && record.rts !== null && String(record.rts).trim() !== '')) { rtsSum += rtsValue; rtsCount += 1 }
        const lossValue = parseKpiNumber(record['Loss % Ach %'] ?? record.loss)
        if ((record['Loss % Ach %'] !== undefined && record['Loss % Ach %'] !== null && String(record['Loss % Ach %']).trim() !== '') || (record.loss !== undefined && record.loss !== null && String(record.loss).trim() !== '')) { lossSum += lossValue; lossCount += 1 }
        const expediteValue = parseKpiNumber(record['Expedite Delivery Performance Ach %'] ?? record['Expedite Delivery Performance Ach Percent'] ?? record['Expedite Delivery Performance'] ?? record.expedite)
        if ((record['Expedite Delivery Performance Ach %'] !== undefined && record['Expedite Delivery Performance Ach %'] !== null && String(record['Expedite Delivery Performance Ach %']).trim() !== '') || (record['Expedite Delivery Performance Ach Percent'] !== undefined && record['Expedite Delivery Performance Ach Percent'] !== null && String(record['Expedite Delivery Performance Ach Percent']).trim() !== '') || (record['Expedite Delivery Performance'] !== undefined && record['Expedite Delivery Performance'] !== null && String(record['Expedite Delivery Performance']).trim() !== '') || (record.expedite !== undefined && record.expedite !== null && String(record.expedite).trim() !== '')) { expediteSum += expediteValue; expediteCount += 1 }
      })

      return {
        scorecard: scoreCount > 0 ? roundGraphValue(scoreSum / scoreCount) : 0,
        clearFloorRate: cfrCount > 0 ? roundGraphValue(cfrSum / cfrCount) : 0,
        successRate: srCount > 0 ? roundGraphValue(srSum / srCount) : 0,
        lineHaulCompliance: lineHaulCount > 0 ? roundGraphValue(lineHaulSum / lineHaulCount) : 0,
        codCompliance: codCount > 0 ? roundGraphValue(codSum / codCount) : 0,
        processCompliance: eodCount > 0 ? roundGraphValue(eodSum / eodCount) : 0,
        rts: rtsCount > 0 ? roundGraphValue(rtsSum / rtsCount) : 0,
        loss: lossCount > 0 ? roundGraphValue(lossSum / lossCount) : 0,
        expedite: expediteCount > 0 ? roundGraphValue(expediteSum / expediteCount) : 0,
        costPerParcel,
        deliveredAdo,
        dispatchedAdo,
        deliveredProd,
        assignedProd,
        fleetCount: fleetCountAvg
      }
    }

    return {
      costPerParcel,
      deliveredAdo,
      dispatchedAdo,
      successRate: Number(filteredStats?.successRate) || 0,
      deliveredProd,
      assignedProd,
      fleetCount: fleetCountAvg
    }
  }

  const formatGraphValue = (value, metric) => {
    const rounded = roundGraphValue(value)
    const percentMetrics = [
      'Success Rate',
      'Scorecard',
      'LM Clear Floor Rate Ach %',
      'Delivery Success Rate Actual',
      'Line Haul Pick-up Compliance Ach %',
      'COD Compliance Ach %',
      'Process Compliance Ach %',
      'RTS % Ach %',
      'Loss % Ach %'
    ]
    if (percentMetrics.includes(metric) || String(metric).includes('%')) {
      return `${rounded}%`
    }
    return rounded
  }

  const formatDeliveryTrendTooltip = (value) => {
    return [formatGraphValue(value, selectedCategory), selectedCategory]
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
        'Scorecard': item.scoreCount > 0 ? roundGraphValue(item.score / item.scoreCount) : 0
      }))

    setPerformanceData(chartData)
  }, [])

  // Fetch dashboard data - OPTIMIZED for 2-3s load time
  useEffect(() => {
    if (dashboardFetchStartedRef.current) return
    dashboardFetchStartedRef.current = true
    async function fetchData() {
      try {
        console.log('Dashboard fetchData start')
        setLoading(true)
        
        // PHASE 1: Fetch minimal critical data in parallel (1-2s)
        // Only fetch recent data for initial render - full history loads in background
        const [dashboardResult, kpiMetricsResult, initialPerformanceResult] = await Promise.all([
          getDashboardMetrics(14),                    // Only 14 days for initial load (~400-500 rows vs 8450)
          getKPIMetricsByHub(),                       // ~0.25s
          getPerformanceRecords()                     // Fetch all performance records for dropdown data
        ])
        
        let performanceResult = initialPerformanceResult
        if (performanceResult?.data?.length === 0) {
          performanceResult = await getPerformanceRecords()
        }

        if (dashboardResult?.error) {
          showMessage('error', `Google Apps Script data could not load: ${dashboardResult.error.message}`)
        }
        
        // Process and set critical data immediately for fast UI render
        if (dashboardResult.data) {
          console.log('Dashboard metrics loaded:', dashboardResult.data?.length || 0, 'rows')
          if (dashboardResult.data?.length > 0) {
            console.log('Sample dashboard metric:', dashboardResult.data[0])
          }
          setDashboardMetrics(dashboardResult.data)
        }

        // Transform PERFORMANCE records into chart data with dropdown categories
        if (performanceResult?.data && performanceResult.data.length > 0) {
          console.log('Performance records loaded:', performanceResult.data.length, 'rows')
          console.log('Sample performance record:', performanceResult.data[0])
          
          const chartData = performanceResult.data
            .sort((a, b) => new Date(a.date) - new Date(b.date))
            .map(item => ({
              month: item.date?.slice(5) || item.date,
              'Total Delivered': Math.round(parseFloat(item.delivered_products || item.delivered || 0)) || 0,
              'Cost Per Parcel': Math.round(parseFloat(item.cost_per_parcel || 0)) || 0,
              'Delivered Ado': Math.round(parseFloat(item.delivered_ado || 0)) || 0,
              'Dispatched Ado': Math.round(parseFloat(item.dispatched_ado || 0)) || 0,
              'Success Rate': Math.round(parseFloat(item.success_rate || 0)) || 0,
              'Delivered Prod': Math.round(parseFloat(item.delivered_products || 0)) || 0,
              'Assigned Prod': Math.round(parseFloat(item.dispatched_products || item.assigned || 0)) || 0,
              'Fleet Count': Math.round(parseFloat(item.fleet_count || 0)) || 0
            }))
          
          setPerformanceData(chartData)
          setPerformanceRecords(performanceResult.data)
        } else if (dashboardResult.data) {
          // Fallback to dashboard metrics if performance data is not available
          const chartData = dashboardResult.data
            .sort((a, b) => new Date(a.date) - new Date(b.date))
            .map(item => ({
              month: item.date?.slice(5) || item.date,
              'Success Rate': Math.round(parseFloat(item.success_rate) * 100) || 0,
              'Riders': item.riders || 0,
              'Delivered': Math.round(parseFloat(item.delivered)) || 0,
              'On-Hold': Math.round(parseFloat(item.on_hold)) || 0,
              'Productivity': Math.round(parseFloat(item.productivity)) || 0,
              'Clear Floor Rate': Math.round(parseFloat(item.clear_floor_rate)) || 0,
              'Scorecard': roundGraphValue(item.scorecard)
            }))
          
          setPerformanceData(chartData)
        }
        
        if (kpiMetricsResult.data) {
          setKpiMetricsByHub(kpiMetricsResult.data)
        }
        
        // PHASE 2: Fetch full data and supporting data in background (non-blocking)
        // Fetch full history (150 days) and refresh cache without blocking UI
        // Wait for all phase 2 data before marking loading as complete
        try {
          const [dashboardFull, performanceFull, kpiPageFull, statsResult, hubResult, ridersResult, overallKpiResult, leadersResult] = await Promise.all([
            getDashboardMetrics(150),                   // Full 150 days for date range filters
            getRecentPerformanceRecords(30),            // Full 30 days
            getKpiRecords(),                            // Full KPI records (deferred)
            getDashboardStats(),
            getRiderHubStats(),
            getRiders(),
            getOverallKPIMetrics(),
            getClusterLeaders()
          ])
          
          // Update with full dataset
          if (dashboardFull?.data && dashboardFull.data.length > dashboardResult.data.length) {
            console.log('Dashboard: Updated with full 150-day dataset (' + dashboardFull.data.length + ' rows)')
            setDashboardMetrics(dashboardFull.data)
          }
          
          if (performanceFull?.data && performanceFull.data.length > performanceResult.data.length) {
            console.log('Performance: Updated with full 30-day dataset (' + performanceFull.data.length + ' records)')
            setPerformanceRecords(performanceFull.data)
          }
          
          if (kpiPageFull?.data) {
            console.log('KPI Records: Loaded (' + kpiPageFull.data.length + ' records)')
            setKpiData(kpiPageFull.data)
            const subRegions = [...new Set(kpiPageFull.data.map(item => item.sub_region).filter(Boolean))]
            setUniqueRegions(subRegions)
          }
          
          if (statsResult?.data) {
            setStats(statsResult.data)
          }
          
          if (hubResult?.data) {
            setRiderStats(hubResult.data)
            setRidersNoRoute([])
            const hubPerf = hubResult.data.map(hub => ({
              name: hub.hub,
              riders: hub.riders,
              deliveryRate: Math.min(95, 70 + Math.random() * 25),
              onTimeRate: Math.min(98, 75 + Math.random() * 23),
              completionRate: Math.min(100, 80 + Math.random() * 20)
            })).slice(0, 5)
            setHubPerformance(hubPerf)
          }
          
          if (ridersResult?.data) {
            setRidersData(ridersResult.data)
          }
          
          if (overallKpiResult?.data) {
            setOverallKpiMetrics(overallKpiResult.data)
          }
          
          if (leadersResult?.data) {
            setClusterLeaders(leadersResult.data)
          }
          
          // PHASE 3: Defer expensive cache refresh to after all data loads
          // This 1.13s operation happens in the background without blocking user interaction
          populateDashboardMetrics().catch(error => {
            console.error('Error refreshing dashboard metrics cache:', error)
          })
          
          setLoading(false)
          console.log('Dashboard fetchData complete - all data loaded')
        } catch (error) {
          console.error('Error fetching phase 2 data:', error)
          setLoading(false)
          console.log('Dashboard fetchData complete (with partial data)')
        }
        
      } catch (error) {
        console.error('Dashboard fetchData error:', error)
        setMessage('error', 'Failed to load dashboard data. Please refresh.')
        setLoading(false)
        console.log('Dashboard fetchData complete (error)')
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

  useEffect(() => {
    if (dashboardView === 'hub' && hubViewMode === 'kpi' && kpiData.length === 0) {
      const loadKpiTabData = async () => {
        try {
          const { data, error } = await getKpiRecords()
          if (!error && data) {
            setKpiData(data)
            setUniqueRegions([...new Set(data.map(item => item.sub_region).filter(Boolean))])
          }
        } catch (err) {
          console.error('Error loading KPI records for KPI tab:', err)
        }
      }

      loadKpiTabData()
    }
  }, [dashboardView, hubViewMode, kpiData.length])

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
    const dataHubs = (hubViewMode === 'kpi' ? kpiData : performanceRecords)
      .map(item => String(hubViewMode === 'kpi' ? item.operator_hub || item.hub : item.hub || '').trim())
      .filter(Boolean)
    return [...new Set([...metricHubs, ...dataHubs])].sort()
  }, [dashboardMetrics, performanceRecords, kpiData, hubViewMode])

  // Filter hubs based on search term
  const filteredHubs = useMemo(() => {
    if (!hubSearchTerm) return uniqueHubs
    return uniqueHubs.filter(hub => 
      hub.toLowerCase().includes(hubSearchTerm.toLowerCase())
    )
  }, [uniqueHubs, hubSearchTerm])

  // Create cluster leader to hub mapping for Overall view filtering
  const clusterLeaderHubMap = useMemo(() => {
    const map = {}
    clusterLeaders.forEach(leader => {
      if (leader.hubs && Array.isArray(leader.hubs)) {
        map[leader.leader_name] = leader.hubs
      }
    })
    return map
  }, [clusterLeaders])

  // Resolve assigned hubs for the currently selected cluster.
  // Prefer hub assignments from `performanceRecords` (HUB NAME) and normalize values.
  // Fall back to `clusterLeaderHubMap` only when performance records do not contain the cluster.
  const assignedHubsForSelectedCluster = useMemo(() => {
    if (!selectedCluster) return []
    const clusterNorm = selectedCluster.trim().toLowerCase()
    const sourceRecords = hubViewMode === 'kpi' ? kpiData : performanceRecords

    const derived = sourceRecords
      .filter(r => {
        const clusterValue = String(r.clustering || r.cluster || '').trim().toLowerCase()
        return clusterValue === clusterNorm && (r.operator_hub || r.hub)
      })
      .map(r => String(r.operator_hub || r.hub || '').trim())

    const uniqueDerived = [...new Set(derived)]
    if (uniqueDerived.length > 0) return uniqueDerived.sort((a, b) => a.localeCompare(b))

    const fromMap = clusterLeaderHubMap[selectedCluster] || []
    return Array.isArray(fromMap) ? fromMap.slice().sort((a, b) => a.localeCompare(b)) : []
  }, [selectedCluster, clusterLeaderHubMap, performanceRecords, kpiData, hubViewMode])

  const hubDropdownOptions = useMemo(() => {
    // If a cluster is selected, limit hub dropdown to hubs assigned to that cluster leader
    if (selectedCluster) {
      const assigned = assignedHubsForSelectedCluster
      const sorted = Array.isArray(assigned) ? assigned.slice().sort((a, b) => a.localeCompare(b)) : []
      if (!hubSearchTerm || hubSearchTerm === selectedHub) return sorted
      return sorted.filter(hub => hub.toLowerCase().includes(hubSearchTerm.toLowerCase()))
    }

    if (!hubSearchTerm || hubSearchTerm === selectedHub) return uniqueHubs
    return filteredHubs
  }, [filteredHubs, hubSearchTerm, selectedCluster, selectedHub, uniqueHubs, clusterLeaderHubMap])

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

  // Get unique clusters from Performance data CLUSTERING column only
  const uniqueClusters = useMemo(() => {
    const perfClusters = performanceRecords.map(item => item.clustering).filter(Boolean)
    return [...new Set(perfClusters)].sort()
  }, [performanceRecords])

  const clusterDropdownOptions = useMemo(() => {
    const search = String(clusterSearchTerm || '').trim().toLowerCase()
    if (!search) return uniqueClusters
    return uniqueClusters.filter(cluster => String(cluster || '').toLowerCase().includes(search))
  }, [uniqueClusters, clusterSearchTerm])

  // Cluster leaders are now fetched in the background during main dashboard load
  
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

    const isHubRangeSelected = Boolean(
      hubFromDate && hubToDate ||
      selectedDate ||
      (hubDeliveryTrendRange && hubDeliveryTrendRange !== 'ALL') ||
      (hubCompareDateA && hubCompareDateB)
    )

    // When a specific hub is selected in hub view and no explicit KPI date range is selected,
    // keep the legacy dashboard_metrics summary as a fallback.
    if (dashboardView === 'hub' && selectedHub && selectedHub !== 'All Hubs' && !isHubRangeSelected) {
      const useKpiSummary = hubViewMode === 'kpi'
      const hubMetrics = (useKpiSummary ? kpiData : dashboardMetrics).filter(m => normalizeHub(useKpiSummary ? (m.operator_hub || m.hub) : m.hub) === selectedHubNorm)

      if (hubMetrics.length === 0) {
        return {
          successRate: 0,
          activeRiders: 0,
          delivered: 0,
          onHold: 0,
          productivity: 0,
          clearFloorRate: 0,
          scorecard: 0,
          lineHaulCompliance: 0,
          codCompliance: 0,
          processCompliance: 0,
          rts: 0,
          loss: 0,
          expedite: 0
        }
      }

      if (useKpiSummary) {
        const total = hubMetrics.length
        const avgScorecard = Math.round(hubMetrics.reduce((sum, item) => sum + parseKpiNumber(item.score ?? item.Scorecard), 0) / total)
        const avgClearFloor = Math.round(hubMetrics.reduce((sum, item) => sum + parseKpiNumber(item.cfr ?? item['LM Clear Floor Rate Ach %']), 0) / total)
        const avgSuccessRate = Math.round(hubMetrics.reduce((sum, item) => sum + parseKpiNumber(item.sr ?? item['Delivery Success Rate Actual']), 0) / total)
        const avgLineHaul = Math.round(hubMetrics.reduce((sum, item) => sum + parseKpiNumber(item.line_haul_compliance ?? item['Line Haul Pick-up Compliance Ach %']), 0) / total)
        const avgCod = Math.round(hubMetrics.reduce((sum, item) => sum + parseKpiNumber(item.cod_remittance ?? item['COD Compliance Ach %']), 0) / total)
        const avgProcess = Math.round(hubMetrics.reduce((sum, item) => sum + parseKpiNumber(item.eod_compliance ?? item['Process Compliance Ach %']), 0) / total)
        const avgRts = Math.round(hubMetrics.reduce((sum, item) => sum + parseKpiNumber(item['RTS % Ach %'] ?? item.rts ?? item['RTS %']), 0) / total)
        const avgLoss = Math.round(hubMetrics.reduce((sum, item) => sum + parseKpiNumber(item['Loss % Ach %'] ?? item.loss ?? item['Loss %']), 0) / total)
        const avgExpedite = Math.round(hubMetrics.reduce((sum, item) => sum + parseKpiNumber(item['Expedite Delivery Performance Ach %'] ?? item['Expedite Delivery Performance Ach Percent'] ?? item['Expedite Delivery Performance'] ?? item.expedite), 0) / total)

        return {
          successRate: avgSuccessRate,
          activeRiders: 0,
          delivered: 0,
          onHold: 0,
          productivity: 0,
          clearFloorRate: avgClearFloor,
          scorecard: avgScorecard,
          lineHaulCompliance: avgLineHaul,
          codCompliance: avgCod,
          processCompliance: avgProcess,
          rts: avgRts,
          loss: avgLoss,
          expedite: avgExpedite
        }
      }

      const total = hubMetrics.length
      const avgSuccessRate = Math.round(hubMetrics.reduce((sum, item) => sum + ((item.success_rate || 0) * 100), 0) / total)
      const sumRiders = hubMetrics.reduce((sum, item) => sum + (item.riders || 0), 0)
      const sumDelivered = hubMetrics.reduce((sum, item) => sum + (item.delivered || 0), 0)
      const sumOnHold = hubMetrics.reduce((sum, item) => sum + (item.on_hold || 0), 0)
      const avgProductivity = Math.round(hubMetrics.reduce((sum, item) => sum + (item.productivity || 0), 0) / total)
      const avgClearFloor = Math.round(hubMetrics.reduce((sum, item) => sum + (item.clear_floor_rate || 0), 0) / total)
      const avgScorecard = Math.round(hubMetrics.reduce((sum, item) => sum + (item.scorecard || 0), 0) / total)

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
        const metricRange = getHubMetricDateRange({
          selectedHub,
          hubFromDate,
          hubToDate,
          selectedDate,
          hubDeliveryTrendRange,
          metricRows: hubViewMode === 'kpi' ? kpiData : dashboardMetrics
        })
        if (metricRange && metricRange.start && metricRange.end) {
          filteredPerformance = filteredPerformance.filter(p => {
            const recordDate = p.date?.split('T')[0] || p.date
            return recordDate >= metricRange.start && recordDate <= metricRange.end
          })
          filteredKPI = filteredKPI.filter(k => {
            const recordDate = k.date?.split('T')[0] || k.date
            return recordDate >= metricRange.start && recordDate <= metricRange.end
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
          scorecard: avgScorecard,
          lineHaulCompliance: 0,
          codCompliance: 0,
          processCompliance: 0,
          rts: 0,
          loss: 0,
          expedite: 0
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
          scorecard: '0.0',
          lineHaulCompliance: 0,
          codCompliance: 0,
          processCompliance: 0,
          rts: 0,
          loss: 0,
          expedite: 0
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
      
      // Calculate KPI metrics from the actual KPI columns used by the KPI tab
      let totalScorecard = 0
      let scorecardCount = 0
      let totalClearFloor = 0
      let clearFloorCount = 0
      let totalSuccessRate = 0
      let successRateCount = 0
      let totalLineHaul = 0
      let lineHaulCount = 0
      let totalCodCompliance = 0
      let codComplianceCount = 0
      let totalProcessCompliance = 0
      let processComplianceCount = 0
      let totalRts = 0
      let rtsCount = 0
      let totalLoss = 0
      let lossCount = 0
      let totalExpedite = 0
      let expediteCount = 0

      filteredKPI.forEach(record => {
        const scoreValue = parseKpiNumber(record.score ?? record.Scorecard)
        if (!Number.isNaN(scoreValue)) {
          totalScorecard += scoreValue
          scorecardCount += 1
        }

        const cfrValue = parseKpiNumber(record.cfr ?? record['LM Clear Floor Rate Ach %'])
        if (!Number.isNaN(cfrValue)) {
          totalClearFloor += cfrValue
          clearFloorCount += 1
        }

        const srValue = parseKpiNumber(record.sr ?? record['Delivery Success Rate Actual'])
        if (!Number.isNaN(srValue)) {
          totalSuccessRate += srValue
          successRateCount += 1
        }

        const lineHaulValue = parseKpiNumber(record.line_haul_compliance ?? record['Line Haul Pick-up Compliance Ach %'])
        if (!Number.isNaN(lineHaulValue)) {
          totalLineHaul += lineHaulValue
          lineHaulCount += 1
        }

        const codValue = parseKpiNumber(record.cod_remittance ?? record['COD Compliance Ach %'])
        if (!Number.isNaN(codValue)) {
          totalCodCompliance += codValue
          codComplianceCount += 1
        }

        const processValue = parseKpiNumber(record.eod_compliance ?? record['Process Compliance Ach %'])
        if (!Number.isNaN(processValue)) {
          totalProcessCompliance += processValue
          processComplianceCount += 1
        }

        const rtsValue = parseKpiNumber(record['RTS % Ach %'] ?? record.rts ?? record['RTS %'])
        if (!Number.isNaN(rtsValue)) {
          totalRts += rtsValue
          rtsCount += 1
        }

        const lossValue = parseKpiNumber(record['Loss % Ach %'] ?? record.loss ?? record['Loss %'])
        if (!Number.isNaN(lossValue)) {
          totalLoss += lossValue
          lossCount += 1
        }

        const expediteValue = parseKpiNumber(record['Expedite Delivery Performance Ach %'] ?? record['Expedite Delivery Performance'] ?? record.expedite)
        if (!Number.isNaN(expediteValue)) {
          totalExpedite += expediteValue
          expediteCount += 1
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
      
      const avgPerformanceSuccessRate = successRates.length > 0 ? Math.round(successRates.reduce((sum, rate) => sum + rate, 0) / successRates.length) : 0
      const avgKpiSuccessRate = successRateCount > 0 ? Math.round(totalSuccessRate / successRateCount) : 0
      const avgClearFloor = clearFloorCount > 0 ? Math.round(totalClearFloor / clearFloorCount) : 0
      const avgScorecard = scorecardCount > 0 ? Math.round(totalScorecard / scorecardCount) : 0
      const avgLineHaul = lineHaulCount > 0 ? Math.round(totalLineHaul / lineHaulCount) : 0
      const avgCodCompliance = codComplianceCount > 0 ? Math.round(totalCodCompliance / codComplianceCount) : 0
      const avgProcessCompliance = processComplianceCount > 0 ? Math.round(totalProcessCompliance / processComplianceCount) : 0
      const avgRts = rtsCount > 0 ? Math.round(totalRts / rtsCount) : 0
      const avgLoss = lossCount > 0 ? Math.round(totalLoss / lossCount) : 0
      const avgExpedite = expediteCount > 0 ? Math.round(totalExpedite / expediteCount) : 0

      return {
        successRate: avgKpiSuccessRate || avgPerformanceSuccessRate,
        activeRiders: riders.size,
        delivered: totalDelivered,
        onHold: totalOnHold,
        productivity: avgProductivity,
        clearFloorRate: avgClearFloor,
        scorecard: avgScorecard,
        lineHaulCompliance: avgLineHaul,
        codCompliance: avgCodCompliance,
        processCompliance: avgProcessCompliance,
        rts: avgRts,
        loss: avgLoss,
        expedite: avgExpedite
      }
    }
    
    // For overall view: process data from cluster leader assigned hubs
    if (dashboardView === 'overall' && selectedCluster) {
      const normalizeHub = (value) => String(value || '').trim().toLowerCase()
      const assignedHubs = assignedHubsForSelectedCluster
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
        scorecard: avgScorecard,
        lineHaulCompliance: 0,
        codCompliance: 0,
        processCompliance: 0,
        rts: 0,
        loss: 0,
        expedite: 0
      }
    }
    
    // Default case: use dashboard_metrics
    let filtered = dashboardMetrics
    
    // In Overall view with selectedCluster: filter hubs assigned to that cluster leader
    if (dashboardView === 'overall' && selectedCluster) {
      const assignedHubs = assignedHubsForSelectedCluster
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
      const assignedHubs = assignedHubsForSelectedCluster
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
      { key: 'RTS % Ach %', fallback: 'rts', label: 'RTS' },
      { key: 'Loss % Ach %', fallback: 'loss', label: 'Loss' }
    ]
    
    const result = kpiFields.map(field => {
      const values = filteredKpiData
        .map(item => item[field.key] ?? item[field.fallback])
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

  const parseNumeric = (value) => {
    if (value === null || value === undefined || value === '') return 0
    const numberValue = Number(String(value).replace(/%/g, '').trim())
    if (!Number.isFinite(numberValue)) return 0
    return numberValue > 0 && numberValue <= 1 ? numberValue * 100 : numberValue
  }

  const getKpiMetricChartData = () => {
    const hubFiltersPresent = Boolean(
      (selectedHub && selectedHub !== 'All Hubs') ||
      hubFromDate || hubToDate ||
      (hubDeliveryTrendRange && hubDeliveryTrendRange !== 'ALL') ||
      selectedDate ||
      hubCompareDateA || hubCompareDateB
    )

    if (dashboardView === 'hub' && !hubFiltersPresent) {
      return []
    }

    let filtered = Array.isArray(kpiData) ? kpiData.slice() : []
    const selectedHubNorm = String(selectedHub || '').trim().toLowerCase()
    const normalizeHubValue = (value) => String(value || '').trim().toLowerCase()

    if (dashboardView === 'hub' && selectedCluster) {
      const assigned = assignedHubsForSelectedCluster
      const assignedNorm = new Set((assigned || []).map(a => normalizeHubValue(a)))
      filtered = filtered.filter(item => assignedNorm.has(normalizeHubValue(item.operator_hub || item.hub)))
    }

    if (dashboardView === 'hub' && selectedHub && selectedHub !== 'All Hubs') {
      filtered = filtered.filter(item => normalizeHubValue(item.operator_hub || item.hub) === selectedHubNorm)
    }

    const filterByDate = (itemDate) => {
      if (!itemDate) return false
      const date = String(itemDate).split('T')[0] || String(itemDate)
      if (hubFromDate && hubToDate) {
        return date >= hubFromDate && date <= hubToDate
      }
      if (selectedDate) {
        return date === selectedDate
      }
      if (hubDeliveryTrendRange && hubDeliveryTrendRange !== 'ALL') {
        const metricRange = getHubMetricDateRange({
          selectedHub,
          hubFromDate,
          hubToDate,
          selectedDate,
          hubDeliveryTrendRange,
          metricRows: kpiData
        })
        if (!metricRange) return false
        return date >= metricRange.start && date <= metricRange.end
      }
      return true
    }

    filtered = filtered.filter(item => filterByDate(item.date))

    const aggregates = {}
    filtered.forEach(item => {
      const date = String(item.date || '').split('T')[0] || item.date
      if (!date) return

      if (!aggregates[date]) {
        aggregates[date] = {
          date,
          count: 0,
          score: 0,
          scoreCount: 0,
          cfr: 0,
          cfrCount: 0,
          sr: 0,
          srCount: 0,
          line_haul_compliance: 0,
          lineHaulCount: 0,
          cod_remittance: 0,
          codCount: 0,
          eod_compliance: 0,
          eodCount: 0,
          rts: 0,
          rtsCount: 0,
          loss: 0,
          lossCount: 0,
          expedite: 0,
          expediteCount: 0
        }
      }

      const entry = aggregates[date]
      if (item.score !== undefined && item.score !== null) {
        entry.score += parseNumeric(item.score)
        entry.scoreCount += 1
      }
      if (item.cfr !== undefined && item.cfr !== null) {
        entry.cfr += parseNumeric(item.cfr)
        entry.cfrCount += 1
      }
      if (item.sr !== undefined && item.sr !== null) {
        entry.sr += parseNumeric(item.sr)
        entry.srCount += 1
      }
      if (item.line_haul_compliance !== undefined && item.line_haul_compliance !== null) {
        entry.line_haul_compliance += parseNumeric(item.line_haul_compliance)
        entry.lineHaulCount += 1
      }
      if (item.cod_remittance !== undefined && item.cod_remittance !== null) {
        entry.cod_remittance += parseNumeric(item.cod_remittance)
        entry.codCount += 1
      }
      if (item.eod_compliance !== undefined && item.eod_compliance !== null) {
        entry.eod_compliance += parseNumeric(item.eod_compliance)
        entry.eodCount += 1
      }
      const rtsValue = parseNumeric(item['RTS % Ach %'] ?? item.rts)
      if ((item['RTS % Ach %'] !== undefined && item['RTS % Ach %'] !== null && String(item['RTS % Ach %']).trim() !== '') ||
          (item.rts !== undefined && item.rts !== null && String(item.rts).trim() !== '')) {
        entry.rts += rtsValue
        entry.rtsCount += 1
      }

      const lossValue = parseNumeric(item['Loss % Ach %'] ?? item.loss)
      if ((item['Loss % Ach %'] !== undefined && item['Loss % Ach %'] !== null && String(item['Loss % Ach %']).trim() !== '') ||
          (item.loss !== undefined && item.loss !== null && String(item.loss).trim() !== '')) {
        entry.loss += lossValue
        entry.lossCount += 1
      }

      const expediteValue = parseNumeric(item['Expedite Delivery Performance Ach %'] ?? item['Expedite Delivery Performance Ach Percent'] ?? item['Expedite Delivery Performance'])
      if (expediteValue || (item['Expedite Delivery Performance Ach %'] === 0 || item['Expedite Delivery Performance Ach Percent'] === 0 || item['Expedite Delivery Performance'] === 0)) {
        entry.expedite += expediteValue
        entry.expediteCount += 1
      }
      entry.count += 1
    })

    return Object.values(aggregates)
      .sort((a, b) => String(a.date).localeCompare(String(b.date)))
      .map(item => ({
        month: item.date?.slice(5) || item.date,
        date: item.date,
        'Scorecard': item.scoreCount > 0 ? roundGraphValue(item.score / item.scoreCount) : 0,
        'LM Clear Floor Rate Ach %': item.cfrCount > 0 ? roundGraphValue(item.cfr / item.cfrCount) : 0,
        'Delivery Success Rate Actual': item.srCount > 0 ? roundGraphValue(item.sr / item.srCount) : 0,
        'Line Haul Pick-up Compliance Ach %': item.lineHaulCount > 0 ? roundGraphValue(item.line_haul_compliance / item.lineHaulCount) : 0,
        'COD Compliance Ach %': item.codCount > 0 ? roundGraphValue(item.cod_remittance / item.codCount) : 0,
        'Process Compliance Ach %': item.eodCount > 0 ? roundGraphValue(item.eod_compliance / item.eodCount) : 0,
        'RTS % Ach %': item.rtsCount > 0 ? roundGraphValue(item.rts / item.rtsCount) : 0,
        'Loss % Ach %': item.lossCount > 0 ? roundGraphValue(item.loss / item.lossCount) : 0,
        'Expedite Delivery Performance Ach %': item.expediteCount > 0 ? roundGraphValue(item.expedite / item.expediteCount) : 0
      }))
  }

  const getDashboardMetricChartData = () => {
    console.log('getDashboardMetricChartData called with dashboardMetrics:', dashboardMetrics?.length || 0, 'rows')
    
    // If in hub view and no hub filters (hub, from/to, range, compare, or date) are provided, return empty
    const hubFiltersPresent = Boolean(
      (selectedHub && selectedHub !== 'All Hubs') ||
      hubFromDate || hubToDate ||
      (hubDeliveryTrendRange && hubDeliveryTrendRange !== 'ALL') ||
      selectedDate ||
      hubCompareDateA || hubCompareDateB
    )

    if (dashboardView === 'hub' && !hubFiltersPresent) {
      console.log('Hub view without hub/date filters: returning empty chart data')
      return []
    }

    let filtered = dashboardMetrics
    const selectedHubNorm = String(selectedHub || '').trim().toLowerCase()
    const selectedDateNorm = String(selectedDate || '').split('T')[0]

    console.log('Filtering with selectedHub:', selectedHub, 'normalized:', selectedHubNorm)
    console.log('Available hubs in dashboardMetrics:', [...new Set(dashboardMetrics.map(d => d.hub))])

    // If a cluster is selected, filter to its assigned hubs
    if (dashboardView === 'hub' && selectedCluster) {
      const assigned = assignedHubsForSelectedCluster
      const assignedNorm = new Set((assigned || []).map(a => String(a).trim().toLowerCase()))
      filtered = filtered.filter(item => assignedNorm.has(String(item.hub || '').trim().toLowerCase()))
      console.log('Filtered by cluster, remaining rows:', filtered.length)
      if (filtered.length > 0) console.log('Sample filtered row:', filtered[0])
    }

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

    const mapMetricRow = (item, monthValue = item.date) => ({
      month: monthValue,
      date: item.date,
      'Success Rate': item.count > 0 ? roundGraphValue((item.success_rate / item.count) * 100) : 0,
      'Riders': roundGraphValue(item.riders),
      'Total Delivered': roundGraphValue(item.delivered),
      'Cost Per Parcel': item.cost_per_parcel_count > 0 ? roundGraphValue(item.cost_per_parcel / item.cost_per_parcel_count) : 0,
      'Delivered Ado': roundGraphValue(item.delivered_ado),
      'Dispatched Ado': roundGraphValue(item.dispatched_ado),
      'Delivered': roundGraphValue(item.delivered),
      'Delivered Prod': roundGraphValue(item.delivered),
      'On-Hold': roundGraphValue(item.on_hold),
      'Productivity': item.count > 0 ? roundGraphValue(item.productivity / item.count) : 0,
      'Assigned Prod': item.count > 0 ? roundGraphValue(item.productivity / item.count) : 0,
      'Fleet Count': roundGraphValue(item.fleet_count),
      'Clear Floor Rate': item.count > 0 ? roundGraphValue(item.clear_floor_rate / item.count) : 0,
      'Scorecard': item.count > 0 ? roundGraphValue(item.scorecard / item.count) : 0
    })

    const aggregateMetricRows = (rows) => {
      const aggregated = {}

      rows.forEach(item => {
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
            cost_per_parcel: 0,
            cost_per_parcel_count: 0,
            delivered_ado: 0,
            dispatched_ado: 0,
            fleet_count: 0,
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
        entry.cost_per_parcel += Number(item.cost_per_parcel) || 0
        if (Number(item.cost_per_parcel) > 0) {
          entry.cost_per_parcel_count += 1
        }
        entry.delivered_ado += Number(item.delivered_ado) || 0
        entry.dispatched_ado += Number(item.dispatched_ado) || 0
        entry.fleet_count += Number(item.fleet_count) || 0
        entry.clear_floor_rate += Number(item.clear_floor_rate) || 0
        entry.scorecard += Number(item.scorecard) || 0
        entry.count += 1
      })

      return Object.values(aggregated).sort((a, b) => a.date.localeCompare(b.date))
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

    const chartData = aggregateMetricRows(filtered).map(item => mapMetricRow(item))
    
    console.log('Final chart data:', chartData?.length || 0, 'rows')
    if (chartData?.length > 0) {
      console.log('Sample chart row:', chartData[0])
    }
    
    return chartData
  }

  if (dashboardView === 'hub') {
    const hasHubFilters = Boolean(
      selectedHub && selectedHub !== 'All Hubs' && (
        (hubFromDate && hubToDate) ||
        selectedDate ||
        (hubCompareDateA && hubCompareDateB) ||
        hubDeliveryTrendRange
      )
    )

    if (!hasHubFilters) return []

    return hubViewMode === 'kpi' ? getKpiMetricChartData() : getDashboardMetricChartData()
  }
  if (dashboardView === 'overall' && selectedCluster) {
    const assignedHubs = assignedHubsForSelectedCluster
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
        ? roundGraphValue(totals.scorecard / totals.kpiCount)
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
        'Scorecard': roundGraphValue(avgScorecard)
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

const filteredChartDataWithSelectedValue = useMemo(() => {
  return filteredChartData.map(item => ({
    ...item,
    displayValue: Number(item[selectedCategory]) || 0
  }))
}, [filteredChartData, selectedCategory])

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

const deliveryTrendChartData = useMemo(() => {
  return filteredChartData.map(item => ({
    ...item,
    selectedValue: Number(item[selectedCategory]) || 0
  }))
}, [filteredChartData, selectedCategory])

const chartDomain = useMemo(() => {
  if (!deliveryTrendChartData || deliveryTrendChartData.length === 0) {
    return [0, 'auto']
  }

  const hasComparisonBars = deliveryTrendChartData[0]?.currentLabel && deliveryTrendChartData[0]?.priorLabel
  const values = hasComparisonBars
    ? deliveryTrendChartData.flatMap(item => [
        Number(item.currentPeriod) || 0,
        Number(item.priorPeriod) || 0
      ])
    : deliveryTrendChartData.map(item => Number(item.selectedValue) || 0)
  const maxValue = Math.max(...values, 0)

  // Percentage-like metrics should be capped at 100, with top padding for labels
  if (['Success Rate', 'Assigned Prod', ...KPI_TREND_OPTIONS].includes(selectedCategory)) {
    // For percentage metrics, keep bars below the top edge
    return [0, 110]
  }

  const targetValue = Number(targets[selectedCategory])
  const topValue = Number.isFinite(targetValue) ? Math.max(maxValue, targetValue) : maxValue
  return [0, Math.max(10, Math.ceil(topValue * 1.2))]
}, [deliveryTrendChartData, selectedCategory, targets])

const buildTicksWithTarget = (domain, explicitTicks, targetValue) => {
  const target = Number(targetValue)
  if (!Number.isFinite(target)) return explicitTicks

  let ticks = explicitTicks ? [...explicitTicks] : []

  if (!explicitTicks && domain && domain.length === 2 && Number.isFinite(domain[1])) {
    const [min = 0, max] = domain
    const step = Math.max(1, Math.round((max - min) / 5))
    for (let value = min; value <= max; value += step) {
      ticks.push(value)
    }
    if (ticks[ticks.length - 1] !== max) ticks.push(max)
  }

  ticks.push(target)
  return Array.from(new Set(ticks.filter(Number.isFinite))).sort((a, b) => a - b)
}

// Compute explicit Y axis ticks when domain is capped at 100
const yTicks = useMemo(() => {
  if (!chartDomain || chartDomain.length !== 2) return undefined
  const baseTicks = chartDomain[1] === 100 ? [0,20,40,60,80,100] : undefined
  return buildTicksWithTarget(chartDomain, baseTicks, targets[selectedCategory])
}, [chartDomain, selectedCategory, targets])

const hubSevenDayComparisonData = useMemo(() => {
  const hasHubFilter = selectedCluster || (selectedHub && selectedHub !== 'All Hubs')
  if (dashboardView !== 'hub' || !hasHubFilter) {
    return []
  }

  if (hubViewMode === 'kpi') {
    let hubRows = []
    if (selectedCluster) {
      const assigned = assignedHubsForSelectedCluster
      const assignedNorm = new Set((assigned || []).map(a => String(a).trim().toLowerCase()))
      hubRows = kpiData.filter(item => assignedNorm.has(String(item.operator_hub || item.hub || '').trim().toLowerCase()))
    } else {
      const selectedHubNorm = String(selectedHub || '').trim().toLowerCase()
      hubRows = kpiData.filter(item => String(item.operator_hub || item.hub || '').trim().toLowerCase() === selectedHubNorm)
    }

    if (!hubRows.length) return []
    return buildKpiSevenDayComparisonData(hubRows, selectedCategory)
  }

  if (!dashboardMetrics?.length) return []

  let hubRows = []
  if (selectedCluster) {
    const assigned = assignedHubsForSelectedCluster
    const assignedNorm = new Set((assigned || []).map(a => String(a).trim().toLowerCase()))
    hubRows = dashboardMetrics.filter(item => assignedNorm.has(String(item.hub || '').trim().toLowerCase()))
  } else {
    const selectedHubNorm = String(selectedHub || '').trim().toLowerCase()
    hubRows = dashboardMetrics.filter(item => String(item.hub || '').trim().toLowerCase() === selectedHubNorm)
  }

  const latestDateString = getMaxDateString(hubRows.map(item => item.date?.split('T')[0] || item.date))
  if (!latestDateString) return []

  const lastRange = getRangeBounds('L7D', latestDateString)
  const priorRange = getRangeBounds('P7D', latestDateString)

  const aggregateMetricRows = (rows) => {
    const aggregated = {}

    rows.forEach(item => {
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
          cost_per_parcel: 0,
          cost_per_parcel_count: 0,
          delivered_ado: 0,
          dispatched_ado: 0,
          fleet_count: 0,
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
      entry.cost_per_parcel += Number(item.cost_per_parcel) || 0
      if (Number(item.cost_per_parcel) > 0) {
        entry.cost_per_parcel_count += 1
      }
      entry.delivered_ado += Number(item.delivered_ado) || 0
      entry.dispatched_ado += Number(item.dispatched_ado) || 0
      entry.fleet_count += Number(item.fleet_count) || 0
      entry.clear_floor_rate += Number(item.clear_floor_rate) || 0
      entry.scorecard += Number(item.scorecard) || 0
      entry.count += 1
    })

    return Object.values(aggregated).sort((a, b) => a.date.localeCompare(b.date))
  }

  const mapMetricRow = (item) => ({
    'Success Rate': item.count > 0 ? roundGraphValue((item.success_rate / item.count) * 100) : 0,
    'Riders': roundGraphValue(item.riders),
    'Total Delivered': roundGraphValue(item.delivered),
    'Cost Per Parcel': item.cost_per_parcel_count > 0 ? roundGraphValue(item.cost_per_parcel / item.cost_per_parcel_count) : 0,
    'Delivered Ado': roundGraphValue(item.delivered_ado),
    'Dispatched Ado': roundGraphValue(item.dispatched_ado),
    'Delivered': roundGraphValue(item.delivered),
    'Delivered Prod': roundGraphValue(item.delivered),
    'On-Hold': roundGraphValue(item.on_hold),
    'Productivity': item.count > 0 ? roundGraphValue(item.productivity / item.count) : 0,
    'Assigned Prod': item.count > 0 ? roundGraphValue(item.productivity / item.count) : 0,
    'Fleet Count': roundGraphValue(item.fleet_count),
    'Clear Floor Rate': item.count > 0 ? roundGraphValue(item.clear_floor_rate / item.count) : 0,
    'Scorecard': item.count > 0 ? roundGraphValue(item.scorecard / item.count) : 0
  })

  const lastAggregated = aggregateMetricRows(hubRows.filter(item => {
    const itemDate = item.date?.split('T')[0] || item.date
    return itemDate >= lastRange.start && itemDate <= lastRange.end
  }))
  const priorAggregated = aggregateMetricRows(hubRows.filter(item => {
    const itemDate = item.date?.split('T')[0] || item.date
    return itemDate >= priorRange.start && itemDate <= priorRange.end
  }))

  const priorByIndex = new Map(priorAggregated.map((item, index) => [index, mapMetricRow(item)]))
  const currentLabel = formatShortRangeLabel(lastRange.start, lastRange.end)
  const priorLabel = formatShortRangeLabel(priorRange.start, priorRange.end)

  return lastAggregated
    .map((item, originalIndex) => {
      const current = mapMetricRow(item)
      const prior = priorByIndex.get(originalIndex) || {}
      const date = parseDateString(item.date)
      return {
        month: date ? date.toLocaleDateString('en-US', { weekday: 'short' }) : item.date,
        currentPeriod: current[selectedCategory] || 0,
        priorPeriod: prior[selectedCategory] || 0,
        currentLabel,
        priorLabel
      }
    })
}, [dashboardMetrics, kpiData, selectedHub, dashboardView, selectedCluster, selectedCategory, hubViewMode, assignedHubsForSelectedCluster])

const hubSevenDayComparisonDomain = useMemo(() => {
  if (!hubSevenDayComparisonData.length) return [0, 'auto']
  const values = hubSevenDayComparisonData.flatMap(item => [
    Number(item.currentPeriod) || 0,
    Number(item.priorPeriod) || 0
  ])
  const maxValue = Math.max(...values, 0)
  // If comparison is for percentage-like metrics, cap at 100 with extra top padding
  if (['Success Rate', 'Assigned Prod', ...KPI_TREND_OPTIONS].includes(selectedCategory)) return [0, 110]
  const targetValue = Number(targets[selectedCategory])
  const topValue = Number.isFinite(targetValue) ? Math.max(maxValue, targetValue) : maxValue
  return [0, Math.max(10, Math.ceil(topValue * 1.2))]
}, [hubSevenDayComparisonData, selectedCategory, targets])

// Hub comparison explicit ticks when capped at 100
const hubYTicks = useMemo(() => {
  if (!hubSevenDayComparisonDomain || hubSevenDayComparisonDomain.length !== 2) return undefined
  const baseTicks = hubSevenDayComparisonDomain[1] === 100 ? [0,20,40,60,80,100] : undefined
  return buildTicksWithTarget(hubSevenDayComparisonDomain, baseTicks, targets[selectedCategory])
}, [hubSevenDayComparisonDomain, selectedCategory, targets])

// Calculate hub level period comparison data for Graph Comparison
const hubLevelGraphComparison = useMemo(() => {
  const hasHubFilter = selectedCluster || (selectedHub && selectedHub !== 'All Hubs')
  if (dashboardView !== 'hub' || !hasHubFilter) {
    return []
  }

  if (hubViewMode === 'kpi') {
    let hubRows = []
    if (selectedCluster) {
      const assigned = assignedHubsForSelectedCluster
      const assignedNorm = new Set((assigned || []).map(a => String(a).trim().toLowerCase()))
      hubRows = kpiData.filter(item => assignedNorm.has(String(item.operator_hub || item.hub || '').trim().toLowerCase()))
    } else {
      const selectedHubNorm = String(selectedHub || '').trim().toLowerCase()
      hubRows = kpiData.filter(item => String(item.operator_hub || item.hub || '').trim().toLowerCase() === selectedHubNorm)
    }

    if (hubRows.length === 0) return []
    return buildKpiGraphComparisonData(hubRows, selectedCategory)
  }

  if (!dashboardMetrics || dashboardMetrics.length === 0) {
    return []
  }

  let hubData = []
  if (selectedCluster) {
    const assigned = assignedHubsForSelectedCluster
    const assignedNorm = new Set((assigned || []).map(a => String(a).trim().toLowerCase()))
    hubData = dashboardMetrics.filter(item => assignedNorm.has(String(item.hub || '').trim().toLowerCase()))
  } else {
    const selectedHubNorm = String(selectedHub || '').trim().toLowerCase()
    hubData = dashboardMetrics.filter(item => {
      const itemHubNorm = String(item.hub || '').trim().toLowerCase()
      return itemHubNorm === selectedHubNorm
    })
  }

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
      cost_per_parcel: 0,
      cost_per_parcel_count: 0,
      delivered_ado: 0,
      dispatched_ado: 0,
      fleet_count: 0,
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
      totals.cost_per_parcel += Number(item.cost_per_parcel) || 0
      if (Number(item.cost_per_parcel) > 0) {
        totals.cost_per_parcel_count += 1
      }
      totals.delivered_ado += Number(item.delivered_ado) || 0
      totals.dispatched_ado += Number(item.dispatched_ado) || 0
      totals.fleet_count += Number(item.fleet_count) || 0
      totals.clear_floor_rate += Number(item.clear_floor_rate) || 0
      totals.scorecard += Number(item.scorecard) || 0
      totals.count++
    })

    return {
      'Success Rate': totals.count > 0 ? roundGraphValue((totals.success_rate / totals.count) * 100) : 0,
      'Riders': roundGraphValue(totals.riders),
      'Total Delivered': roundGraphValue(totals.delivered),
      'Cost Per Parcel': totals.cost_per_parcel_count > 0 ? roundGraphValue(totals.cost_per_parcel / totals.cost_per_parcel_count) : 0,
      'Delivered Ado': roundGraphValue(totals.delivered_ado),
      'Dispatched Ado': roundGraphValue(totals.dispatched_ado),
      'Delivered': roundGraphValue(totals.delivered),
      'Delivered Prod': totals.count > 0 ? roundGraphValue(totals.delivered / totals.count) : 0,
      'On-Hold': roundGraphValue(totals.on_hold),
      'Productivity': totals.count > 0 ? roundGraphValue(totals.productivity / totals.count) : 0,
      'Assigned Prod': totals.count > 0 ? roundGraphValue(totals.productivity / totals.count) : 0,
      'Fleet Count': totals.count > 0 ? roundGraphValue(totals.fleet_count / totals.count) : 0,
      'Clear Floor Rate': totals.count > 0 ? roundGraphValue(totals.clear_floor_rate / totals.count) : 0,
      'Scorecard': totals.count > 0 ? roundGraphValue(totals.scorecard / totals.count) : 0
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
}, [dashboardMetrics, kpiData, selectedHub, dashboardView, selectedCluster, selectedCategory, hubViewMode, assignedHubsForSelectedCluster])

const hubLevelGraphComparisonChartData = useMemo(() => {
  return hubLevelGraphComparison.map(item => ({
    ...item,
    selectedValue: Number(item[selectedCategory]) || 0
  }))
}, [hubLevelGraphComparison, selectedCategory])

// Domain for the hub-level graph comparison (Graph Comparison chart)
const hubLevelGraphComparisonDomain = useMemo(() => {
  if (!hubLevelGraphComparisonChartData || hubLevelGraphComparisonChartData.length === 0) return [0, 'auto']
  const values = hubLevelGraphComparisonChartData.flatMap(item => {
    const v = Number(item.selectedValue) || 0
    return [v]
  })
  const maxValue = Math.max(...values, 0)
  if (['Success Rate', 'Assigned Prod', ...KPI_TREND_OPTIONS].includes(selectedCategory)) return [0, 100]
  const targetValue = Number(targets[selectedCategory])
  const topValue = Number.isFinite(targetValue) ? Math.max(maxValue, targetValue) : maxValue
  return [0, Math.max(10, Math.ceil(topValue * 1.2))]
}, [hubLevelGraphComparisonChartData, selectedCategory, targets])

const hubLevelYTicks = useMemo(() => {
  if (!hubLevelGraphComparisonDomain || hubLevelGraphComparisonDomain.length !== 2) return undefined
  const baseTicks = hubLevelGraphComparisonDomain[1] === 100 ? [0,20,40,60,80,100] : undefined
  return buildTicksWithTarget(hubLevelGraphComparisonDomain, baseTicks, targets[selectedCategory])
}, [hubLevelGraphComparisonDomain, selectedCategory, targets])

const getHubSevenDayComparisonDataForHub = useCallback((hubName) => {
  if (!hubName) return []
  const normalizeHub = (value) => String(value || '').trim().toLowerCase()
  const hubNorm = normalizeHub(hubName)

  if (hubViewMode === 'kpi') {
    const hubRows = kpiData.filter(item => normalizeHub(item.operator_hub || item.hub) === hubNorm)
    if (!hubRows.length) return []
    return buildKpiSevenDayComparisonData(hubRows, selectedCategory)
  }

  if (!dashboardMetrics?.length) return []
  const hubRows = dashboardMetrics.filter(item => normalizeHub(item.hub) === hubNorm)
  const latestDateString = getMaxDateString(hubRows.map(item => item.date?.split('T')[0] || item.date))
  if (!latestDateString) return []

  const lastRange = getRangeBounds('L7D', latestDateString)
  const priorRange = getRangeBounds('P7D', latestDateString)

  const aggregateMetricRows = (rows) => {
    const aggregated = {}

    rows.forEach(item => {
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
          cost_per_parcel: 0,
          cost_per_parcel_count: 0,
          delivered_ado: 0,
          dispatched_ado: 0,
          fleet_count: 0,
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
      entry.cost_per_parcel += Number(item.cost_per_parcel) || 0
      if (Number(item.cost_per_parcel) > 0) {
        entry.cost_per_parcel_count += 1
      }
      entry.delivered_ado += Number(item.delivered_ado) || 0
      entry.dispatched_ado += Number(item.dispatched_ado) || 0
      entry.fleet_count += Number(item.fleet_count) || 0
      entry.clear_floor_rate += Number(item.clear_floor_rate) || 0
      entry.scorecard += Number(item.scorecard) || 0
      entry.count += 1
    })

    return Object.values(aggregated).sort((a, b) => a.date.localeCompare(b.date))
  }

  const mapMetricRow = (item) => ({
    month: parseDateString(item.date)?.toLocaleDateString('en-US', { weekday: 'short' }) || item.date,
    values: {
      'Success Rate': item.count > 0 ? roundGraphValue((item.success_rate / item.count) * 100) : 0,
      'Riders': roundGraphValue(item.riders),
      'Total Delivered': roundGraphValue(item.delivered),
      'Cost Per Parcel': item.cost_per_parcel_count > 0 ? roundGraphValue(item.cost_per_parcel / item.cost_per_parcel_count) : 0,
      'Delivered Ado': roundGraphValue(item.delivered_ado),
      'Dispatched Ado': roundGraphValue(item.dispatched_ado),
      'Delivered': roundGraphValue(item.delivered),
      'Delivered Prod': roundGraphValue(item.delivered),
      'On-Hold': roundGraphValue(item.on_hold),
      'Productivity': item.count > 0 ? roundGraphValue(item.productivity / item.count) : 0,
      'Assigned Prod': item.count > 0 ? roundGraphValue(item.productivity / item.count) : 0,
      'Fleet Count': roundGraphValue(item.fleet_count),
      'Clear Floor Rate': item.count > 0 ? roundGraphValue(item.clear_floor_rate / item.count) : 0,
      'Scorecard': item.count > 0 ? roundGraphValue(item.scorecard / item.count) : 0
    },
    currentLabel: formatShortRangeLabel(lastRange.start, lastRange.end),
    priorLabel: formatShortRangeLabel(priorRange.start, priorRange.end)
  })

  const lastAggregated = aggregateMetricRows(hubRows.filter(item => {
    const itemDate = item.date?.split('T')[0] || item.date
    return itemDate >= lastRange.start && itemDate <= lastRange.end
  }))

  const priorAggregated = aggregateMetricRows(hubRows.filter(item => {
    const itemDate = item.date?.split('T')[0] || item.date
    return itemDate >= priorRange.start && itemDate <= priorRange.end
  }))

  const priorByIndex = new Map(priorAggregated.map((item, index) => [index, mapMetricRow(item)]))

  return lastAggregated.map((item, index) => {
    const current = mapMetricRow(item)
    const prior = priorByIndex.get(index) || { values: {} }
    return {
      month: current.month,
      currentPeriod: current.values[selectedCategory] || 0,
      priorPeriod: prior.values[selectedCategory] || 0,
      currentLabel: current.currentLabel,
      priorLabel: current.priorLabel
    }
  })
}, [dashboardMetrics, kpiData, selectedCategory, hubViewMode])

const getHubLevelGraphComparisonForHub = useCallback((hubName) => {
  if (!hubName) return []
  const normalizeHub = (value) => String(value || '').trim().toLowerCase()
  const hubNorm = normalizeHub(hubName)

  if (hubViewMode === 'kpi') {
    const hubRows = kpiData.filter(item => normalizeHub(item.operator_hub || item.hub) === hubNorm)
    if (!hubRows.length) return []
    return buildKpiGraphComparisonData(hubRows, selectedCategory)
  }

  if (!dashboardMetrics?.length) return []
  const hubData = dashboardMetrics.filter(item => normalizeHub(item.hub) === hubNorm)
  if (!hubData.length) return []

  const dates = hubData.map(item => String(item.date || '').split('T')[0]).filter(Boolean)
  if (!dates.length) return []

  const latestDate = new Date(dates.reduce((latest, current) => current > latest ? current : latest, dates[0]))
  const l7dStart = new Date(latestDate)
  l7dStart.setDate(latestDate.getDate() - 6)
  const l7dEnd = new Date(latestDate)

  const p7dEnd = new Date(l7dStart)
  p7dEnd.setDate(p7dEnd.getDate() - 1)
  const p7dStart = new Date(p7dEnd)
  p7dStart.setDate(p7dEnd.getDate() - 6)

  const mtdStart = new Date(latestDate.getFullYear(), latestDate.getMonth(), 1)

  const formatLocalDate = (date) => {
    const pad = (value) => String(value).padStart(2, '0')
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
  }

  const calculatePeriodAvg = (startDate, endDate) => {
    const filtered = hubData.filter(item => {
      const itemDate = String(item.date || '').split('T')[0]
      return itemDate >= startDate && itemDate <= endDate
    })

    if (!filtered.length) return null

    const totals = {
      success_rate: 0,
      riders: 0,
      delivered: 0,
      on_hold: 0,
      productivity: 0,
      cost_per_parcel: 0,
      cost_per_parcel_count: 0,
      delivered_ado: 0,
      dispatched_ado: 0,
      fleet_count: 0,
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
      totals.cost_per_parcel += Number(item.cost_per_parcel) || 0
      if (Number(item.cost_per_parcel) > 0) totals.cost_per_parcel_count += 1
      totals.delivered_ado += Number(item.delivered_ado) || 0
      totals.dispatched_ado += Number(item.dispatched_ado) || 0
      totals.fleet_count += Number(item.fleet_count) || 0
      totals.clear_floor_rate += Number(item.clear_floor_rate) || 0
      totals.scorecard += Number(item.scorecard) || 0
      totals.count += 1
    })

    return {
      'Success Rate': totals.count > 0 ? roundGraphValue((totals.success_rate / totals.count) * 100) : 0,
      'Riders': roundGraphValue(totals.riders),
      'Total Delivered': roundGraphValue(totals.delivered),
      'Cost Per Parcel': totals.cost_per_parcel_count > 0 ? roundGraphValue(totals.cost_per_parcel / totals.cost_per_parcel_count) : 0,
      'Delivered Ado': roundGraphValue(totals.delivered_ado),
      'Dispatched Ado': roundGraphValue(totals.dispatched_ado),
      'Delivered': roundGraphValue(totals.delivered),
      'Delivered Prod': totals.count > 0 ? roundGraphValue(totals.delivered / totals.count) : 0,
      'On-Hold': roundGraphValue(totals.on_hold),
      'Productivity': totals.count > 0 ? roundGraphValue(totals.productivity / totals.count) : 0,
      'Assigned Prod': totals.count > 0 ? roundGraphValue(totals.productivity / totals.count) : 0,
      'Fleet Count': totals.count > 0 ? roundGraphValue(totals.fleet_count / totals.count) : 0,
      'Clear Floor Rate': totals.count > 0 ? roundGraphValue(totals.clear_floor_rate / totals.count) : 0,
      'Scorecard': totals.count > 0 ? roundGraphValue(totals.scorecard / totals.count) : 0
    }
  }

  const l7dAvg = calculatePeriodAvg(formatLocalDate(l7dStart), formatLocalDate(l7dEnd))
  const p7dAvg = calculatePeriodAvg(formatLocalDate(p7dStart), formatLocalDate(p7dEnd))
  const mtdAvg = calculatePeriodAvg(formatLocalDate(mtdStart), formatLocalDate(latestDate))

  const result = []
  if (l7dAvg) result.push({ period: 'Last 7 Days', selectedValue: l7dAvg[selectedCategory] || 0, ...l7dAvg })
  if (p7dAvg) result.push({ period: 'Prior 7 Days', selectedValue: p7dAvg[selectedCategory] || 0, ...p7dAvg })
  if (mtdAvg) result.push({ period: 'Month to Date', selectedValue: mtdAvg[selectedCategory] || 0, ...mtdAvg })

  return result
}, [dashboardMetrics, kpiData, selectedCategory, hubViewMode])

const clusterHubSections = useMemo(() => {
  if (dashboardView !== 'hub' || !selectedCluster) return []
  return assignedHubsForSelectedCluster.map(hub => ({
    hub,
    sevenDayData: getHubSevenDayComparisonDataForHub(hub),
    graphData: getHubLevelGraphComparisonForHub(hub)
  }))
}, [dashboardView, selectedCluster, assignedHubsForSelectedCluster, getHubSevenDayComparisonDataForHub, getHubLevelGraphComparisonForHub])

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

  // Close cluster dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (showClusterDropdown && !event.target.closest('.cluster-search-container')) {
        setShowClusterDropdown(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [showClusterDropdown])

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

      const assignedHubs = assignedHubsForSelectedCluster
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
      .map(([date, value]) => ({ date, value: roundGraphValue(value) }))
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
      const rangeLabels = {
        ALL: 'All Data',
        L7D: 'Last 7 Days',
        P7D: 'Prior 7 Days',
        MTD: 'Month to Date'
      }
      
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
        reportTitle = hubViewMode === 'kpi' ? 'KPI Dashboard' : 'Performance Dashboard'
        filterInfo = [
          `Hub: ${selectedHub || 'All Hubs'}`,
          `From: ${hubFromDate || ''}    To: ${hubToDate || ''}`,
          `Range: ${rangeLabels[hubDeliveryTrendRange] || hubDeliveryTrendRange || ''}`,
          `Trend: ${selectedCategory || 'None'}`
        ]
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
      const filterText = dashboardView === 'hub'
        ? `Filters: ${filterInfo.join('\n')}`
        : `Filters: ${filterInfo.join(' | ')}`
      const filterLines = pdf.splitTextToSize(filterText, pdfWidth - (margin * 2) - 6)
      const filterBoxHeight = Math.max(12, filterLines.length * 5 + 6)
      pdf.setFillColor(241, 245, 249)
      pdf.rect(margin, currentY - 3, pdfWidth - (margin * 2), filterBoxHeight, 'F')
      pdf.setFontSize(9)
      pdf.setTextColor(100, 116, 139)
      pdf.text(filterLines, margin + 3, currentY + 4)
      currentY += filterBoxHeight + 6

      // === SUMMARY STATS SECTION ===
      const comparisonData = dashboardView === 'overall' ? getComparisonData() : []
      
      const shouldShowMetrics = dashboardView === 'hub' && selectedHub && selectedHub !== 'All Hubs'
      const exportHubLevelTopKpis = getHubLevelTopKpisForExport()
      let summaryStats = []
      if (shouldShowMetrics && dashboardView === 'hub' && filteredStats) {
        summaryStats = (hubViewMode === 'kpi')
          ? [
              { label: 'Scorecard', value: `${filteredStats?.scorecard || 0}%` },
              { label: 'Clear Floor', value: `${filteredStats?.clearFloorRate || 0}%` },
              { label: 'Success Rate', value: `${filteredStats?.successRate || 0}%` },
              { label: 'Line Haul', value: `${filteredStats?.lineHaulCompliance || 0}%` },
              { label: 'COD Compliance', value: `${filteredStats?.codCompliance || 0}%` },
              { label: 'Process Compliance', value: `${filteredStats?.processCompliance || 0}%` },
              { label: 'RTS', value: `${filteredStats?.rts || 0}%` },
              { label: 'Loss', value: `${filteredStats?.loss || 0}%` },
              { label: 'Expedite', value: `${filteredStats?.expedite || 0}%` }
            ]
          : [
              { label: 'Cost Per Parcel', value: String(exportHubLevelTopKpis.costPerParcel || 0) },
              { label: 'Delivered Ado', value: String(exportHubLevelTopKpis.deliveredAdo || 0) },
              { label: 'Dispatched Ado', value: String(exportHubLevelTopKpis.dispatchedAdo || 0) },
              { label: 'Success Rate', value: `${exportHubLevelTopKpis.successRate || 0}%` },
              { label: 'Delivered Prod', value: String(exportHubLevelTopKpis.deliveredProd || 0) },
              { label: 'Assigned Prod', value: String(exportHubLevelTopKpis.assignedProd || 0) },
              { label: 'Fleet Count', value: String(exportHubLevelTopKpis.fleetCount || 0) }
            ]
      }

      if (shouldShowMetrics) {
        pdf.setTextColor(51, 65, 85)
        pdf.setFontSize(12)
        pdf.setFont(undefined, 'bold')
        pdf.text('Metrics', margin, currentY)
        currentY += 8
      }

      // Determine an export-safe selected category (match current hubViewMode)
      const exportSelectedCategory = (hubViewMode === 'kpi')
        ? (KPI_TREND_OPTIONS.includes(selectedCategory) ? selectedCategory : KPI_TREND_OPTIONS[0])
        : (PERFORMANCE_TREND_OPTIONS.includes(selectedCategory) ? selectedCategory : PERFORMANCE_TREND_OPTIONS[0])

      const exportFilteredChartDataWithSelectedValue = filteredChartData.map(item => ({
        ...item,
        displayValue: Number(item[exportSelectedCategory]) || 0
      }))

      const exportHubSevenDayComparisonData = hubSevenDayComparisonData.map(item => ({
        ...item,
        currentPeriod: Number(item.currentPeriod) || 0,
        priorPeriod: Number(item.priorPeriod) || 0
      }))

      const exportHubLevelGraphComparisonChartData = hubLevelGraphComparisonChartData.map(item => ({
        ...item,
        selectedValue: Number(item.selectedValue) || 0
      }))

      // === METRICS TABLE (when hub filter is used) ===
      if (dashboardView === 'hub' && selectedHub && selectedHub !== 'All Hubs' && filteredChartData.length > 0) {
        const metricCards = hubViewMode === 'kpi'
          ? [
              { label: 'Scorecard', value: `${filteredStats?.scorecard || 0}%` },
              { label: 'Clear Floor', value: `${filteredStats?.clearFloorRate || 0}%` },
              { label: 'Success Rate', value: `${filteredStats?.successRate || 0}%` },
              { label: 'Line Haul', value: `${filteredStats?.lineHaulCompliance || 0}%` },
              { label: 'COD Compliance', value: `${filteredStats?.codCompliance || 0}%` },
              { label: 'Process Compliance', value: `${filteredStats?.processCompliance || 0}%` },
              { label: 'RTS', value: `${filteredStats?.rts || 0}%` },
              { label: 'Loss', value: `${filteredStats?.loss || 0}%` },
              { label: 'Expedite', value: `${filteredStats?.expedite || 0}%` }
            ]
          : [
              { label: 'Cost Per Parcel', value: String(exportHubLevelTopKpis.costPerParcel || 0) },
              { label: 'Delivered Ado', value: String(exportHubLevelTopKpis.deliveredAdo || 0) },
              { label: 'Dispatched Ado', value: String(exportHubLevelTopKpis.dispatchedAdo || 0) },
              { label: 'Success Rate', value: `${exportHubLevelTopKpis.successRate || 0}%` },
              { label: 'Delivered Prod', value: String(exportHubLevelTopKpis.deliveredProd || 0) },
              { label: 'Assigned Prod', value: String(exportHubLevelTopKpis.assignedProd || 0) },
              { label: 'Fleet Count', value: String(exportHubLevelTopKpis.fleetCount || 0) }
            ]

        if (metricCards.length > 0) {
          currentY += 8
          if (currentY > 250) {
            pdf.addPage()
            currentY = margin
          }

          const cardWidth = 42
          const cardHeight = 20
          const cardSpacing = 2
          let cardX = margin
          let cardY = currentY

          pdf.setTextColor(51, 65, 85)
          pdf.setFont(undefined, 'normal')
          pdf.setFontSize(6)

          metricCards.forEach((metric, index) => {
            if (cardX + cardWidth > pdfWidth - margin) {
              cardX = margin
              cardY += cardHeight + cardSpacing
            }
            if (cardY + cardHeight > pageHeight - margin) {
              pdf.addPage()
              cardX = margin
              cardY = margin
            }

            pdf.setFillColor(254, 242, 242)
            pdf.rect(cardX, cardY, cardWidth, cardHeight, 'F')
            pdf.setDrawColor(168, 48, 48)
            pdf.rect(cardX, cardY, cardWidth, cardHeight, 'S')

            pdf.setFontSize(6)
            pdf.setTextColor(100, 116, 139)
            pdf.text(metric.label, cardX + 3, cardY + 6)

            pdf.setFontSize(8)
            pdf.setTextColor(168, 48, 48)
            pdf.setFont(undefined, 'bold')
            pdf.text(metric.value || '0', cardX + 3, cardY + 15)

            cardX += cardWidth + cardSpacing
          })

          currentY = cardY + cardHeight + 10
        }
      }

      // === GRAPH TEMPLATE SECTION ===
      const addPageIfNeeded = (requiredHeight = 45) => {
        if (currentY + requiredHeight > pageHeight - margin) {
          pdf.addPage()
          currentY = margin
        }
      }

      const drawGraphSectionHeading = (title) => {
        addPageIfNeeded(16)
        pdf.setTextColor(...PDF_THEME.ink)
        pdf.setFontSize(12)
        pdf.setFont(undefined, 'bold')
        pdf.text(title, margin, currentY)
        currentY += 8
      }

      const chartGap = 5
      const halfChartWidth = (pdfWidth - (margin * 2) - chartGap) / 2
      const fullChartWidth = pdfWidth - (margin * 2)

      const drawTwoColumnCharts = (charts, chartHeight = 58) => {
        for (let index = 0; index < charts.length; index += 2) {
          addPageIfNeeded(chartHeight + 8)
          const left = charts[index]
          const right = charts[index + 1]
          left(margin, currentY, halfChartWidth, chartHeight)
          if (right) {
            right(margin + halfChartWidth + chartGap, currentY, halfChartWidth, chartHeight)
          }
          currentY += chartHeight + chartGap
        }
      }

      const buildRiderExportChartData = () => {
        if (!selectedRider) return []

        const selectedRiderId = String(selectedRider)
        const sourceRecords = selectedRiderRecords.length > 0
          ? selectedRiderRecords
          : performanceRecords.filter(record => String(record.rider_id) === selectedRiderId)

        const useCustomRange = riderFromDate && riderToDate
        const latestRecordDate = getMaxDateString(sourceRecords.map(record => record.date))
        const rangeBounds = (!useCustomRange && riderTrendRange && riderTrendRange !== 'ALL')
          ? getRangeBounds(riderTrendRange, latestRecordDate)
          : { start: '', end: '' }
        const selectedDateNorm = selectedDate ? selectedDate.split('T')[0] : ''

        const dateMap = new Map()
        sourceRecords.forEach(record => {
          const recordDate = record.date?.split('T')[0] || record.date
          if (!recordDate) return
          if (useCustomRange && (recordDate < riderFromDate || recordDate > riderToDate)) return
          if (rangeBounds.start && rangeBounds.end && (recordDate < rangeBounds.start || recordDate > rangeBounds.end)) return
          if (!useCustomRange && !rangeBounds.start && selectedDateNorm && recordDate !== selectedDateNorm) return

          const current = dateMap.get(recordDate) || { date: recordDate, delivered: 0, onHold: 0, assigned: 0, recordCount: 0 }
          current.delivered += parseInt(record.delivered) || 0
          current.onHold += parseInt(record.onhold) || 0
          current.assigned += parseInt(record.assigned) || 0
          current.recordCount += 1
          dateMap.set(recordDate, current)
        })

        return Array.from(dateMap.values())
          .sort((a, b) => a.date.localeCompare(b.date))
          .map(item => ({
            ...item,
            successRate: item.assigned > 0 ? roundGraphValue((item.delivered / item.assigned) * 100) : 0,
            productivity: roundGraphValue(item.assigned)
          }))
      }

      const buildRiderNoRouteByHub = () => {
        const grouped = filteredRidersNoRoute.reduce((acc, rider) => {
          const hub = rider.hub || rider.operator_hub || 'Unknown'
          acc[hub] = (acc[hub] || 0) + 1
          return acc
        }, {})

        return Object.entries(grouped)
          .map(([hub, count]) => ({ hub, count }))
          .sort((a, b) => b.count - a.count)
          .slice(0, 12)
      }

      const drawHubGraphTemplate = () => {
        // Performance / KPI Trend
        drawGraphSectionHeading(hubViewMode === 'kpi' ? 'KPI Trend' : 'Performance Trend')
        addPageIfNeeded(72)
        drawSingleBarChart(pdf, {
          x: margin,
          y: currentY,
          width: fullChartWidth,
          height: 64,
          title: hubViewMode === 'kpi' ? `${exportSelectedCategory || 'KPI'}` : `${exportSelectedCategory || 'Performance'}`,
          subtitle: hubDeliveryTrendDateLabel,
          data: exportFilteredChartDataWithSelectedValue,
          xKey: 'month',
          yKey: 'displayValue',
          suffix: (['Success Rate', ...KPI_TREND_OPTIONS].includes(exportSelectedCategory) ? '%' : ''),
          target: targets[exportSelectedCategory]
        })
        currentY += 72

        // Last vs Prior 7 Days (export only if UI shows data - only when NO cluster selected)
        if (!selectedCluster && exportHubSevenDayComparisonData && exportHubSevenDayComparisonData.length > 0) {
          drawGraphSectionHeading('Last vs Prior 7 Days')
          addPageIfNeeded(78)
          drawGroupedBarChart(pdf, {
            x: margin,
            y: currentY,
            width: fullChartWidth,
            height: 66,
            title: 'Last vs Prior 7 Days',
            data: exportHubSevenDayComparisonData,
            xKey: 'month',
            firstKey: 'currentPeriod',
            secondKey: 'priorPeriod',
            suffix: (['Success Rate', ...KPI_TREND_OPTIONS].includes(exportSelectedCategory) ? '%' : ''),
            max: (['Success Rate', ...KPI_TREND_OPTIONS].includes(exportSelectedCategory) ? 100 : undefined),
            target: targets[exportSelectedCategory]
          })
          currentY += 72
        }

        // Graph Comparison (per hub or overall) - only if data exists and NO cluster selected
        if (!selectedCluster && exportHubLevelGraphComparisonChartData && exportHubLevelGraphComparisonChartData.length > 0) {
          drawGraphSectionHeading('Graph Comparison')
          addPageIfNeeded(78)
          drawSingleBarChart(pdf, {
            x: margin,
            y: currentY,
            width: fullChartWidth,
            height: 66,
            title: 'Graph Comparison',
            data: exportHubLevelGraphComparisonChartData,
            xKey: 'period',
            yKey: 'selectedValue',
            suffix: (['Success Rate', ...KPI_TREND_OPTIONS].includes(exportSelectedCategory) ? '%' : ''),
            max: (['Success Rate', ...KPI_TREND_OPTIONS].includes(exportSelectedCategory) ? 100 : undefined),
            target: targets[exportSelectedCategory]
          })
          currentY += 78
        }


      }

      const drawRiderGraphTemplate = () => {
        drawGraphSectionHeading('Graph Template')

        if (selectedRider) {
          const riderExportChartData = buildRiderExportChartData()
          const riderCharts = RIDER_EXPORT_METRICS.map(metric => (x, y, width, height) => {
            drawSingleBarChart(pdf, {
              x,
              y,
              width,
              height,
              title: metric.label,
              data: riderExportChartData,
              xKey: 'date',
              yKey: metric.key,
              suffix: metric.suffix || '',
              color: metric.color,
              max: metric.suffix === '%' ? 100 : undefined
            })
          })
          drawTwoColumnCharts(riderCharts, 58)
        } else {
          addPageIfNeeded(70)
          drawSingleBarChart(pdf, {
            x: margin,
            y: currentY,
            width: fullChartWidth,
            height: 64,
            title: 'Riders No Route by Hub',
            data: buildRiderNoRouteByHub(),
            xKey: 'hub',
            yKey: 'count'
          })
          currentY += 70
        }
      }

      const drawOverallGraphTemplate = () => {
        drawGraphSectionHeading('Graph Template')
        const overallCharts = OVERALL_EXPORT_CHARTS.map(chart => (x, y, width, height) => {
          drawGroupedBarChart(pdf, {
            x,
            y,
            width,
            height,
            title: chart.title,
            data: comparisonData,
            xKey: 'hub',
            firstKey: chart.p7dKey,
            secondKey: chart.l7dKey,
            suffix: chart.suffix || '',
            max: chart.max,
            target: targets[exportSelectedCategory]
          })
        })

        overallCharts.forEach(drawChart => {
          addPageIfNeeded(72)
          drawChart(margin, currentY, fullChartWidth, 66)
          currentY += 72
        })
      }

      if (dashboardView === 'hub') {
        // Only export hub graphs if the dashboard actually shows them
        if (filteredChartData && filteredChartData.length > 0) {
          drawHubGraphTemplate()
        }

        // If a cluster is selected, also export per-hub Last vs Prior and Graph Comparison
        if (selectedCluster && clusterHubSections && clusterHubSections.length > 0) {
          clusterHubSections.forEach((hubSection) => {
            if (currentY > 250) {
              pdf.addPage()
              currentY = margin
            }
            pdf.setTextColor(51, 65, 85)
            pdf.setFontSize(12)
            pdf.setFont(undefined, 'bold')
            pdf.text(`Hub: ${hubSection.hub}`, margin, currentY)
            currentY += 8

            // Last vs Prior 7 Days for this hub
            if (hubSection.sevenDayData && hubSection.sevenDayData.length > 0) {
              addPageIfNeeded(78)
              drawGroupedBarChart(pdf, {
                x: margin,
                y: currentY,
                width: fullChartWidth,
                height: 66,
                title: 'Last vs Prior 7 Days',
                data: hubSection.sevenDayData,
                xKey: 'month',
                firstKey: 'currentPeriod',
                secondKey: 'priorPeriod',
                suffix: (['Success Rate', ...KPI_TREND_OPTIONS].includes(exportSelectedCategory) ? '%' : ''),
                max: (['Success Rate', ...KPI_TREND_OPTIONS].includes(exportSelectedCategory) ? 100 : undefined),
                target: targets[exportSelectedCategory]
              })
              currentY += 72
            }

            // Graph Comparison for this hub
            if (hubSection.graphData && hubSection.graphData.length > 0) {
              addPageIfNeeded(78)
              drawSingleBarChart(pdf, {
                x: margin,
                y: currentY,
                width: fullChartWidth,
                height: 66,
                title: 'Graph Comparison',
                data: hubSection.graphData,
                xKey: 'period',
                yKey: 'selectedValue',
                suffix: (['Success Rate', ...KPI_TREND_OPTIONS].includes(exportSelectedCategory) ? '%' : ''),
                max: (['Success Rate', ...KPI_TREND_OPTIONS].includes(exportSelectedCategory) ? 100 : undefined),
                target: targets[exportSelectedCategory]
              })
              currentY += 78
            }

            currentY += 8
          })
        }
      } else if (dashboardView === 'rider') {
        // Only export rider graphs if rider data or riders-no-route is visible
        if ((selectedRider && riderLevelData && riderLevelData.length > 0) || (filteredRidersNoRoute && filteredRidersNoRoute.length > 0)) {
          drawRiderGraphTemplate()
        }
      } else if (dashboardView === 'overall') {
        // Only export overall graphs if comparison data exists
        if (comparisonData && comparisonData.length > 0) {
          drawOverallGraphTemplate()
        }
      }

      // === DATA TABLE SECTION ===
      // Detailed data export has been removed.

      // Download the PDF
      const filename = dashboardView === 'hub' 
        ? `${hubViewMode === 'kpi' ? 'kpi' : 'performance'}-dashboard-${selectedHub || 'all'}-${new Date().toISOString().split('T')[0]}.pdf`
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
  }, [dashboardView, filteredChartData, filteredRidersNoRoute, riderLevelData, getComparisonData, filteredStats, kpiGradeData, retentionMetrics, selectedHub, hubSearchTerm, selectedCluster, selectedRider, selectedDate, riderFromDate, riderToDate, riderLevelChartData, hubLevelGraphComparison, hubDeliveryTrendDateLabel, selectedRiderRecords, performanceRecords, riderTrendRange, hubFromDate, hubToDate, hubCompareDateA, hubCompareDateB, hubDeliveryTrendRange, selectedCategory, hubDeliveryTrendTab, showMessage, hubViewMode])

  const COLORS = ['#a83030', '#c94c4c', '#e07e7e', '#f0b1b1', '#742a2a']

  if (loading) {
    return (
      <div className="space-y-4 relative">
        {/* Skeleton Loading Screen */}
        <SkeletonDashboard />
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
              onClick={() => {
                setDashboardView('hub')
                setHubViewMode('performance')
                if (!PERFORMANCE_TREND_OPTIONS.includes(selectedCategory)) {
                  setSelectedCategory(PERFORMANCE_TREND_OPTIONS[0])
                }
              }}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-[6px] text-[11px] font-medium transition-all duration-180 ${
                dashboardView === 'hub' && hubViewMode === 'performance'
                  ? 'bg-[hsl(0,58%,42%)] text-white shadow-[0_2px_8px_rgba(0,0,0,0.05)]'
                  : 'text-[hsl(220,8%,55%)] hover:text-[hsl(220,15%,95%)] hover:bg-[hsl(220,18%,18%)]'
              }`}
            >
              <Building2 className="w-3.5 h-3.5" />
              Performance
            </button>
            <button
              onClick={() => {
                setDashboardView('hub')
                setHubViewMode('kpi')
                if (!KPI_TREND_OPTIONS.includes(selectedCategory)) {
                  setSelectedCategory(KPI_TREND_OPTIONS[0])
                }
              }}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-[6px] text-[11px] font-medium transition-all duration-180 ${
                dashboardView === 'hub' && hubViewMode === 'kpi'
                  ? 'bg-[hsl(0,58%,42%)] text-white shadow-[0_2px_8px_rgba(0,0,0,0.05)]'
                  : 'text-[hsl(220,8%,55%)] hover:text-[hsl(220,15%,95%)] hover:bg-[hsl(220,18%,18%)]'
              }`}
            >
              <Target className="w-3.5 h-3.5" />
              KPI
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
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-1 text-[hsl(220,8%,55%)]">
            <Filter className="w-3.5 h-3.5" />
            <span className="text-[10px] font-medium tracking-wide uppercase">Filters</span>
          </div>
          
          <div className="relative hub-search-container min-w-0">
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
              className="bg-[hsl(220,18%,18%)] border border-[hsl(220,13%,30%)] rounded-[6px] px-2 py-1 text-[10px] text-[hsl(220,15%,95%)] focus:border-[hsl(0,58%,42%)] outline-none w-44 max-w-[11rem]"
            />
            {showHubDropdown && (
              <div className="absolute top-full left-0 mt-1 bg-[hsl(220,20%,14%)] border border-[hsl(220,13%,30%)] rounded-[10px] shadow-[0_4px_16px_rgba(0,0,0,0.07)] z-[99999] max-h-40 overflow-y-auto w-64">
                {hubDropdownOptions.length > 0 ? (
                  hubDropdownOptions.map(hub => (
                    <div
                      key={hub}
                      onClick={() => {
                        setSelectedHub(hub)
                        setHubSearchTerm(hub)
                        setShowHubDropdown(false)
                      }}
                      className="px-2 py-1 text-[10px] text-[hsl(220,15%,95%)] hover:bg-[hsl(220,18%,18%)] cursor-pointer"
                    >
                      {hub}
                    </div>
                  ))
                ) : (
                  <div className="px-2 py-1 text-[10px] text-[hsl(220,8%,55%)]">No hubs found</div>
                )}
              </div>
            )}
          </div>
          
          {/* From Date */}
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] text-[hsl(220,8%,55%)]">From:</span>
            <input
              type="date"
              value={hubFromDate}
              onChange={(e) => setHubFromDate(e.target.value)}
              className="bg-[hsl(220,18%,18%)] border border-[hsl(220,13%,30%)] rounded-[6px] px-2 py-1 text-[10px] text-[hsl(220,15%,95%)] focus:border-[hsl(0,58%,42%)] outline-none"
            />
          </div>
          
          {/* To Date */}
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] text-[hsl(220,8%,55%)]">To:</span>
            <input
              type="date"
              value={hubToDate}
              onChange={(e) => setHubToDate(e.target.value)}
              className="bg-[hsl(220,18%,18%)] border border-[hsl(220,13%,30%)] rounded-[6px] px-2 py-1 text-[10px] text-[hsl(220,15%,95%)] focus:border-[hsl(0,58%,42%)] outline-none"
            />
          </div>

          {/* Range Filter */}
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] text-[hsl(220,8%,55%)]">Range:</span>
            <select
              value={hubDeliveryTrendRange}
              onChange={(e) => setHubDeliveryTrendRange(e.target.value)}
              className="bg-[hsl(220,18%,18%)] border border-[hsl(220,13%,30%)] rounded-[6px] px-2 py-1 text-[10px] text-[hsl(220,15%,95%)] focus:border-[hsl(0,58%,42%)] outline-none"
            >
              <option value="ALL">All Data</option>
              <option value="L7D">Last 7 Days</option>
              <option value="P7D">Prior 7 Days</option>
              <option value="MTD">Month to Date</option>
            </select>
          </div>

          {/* Trend Selector */}
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] text-[hsl(220,8%,55%)]">Trend:</span>
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="bg-[hsl(220,18%,18%)] border border-[hsl(220,13%,30%)] rounded-[6px] px-2 py-1 text-[10px] text-[hsl(220,15%,95%)] focus:border-[hsl(0,58%,42%)] outline-none"
            >
              {(hubViewMode === 'kpi' ? KPI_TREND_OPTIONS : PERFORMANCE_TREND_OPTIONS).map(option => (
                <option key={option} value={option}>{option}</option>
              ))}
            </select>
          </div>

          {/* Cluster Filter */}
          <div className="relative cluster-search-container min-w-0 flex items-center gap-1.5">
            <input
              type="text"
              placeholder="Search cluster..."
              value={clusterSearchTerm || selectedCluster}
              onChange={(e) => {
                const value = e.target.value
                setClusterSearchTerm(value)
                if (value === '') {
                  setSelectedCluster('')
                }
                setShowClusterDropdown(true)
              }}
              onFocus={() => setShowClusterDropdown(true)}
              className="bg-[hsl(220,18%,18%)] border border-[hsl(220,13%,30%)] rounded-[6px] px-2 py-1 text-[10px] text-[hsl(220,15%,95%)] focus:border-[hsl(0,58%,42%)] outline-none w-32 max-w-[8rem]"
            />
            {showClusterDropdown && (
              <div className="absolute top-full left-0 mt-1 bg-[hsl(220,20%,14%)] border border-[hsl(220,13%,30%)] rounded-[10px] shadow-[0_4px_16px_rgba(0,0,0,0.07)] z-[99999] max-h-40 overflow-y-auto w-40">
                <div
                  onClick={() => {
                    setSelectedCluster('')
                    setClusterSearchTerm('')
                    setShowClusterDropdown(false)
                  }}
                  className="px-2 py-1 text-[10px] text-[hsl(220,15%,95%)] hover:bg-[hsl(220,18%,18%)] cursor-pointer"
                >
                  All Clusters
                </div>
                {clusterDropdownOptions.length > 0 ? (
                  clusterDropdownOptions.map(cluster => (
                    <div
                      key={cluster}
                      onClick={() => {
                        setSelectedCluster(cluster)
                        setClusterSearchTerm(cluster)
                        setShowClusterDropdown(false)
                      }}
                      className="px-2 py-1 text-[10px] text-[hsl(220,15%,95%)] hover:bg-[hsl(220,18%,18%)] cursor-pointer"
                    >
                      {cluster}
                    </div>
                  ))
                ) : (
                  <div className="px-2 py-1 text-[10px] text-[hsl(220,8%,55%)]">No clusters found</div>
                )}
              </div>
            )}
          </div>
          
          {/* Refresh Button */}
          
          
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
            <span className="text-[10px] text-[hsl(220,8%,55%)]">From:</span>
            <input
              type="date"
              value={riderFromDate}
              onChange={(e) => setRiderFromDate(e.target.value)}
              className="bg-[hsl(220,18%,18%)] border border-[hsl(220,13%,30%)] rounded-[6px] px-2 py-1 text-[11px] text-[hsl(220,15%,95%)] focus:border-[hsl(0,58%,42%)] outline-none"
            />
          </div>
          
          {/* To Date */}
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] text-[hsl(220,8%,55%)]">To:</span>
            <input
              type="date"
              value={riderToDate}
              onChange={(e) => setRiderToDate(e.target.value)}
              className="bg-[hsl(220,18%,18%)] border border-[hsl(220,13%,30%)] rounded-[6px] px-2 py-1 text-[11px] text-[hsl(220,15%,95%)] focus:border-[hsl(0,58%,42%)] outline-none"
            />
          </div>
          
          {/* Range Filter */}
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] text-[hsl(220,8%,55%)]">Range:</span>
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
          
          
          </div>
      </div>
      )}

      {/* Filters Bar for Overall View */}
      {dashboardView === 'overall' && (
      <div className="bg-[hsl(220,20%,14%)] rounded-[14px] p-3 border border-[hsl(220,13%,30%)] shadow-[0_2px_8px_rgba(0,0,0,0.05)] z-50">
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-1 text-[hsl(220,8%,55%)]">
            <Filter className="w-3.5 h-3.5" />
            <span className="text-[11px] font-medium tracking-wide uppercase">Filters</span>
          </div>
          
          {/* Cluster Filter */}
          <div className="relative cluster-search-container min-w-0 flex-shrink-0 max-w-[9.5rem]">
            <input
              type="text"
              placeholder="Search cluster..."
              value={clusterSearchTerm || selectedCluster}
              onChange={(e) => {
                const value = e.target.value
                setClusterSearchTerm(value)
                if (value === '') {
                  setSelectedCluster('')
                }
                setShowClusterDropdown(true)
              }}
              onFocus={() => setShowClusterDropdown(true)}
              className="bg-[hsl(220,18%,18%)] border border-[hsl(220,13%,30%)] rounded-[6px] px-2 py-1 text-[10px] text-[hsl(220,15%,95%)] focus:border-[hsl(0,58%,42%)] outline-none w-full"
            />
            {showClusterDropdown && (
              <div className="absolute top-full left-0 mt-1 bg-[hsl(220,20%,14%)] border border-[hsl(220,13%,30%)] rounded-[10px] shadow-[0_4px_16px_rgba(0,0,0,0.07)] z-[99999] max-h-40 overflow-y-auto w-64">
                <div
                  onClick={() => {
                    setSelectedCluster('')
                    setClusterSearchTerm('')
                    setShowClusterDropdown(false)
                  }}
                  className="px-2 py-1 text-[11px] text-[hsl(220,15%,95%)] hover:bg-[hsl(220,18%,18%)] cursor-pointer"
                >
                  All Clusters
                </div>
                {clusterDropdownOptions.length > 0 ? (
                  clusterDropdownOptions.map(cluster => (
                    <div
                      key={cluster}
                      onClick={() => {
                        setSelectedCluster(cluster)
                        setClusterSearchTerm(cluster)
                        setShowClusterDropdown(false)
                      }}
                      className="px-2 py-1 text-[11px] text-[hsl(220,15%,95%)] hover:bg-[hsl(220,18%,18%)] cursor-pointer"
                    >
                      {cluster}
                    </div>
                  ))
                ) : (
                  <div className="px-2 py-1 text-[11px] text-[hsl(220,8%,55%)]">No clusters found</div>
                )}
              </div>
            )}
          </div>

          
          
          {/* Refresh Button */}
          
          
        </div>
      </div>
      )}

      {/* KPI Stats Row - Symmetrical 7 Metrics - Hub Level Only */}
      {dashboardView === 'hub' && selectedHub && selectedHub !== 'All Hubs' && (
      <div>
        {/* Compute top KPIs for the selected hub and date range */}
        {(() => {
          const hubLevelTopKpis = (function() {
            const normalizeHub = v => String(v || '').trim().toLowerCase()
            const selectedHubNorm = normalizeHub(selectedHub)

            let perf = Array.isArray(performanceRecords) ? performanceRecords.slice() : []
            let metrics = Array.isArray(dashboardMetrics) ? dashboardMetrics.slice() : []
            let kpi = Array.isArray(kpiData) ? kpiData.slice() : []

            if (selectedHub && selectedHub !== 'All Hubs') {
              perf = perf.filter(p => normalizeHub(p.hub) === selectedHubNorm)
              metrics = metrics.filter(m => normalizeHub(m.hub) === selectedHubNorm)
              kpi = kpi.filter(k => normalizeHub(k.operator_hub || k.hub) === selectedHubNorm)
            }

            if (hubFromDate && hubToDate) {
              const start = hubFromDate
              const end = hubToDate
              perf = perf.filter(p => {
                const d = p.date?.split('T')[0] || p.date
                return d >= start && d <= end
              })
              metrics = metrics.filter(m => {
                const d = m.date?.split('T')[0] || m.date
                return d >= start && d <= end
              })
              kpi = kpi.filter(k => {
                const d = k.date?.split('T')[0] || k.date
                return d >= start && d <= end
              })
            } else if (selectedDate) {
              perf = perf.filter(p => {
                const d = p.date?.split('T')[0] || p.date
                return d === selectedDate
              })
              metrics = metrics.filter(m => {
                const d = m.date?.split('T')[0] || m.date
                return d === selectedDate
              })
              kpi = kpi.filter(k => {
                const d = k.date?.split('T')[0] || k.date
                return d === selectedDate
              })
            } else if (hubDeliveryTrendRange && hubDeliveryTrendRange !== 'ALL') {
              const metricRange = getHubMetricDateRange({
                selectedHub,
                hubFromDate,
                hubToDate,
                selectedDate,
                hubDeliveryTrendRange,
                metricRows: hubViewMode === 'kpi' ? kpi : metrics
              })

              if (metricRange && metricRange.start && metricRange.end) {
                perf = perf.filter(p => {
                  const d = p.date?.split('T')[0] || p.date
                  return d >= metricRange.start && d <= metricRange.end
                })
                metrics = metrics.filter(m => {
                  const d = m.date?.split('T')[0] || m.date
                  return d >= metricRange.start && d <= metricRange.end
                })
                kpi = kpi.filter(k => {
                  const d = k.date?.split('T')[0] || k.date
                  return d >= metricRange.start && d <= metricRange.end
                })
              } else {
                perf = []
                metrics = []
                kpi = []
              }
            }

            let costSum = 0, costCount = 0
            let delAdo = 0, dispAdo = 0, deliveredTotal = 0, assignedTotal = 0
            let prodSum = 0, prodCount = 0
            let fleetSum = 0, fleetCount = 0

            const activeRecords = hubViewMode === 'kpi' ? kpi : perf
            if (activeRecords.length > 0) {
              activeRecords.forEach(r => {
                const cp = Number(r.cost_per_parcel) || 0
                if (cp > 0) { costSum += cp; costCount++ }
                delAdo += Number(r.delivered_ado) || 0
                dispAdo += Number(r.dispatched_ado) || 0
                deliveredTotal += Number(r.delivered) || 0
                assignedTotal += Number(r.assigned) || 0
                prodSum += Number(r.productivity) || 0
                if (Number(r.fleet_count)) { fleetSum += Number(r.fleet_count); fleetCount++ }
              })
            } else if (metrics.length > 0) {
              metrics.forEach(m => {
                const cp = Number(m.cost_per_parcel) || 0
                if (cp > 0) { costSum += cp; costCount++ }
                delAdo += Number(m.delivered_ado) || 0
                dispAdo += Number(m.dispatched_ado) || 0
                deliveredTotal += Number(m.delivered) || 0
                assignedTotal += Number(m.productivity) || 0
                prodSum += Number(m.productivity) || 0; prodCount++
                if (Number(m.fleet_count)) { fleetSum += Number(m.fleet_count); fleetCount++ }
              })
            }

            const costPerParcel = costCount > 0 ? Math.round(costSum / costCount) : 0
            const deliveredAdo = Math.round(delAdo)
            const dispatchedAdo = Math.round(dispAdo)
            const deliveredProd = (perf.length > 0 || metrics.length > 0) ? Math.round(deliveredTotal / Math.max(1, (perf.length || metrics.length))) : 0
            const assignedProd = perf.length > 0 ? Math.round(assignedTotal / Math.max(1, perf.length)) : (prodCount > 0 ? Math.round(prodSum / prodCount) : 0)
            const fleetCountAvg = fleetCount > 0 ? Math.round(fleetSum / fleetCount) : 0

            if (hubViewMode === 'kpi') {
              let scoreSum = 0, scoreCount = 0
              let cfrSum = 0, cfrCount = 0
              let srSum = 0, srCount = 0
              let lineHaulSum = 0, lineHaulCount = 0
              let codSum = 0, codCount = 0
              let eodSum = 0, eodCount = 0
              let rtsSum = 0, rtsCount = 0
              let lossSum = 0, lossCount = 0
              let expediteSum = 0, expediteCount = 0

              kpi.forEach(record => {
                const scoreValue = parseKpiNumber(record.score)
                if (record.score !== undefined && record.score !== null && String(record.score).trim() !== '') {
                  scoreSum += scoreValue
                  scoreCount += 1
                }
                const cfrValue = parseKpiNumber(record.cfr)
                if (record.cfr !== undefined && record.cfr !== null && String(record.cfr).trim() !== '') {
                  cfrSum += cfrValue
                  cfrCount += 1
                }
                const srValue = parseKpiNumber(record.sr)
                if (record.sr !== undefined && record.sr !== null && String(record.sr).trim() !== '') {
                  srSum += srValue
                  srCount += 1
                }
                const lineHaulValue = parseKpiNumber(record.line_haul_compliance)
                if (record.line_haul_compliance !== undefined && record.line_haul_compliance !== null && String(record.line_haul_compliance).trim() !== '') {
                  lineHaulSum += lineHaulValue
                  lineHaulCount += 1
                }
                const codValue = parseKpiNumber(record.cod_remittance)
                if (record.cod_remittance !== undefined && record.cod_remittance !== null && String(record.cod_remittance).trim() !== '') {
                  codSum += codValue
                  codCount += 1
                }
                const eodValue = parseKpiNumber(record.eod_compliance)
                if (record.eod_compliance !== undefined && record.eod_compliance !== null && String(record.eod_compliance).trim() !== '') {
                  eodSum += eodValue
                  eodCount += 1
                }
                const rtsValue = parseKpiNumber(record['RTS % Ach %'] ?? record.rts)
                if ((record['RTS % Ach %'] !== undefined && record['RTS % Ach %'] !== null && String(record['RTS % Ach %']).trim() !== '') ||
                    (record.rts !== undefined && record.rts !== null && String(record.rts).trim() !== '')) {
                  rtsSum += rtsValue
                  rtsCount += 1
                }
                const lossValue = parseKpiNumber(record['Loss % Ach %'] ?? record.loss)
                if ((record['Loss % Ach %'] !== undefined && record['Loss % Ach %'] !== null && String(record['Loss % Ach %']).trim() !== '') ||
                    (record.loss !== undefined && record.loss !== null && String(record.loss).trim() !== '')) {
                  lossSum += lossValue
                  lossCount += 1
                }
                const expediteValue = parseKpiNumber(record['Expedite Delivery Performance Ach %'] ?? record['Expedite Delivery Performance Ach Percent'] ?? record['Expedite Delivery Performance'] ?? record.expedite)
                if ((record['Expedite Delivery Performance Ach %'] !== undefined && record['Expedite Delivery Performance Ach %'] !== null && String(record['Expedite Delivery Performance Ach %']).trim() !== '') ||
                    (record['Expedite Delivery Performance Ach Percent'] !== undefined && record['Expedite Delivery Performance Ach Percent'] !== null && String(record['Expedite Delivery Performance Ach Percent']).trim() !== '') ||
                    (record['Expedite Delivery Performance'] !== undefined && record['Expedite Delivery Performance'] !== null && String(record['Expedite Delivery Performance']).trim() !== '') ||
                    (record.expedite !== undefined && record.expedite !== null && String(record.expedite).trim() !== '')) {
                  expediteSum += expediteValue
                  expediteCount += 1
                }
              })

              return {
                scorecard: scoreCount > 0 ? roundGraphValue(scoreSum / scoreCount) : 0,
                clearFloorRate: cfrCount > 0 ? roundGraphValue(cfrSum / cfrCount) : 0,
                successRate: srCount > 0 ? roundGraphValue(srSum / srCount) : 0,
                lineHaulCompliance: lineHaulCount > 0 ? roundGraphValue(lineHaulSum / lineHaulCount) : 0,
                codCompliance: codCount > 0 ? roundGraphValue(codSum / codCount) : 0,
                processCompliance: eodCount > 0 ? roundGraphValue(eodSum / eodCount) : 0,
                rts: rtsCount > 0 ? roundGraphValue(rtsSum / rtsCount) : 0,
                loss: lossCount > 0 ? roundGraphValue(lossSum / lossCount) : 0,
                expedite: expediteCount > 0 ? roundGraphValue(expediteSum / expediteCount) : 0,
                costPerParcel,
                deliveredAdo,
                dispatchedAdo,
                deliveredProd,
                assignedProd,
                fleetCount: fleetCountAvg
              }
            }

            const successRate = Number(filteredStats.successRate) || 0
            return { costPerParcel, deliveredAdo, dispatchedAdo, successRate, deliveredProd, assignedProd, fleetCount: fleetCountAvg }
          })()

          return (
            <div className="flex gap-2">
              {hubViewMode === 'kpi' ? (
                <>
                  <CompactStatCard title="Scorecard" value={`${hubLevelTopKpis.scorecard || 0}%`} icon={CheckCircle} accentColor="bg-cyan-600" />
                  <CompactStatCard title="Clear Floor" value={`${hubLevelTopKpis.clearFloorRate || 0}%`} icon={Package} accentColor="bg-emerald-600" />
                  <CompactStatCard title="Success Rate" value={`${hubLevelTopKpis.successRate || 0}%`} icon={Zap} accentColor="bg-green-600" />
                  <CompactStatCard title="Line Haul" value={`${hubLevelTopKpis.lineHaulCompliance || 0}%`} icon={TrendingUp} accentColor="bg-blue-600" />
                  <CompactStatCard title="COD Compliance" value={`${hubLevelTopKpis.codCompliance || 0}%`} icon={Users} accentColor="bg-purple-600" />
                  <CompactStatCard title="Process Compliance" value={`${hubLevelTopKpis.processCompliance || 0}%`} icon={CheckCircle} accentColor="bg-orange-500" />
                  <CompactStatCard title="RTS" value={`${hubLevelTopKpis.rts || 0}%`} icon={Zap} accentColor="bg-maroon-500" />
                  <CompactStatCard title="Loss" value={`${hubLevelTopKpis.loss || 0}%`} icon={AlertTriangle} accentColor="bg-red-600" />
                  <CompactStatCard title="Expedite" value={`${hubLevelTopKpis.expedite || 0}%`} icon={Sparkles} accentColor="bg-sky-500" />
                </>
              ) : (
                <>
                  <CompactStatCard title="Cost Per Parcel" value={hubLevelTopKpis.costPerParcel?.toString() || '0'} icon={Package} accentColor="bg-emerald-600" />
                  <CompactStatCard title="Delivered Ado" value={hubLevelTopKpis.deliveredAdo?.toString() || '0'} icon={CheckCircle} accentColor="bg-maroon-500" />
                  <CompactStatCard title="Dispatched Ado" value={hubLevelTopKpis.dispatchedAdo?.toString() || '0'} icon={Zap} accentColor="bg-orange-500" />
                  <CompactStatCard title="Success Rate" value={`${hubLevelTopKpis.successRate || 0}%`} icon={CheckCircle} accentColor="bg-green-600" />
                  <CompactStatCard title="Delivered Prod" value={hubLevelTopKpis.deliveredProd?.toString() || '0'} icon={Package} accentColor="bg-cyan-600" />
                  <CompactStatCard title="Assigned Prod" value={hubLevelTopKpis.assignedProd?.toString() || '0'} icon={TrendingUp} accentColor="bg-blue-600" />
                  <CompactStatCard title="Fleet Count" value={hubLevelTopKpis.fleetCount?.toString() || '0'} icon={Users} accentColor="bg-purple-600" />
                </>
              )}
            </div>
          )
        })()}
      </div>
      )}

      {/* Charts Row - Horizontal Layout - Hub Level Only */}
      {dashboardView === 'hub' && (
      <div className="space-y-4">
        {/* Top Row: Delivery Trend Only */}
        <div>
          {/* Delivery Performance - Area/Bar Chart */}
          <div className="relative bg-slate-800/80 backdrop-blur-sm rounded-lg p-3 border border-slate-600/50 hover:border-slate-500/50 transition-all duration-300 shadow-[0_0_20px_rgba(0,0,0,0.2)]">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <div className="w-1 h-4 bg-maroon-500 rounded-full shadow-[0_0_10px_rgba(168,48,48,0.5)]"></div>
                <h3 className="text-sm font-semibold text-white tracking-wide">{hubViewMode === 'kpi' ? 'KPI Trend' : 'Performance Trend'}</h3>
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
                      Line Chart
                    </button>
                    <button
                      onClick={() => setHubDeliveryTrendTab('graph')}
                      className={`px-3 py-1 rounded text-xs font-medium transition-all ${
                        hubDeliveryTrendTab === 'graph'
                          ? 'bg-maroon-500 text-white'
                          : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      Bar Graph
                    </button>
                  </div>
                </div>
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
                      data={filteredChartDataWithSelectedValue}
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
                        interval={0}
                        minTickGap={0}
                        angle={0}
                        textAnchor="middle"
                        height={40}
                        tickMargin={8}
                        tickFormatter={formatCompactDateTick}
                      />
                      <YAxis 
                        stroke="#94a3b8" 
                        fontSize={9} 
                        tickLine={false} 
                        axisLine={false} 
                        width={50}
                        domain={chartDomain}
                        ticks={yTicks}
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
                        formatter={formatDeliveryTrendTooltip}
                      />
                      {targets[selectedCategory] && targets[selectedCategory] > 0 && (
                        <Legend
                          verticalAlign="top"
                          align="center"
                          payload={[
                            {
                              value: `${targets[selectedCategory]}${selectedCategory === 'Success Rate' ? '%' : ''}`,
                              type: 'line',
                              color: '#10b981',
                              strokeDasharray: '5 5'
                            }
                          ]}
                          wrapperStyle={{ color: '#10b981', fontSize: 11, paddingBottom: 8 }}
                        />
                      )}
                      {targets[selectedCategory] && targets[selectedCategory] > 0 && (
                        <ReferenceLine
                          y={targets[selectedCategory]}
                          stroke="#10b981"
                          strokeWidth={2}
                          strokeDasharray="5 5"
                        />
                      )}
                      <Area 
                        type="monotone" 
                        dataKey="displayValue"
                        name={selectedCategory}
                        stroke="#a83030" 
                        strokeWidth={2}
                        fillOpacity={0.3} 
                        fill="url(#colorDeliveries)"
                        animationDuration={1200}
                        animationEasing="ease-in-out"
                        isAnimationActive={true}
                      >
                        <LabelList dataKey="displayValue" position="top" formatter={(value) => formatGraphValue(value, selectedCategory)} fill="#ffffff" fontSize={12} />
                      </Area>
                      <Line
                        type="monotone"
                        dataKey="displayValue"
                        name={selectedCategory}
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
                  data={filteredChartDataWithSelectedValue}
                  margin={{ top: filteredChartData[0]?.currentLabel ? 24 : 10, right: 20, left: 0, bottom: 10 }}
                  isAnimationActive={true}
                  animationDuration={1200}
                >
                  <defs>
                    <linearGradient id="colorBar" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#a83030" stopOpacity={0.8}/>
                      <stop offset="95%" stopColor="#a83030" stopOpacity={0.4}/>
                    </linearGradient>
                    <linearGradient id="colorLast7" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#0ea5e9" stopOpacity={0.95}/>
                      <stop offset="95%" stopColor="#0284c7" stopOpacity={0.75}/>
                    </linearGradient>
                    <linearGradient id="colorPrior7" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#ef4444" stopOpacity={0.95}/>
                      <stop offset="95%" stopColor="#dc2626" stopOpacity={0.75}/>
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
                    minTickGap={0}
                    angle={0}
                    textAnchor="middle"
                    height={40}
                    tickMargin={8}
                    tickFormatter={formatCompactDateTick}
                  />
                  <YAxis 
                    stroke="#94a3b8" 
                    fontSize={9} 
                    tickLine={false} 
                    axisLine={false} 
                    width={40}
                    domain={chartDomain}
                    ticks={yTicks}
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
                    formatter={formatDeliveryTrendTooltip}
                  />
                  {filteredChartData[0]?.currentLabel && filteredChartData[0]?.priorLabel && (
                    <Legend
                      verticalAlign="top"
                      align="center"
                      iconType="square"
                      wrapperStyle={{ color: '#cbd5e1', fontSize: 11, paddingBottom: 8 }}
                    />
                  )}
                  {targets[selectedCategory] && targets[selectedCategory] > 0 && (
                    <Legend
                      verticalAlign="top"
                      align="center"
                      iconType="square"
                      payload={[
                        {
                          value: `${targets[selectedCategory]}${selectedCategory === 'Success Rate' ? '%' : ''}`,
                          type: 'line',
                          color: '#10b981',
                          strokeDasharray: '5 5'
                        }
                      ]}
                      wrapperStyle={{ color: '#10b981', fontSize: 11, paddingBottom: 8 }}
                    />
                  )}
                  {targets[selectedCategory] && targets[selectedCategory] > 0 && (
                    <ReferenceLine
                      y={targets[selectedCategory]}
                      stroke="#10b981"
                      strokeWidth={2}
                      strokeDasharray="5 5"
                    />
                  )}
                  {filteredChartData[0]?.currentLabel && filteredChartData[0]?.priorLabel ? (
                    <>
                      <Bar 
                        dataKey="currentPeriod"
                        name={filteredChartData[0].currentLabel}
                        fill="url(#colorLast7)"
                        animationDuration={1200}
                        animationEasing="ease-in-out"
                        isAnimationActive={true}
                        radius={[4, 4, 0, 0]}
                      >
                        <LabelList dataKey="currentPeriod" position="top" formatter={(value) => formatGraphValue(value, selectedCategory)} fill="#38bdf8" fontSize={12} />
                      </Bar>
                      <Bar 
                        dataKey="priorPeriod"
                        name={filteredChartData[0].priorLabel}
                        fill="url(#colorPrior7)"
                        animationDuration={1200}
                        animationEasing="ease-in-out"
                        isAnimationActive={true}
                        radius={[4, 4, 0, 0]}
                      >
                        <LabelList dataKey="priorPeriod" position="top" formatter={(value) => formatGraphValue(value, selectedCategory)} fill="#f87171" fontSize={12} />
                      </Bar>
                    </>
                  ) : (
                    <Bar 
                      dataKey="displayValue"
                      name={selectedCategory}
                      fill="url(#colorBar)"
                      animationDuration={1200}
                      animationEasing="ease-in-out"
                      isAnimationActive={true}
                      radius={[4, 4, 0, 0]}
                    >
                      <LabelList dataKey="displayValue" position="top" formatter={(value) => formatGraphValue(value, selectedCategory)} fill="#ffffff" fontSize={12} />
                    </Bar>
                  )}
                </BarChart>
              )
            ) : (
              <div className="flex items-center justify-center h-full">
                <span className="text-slate-400 text-sm">
                  {selectedCluster ? (hubViewMode === 'kpi' ? 'KPI Trend is disabled while a cluster is selected' : 'Performance Trend is disabled while a cluster is selected') : 'Select a hub or date range to view trend'}
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

          
        </div>

        {selectedCluster ? (
          clusterHubSections.length > 0 ? (
            <div className="space-y-8">
              {clusterHubSections.map(({ hub, sevenDayData, graphData }) => {
                const sevenDayValues = sevenDayData.flatMap(item => [
                  Number(item.currentPeriod) || 0,
                  Number(item.priorPeriod) || 0
                ])
                const sevenDayMax = sevenDayValues.length > 0 ? Math.max(...sevenDayValues) : 0
                const sevenDayDomain = ['Success Rate', 'Assigned Prod', ...KPI_TREND_OPTIONS].includes(selectedCategory)
                  ? [0, 110]
                  : [0, Math.max(10, Math.ceil(Math.max(sevenDayMax, Number(targets[selectedCategory]) || 0) * 1.2))]
                const sevenDayTicks = buildTicksWithTarget(
                  sevenDayDomain,
                  sevenDayDomain[1] === 100 ? [0, 20, 40, 60, 80, 100] : undefined,
                  targets[selectedCategory]
                )
                const graphValues = graphData.flatMap(item => Number(item.selectedValue) || 0)
                const graphMax = graphValues.length > 0 ? Math.max(...graphValues) : 0
                const graphDomain = ['Success Rate', 'Assigned Prod', ...KPI_TREND_OPTIONS].includes(selectedCategory)
                  ? [0, 100]
                  : [0, Math.max(10, Math.ceil(Math.max(graphMax, Number(targets[selectedCategory]) || 0) * 1.2))]
                const graphTicks = buildTicksWithTarget(
                  graphDomain,
                  graphDomain[1] === 100 ? [0, 20, 40, 60, 80, 100] : undefined,
                  targets[selectedCategory]
                )
                const safeHubId = String(hub || '')
                  .trim()
                  .toLowerCase()
                  .replace(/\s+/g, '-')
                  .replace(/[^a-z0-9_-]/g, '')

                return (
                  <div key={hub} className="space-y-4">
                    <div className="text-sm font-semibold text-white">Hub: {hub}</div>
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                      <div className="lg:col-span-2 relative bg-slate-800/80 backdrop-blur-sm rounded-lg p-3 border border-slate-600/50 hover:border-slate-500/50 transition-all duration-300 shadow-[0_0_20px_rgba(0,0,0,0.2)]">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <div className="w-1 h-4 bg-maroon-500 rounded-full shadow-[0_0_10px_rgba(168,48,48,0.5)]"></div>
                            <h3 className="text-sm font-semibold text-white tracking-wide">Last vs Prior 7 Days</h3>
                          </div>
                        </div>
                        <ResponsiveContainer width="100%" height={380}>
                          {sevenDayData.length > 0 ? (
                            <BarChart
                              data={sevenDayData}
                              margin={{ top: 24, right: 24, left: 0, bottom: 30 }}
                              isAnimationActive={true}
                              animationDuration={1200}
                            >
                              <defs>
                                <linearGradient id={`colorCompareLast7-${safeHubId}`} x1="0" y1="0" x2="0" y2="1">
                                  <stop offset="5%" stopColor="#0ea5e9" stopOpacity={0.55}/>
                                  <stop offset="95%" stopColor="#0284c7" stopOpacity={0.28}/>
                                </linearGradient>
                                <linearGradient id={`colorComparePrior7-${safeHubId}`} x1="0" y1="0" x2="0" y2="1">
                                  <stop offset="5%" stopColor="#ef4444" stopOpacity={0.55}/>
                                  <stop offset="95%" stopColor="#dc2626" stopOpacity={0.28}/>
                                </linearGradient>
                              </defs>
                              <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.5} />
                              <XAxis
                                dataKey="month"
                                stroke="#94a3b8"
                                fontSize={9}
                                tickLine={false}
                                axisLine={false}
                                interval={0}
                                height={54}
                              />
                              <YAxis
                                stroke="#94a3b8"
                                fontSize={9}
                                tickLine={false}
                                axisLine={false}
                                width={45}
                                domain={sevenDayDomain}
                                ticks={sevenDayTicks}
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
                              <Legend
                                verticalAlign="top"
                                align="center"
                                wrapperStyle={{ color: '#cbd5e1', fontSize: 11, paddingBottom: 8 }}
                                payload={targets[selectedCategory] && targets[selectedCategory] > 0 ? [
                                  {
                                    value: sevenDayData[0]?.currentLabel || 'Last 7 Days',
                                    type: 'rect',
                                    color: '#a83030'
                                  },
                                  {
                                    value: sevenDayData[0]?.priorLabel || 'Prior 7 Days',
                                    type: 'rect',
                                    color: '#38bdf8'
                                  },
                                  {
                                    value: `${targets[selectedCategory]}${selectedCategory === 'Success Rate' ? '%' : ''}`,
                                    type: 'line',
                                    color: '#10b981',
                                    strokeDasharray: '5 5'
                                  }
                                ] : undefined}
                              />
                              {targets[selectedCategory] && targets[selectedCategory] > 0 && (
                                <ReferenceLine
                                  y={targets[selectedCategory]}
                                  stroke="#10b981"
                                  strokeWidth={2}
                                  strokeDasharray="5 5"
                                />
                              )}
                              <Bar
                                dataKey="currentPeriod"
                                name={sevenDayData[0]?.currentLabel || 'Last 7 Days'}
                                fill={`url(#colorCompareLast7-${safeHubId})`}
                                animationDuration={1200}
                                animationEasing="ease-in-out"
                                isAnimationActive={true}
                                radius={[4, 4, 0, 0]}
                              >
                                <LabelList dataKey="currentPeriod" position="top" formatter={(value) => formatGraphValue(value, selectedCategory)} fill="#38bdf8" fontSize={12} />
                              </Bar>
                              <Bar
                                dataKey="priorPeriod"
                                name={sevenDayData[0]?.priorLabel || 'Prior 7 Days'}
                                fill={`url(#colorComparePrior7-${safeHubId})`}
                                animationDuration={1200}
                                animationEasing="ease-in-out"
                                isAnimationActive={true}
                                radius={[4, 4, 0, 0]}
                              >
                                <LabelList dataKey="priorPeriod" position="top" formatter={(value) => formatGraphValue(value, selectedCategory)} fill="#f87171" fontSize={12} />
                              </Bar>
                            </BarChart>
                          ) : (
                            <div className="flex items-center justify-center h-full">
                              <span className="text-slate-400 text-sm">No hub data available for this period</span>
                            </div>
                          )}
                        </ResponsiveContainer>
                      </div>

                      <div className="lg:col-span-1 relative bg-slate-800/80 backdrop-blur-sm rounded-lg p-3 border border-slate-600/50 hover:border-slate-500/50 transition-all duration-300 shadow-[0_0_20px_rgba(0,0,0,0.2)]">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <div className="w-1 h-4 bg-maroon-500 rounded-full shadow-[0_0_10px_rgba(168,48,48,0.5)]"></div>
                            <h3 className="text-sm font-semibold text-white tracking-wide">Graph Comparison</h3>
                          </div>
                        </div>
                        <ResponsiveContainer width="100%" height={380}>
                          {graphData.length > 0 ? (
                            <BarChart
                              data={graphData}
                              margin={{ top: 24, right: 30, left: 0, bottom: 30 }}
                              isAnimationActive={true}
                              animationDuration={1200}
                            >
                              <defs>
                                <linearGradient id={`colorCompare-${safeHubId}`} x1="0" y1="0" x2="0" y2="1">
                                  <stop offset="5%" stopColor="#a83030" stopOpacity={0.8}/>
                                  <stop offset="95%" stopColor="#a83030" stopOpacity={0.4}/>
                                </linearGradient>
                              </defs>
                              <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.5} />
                              <XAxis
                                dataKey="period"
                                stroke="#94a3b8"
                                fontSize={9}
                                tick={false}
                                tickLine={false}
                                axisLine={false}
                                interval={0}
                                height={36}
                              />
                              <YAxis
                                stroke="#94a3b8"
                                fontSize={9}
                                tickLine={false}
                                axisLine={false}
                                width={50}
                                domain={graphDomain}
                                ticks={graphTicks}
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
                              <Legend
                                verticalAlign="top"
                                align="center"
                                wrapperStyle={{ color: '#cbd5e1', fontSize: 11, paddingBottom: 8 }}
                                payload={
                                  [
                                    {
                                      value: selectedCategory,
                                      type: 'rect',
                                      color: '#a83030'
                                    },
                                    ...(targets[selectedCategory] && targets[selectedCategory] > 0 ? [
                                      {
                                        value: `${targets[selectedCategory]}${selectedCategory === 'Success Rate' ? '%' : ''}`,
                                        type: 'line',
                                        color: '#10b981',
                                        strokeDasharray: '5 5'
                                      }
                                    ] : [])
                                  ]
                                }
                              />
                              {targets[selectedCategory] && targets[selectedCategory] > 0 && (
                                <ReferenceLine
                                  y={targets[selectedCategory]}
                                  stroke="#10b981"
                                  strokeWidth={2}
                                  strokeDasharray="5 5"
                                />
                              )}
                              <Bar
                                dataKey="selectedValue"
                                name={selectedCategory}
                                fill={`url(#colorCompare-${safeHubId})`}
                                animationDuration={1200}
                                animationEasing="ease-in-out"
                                isAnimationActive={true}
                                radius={[4, 4, 0, 0]}
                              >
                                <LabelList dataKey="selectedValue" position="top" formatter={(value) => formatGraphValue(value, selectedCategory)} fill="#ffffff" fontSize={12} />
                                <LabelList dataKey="period" content={<GraphComparisonPeriodLabel />} />
                              </Bar>
                            </BarChart>
                          ) : (
                            <div className="flex items-center justify-center h-full">
                              <span className="text-slate-400 text-sm">No graph data available for this hub</span>
                            </div>
                          )}
                        </ResponsiveContainer>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          ) : (
            <div className="flex items-center justify-center rounded-lg bg-slate-800/80 border border-slate-600/50 p-8 text-center text-slate-400">
              Select a cluster to view hub Last vs Prior 7 Days and Graph Comparison.
            </div>
          )
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* Last vs Prior 7 Days - Wider (left, spans 2 columns on large screens) */}
            <div className="lg:col-span-2 relative bg-slate-800/80 backdrop-blur-sm rounded-lg p-3 border border-slate-600/50 hover:border-slate-500/50 transition-all duration-300 shadow-[0_0_20px_rgba(0,0,0,0.2)]">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <div className="w-1 h-4 bg-maroon-500 rounded-full shadow-[0_0_10px_rgba(168,48,48,0.5)]"></div>
                  <h3 className="text-sm font-semibold text-white tracking-wide">Last vs Prior 7 Days</h3>
                </div>
              </div>
              <ResponsiveContainer width="100%" height={380}>
                {hubSevenDayComparisonData.length > 0 ? (
                  <BarChart
                    data={hubSevenDayComparisonData}
                    margin={{ top: 24, right: 24, left: 0, bottom: 30 }}
                    isAnimationActive={true}
                    animationDuration={1200}
                  >
                    <defs>
                      <linearGradient id="colorCompareLast7" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#0ea5e9" stopOpacity={0.55}/>
                        <stop offset="95%" stopColor="#0284c7" stopOpacity={0.28}/>
                      </linearGradient>
                      <linearGradient id="colorComparePrior7" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#ef4444" stopOpacity={0.55}/>
                        <stop offset="95%" stopColor="#dc2626" stopOpacity={0.28}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.5} />
                    <XAxis 
                      dataKey="month" 
                      stroke="#94a3b8" 
                      fontSize={9} 
                      tick={{ fill: '#cbd5e1', dy: 8 }}
                      tickLine={false} 
                      axisLine={false}
                      interval={0}
                      height={74}
                    />
                    <YAxis 
                      stroke="#94a3b8" 
                      fontSize={9} 
                      tickLine={false} 
                      axisLine={false} 
                      width={45}
                      domain={hubSevenDayComparisonDomain}
                      ticks={hubYTicks}
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
                    <Legend
                      verticalAlign="top"
                      align="center"
                      wrapperStyle={{ color: '#cbd5e1', fontSize: 11, paddingBottom: 8 }}
                      payload={targets[selectedCategory] && targets[selectedCategory] > 0 ? [
                        {
                          value: hubSevenDayComparisonData[0]?.currentLabel || 'Last 7 Days',
                          type: 'rect',
                          color: '#a83030'
                        },
                        {
                          value: hubSevenDayComparisonData[0]?.priorLabel || 'Prior 7 Days',
                          type: 'rect',
                          color: '#38bdf8'
                        },
                        {
                          value: `${targets[selectedCategory]}${selectedCategory === 'Success Rate' ? '%' : ''}`,
                          type: 'line',
                          color: '#10b981',
                          strokeDasharray: '5 5'
                        }
                      ] : undefined}
                    />
                    {targets[selectedCategory] && targets[selectedCategory] > 0 && (
                      <ReferenceLine
                        y={targets[selectedCategory]}
                        stroke="#10b981"
                        strokeWidth={2}
                        strokeDasharray="5 5"
                      />
                    )}
                    <Bar
                      dataKey="currentPeriod"
                      name={hubSevenDayComparisonData[0]?.currentLabel || 'Last 7 Days'}
                      fill="url(#colorCompareLast7)"
                      animationDuration={1200}
                      animationEasing="ease-in-out"
                      isAnimationActive={true}
                      radius={[4, 4, 0, 0]}
                    >
                      <LabelList dataKey="currentPeriod" position="top" formatter={(value) => formatGraphValue(value, selectedCategory)} fill="#38bdf8" fontSize={12} />
                    </Bar>
                    <Bar
                      dataKey="priorPeriod"
                      name={hubSevenDayComparisonData[0]?.priorLabel || 'Prior 7 Days'}
                      fill="url(#colorComparePrior7)"
                      animationDuration={1200}
                      animationEasing="ease-in-out"
                      isAnimationActive={true}
                      radius={[4, 4, 0, 0]}
                    >
                      <LabelList dataKey="priorPeriod" position="top" formatter={(value) => formatGraphValue(value, selectedCategory)} fill="#f87171" fontSize={12} />
                    </Bar>
                  </BarChart>
                ) : (
                  <div className="flex items-center justify-center h-full">
                    <span className="text-slate-400 text-sm">Select a hub or cluster to compare prior and last 7 days</span>
                  </div>
                )}
              </ResponsiveContainer>
            </div>
            
            {/* Graph Comparison - Right, narrower */}
            <div className="lg:col-span-1 relative bg-slate-800/80 backdrop-blur-sm rounded-lg p-3 border border-slate-600/50 hover:border-slate-500/50 transition-all duration-300 shadow-[0_0_20px_rgba(0,0,0,0.2)]">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <div className="w-1 h-4 bg-maroon-500 rounded-full shadow-[0_0_10px_rgba(168,48,48,0.5)]"></div>
                  <h3 className="text-sm font-semibold text-white tracking-wide">Graph Comparison</h3>
                </div>
              </div>
              <ResponsiveContainer width="100%" height={380}>
                {hubLevelGraphComparisonChartData.length > 0 ? (
                  <BarChart
                    data={hubLevelGraphComparisonChartData}
                    margin={{ top: 24, right: 30, left: 0, bottom: 30 }}
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
                      fontSize={9}
                      tickLine={false}
                      axisLine={false}
                      interval={0}
                      height={54}
                      tickFormatter={(value) => value}
                    />
                    <YAxis 
                      stroke="#94a3b8" 
                      fontSize={9} 
                      tickLine={false} 
                      axisLine={false} 
                      width={50}
                      domain={hubLevelGraphComparisonDomain}
                      ticks={hubLevelYTicks}
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
                    <Legend
                      verticalAlign="top"
                      align="center"
                      wrapperStyle={{ color: '#cbd5e1', fontSize: 11, paddingBottom: 8 }}
                      payload={
                        [
                          {
                            value: selectedCategory,
                            type: 'rect',
                            color: '#a83030'
                          },
                          ...(targets[selectedCategory] && targets[selectedCategory] > 0 ? [
                            {
                              value: `${targets[selectedCategory]}${selectedCategory === 'Success Rate' ? '%' : ''}`,
                              type: 'line',
                              color: '#10b981',
                              strokeDasharray: '5 5'
                            }
                          ] : [])
                        ]
                      }
                    />
                    {targets[selectedCategory] && targets[selectedCategory] > 0 && (
                      <ReferenceLine
                        y={targets[selectedCategory]}
                        stroke="#10b981"
                        strokeWidth={2}
                        strokeDasharray="5 5"
                      />
                    )}
                    <Bar 
                      dataKey="selectedValue"
                      name={selectedCategory}
                      fill="url(#colorCompare)"
                      animationDuration={1200}
                      animationEasing="ease-in-out"
                      isAnimationActive={true}
                      radius={[4, 4, 0, 0]}
                    >
                      <LabelList dataKey="selectedValue" position="top" formatter={(value) => formatGraphValue(value, selectedCategory)} fill="#ffffff" fontSize={12} />
                    </Bar>
                  </BarChart>
                ) : (
                  <div className="flex items-center justify-center h-full">
                    <span className="text-slate-400 text-sm">
                      Select a hub or cluster to view comparison
                    </span>
                  </div>
                )}
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* KPI Distribution Section - Full Width Below */}
        {false && (selectedHub && selectedHub !== 'All Hubs' ? (
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
        ))}
      </div>
      )}

      {/* Rider Stats Section - Hub Level Only */}
      {false && dashboardView === 'hub' && (
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
                {hubViewMode === 'kpi' ? 'KPI Trend' : 'Performance Trend'}
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
                  Line Chart
                </button>
                <button
                  onClick={() => setRiderDeliveryTrendTab('graph')}
                  className={`px-3 py-1 rounded text-xs font-medium transition-all ${
                    riderDeliveryTrendTab === 'graph'
                      ? 'bg-maroon-500 text-white'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Bar Graph
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
                      tickFormatter={formatCompactDateTick}
                      interval={0}
                      minTickGap={0}
                      angle={0}
                      textAnchor="middle"
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
                          return [`${roundGraphValue(value)}%`, 'Success Rate']
                        }
                        return [roundGraphValue(value), riderTrendMetric]
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
                        formatter={(value) => riderTrendMetric === 'successRate' ? `${roundGraphValue(value)}%` : roundGraphValue(value)}
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
                      tickFormatter={formatCompactDateTick}
                      interval={0}
                      minTickGap={0}
                      angle={0}
                      textAnchor="middle"
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
                          return [`${roundGraphValue(value)}%`, 'Success Rate']
                        }
                        return [roundGraphValue(value), riderTrendMetric]
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
                        formatter={(value) => riderTrendMetric === 'successRate' ? `${roundGraphValue(value)}%` : roundGraphValue(value)}
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
        selectedCluster ? (
      <div className="space-y-4">
        {/* Region Title */}
        <div className="text-center">
          <h2 className="text-xl font-bold text-white">{selectedCluster}</h2>
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
        ) : (
          <div className="flex items-center justify-center rounded-lg bg-slate-800/80 border border-slate-600/50 p-8 text-center text-slate-400">
            Select a cluster to view hub Last vs Prior 7 Days and Graph Comparison.
          </div>
        )
      )}
    </div>
  )
}

export default Dashboard
