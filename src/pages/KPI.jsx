// Clean version - all percentage and grade fixes applied
import { useState, useEffect, useRef } from 'react'
import { Upload, Filter, Download, Search, X, ChevronDown, Loader2, Calendar, Building2, MapPin } from 'lucide-react'
import * as XLSX from 'xlsx'
import { getKpiRecords, batchInsertKpiRecords, deleteAllKpiRecords } from '../lib/data'

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
  const [showFilters, setShowFilters] = useState(false)
  const [filters, setFilters] = useState({
    dateFrom: '',
    dateTo: '',
    subRegion: '',
    operatorHub: '',
    rider: '',
    grade: '',
  })
  const [searchTerm, setSearchTerm] = useState('')
  const fileInputRef = useRef(null)
  const [showUploadModal, setShowUploadModal] = useState(false)

  useEffect(() => {
    async function fetchData() {
      setLoading(true)
      const { data: records, error } = await getKpiRecords()
      if (!error && records) {
        setData(records)
        setFilteredData(records)
      }
      setLoading(false)
    }
    fetchData()
  }, [])

  const handleFilterChange = (key, value) => {
    setFilters(prev => ({ ...prev, [key]: value }))
  }

  const applyFilters = () => {
    let result = data
    
    if (searchTerm) {
      result = result.filter(item => 
        item.region.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.operator_hub.toLowerCase().includes(searchTerm.toLowerCase())
      )
    }
    
    if (filters.dateFrom) {
      result = result.filter(item => item.date >= filters.dateFrom)
    }
    
    if (filters.dateTo) {
      result = result.filter(item => item.date <= filters.dateTo)
    }
    
    if (filters.subRegion) {
      result = result.filter(item => item.sub_region === filters.subRegion)
    }
    
    if (filters.operatorHub) {
      result = result.filter(item => item.operator_hub === filters.operatorHub)
    }
    
    if (filters.grade) {
      result = result.filter(item => item.grade === filters.grade)
    }
    
    setFilteredData(result)
  }

  // Auto-apply filters when they change
  useEffect(() => {
    applyFilters()
  }, [filters, applyFilters])

  const clearFilters = () => {
    setFilters({ dateFrom: '', dateTo: '', subRegion: '', operatorHub: '', rider: '', grade: '' })
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
        alert('No data found in file')
        return
      }
      
      const headers = jsonData[0].map(h => h.toString().trim())
      console.log('Headers found:', headers) // Debug
      
      const formattedData = jsonData
        .slice(1)
        .filter(row => row[0] && row[0].toString().trim() !== '')
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
        alert('No valid data to import')
        return
      }
      
      const { data: inserted, error } = await batchInsertKpiRecords(formattedData)
      if (error) {
        console.error('Import error:', error)
        alert('Import failed: ' + error.message)
      } else if (inserted) {
        setData(prev => [...inserted, ...prev])
        setFilteredData(prev => [...inserted, ...prev])
        setShowUploadModal(false)
        alert(`Successfully imported ${inserted.length} records`)
      }
    } catch (err) {
      console.error('Import error:', err)
      alert('Import failed: ' + err.message)
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
      alert('Delete failed: ' + error.message)
    } else {
      setData([])
      setFilteredData([])
      alert('All records deleted successfully')
    }
  }

  const handleExport = () => {
    const exportData = filteredData.map(item => ({
      'Date': item.date,
      'Region': item.region,
      'Sub Region': item.sub_region,
      'Operator Hub': item.operator_hub,
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
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-primary-600" />
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

      {/* Search and Filter */}
      <div className="bg-slate-800 rounded-xl shadow-sm border border-slate-700 p-2.5">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-2.5">
          <div className="sm:col-span-2">
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
            </div>
            <div className="flex justify-end gap-3 p-4 border-t border-slate-700">
              <button
                onClick={() => setShowUploadModal(false)}
                className="px-3 py-1.5 text-xs border border-slate-600 hover:bg-slate-700 text-slate-300 rounded-lg transition-all duration-200 hover:border-slate-500"
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
