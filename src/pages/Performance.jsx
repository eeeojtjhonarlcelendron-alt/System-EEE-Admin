import { useState, useEffect, useRef, useMemo, useCallback } from 'react'
import { Upload, Filter, Download, Search, X, ChevronDown, Loader2, FileDown, Plus, Pencil, Trash2, Calendar, Building2, MapPin } from 'lucide-react'
import * as XLSX from 'xlsx'
import { getPerformanceRecords, getPerformanceRecordsPaginated, batchInsertPerformanceRecords, deleteAllPerformanceRecords, updatePerformanceRecord, getPerformanceRecordByRiderAndDate, getPerformanceRecordsByDateRange, refreshRiders, deletePerformanceRecord, insertSinglePerformanceRecord, getRiders, syncRidersFromPerformance } from '../lib/data'
import { SkeletonPerformance, ProgressBarLoader } from '../components/Skeleton'

function parseDate(dateValue) {
  if (!dateValue) return null
  
  // Handle Date objects (from Excel parsing)
  if (dateValue instanceof Date) {
    if (isNaN(dateValue.getTime())) return null
    const year = dateValue.getFullYear()
    const month = String(dateValue.getMonth() + 1).padStart(2, '0')
    const day = String(dateValue.getDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
  }
  
  // Handle Excel serial date numbers (e.g., 46023)
  if (typeof dateValue === 'number' && dateValue > 30000 && dateValue < 60000) {
    // Excel epoch is 1900-01-01 (with leap year bug)
    const excelEpoch = new Date(1900, 0, 1)
    const daysOffset = dateValue - 2 // Adjust for Excel's leap year bug
    const date = new Date(excelEpoch.getTime() + daysOffset * 24 * 60 * 60 * 1000)
    if (!isNaN(date.getTime())) {
      const year = date.getFullYear()
      const month = String(date.getMonth() + 1).padStart(2, '0')
      const day = String(date.getDate()).padStart(2, '0')
      return `${year}-${month}-${day}`
    }
  }
  
  // Convert to string if not already
  const dateStr = String(dateValue).trim()
  if (dateStr === '') return null
  
  // If already in YYYY-MM-DD format
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return dateStr
  
  // Parse M/D/YYYY or MM/DD/YYYY format (e.g., "1/1/2026")
  const slashMatch = dateStr.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
  if (slashMatch) {
    const month = slashMatch[1].padStart(2, '0')
    const day = slashMatch[2].padStart(2, '0')
    const year = slashMatch[3]
    return `${year}-${month}-${day}`
  }
  
  // Parse "Sep 29" or "Sep 29, 2024" format
  const date = new Date(dateStr)
  if (!isNaN(date.getTime())) {
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
  }
  
  return null
}

function Performance() {
  const [data, setData] = useState([])
  const [filteredData, setFilteredData] = useState([])
  const [loading, setLoading] = useState(true) // Initial page load blocking screen
  const [isFiltering, setIsFiltering] = useState(false) // Non-blocking filter updates
  const [loadingProgress, setLoadingProgress] = useState(0)
  const [loadingStage, setLoadingStage] = useState('')
  const [totalCount, setTotalCount] = useState(0)
  const [showFilters, setShowFilters] = useState(false)
  const [filters, setFilters] = useState({
    dateFrom: '',
    dateTo: '',
    region: '',
    operatorHub: '',
    rider: '',
  })
  const [appliedFilters, setAppliedFilters] = useState(null) // Only load when Apply is clicked
  const [searchTerm, setSearchTerm] = useState('')
  const [currentPage, setCurrentPage] = useState(1)
  const [isRiderMapReady, setIsRiderMapReady] = useState(false)
  const [allRiders, setAllRiders] = useState([])
  const itemsPerPage = 100
  const fileInputRef = useRef(null)
  const [showAddModal, setShowAddModal] = useState(false)
  const [showUploadModal, setShowUploadModal] = useState(false)
  const [importProgress, setImportProgress] = useState({ current: 0, total: 0, status: '' })
  const [newRecord, setNewRecord] = useState({
    date: '',
    rider_id: '',
    driver_name: '',
    hub: '',
    assigned: '',
    delivered: '',
    onhold: '',
    pecentage: '',
    failed_rate: '',
    region: ''
  })
  const riderMapRef = useRef(new Map())
  const syncRidersGuard = useRef(false)

  // Sync riders from existing performance records on mount
  useEffect(() => {
    if (syncRidersGuard.current) return
    syncRidersGuard.current = true

    async function syncExistingRiders() {
      console.log('Syncing riders from existing performance records...')
      const { data: syncedCount, error } = await syncRidersFromPerformance()
      if (error) {
        console.error('Failed to sync existing riders:', error)
      } else {
        console.log(`Synced ${syncedCount} riders from existing performance data`)
      }
    }
    syncExistingRiders()
  }, [])

  async function fetchPageData(page = currentPage, activeFilters = filters, isInitial = false) {
    try {
      if (isInitial) {
        setLoading(true)
      } else {
        setIsFiltering(true)
      }
      setLoadingProgress(0)
      setLoadingStage('Loading performance records...')

      // Fetch current page of performance records from the server
      const { data: records, error, totalCount: count } = await getPerformanceRecordsPaginated(
        page - 1,
        itemsPerPage,
        {
          hub: activeFilters.operatorHub,
          region: activeFilters.region,
          dateFrom: activeFilters.dateFrom,
          dateTo: activeFilters.dateTo,
          search: activeFilters.rider
        }
      )

      if (error) {
        console.error('Error fetching paginated performance records:', error)
        setData([])
        setFilteredData([])
        setTotalCount(0)
        return
      }

      const mergedData = records.map(record => {
        const rider = riderMapRef.current.get(record.rider_id) || {}
        return {
          ...record,
          rider_name: rider.rider_name || record.driver_name,
          operator_hub: rider.operator_hub || record.hub,
          region: rider.region || record.region
        }
      })

      setData(mergedData)
      setFilteredData(mergedData)
      setTotalCount(count || 0)
    } catch (error) {
      console.error('Error fetching page data:', error)
      setData([])
      setFilteredData([])
      setTotalCount(0)
    } finally {
      if (isInitial) {
        setLoading(false)
      } else {
        setIsFiltering(false)
      }
      setLoadingProgress(100)
      setLoadingStage('')
    }
  }

  // Load rider metadata once, then enable paginated data loading
  useEffect(() => {
    async function loadRiderMetadata() {
      const { data: riders, error } = await getRiders()
      if (error) {
        console.error('Error loading rider metadata:', error)
      } else {
        const riderMap = new Map()
        riders.forEach(rider => riderMap.set(rider.rider_id, rider))
        riderMapRef.current = riderMap
        setAllRiders(riders)
      }
      setIsRiderMapReady(true)
    }
    loadRiderMetadata()
  }, [])

  // Fetch a new page whenever filters or page changes, after riders metadata is ready
  useEffect(() => {
    if (!isRiderMapReady) return
    const isInitial = data.length === 0 && loading
    fetchPageData(currentPage, filters, isInitial)
  }, [currentPage, filters, isRiderMapReady])

  // Update filters and trigger apply automatically
  const handleFilterChange = (key, value) => {
    setFilters(prev => ({ ...prev, [key]: value }))
    setCurrentPage(1)
  }

  // Debounced search handler - connects to rider filter
  const handleSearchChange = useCallback((value) => {
    setSearchTerm(value)
    setFilters(prev => ({ ...prev, rider: value }))
    setCurrentPage(1)
  }, [])

  const applyFilters = useCallback(() => {
    setCurrentPage(1)
  }, [])

  const clearFilters = () => {
    setFilters({ dateFrom: '', dateTo: '', region: '', operatorHub: '', rider: '' })
    setAppliedFilters(null)
    setSearchTerm('')
    setCurrentPage(1)
  }

  const handleImport = async (e) => {
    const file = e.target.files[0]
    if (!file) return
    
    // Reset progress
    setImportProgress({ current: 0, total: 0, status: 'Reading file...' })
    
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
            rider_id: rowData['Rider ID']?.toString().trim() || '',
            driver_name: rowData['Rider Name'] || rowData['Rider name'] || rowData['rider_name'] || '',
            hub: rowData['Operator Hub'] || '',
            assigned: parseInt(rowData['Assigned']) || 0,
            delivered: parseInt(rowData['Delivered']) || 0,
            onhold: parseInt(rowData['Onhold']) || 0,
            pecentage: (parseFloat(String(rowData['Pecentage']).replace('%', '')) || 0) / 100,
            failed_rate: 1 - ((parseFloat(String(rowData['Pecentage']).replace('%', '')) || 0) / 100),
            region: rowData['Region'] || '',
          }
        })
      
      if (formattedData.length === 0) {
        alert('No valid data to import')
        return
      }

      // Skip duplicate checking - just insert all valid records
      // The unique constraint will prevent duplicates
      const toInsert = []
      
      for (const record of formattedData) {
        // Skip records with missing required fields
        if (!record.rider_id || !record.date) {
          console.log('Skipping record - missing fields:', { rider_id: record.rider_id, date: record.date, driver_name: record.driver_name })
          continue
        }
        toInsert.push(record)
      }
      
      console.log('Records to insert:', toInsert.length)
      console.log('First 3 toInsert:', toInsert.slice(0, 3))
      
      let insertedCount = 0
      let updatedCount = 0
      let failedRecords = []
      const toUpdate = [] // No duplicate checking, so no updates needed
      
      // Insert records with auto-retry for timeouts
      if (toInsert.length > 0) {
        console.log(`Inserting ${toInsert.length} records with retry logic`)
        setImportProgress({ current: 0, total: toInsert.length, status: 'Importing...' })
        
        // Insert new records in batches of 50 for reliable processing
        const batchSize = 50
        for (let i = 0; i < toInsert.length; i += batchSize) {
          const batch = toInsert.slice(i, i + batchSize)
          const batchEnd = Math.min(i + batchSize, toInsert.length)
          
          setImportProgress({ 
            current: i, 
            total: toInsert.length, 
            status: `Inserting batch ${Math.floor(i / batchSize) + 1} (${i + 1}-${batchEnd} of ${toInsert.length})...` 
          })
          
          const { data: inserted, error: insertError } = await batchInsertPerformanceRecords(batch)
          
          if (insertError) {
            console.error('Batch insert error:', insertError)
            // Fall back to individual inserts for this batch
            for (const record of batch) {
              const { data: singleInserted, error: singleError } = await insertSinglePerformanceRecord(record)
              if (singleError) {
                let errorMessage = singleError.message || 'Unknown error'
                if (errorMessage.includes('duplicate key value')) {
                  errorMessage = 'Duplicate key error - record already exists'
                }
                failedRecords.push({ ...record, error: errorMessage })
              } else if (singleInserted) {
                insertedCount++
              }
            }
          } else if (inserted) {
            insertedCount += inserted.length || batch.length
            // Update local state for first batch only to avoid UI lag
            if (i === 0) {
              setData(prev => [...inserted, ...prev])
              setFilteredData(prev => [...inserted, ...prev])
            }
          }
        }
      }
      
      console.log(`Total inserted: ${insertedCount}/${toInsert.length}, Failed: ${failedRecords.length}`)
      
      setImportProgress({ current: toInsert.length, total: toInsert.length, status: `Complete! ${insertedCount} inserted, ${failedRecords.length} failed` })
      
      // Show failed records if any
      if (failedRecords.length > 0) {
        console.log('Failed records:', failedRecords)
      }
      
      // Update existing records
      for (const record of toUpdate) {
        const { data: updated, error: updateError } = await updatePerformanceRecord(record.id, record)
        console.log('updatePerformanceRecord result:', { updated, updateError })
        if (updateError) {
          console.error('Update error:', updateError)
        } else if (updated) {
          updatedCount++
          // Update local state
          setData(prev => prev.map(item => item.id === record.id ? updated : item))
          setFilteredData(prev => prev.map(item => item.id === record.id ? updated : item))
        }
      }
      
      alert(`Successfully imported ${insertedCount} new records and updated ${updatedCount} existing records`)
      
      // Close upload modal
      setShowUploadModal(false)
      
      // Refresh total count
      setTotalCount(prev => prev + insertedCount)
      
      // Sync unique riders from performance_records to riders table
      const { data: syncedCount, error: syncError } = await syncRidersFromPerformance()
      if (syncError) {
        console.error('Failed to sync riders:', syncError)
      } else {
        console.log(`Synced ${syncedCount} riders to riders table`)
      }
      
      // Also refresh riders table for fast loading
      const { error: refreshError } = await refreshRiders()
      if (refreshError) {
        console.error('Failed to refresh riders:', refreshError)
      }
      
      // Refresh data from database to show newly imported records
      await fetchPageData(currentPage, filters)
    } catch (err) {
      console.error('File parsing error:', err)
      alert('Error parsing file: ' + err.message)
    }
    
    // Reset file input
    e.target.value = ''
  }

  const handleExport = () => {
    const exportData = filteredData.map(item => ({
      'Date': item.date,
      'Rider ID': item.rider_id,
      'Rider Name': item.driver_name,
      'Operator Hub': item.hub,
      'Assigned': item.assigned,
      'Delivered': item.delivered,
      'Onhold': item.onhold,
      'Pecentage': item.pecentage,
      'Failed Rate': item.failed_rate,
      'Region': item.region,
    }))
    
    const ws = XLSX.utils.json_to_sheet(exportData)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Performance Data')
    XLSX.writeFile(wb, 'performance_data.xlsx')
  }

  const handleDownloadTemplate = () => {
    const templateData = [
      ['Date', 'Rider ID', 'Rider Name', 'Operator Hub', 'Assigned', 'Delivered', 'Onhold', 'Pecentage', 'Failed Rate', 'Region'],
      ['1/1/2026', '340280', 'Angelo Pinca Tabucao', 'OP Basey Western Samar Hub', '70', '37', '33', '53%', '47%', 'VIS5'],
      ['1/1/2026', '355408', 'Jeremie Delovieres Demateo', 'OP Basey Western Samar Hub', '70', '36', '34', '51%', '49%', 'VIS5'],
      ['1/1/2026', '358729', 'Jose Obera Sabangan', 'OP Basey Western Samar Hub', '60', '37', '23', '62%', '38%', 'VIS5'],
    ]
    
    const csvContent = templateData.map(row => row.join(',')).join('\n')
    const blob = new Blob([csvContent], { type: 'text/csv' })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'performance_import_template.csv'
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    window.URL.revokeObjectURL(url)
  }

  const handleDeleteAll = async () => {
    if (!confirm('Are you sure you want to delete all performance records? This cannot be undone.')) {
      return
    }
    const { error } = await deleteAllPerformanceRecords()
    if (error) {
      console.error('Delete error:', error)
      alert('Delete failed: ' + error.message)
    } else {
      setData([])
      setFilteredData([])
      alert('All records deleted successfully')
    }
  }

  const handleAddRecord = async (e) => {
    e.preventDefault()
    
    const record = {
      date: newRecord.date,
      rider_id: newRecord.rider_id,
      driver_name: newRecord.driver_name,
      hub: newRecord.hub,
      assigned: parseInt(newRecord.assigned) || 0,
      delivered: parseInt(newRecord.delivered) || 0,
      onhold: parseInt(newRecord.onhold) || 0,
      pecentage: parseFloat(newRecord.pecentage) || 0,
      failed_rate: parseFloat(newRecord.failed_rate) || 0,
      region: newRecord.region
    }
    
    // Check for duplicate
    const { data: existing } = await getPerformanceRecordByRiderAndDate(record.rider_id, record.date)
    
    if (existing) {
      // Update existing
      const { data: updated, error } = await updatePerformanceRecord(existing.id, record)
      if (error) {
        alert('Error updating record: ' + error.message)
        return
      }
      setData(prev => prev.map(item => item.id === existing.id ? updated : item))
      setFilteredData(prev => prev.map(item => item.id === existing.id ? updated : item))
      alert('Record updated successfully')
    } else {
      // Insert new
      const { data: inserted, error } = await batchInsertPerformanceRecords([record])
      if (error) {
        alert('Error adding record: ' + error.message)
        return
      }
      if (inserted && inserted.length > 0) {
        setData(prev => [...inserted, ...prev])
        setFilteredData(prev => [...inserted, ...prev])
        setTotalCount(prev => prev + 1)
        alert('Record added successfully')
      }
    }
    
    // Refresh riders table
    const { error: refreshError } = await refreshRiders()
    if (refreshError) {
      console.error('Failed to refresh riders:', refreshError)
    }
    
    // Reset form and close modal
    setNewRecord({
      date: '',
      rider_id: '',
      driver_name: '',
      hub: '',
      assigned: '',
      delivered: '',
      onhold: '',
      pecentage: '',
      failed_rate: '',
      region: ''
    })
    setShowAddModal(false)
  }

  const handleEdit = (record) => {
    setNewRecord({
      id: record.id,
      date: record.date || '',
      rider_id: record.rider_id || '',
      driver_name: record.driver_name || '',
      hub: record.hub || '',
      assigned: record.assigned?.toString() || '',
      delivered: record.delivered?.toString() || '',
      onhold: record.onhold?.toString() || '',
      pecentage: record.pecentage?.toString() || '',
      failed_rate: record.failed_rate?.toString() || '',
      region: record.region || ''
    })
    setShowAddModal(true)
  }

  const handleDelete = async (id) => {
    if (!confirm('Are you sure you want to delete this record?')) {
      return
    }
    const { error } = await deletePerformanceRecord(id)
    if (error) {
      console.error('Delete error:', error)
      alert('Delete failed: ' + error.message)
    } else {
      setData(prev => prev.filter(item => item.id !== id))
      setFilteredData(prev => prev.filter(item => item.id !== id))
      setTotalCount(prev => prev - 1)
      alert('Record deleted successfully')
      // Refresh riders table
      const { error: refreshError } = await refreshRiders()
      if (refreshError) {
        console.error('Failed to refresh riders:', refreshError)
      }
    }
  }

  // Paginated data is loaded from the server already
  const paginatedData = filteredData
  const totalPages = Math.ceil(totalCount / itemsPerPage)
  
  // Unique values for filters - derive from loaded rider metadata and current page data
  const filterSource = useMemo(() => {
    return [...allRiders, ...data].filter(item => item && (item.operator_hub || item.hub || item.region))
  }, [allRiders, data])

  const uniqueHubs = useMemo(() => 
    [...new Set(filterSource.map(item => item.operator_hub || item.hub).filter(Boolean))].sort((a, b) => a.localeCompare(b)),
    [filterSource]
  )
  
  const uniqueRegions = useMemo(() => 
    [...new Set(filterSource.map(item => item.region).filter(Boolean))].sort((a, b) => a.localeCompare(b)),
    [filterSource]
  )

  const handlePageChange = (page) => {
    console.log('Performance page changed to:', page)
    setCurrentPage(page)
  }
  
  // Debug pagination
  useEffect(() => {
    console.log('Performance pagination debug:', {
      currentPage,
      totalPages,
      itemsPerPage,
      filteredDataLength: filteredData.length,
      paginatedDataLength: paginatedData.length,
      firstItem: paginatedData[0]?.rider_id || paginatedData[0]?.id,
      lastItem: paginatedData[paginatedData.length - 1]?.rider_id || paginatedData[paginatedData.length - 1]?.id
    })
  }, [currentPage, paginatedData, totalPages, filteredData.length])

  // Export data to CSV
  const exportData = () => {
    const headers = ['Date', 'Rider ID', 'Rider Name', 'Operator Hub', 'Assigned', 'Delivered', 'Onhold', 'Percentage', 'Failed Rate', 'Region']
    const csvContent = [
      headers.join(','),
      ...filteredData.map(row => [
        row.date || row.created_date || '',
        row.rider_id || '',
        row.driver_name || '',
        row.hub || '',
        row.assigned || 0,
        row.delivered || 0,
        row.onhold || 0,
        ((row.pecentage || 0) * 100).toFixed(0) + '%',
        ((row.failed_rate || 0) * 100).toFixed(0) + '%',
        row.region || ''
      ].join(','))
    ].join('\n')
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.download = `performance_data_${new Date().toISOString().split('T')[0]}.csv`
    link.click()
  }

  // Show skeleton only on initial load before any data
  if (loading && data.length === 0) {
    return (
      <div className="space-y-6 relative">
        {/* Skeleton Loading Screen */}
        <SkeletonPerformance />
        {/* Progress Loader - Centered overlay */}
        <ProgressBarLoader progress={loadingProgress} loadingStage={loadingStage} />
      </div>
    )
  }

  return (
    <div className="space-y-3 relative">
      {/* Subtle filtering indicator - non-blocking */}
      {isFiltering && (
        <div className="fixed top-0 left-0 right-0 h-1 bg-gradient-to-r from-maroon-600 to-maroon-400 animate-pulse z-50" />
      )}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-3">
        <div>
          <h1 className="text-xl font-bold text-white">Performance Management</h1>
          <p className="text-slate-400 mt-0.5 text-xs">Manage and analyze rider performance data</p>
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
            onClick={exportData}
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
                placeholder="Name or ID..."
                value={searchTerm}
                onChange={(e) => handleSearchChange(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && applyFilters()}
                className="w-full pl-2.5 pr-2.5 py-1.5 text-xs bg-slate-700 border border-slate-600 rounded-lg focus:ring-2 focus:ring-maroon-500 focus:border-maroon-500 outline-none transition-all text-white placeholder-slate-400"
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
              <Building2 className="w-3 h-3 text-slate-500" />
              Hub
            </label>
            <select
              value={filters.operatorHub}
              onChange={(e) => handleFilterChange('operatorHub', e.target.value)}
              className="w-full px-2.5 py-1.5 text-xs bg-slate-700/80 border border-slate-600 rounded-lg focus:ring-2 focus:ring-maroon-500 focus:border-maroon-500 outline-none transition-all duration-200 text-white hover:bg-slate-700"
            >
              <option value="" className="bg-slate-700">All Hubs</option>
              {uniqueHubs.map(hub => (
                <option key={hub} value={hub} className="bg-slate-700">{hub}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="flex items-center gap-1 text-[10px] font-medium text-slate-400 mb-1">
              <MapPin className="w-3 h-3 text-slate-500" />
              Region
            </label>
            <select
              value={filters.region}
              onChange={(e) => handleFilterChange('region', e.target.value)}
              className="w-full px-2.5 py-1.5 text-xs bg-slate-700/80 border border-slate-600 rounded-lg focus:ring-2 focus:ring-maroon-500 focus:border-maroon-500 outline-none transition-all duration-200 text-white hover:bg-slate-700"
            >
              <option value="" className="bg-slate-700">All Regions</option>
              {uniqueRegions.map(region => (
                <option key={region} value={region} className="bg-slate-700">{region}</option>
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
                <th className="px-2 py-2 text-left text-[10px] font-semibold text-slate-300 uppercase tracking-wide">Actions</th>
                <th className="px-2 py-2 text-left text-[10px] font-semibold text-slate-300 uppercase tracking-wide">Date</th>
                <th className="px-2 py-2 text-left text-[10px] font-semibold text-slate-300 uppercase tracking-wide">Rider ID</th>
                <th className="px-2 py-2 text-left text-[10px] font-semibold text-slate-300 uppercase tracking-wide">Rider Name</th>
                <th className="px-2 py-2 text-left text-[10px] font-semibold text-slate-300 uppercase tracking-wide">Operator Hub</th>
                <th className="px-2 py-2 text-left text-[10px] font-semibold text-slate-300 uppercase tracking-wide">Assigned</th>
                <th className="px-2 py-2 text-left text-[10px] font-semibold text-slate-300 uppercase tracking-wide">Delivered</th>
                <th className="px-2 py-2 text-left text-[10px] font-semibold text-slate-300 uppercase tracking-wide">Onhold</th>
                <th className="px-2 py-2 text-left text-[10px] font-semibold text-slate-300 uppercase tracking-wide">Percentage</th>
                <th className="px-2 py-2 text-left text-[10px] font-semibold text-slate-300 uppercase tracking-wide">Failed Rate</th>
                <th className="px-2 py-2 text-left text-[10px] font-semibold text-slate-300 uppercase tracking-wide">Region</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700">
              {paginatedData.map((row, index) => (
                <tr key={`${row.rider_id}-${row.date}-${index}`} className="hover:bg-slate-700/50 transition-all duration-200 group">
                  <td className="px-2 py-1.5 whitespace-nowrap">
                    <div className="flex items-center gap-0.5">
                      <button
                        onClick={() => handleEdit(row)}
                        className="p-1 text-maroon-400 hover:bg-maroon-500/20 rounded transition-all duration-200 hover:scale-110"
                        title="Edit"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleDelete(row.id)}
                        className="p-1 text-red-400 hover:bg-red-500/20 rounded transition-all duration-200 hover:scale-110"
                        title="Delete"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                  <td className="px-2 py-1.5 whitespace-nowrap text-xs text-slate-400">{row.date || row.created_date}</td>
                  <td className="px-2 py-1.5 whitespace-nowrap text-xs font-semibold text-white">{row.rider_id}</td>
                  <td className="px-2 py-1.5 whitespace-nowrap text-xs text-slate-300">{row.driver_name}</td>
                  <td className="px-2 py-1.5 whitespace-nowrap text-xs text-slate-400">{row.hub}</td>
                  <td className="px-2 py-1.5 whitespace-nowrap text-xs text-slate-400">{row.assigned}</td>
                  <td className="px-2 py-1.5 whitespace-nowrap text-xs text-slate-400">{row.delivered}</td>
                  <td className="px-2 py-1.5 whitespace-nowrap text-xs text-slate-400">{row.onhold}</td>
                  <td className="px-2 py-1.5 whitespace-nowrap text-xs text-slate-400">{(row.pecentage * 100).toFixed(0)}%</td>
                  <td className="px-2 py-1.5 whitespace-nowrap text-xs text-slate-400">{row.failed_rate > 1 ? row.failed_rate.toFixed(0) : (row.failed_rate * 100).toFixed(0)}%</td>
                  <td className="px-2 py-1.5 whitespace-nowrap text-xs text-slate-400">{row.region}</td>
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

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="sticky bottom-0 z-10 flex items-center justify-between bg-slate-800 rounded-xl shadow-sm border border-slate-700 p-2.5">
          <div className="text-xs text-slate-400">
            Showing <span className="font-semibold text-white">{(currentPage - 1) * itemsPerPage + 1}</span> to <span className="font-semibold text-white">{Math.min(currentPage * itemsPerPage, totalCount)}</span> of <span className="font-semibold text-white">{totalCount}</span> records
          </div>
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => handlePageChange(currentPage - 1)}
              disabled={currentPage === 1}
              className="px-2.5 py-1 text-xs font-semibold border border-slate-600 rounded-lg hover:bg-slate-700 hover:border-slate-500 text-slate-300 disabled:opacity-40 disabled:cursor-not-allowed transition-all duration-200 hover:shadow-sm"
            >
              Previous
            </button>
            
            <div className="flex items-center gap-0.5 overflow-x-auto max-w-[180px] sm:max-w-[250px]">
              {Array.from({ length: totalPages }, (_, i) => {
                const pageNum = i + 1
                
                return (
                  <button
                    key={pageNum}
                    onClick={() => handlePageChange(pageNum)}
                    className={`min-w-[1.75rem] h-7 text-xs font-semibold rounded-md transition-all flex-shrink-0 ${
                      currentPage === pageNum
                        ? 'bg-maroon-600 text-white shadow-sm'
                        : 'border border-slate-600 hover:bg-slate-700 hover:border-slate-500 text-slate-300'
                    }`}
                  >
                    {pageNum}
                  </button>
                )
              })}
            </div>
            
            <button
              onClick={() => handlePageChange(currentPage + 1)}
              disabled={currentPage === totalPages}
              className="px-2.5 py-1 text-xs font-semibold border border-slate-600 rounded-lg hover:bg-slate-700 hover:border-slate-500 text-slate-300 disabled:opacity-40 disabled:cursor-not-allowed transition-all duration-200 hover:shadow-sm"
            >
              Next
            </button>
          </div>
        </div>
      )}

      <div className="text-xs text-slate-400 font-medium">
        Total: <span className="text-maroon-400 font-semibold">{totalCount}</span> records
      </div>

      {/* Add Record Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-800 rounded-xl shadow-lg p-4 w-full max-w-2xl max-h-[90vh] overflow-y-auto border border-slate-700">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-lg font-bold text-white">Add Performance Record</h2>
              <button
                onClick={() => setShowAddModal(false)}
                className="p-1.5 hover:bg-slate-700 rounded-lg transition text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleAddRecord} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">Date *</label>
                  <input
                    type="date"
                    required
                    value={newRecord.date}
                    onChange={(e) => setNewRecord(prev => ({ ...prev, date: e.target.value }))}
                    className="w-full px-2.5 py-1.5 text-xs bg-slate-700 border border-slate-600 rounded-lg focus:ring-2 focus:ring-maroon-500 focus:border-maroon-500 outline-none text-white placeholder-slate-400"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">Rider ID *</label>
                  <input
                    type="text"
                    required
                    value={newRecord.rider_id}
                    onChange={(e) => setNewRecord(prev => ({ ...prev, rider_id: e.target.value }))}
                    className="w-full px-2.5 py-1.5 text-xs bg-slate-700 border border-slate-600 rounded-lg focus:ring-2 focus:ring-maroon-500 focus:border-maroon-500 outline-none text-white placeholder-slate-400"
                    placeholder="Enter rider ID"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">Rider Name</label>
                  <input
                    type="text"
                    value={newRecord.driver_name}
                    onChange={(e) => setNewRecord(prev => ({ ...prev, driver_name: e.target.value }))}
                    className="w-full px-2.5 py-1.5 text-xs bg-slate-700 border border-slate-600 rounded-lg focus:ring-2 focus:ring-maroon-500 focus:border-maroon-500 outline-none text-white placeholder-slate-400"
                    placeholder="Enter rider name"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">Operator Hub</label>
                  <input
                    type="text"
                    value={newRecord.hub}
                    onChange={(e) => setNewRecord(prev => ({ ...prev, hub: e.target.value }))}
                    className="w-full px-2.5 py-1.5 text-xs bg-slate-700 border border-slate-600 rounded-lg focus:ring-2 focus:ring-maroon-500 focus:border-maroon-500 outline-none text-white placeholder-slate-400"
                    placeholder="Enter hub"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">Assigned</label>
                  <input
                    type="number"
                    value={newRecord.assigned}
                    onChange={(e) => setNewRecord(prev => ({ ...prev, assigned: e.target.value }))}
                    className="w-full px-2.5 py-1.5 text-xs bg-slate-700 border border-slate-600 rounded-lg focus:ring-2 focus:ring-maroon-500 focus:border-maroon-500 outline-none text-white placeholder-slate-400"
                    placeholder="0"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">Delivered</label>
                  <input
                    type="number"
                    value={newRecord.delivered}
                    onChange={(e) => setNewRecord(prev => ({ ...prev, delivered: e.target.value }))}
                    className="w-full px-2.5 py-1.5 text-xs bg-slate-700 border border-slate-600 rounded-lg focus:ring-2 focus:ring-maroon-500 focus:border-maroon-500 outline-none text-white placeholder-slate-400"
                    placeholder="0"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">Onhold</label>
                  <input
                    type="number"
                    value={newRecord.onhold}
                    onChange={(e) => setNewRecord(prev => ({ ...prev, onhold: e.target.value }))}
                    className="w-full px-2.5 py-1.5 text-xs bg-slate-700 border border-slate-600 rounded-lg focus:ring-2 focus:ring-maroon-500 focus:border-maroon-500 outline-none text-white placeholder-slate-400"
                    placeholder="0"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">Percentage (%)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={newRecord.pecentage}
                    onChange={(e) => setNewRecord(prev => ({ ...prev, pecentage: e.target.value }))}
                    className="w-full px-2.5 py-1.5 text-xs bg-slate-700 border border-slate-600 rounded-lg focus:ring-2 focus:ring-maroon-500 focus:border-maroon-500 outline-none text-white placeholder-slate-400"
                    placeholder="0.00"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">Failed Rate (%)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={newRecord.failed_rate}
                    onChange={(e) => setNewRecord(prev => ({ ...prev, failed_rate: e.target.value }))}
                    className="w-full px-2.5 py-1.5 text-xs bg-slate-700 border border-slate-600 rounded-lg focus:ring-2 focus:ring-maroon-500 focus:border-maroon-500 outline-none text-white placeholder-slate-400"
                    placeholder="0.00"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">Region</label>
                  <input
                    type="text"
                    value={newRecord.region}
                    onChange={(e) => setNewRecord(prev => ({ ...prev, region: e.target.value }))}
                    className="w-full px-2.5 py-1.5 text-xs bg-slate-700 border border-slate-600 rounded-lg focus:ring-2 focus:ring-maroon-500 focus:border-maroon-500 outline-none text-white placeholder-slate-400"
                    placeholder="Enter region"
                  />
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-3 py-1.5 text-xs border border-slate-600 hover:bg-slate-700 text-slate-300 rounded-lg transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-3 py-1.5 text-xs bg-maroon-600 hover:bg-maroon-700 text-white rounded-lg transition"
                >
                  Add Record
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Upload Modal */}
      {showUploadModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-800 rounded-xl border border-slate-700 shadow-2xl w-full max-w-lg">
            <div className="flex items-center justify-between p-4 border-b border-slate-700">
              <h3 className="text-base font-semibold text-white">Upload Performance Data</h3>
              <button
                onClick={() => {
                  setShowUploadModal(false)
                  setImportProgress({ current: 0, total: 0, status: '' })
                }}
                className="p-1 text-slate-400 hover:text-white transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-4 space-y-3">
              <div className="border-2 border-dashed border-slate-600 rounded-lg p-6 text-center hover:border-maroon-500 transition">
                <Upload className="w-10 h-10 text-slate-400 mx-auto mb-3" />
                <p className="text-slate-300 mb-1 text-sm">Drop your file here or click to browse</p>
                <p className="text-slate-500 text-xs mb-3">Supports CSV and Excel files</p>
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleImport}
                  accept=".csv,.xlsx,.xls"
                  className="hidden"
                  id="file-upload"
                />
                <label
                  htmlFor="file-upload"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs bg-maroon-600 hover:bg-maroon-700 text-white rounded-lg transition cursor-pointer"
                >
                  <Upload className="w-3.5 h-3.5" />
                  Choose File
                </label>
              </div>
              <div className="bg-slate-700/50 rounded-lg p-3">
                <p className="text-slate-300 text-xs font-medium mb-1">Required columns:</p>
                <p className="text-slate-400 text-[10px]">Date, Rider ID, Rider Name, Operator Hub, Assigned, Delivered, Onhold, Pecentage, Failed Rate, Region</p>
              </div>
              
              {/* Import Progress */}
              {importProgress.total > 0 && (
                <div className="bg-slate-700/50 rounded-lg p-3">
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-slate-300">{importProgress.status}</span>
                    <span className="text-slate-400">
                      {Math.round((importProgress.current / importProgress.total) * 100)}%
                    </span>
                  </div>
                  <div className="w-full bg-slate-600 rounded-full h-2">
                    <div 
                      className="bg-maroon-600 h-2 rounded-full transition-all duration-300"
                      style={{ width: `${(importProgress.current / importProgress.total) * 100}%` }}
                    />
                  </div>
                  <p className="text-slate-400 text-[10px] mt-1">
                    {importProgress.current} / {importProgress.total} records
                  </p>
                </div>
              )}
            </div>
            <div className="flex justify-between gap-3 p-4 border-t border-slate-700">
              <button
                onClick={handleDownloadTemplate}
                className="px-3 py-1.5 text-xs bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition"
              >
                Download Template
              </button>
              <button
                onClick={() => {
                  setShowUploadModal(false)
                  setImportProgress({ current: 0, total: 0, status: '' })
                }}
                className="px-3 py-1.5 text-xs border border-slate-600 hover:bg-slate-700 text-slate-300 rounded-lg transition"
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

export default Performance
