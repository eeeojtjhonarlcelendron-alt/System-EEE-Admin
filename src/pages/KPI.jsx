// Clean version - all percentage and grade fixes applied
import { useState, useEffect, useRef } from 'react'
import { Upload, Filter, Download, Search, X, ChevronDown, Loader2, Calendar, Building2, MapPin, CheckCircle, AlertCircle, AlertTriangle, Users } from 'lucide-react'
import * as XLSX from 'xlsx'
import { getKpiRecords, batchInsertKpiRecords, deleteAllKpiRecords, getClusterLeaders } from '../lib/data'
import { SkeletonKPI, ProgressBarLoader } from '../components/Skeleton'

function parsePercentage(value) {
  if (value === null || value === undefined || value === '') return 0
  const num = parseFloat(value)
  if (isNaN(num)) return 0
  // Convert decimals (0.93) to integers (93)
  const result = num <= 1 ? Math.round(num * 100) : Math.round(num)
  return result
}

function parseDate(dateValue) {
  if (!dateValue) return null
  
  // Handle Excel serial date numbers (e.g., 45367 for 2024-03-15)
  if (typeof dateValue === 'number' && dateValue > 30000 && dateValue < 60000) {
    // Excel's epoch is 1900-01-01 (Windows) or 1904-01-01 (Mac)
    // Using 1900-01-01 as base, subtracting 1 day for Excel's 1900 leap year bug
    const excelEpoch = new Date(1900, 0, 1)
    const date = new Date(excelEpoch.getTime() + (dateValue - 1) * 24 * 60 * 60 * 1000)
    if (!isNaN(date.getTime())) {
      const year = date.getFullYear()
      const month = String(date.getMonth() + 1).padStart(2, '0')
      const day = String(date.getDate()).padStart(2, '0')
      return `${year}-${month}-${day}`
    }
  }
  
  // Handle Date objects (from Excel parsing)
  if (dateValue instanceof Date) {
    if (isNaN(dateValue.getTime())) return null
    const year = dateValue.getFullYear()
    const month = String(dateValue.getMonth() + 1).padStart(2, '0')
    const day = String(dateValue.getDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
  }
  
  // Convert to string if not already
  const dateStr = String(dateValue).trim()
  if (dateStr === '') return null
  
  // If already in YYYY-MM-DD format
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return dateStr
  
  // Parse M/D/YYYY or MM/DD/YYYY format (e.g., "3/15/2024" or "03/15/2024")
  const slashMatch = dateStr.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
  if (slashMatch) {
    const month = slashMatch[1].padStart(2, '0')
    const day = slashMatch[2].padStart(2, '0')
    const year = slashMatch[3]
    return `${year}-${month}-${day}`
  }
  
  // Parse other formats using Date object
  const date = new Date(dateStr)
  if (!isNaN(date.getTime())) {
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
  }
  
  return null
}

function KPI() {
  const [data, setData] = useState([])
  const [filteredData, setFilteredData] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadingProgress, setLoadingProgress] = useState(0)
  const [loadingStage, setLoadingStage] = useState('')
  const [showFilters, setShowFilters] = useState(false)
  const [filters, setFilters] = useState({
    dateFrom: '',
    dateTo: '',
    subRegion: '',
    operatorHub: '',
    rider: '',
    grade: '',
    clusterLead: '',
  })
  const [searchTerm, setSearchTerm] = useState('')
  const fileInputRef = useRef(null)
  const [showUploadModal, setShowUploadModal] = useState(false)
  const [importProgress, setImportProgress] = useState({ current: 0, total: 0, status: '' })
  const [message, setMessage] = useState({ type: '', text: '' })
  const [clusterLeaders, setClusterLeaders] = useState([])

  const showMessage = (type, text) => {
    setMessage({ type, text })
    setTimeout(() => setMessage({ type: '', text: '' }), 5000)
  }

  useEffect(() => {
    async function fetchData() {
      try {
        setLoading(true)
        setLoadingProgress(0)
        setLoadingStage('Initializing KPI data fetch...')
        
        // Create incremental progress function
        const incrementProgress = async (startProgress, targetProgress, stageText, dataFetchFunction) => {
          setLoadingStage(stageText)
          const steps = targetProgress - startProgress
          
          // Increment by 1% at a time
          for (let i = 1; i <= steps; i++) {
            setLoadingProgress(startProgress + i)
            await new Promise(resolve => setTimeout(resolve, 20)) // Small delay for visibility
          }
          
          return await dataFetchFunction()
        }
        
        let currentProgress = 0
        
        // Stage 1: Fetch KPI records (50%)
        const { data: records, error } = await incrementProgress(currentProgress, 50, 'Loading KPI records...', () => getKpiRecords())
        currentProgress = 50
        
        // Stage 2: Process data (80%)
        await incrementProgress(currentProgress, 80, 'Processing KPI data...', async () => {
          if (!error && records) {
            setData(records)
            setFilteredData(records)
          }
        })
        currentProgress = 80
        
        // Final stage: Complete (100%)
        setLoadingStage('Finalizing...')
        for (let i = 81; i <= 100; i++) {
          setLoadingProgress(i)
          await new Promise(resolve => setTimeout(resolve, 20))
        }
      } catch (error) {
        console.error('Error fetching KPI data:', error)
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [])

  // Fetch cluster leaders on mount
  useEffect(() => {
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

  const handleFilterChange = (key, value) => {
    setFilters(prev => ({ ...prev, [key]: value }))
  }

  const applyFilters = () => {
    let result = data

    if (searchTerm) {
      const searchLower = searchTerm.toLowerCase()
      result = result.filter(item => 
        (item.region?.toLowerCase() || '').includes(searchLower) ||
        (item.sub_region?.toLowerCase() || '').includes(searchLower) ||
        (item.operator_hub?.toLowerCase() || '').includes(searchLower) ||
        (item.cluster?.toLowerCase() || '').includes(searchLower)
      )
    }

    // Apply date filters
    if (filters.dateFrom) {
      result = result.filter(item => item.date >= filters.dateFrom)
    }
    if (filters.dateTo) {
      result = result.filter(item => item.date <= filters.dateTo)
    }

    // Apply cluster lead filter
    if (filters.clusterLead) {
      // Create hub-to-cluster mapping from cluster leaders
      const hubToClusterMap = {}
      clusterLeaders.forEach(leader => {
        if (leader.hubs && Array.isArray(leader.hubs)) {
          leader.hubs.forEach(hub => {
            hubToClusterMap[hub] = leader.leader_name
          })
        }
      })
      
      result = result.filter(item => {
        const clusterLead = hubToClusterMap[item.operator_hub]
        return clusterLead === filters.clusterLead
      })
    }

    // Sort by date first (newest first), then alphabetically by region, sub-region, operator hub
    result.sort((a, b) => {
      // Compare date first (newest first)
      const dateA = a.date || ''
      const dateB = b.date || ''
      if (dateA !== dateB) {
        return dateB.localeCompare(dateA) // Newest first
      }
      
      // If dates are equal, compare region
      const regionA = (a.region || '').toLowerCase()
      const regionB = (b.region || '').toLowerCase()
      if (regionA !== regionB) {
        return regionA.localeCompare(regionB)
      }
      
      // If regions are equal, compare sub-region
      const subRegionA = (a.sub_region || '').toLowerCase()
      const subRegionB = (b.sub_region || '').toLowerCase()
      if (subRegionA !== subRegionB) {
        return subRegionA.localeCompare(subRegionB)
      }
      
      // If sub-regions are equal, compare operator hub
      const hubA = (a.operator_hub || '').toLowerCase()
      const hubB = (b.operator_hub || '').toLowerCase()
      return hubA.localeCompare(hubB)
    })

    setFilteredData(result)
  }

  // Auto-apply filters when they change
  useEffect(() => {
    applyFilters()
  }, [filters, applyFilters])

  const clearFilters = () => {
    setFilters({ dateFrom: '', dateTo: '', subRegion: '', operatorHub: '', rider: '', grade: '', clusterLead: '' })
    setSearchTerm('')
    setFilteredData(data)
  }

  const handleImport = async (e) => {
    const file = e.target.files[0]
    if (!file) return

    const isExcel = file.name.endsWith('.xlsx') || file.name.endsWith('.xls')

    try {
      let jsonData = []

      if (isExcel) {
        // Parse Excel file
        const data = await file.arrayBuffer()
        const workbook = XLSX.read(data)
        const worksheet = workbook.Sheets[workbook.SheetNames[0]]
        jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 })
      } else {
        // Parse CSV file
        const csvText = await file.text()
        const lines = csvText.split('\n').filter(line => line.trim())
        jsonData = lines.map(line => line.split(',').map(v => v.trim()))
      }

      if (jsonData.length < 2) {
        showMessage('error', 'No data found in file')
        return
      }

      const headers = jsonData[0].map(h => h.toString().trim())
      console.log('Headers found:', headers) // Debug

      setImportProgress({ current: 0, total: jsonData.length - 1, status: 'Processing data...' })

      const formattedData = jsonData
        .slice(1)
        .filter(row => {
          // Less strict filtering - only filter out completely empty rows
          const hasAnyData = row.some(cell => cell && cell.toString().trim() !== '')
          return hasAnyData
        })
        .map((row) => {
          const rowData = {}
          headers.forEach((header, idx) => {
            rowData[header] = row[idx]
          })
          return {
            date: parseDate(rowData['Date']),
            region: rowData['Region'] || '',
            sub_region: rowData['Sub Region'] || '',
            operator_hub: rowData['Operator Hub'] || '',
            cluster: rowData['Cluster'] || '',
            score: parsePercentage(rowData['Score']),
            grade: ((score) => {
              // Auto-calculate grade based on score
              // A+: 95-100%, A: 90-94.99%, B+: 85-89.99%, B: 80-84.99%, C: 0-79.99%
              if (score >= 95) return 'A+'
              if (score >= 90) return 'A'
              if (score >= 85) return 'B+'
              if (score >= 80) return 'B'
              return 'C'
            })(parsePercentage(rowData['Score'])),
            remarks: rowData['Remarks'] || '',
            cfr: parsePercentage(rowData['CFR']),
            sr: parsePercentage(rowData['SR']),
            aging_four_days: parsePercentage(rowData['% Aging >= 4 days']),
            line_haul_compliance: parsePercentage(rowData['Line Haul Pick-up Compliance']),
            cod_remittance: parsePercentage(rowData['COD Remittance']),
            eod_compliance: parsePercentage(rowData['EOD Report Compliance']),
            rts: parsePercentage(rowData['RTS %']),
            loss: parsePercentage(rowData['Loss']),
          }
        })

      if (formattedData.length === 0) {
        showMessage('error', 'No valid data to import')
        setImportProgress({ current: 0, total: 0, status: '' })
        return
      }

      // Pass all data directly to batchInsertKpiRecords (handles batching internally)
      const allInserted = []

      setImportProgress({ current: 0, total: formattedData.length, status: `Importing...` })

      const { data: inserted, error } = await batchInsertKpiRecords(formattedData, (progress) => {
        setImportProgress({
          current: progress.current,
          total: formattedData.length,
          status: progress.status
        })
      })

      if (error) {
        console.error('Import error:', error)
        showMessage('error', `Import failed: ${error.message}. ${inserted?.length || 0} records were imported before the error.`)
        setImportProgress({ current: 0, total: 0, status: '' })
        if (inserted && inserted.length > 0) {
          setData(prev => [...inserted, ...prev])
          setFilteredData(prev => [...inserted, ...prev])
        }
        return
      }

      if (inserted) {
        allInserted.push(...inserted)
      }

      setData(prev => [...allInserted, ...prev])
      setFilteredData(prev => [...allInserted, ...prev])
      setShowUploadModal(false)
      showMessage('success', `Successfully imported ${allInserted.length} records`)
      setImportProgress({ current: 0, total: 0, status: '' })
    } catch (err) {
      console.error('Import error:', err)
      showMessage('error', 'Import failed: ' + err.message)
      setImportProgress({ current: 0, total: 0, status: '' })
    }

    // Reset file input
    e.target.value = ''
  }

  const handleDownloadTemplate = () => {
    const templateData = [{
      'Date': '3/15/2024',
      'Region': 'North',
      'Sub Region': 'Metro',
      'Operator Hub': 'Hub A',
      'Cluster': 'Cluster 1',
      'Score': '85.5',
      'Grade': 'A',
      'Remarks': 'Excellent performance',
      'CFR': '93',
      'SR': '99',
      '% Aging >= 4 days': '1',
      'Line Haul Pick-up Compliance': '99',
      'COD Remittance': '100',
      'EOD Report Compliance': '96',
      'RTS %': '1',
      'Loss': '0'
    }]
    
    const ws = XLSX.utils.json_to_sheet(templateData)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'KPI Template')
    XLSX.writeFile(wb, 'kpi_import_template.xlsx')
  }

  const handleDeleteAll = async () => {
    if (!confirm('Are you sure you want to delete all KPI records?')) return
    
    const { error } = await deleteAllKpiRecords()
    if (error) {
      showMessage('error', 'Delete failed: ' + error.message)
    } else {
      setData([])
      setFilteredData([])
      showMessage('success', 'All records deleted successfully')
    }
  }

  const handleExport = () => {
    const exportData = filteredData.map(item => ({
      'Date': item.date,
      'Region': item.region,
      'Sub Region': item.sub_region,
      'Operator Hub': item.operator_hub,
      'Cluster': item.cluster,
      'Score': item.score,
      'Grade': item.grade,
      'Remarks': item.remarks,
      'CFR': item.cfr,
      'SR': item.sr,
      '% Aging >= 4 days': item.aging_four_days,
      'Line Haul Pick-up Compliance': item.line_haul_compliance,
      'COD Remittance': item.cod_remittance,
      'EOD Report Compliance': item.eod_compliance,
      'RTS %': item.rts,
      'Loss': item.loss,
    }))
    
    const ws = XLSX.utils.json_to_sheet(exportData)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'KPI Data')
    XLSX.writeFile(wb, 'kpi_data.xlsx')
  }

  const uniqueSubRegions = [...new Set(data.map(item => item.sub_region).filter(Boolean))]
  const uniqueHubs = [...new Set(data.map(item => item.operator_hub))]
  const uniqueGrades = [...new Set(data.map(item => item.grade))]

  const getGradeBadgeColor = (grade) => {
    switch (grade) {
      case 'A+': return 'bg-maroon-900 text-maroon-100'
      case 'A': return 'bg-maroon-800 text-maroon-100'
      case 'B+': return 'bg-maroon-700 text-white'
      case 'B': return 'bg-maroon-600 text-white'
      case 'C': return 'bg-maroon-400 text-white'
      case 'D': return 'bg-maroon-300 text-maroon-900'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  if (loading) {
    return (
      <div className="space-y-6 relative">
        {/* Skeleton Loading Screen */}
        <SkeletonKPI />
        {/* Progress Loader - Centered overlay */}
        <ProgressBarLoader progress={loadingProgress} loadingStage={loadingStage} />
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-3">
        <div>
          <h1 className="text-xl font-bold text-white">KPI Management</h1>
          <p className="text-slate-400 mt-0.5 text-xs">Track and analyze key performance indicators</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowUploadModal(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-maroon-600 hover:bg-maroon-700 text-white rounded-lg transition-all duration-200 font-medium text-xs shadow-sm hover:shadow-md hover:scale-105"
          >
            <Upload className="w-3.5 h-3.5" />
            Upload
          </button>
          <button
            onClick={handleExport}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-all duration-200 font-medium text-xs hover:shadow-md"
          >
            <Download className="w-3.5 h-3.5" />
            Export
          </button>
        </div>
      </div>

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

      {/* Search and Filter */}
      <div className="bg-slate-800 rounded-xl shadow-sm border border-slate-700 p-2.5">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-7 gap-2.5">
          <div className="sm:col-span-2 lg:col-span-2">
            <label className="flex items-center gap-1 text-[10px] font-medium text-slate-400 mb-1">
              <Search className="w-3 h-3 text-maroon-500" />
              Search
            </label>
            <div className="relative">
              <input
                type="text"
                placeholder="Region or hub..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-2.5 pr-2.5 py-1.5 text-xs bg-slate-700/80 border border-slate-600 rounded-lg focus:ring-2 focus:ring-maroon-500 focus:border-maroon-500 outline-none transition-all duration-200 text-white placeholder-slate-400 hover:bg-slate-700"
              />
            </div>
          </div>
          <div>
            <label className="flex items-center gap-1 text-[10px] font-medium text-slate-400 mb-1">
              <Calendar className="w-3 h-3 text-slate-500" />
              From
            </label>
            <input
              type="date"
              value={filters.dateFrom}
              onChange={(e) => handleFilterChange('dateFrom', e.target.value)}
              className="w-full px-2.5 py-1.5 text-xs bg-slate-700/80 border border-slate-600 rounded-lg focus:ring-2 focus:ring-maroon-500 focus:border-maroon-500 outline-none transition-all duration-200 text-white hover:bg-slate-700"
            />
          </div>
          <div>
            <label className="flex items-center gap-1 text-[10px] font-medium text-slate-400 mb-1">
              <Calendar className="w-3 h-3 text-slate-500" />
              To
            </label>
            <input
              type="date"
              value={filters.dateTo}
              onChange={(e) => handleFilterChange('dateTo', e.target.value)}
              className="w-full px-2.5 py-1.5 text-xs bg-slate-700/80 border border-slate-600 rounded-lg focus:ring-2 focus:ring-maroon-500 focus:border-maroon-500 outline-none transition-all duration-200 text-white hover:bg-slate-700"
            />
          </div>
          <div>
            <label className="flex items-center gap-1 text-[10px] font-medium text-slate-400 mb-1">
              <Users className="w-3 h-3 text-slate-500" />
              Cluster Lead
            </label>
            <select
              value={filters.clusterLead}
              onChange={(e) => handleFilterChange('clusterLead', e.target.value)}
              className="w-full px-2.5 py-1.5 text-xs bg-slate-700/80 border border-slate-600 rounded-lg focus:ring-2 focus:ring-maroon-500 focus:border-maroon-500 outline-none transition-all duration-200 text-white hover:bg-slate-700"
            >
              <option value="" className="bg-slate-700">All Cluster Leads</option>
              {clusterLeaders.map(leader => (
                <option key={leader.id} value={leader.leader_name} className="bg-slate-700">
                  {leader.leader_name}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>


      {/* Data Table */}
      <div className="bg-slate-800 rounded-xl shadow-sm border border-slate-700 overflow-hidden">
        <div className="overflow-x-auto max-h-[calc(100vh-280px)]">
          <table className="w-full">
            <thead className="bg-slate-700/50 sticky top-0 z-10">
              <tr className="border-b border-slate-600">
                <th className="px-2 py-2 text-left text-[10px] font-semibold text-slate-300 uppercase tracking-wide">Date</th>
                <th className="px-2 py-2 text-left text-[10px] font-semibold text-slate-300 uppercase tracking-wide">Region</th>
                <th className="px-2 py-2 text-left text-[10px] font-semibold text-slate-300 uppercase tracking-wide">Sub Region</th>
                <th className="px-2 py-2 text-left text-[10px] font-semibold text-slate-300 uppercase tracking-wide">Operator Hub</th>
                <th className="px-2 py-2 text-left text-[10px] font-semibold text-slate-300 uppercase tracking-wide">Cluster</th>
                <th className="px-2 py-2 text-left text-[10px] font-semibold text-slate-300 uppercase tracking-wide">Score</th>
                <th className="px-2 py-2 text-left text-[10px] font-semibold text-slate-300 uppercase tracking-wide">Grade</th>
                <th className="px-2 py-2 text-left text-[10px] font-semibold text-slate-300 uppercase tracking-wide">Remarks</th>
                <th className="px-2 py-2 text-left text-[10px] font-semibold text-slate-300 uppercase tracking-wide">CFR</th>
                <th className="px-2 py-2 text-left text-[10px] font-semibold text-slate-300 uppercase tracking-wide">SR</th>
                <th className="px-2 py-2 text-left text-[10px] font-semibold text-slate-300 uppercase tracking-wide">% Aging ≥4d</th>
                <th className="px-2 py-2 text-left text-[10px] font-semibold text-slate-300 uppercase tracking-wide">Line Haul</th>
                <th className="px-2 py-2 text-left text-[10px] font-semibold text-slate-300 uppercase tracking-wide">COD Rem.</th>
                <th className="px-2 py-2 text-left text-[10px] font-semibold text-slate-300 uppercase tracking-wide">EOD Comp.</th>
                <th className="px-2 py-2 text-left text-[10px] font-semibold text-slate-300 uppercase tracking-wide">RTS %</th>
                <th className="px-2 py-2 text-left text-[10px] font-semibold text-slate-300 uppercase tracking-wide">Loss</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700">
              {filteredData.map((row) => (
                <tr key={row.id} className="hover:bg-slate-700/50 transition-all duration-200">
                  <td className="px-2 py-1.5 whitespace-nowrap text-xs text-slate-400">{row.date}</td>
                  <td className="px-2 py-1.5 whitespace-nowrap text-xs font-semibold text-white">{row.region}</td>
                  <td className="px-2 py-1.5 whitespace-nowrap text-xs text-slate-400">{row.sub_region}</td>
                  <td className="px-2 py-1.5 whitespace-nowrap text-xs text-slate-400">{row.operator_hub}</td>
                  <td className="px-2 py-1.5 whitespace-nowrap text-xs text-slate-400">
                    {(() => {
                      // Find cluster leader for this hub
                      const clusterLeader = clusterLeaders.find(leader => 
                        leader.hubs && leader.hubs.includes(row.operator_hub)
                      )
                      return clusterLeader ? clusterLeader.leader_name : ''
                    })()}
                  </td>
                  <td className="px-2 py-1.5 whitespace-nowrap text-xs font-semibold text-white">{row.score}</td>
                  <td className="px-2 py-1.5 whitespace-nowrap">
                    <span className={`inline-flex px-2 py-0.5 text-[10px] font-semibold rounded-full ${getGradeBadgeColor(row.grade)}`}>
                      {row.grade}
                    </span>
                  </td>
                  <td className="px-2 py-1.5 text-xs text-slate-400 max-w-xs truncate">{row.remarks}</td>
                  <td className="px-2 py-1.5 whitespace-nowrap text-xs text-slate-400">{row.cfr}%</td>
                  <td className="px-2 py-1.5 whitespace-nowrap text-xs text-slate-400">{row.sr}%</td>
                  <td className="px-2 py-1.5 whitespace-nowrap text-xs text-slate-400">{row.aging_four_days}%</td>
                  <td className="px-2 py-1.5 whitespace-nowrap text-xs text-slate-400">{row.line_haul_compliance}%</td>
                  <td className="px-2 py-1.5 whitespace-nowrap text-xs text-slate-400">{row.cod_remittance}%</td>
                  <td className="px-2 py-1.5 whitespace-nowrap text-xs text-slate-400">{row.eod_compliance}%</td>
                  <td className="px-2 py-1.5 whitespace-nowrap text-xs text-slate-400">{row.rts}%</td>
                  <td className="px-2 py-1.5 whitespace-nowrap text-xs text-slate-400">{row.loss}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {filteredData.length === 0 && (
          <div className="text-center py-8 text-slate-400 text-xs">
            No data found matching your criteria.
          </div>
        )}
      </div>

      <div className="text-xs text-slate-400 font-medium">
        Showing <span className="text-white font-semibold">{filteredData.length}</span> of <span className="text-white font-semibold">{data.length}</span> records
      </div>

      {/* Upload Modal */}
      {showUploadModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-800 rounded-xl border border-slate-700 shadow-2xl w-full max-w-lg">
            <div className="flex items-center justify-between p-4 border-b border-slate-700">
              <h3 className="text-base font-semibold text-white">Upload KPI Data</h3>
              <button
                onClick={() => setShowUploadModal(false)}
                className="p-1 text-slate-400 hover:text-white transition-all duration-200 hover:scale-110"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-4 space-y-3">
              {importProgress.total > 0 ? (
                <div className="space-y-3">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-300">{importProgress.status}</span>
                    <span className="text-white font-medium">{importProgress.current} / {importProgress.total}</span>
                  </div>
                  <div className="w-full bg-slate-700 rounded-full h-2">
                    <div
                      className="bg-maroon-600 h-2 rounded-full transition-all duration-300"
                      style={{ width: `${(importProgress.current / importProgress.total) * 100}%` }}
                    ></div>
                  </div>
                  <div className="text-center">
                    <Loader2 className="w-6 h-6 animate-spin text-maroon-500 mx-auto" />
                  </div>
                </div>
              ) : (
                <>
                  <div className="border-2 border-dashed border-slate-600 rounded-xl p-6 text-center hover:border-maroon-500 transition-all duration-200 hover:bg-slate-800/50">
                    <Upload className="w-10 h-10 text-slate-400 mx-auto mb-3" />
                    <p className="text-slate-300 mb-1 text-sm">Drop your file here or click to browse</p>
                    <p className="text-slate-500 text-xs mb-3">Supports CSV and Excel files</p>
                    <input
                      type="file"
                      ref={fileInputRef}
                      onChange={handleImport}
                      accept=".csv,.xlsx,.xls"
                      className="hidden"
                      id="kpi-file-upload"
                    />
                    <label
                      htmlFor="kpi-file-upload"
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs bg-maroon-600 hover:bg-maroon-700 text-white rounded-lg transition-all duration-200 cursor-pointer shadow-sm hover:shadow-md"
                    >
                      <Upload className="w-3.5 h-3.5" />
                      Choose File
                    </label>
                  </div>
                  <div className="bg-slate-700/50 rounded-lg p-3">
                    <p className="text-slate-300 text-xs font-medium mb-1">Required columns:</p>
                    <p className="text-slate-400 text-[10px]">Date, Region, Sub Region, Operator Hub, Score, Grade, Remarks, CFR, SR, % Aging = 4 days, Line Haul Pick-up Compliance, COD Remittance, EOD Report Compliance, RTS %, Loss</p>
                  </div>
                </>
              )}
            </div>
            <div className="flex justify-end gap-3 p-4 border-t border-slate-700">
              <button
                onClick={() => setShowUploadModal(false)}
                disabled={importProgress.total > 0}
                className="px-3 py-1.5 text-xs border border-slate-600 hover:bg-slate-700 text-slate-300 rounded-lg transition-all duration-200 hover:border-slate-500 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default KPI
