import { useState, useEffect, useRef, useMemo, useCallback } from 'react'
import { Filter, Search, X, ChevronDown, UserCheck, UserX, Loader2 } from 'lucide-react'
import { getRiders, getPerformanceRecords, getFuelManagementRiders } from '../lib/data'

function Rider() {
  const [data, setData] = useState([])
  const [filteredData, setFilteredData] = useState([])
  const [loading, setLoading] = useState(true)
  const [showFilters, setShowFilters] = useState(false)
  const [statusFilter, setStatusFilter] = useState('')
  const [operatorHubFilter, setOperatorHubFilter] = useState('')
  const [searchTerm, setSearchTerm] = useState('')
  const [currentPage, setCurrentPage] = useState(1)
  const [performanceRecords, setPerformanceRecords] = useState([])
  const itemsPerPage = 100
  const searchTimeoutRef = useRef(null)

  useEffect(() => {
    async function fetchData() {
      setLoading(true)
      const [ridersResult, performanceResult, fuelResult] = await Promise.all([
        getRiders(),
        getPerformanceRecords(),
        getFuelManagementRiders()
      ])
      
      // Get performance records
      const performanceData = performanceResult.data || []
      setPerformanceRecords(performanceData)
      
      // Create unique riders map from all sources
      const ridersMap = new Map()
      
      // Add riders from riders table
      if (ridersResult.data) {
        ridersResult.data.forEach(rider => {
          ridersMap.set(rider.rider_id, { ...rider, source: 'riders_table' })
        })
      }
      
      // Add riders from fuel_management_riders (prefer this data if exists)
      if (fuelResult.data) {
        fuelResult.data.forEach(rider => {
          const existing = ridersMap.get(rider.rider_id)
          if (existing) {
            // Merge data, keeping fuel_management_riders values
            ridersMap.set(rider.rider_id, { 
              ...existing, 
              ...rider, 
              source: 'both' 
            })
          } else {
            ridersMap.set(rider.rider_id, { 
              ...rider, 
              source: 'fuel_management' 
            })
          }
        })
      }
      
      // Add unique riders from performance records
      performanceData.forEach(record => {
        const riderId = record.rider_id
        if (!ridersMap.has(riderId)) {
          ridersMap.set(riderId, {
            rider_id: riderId,
            rider_name: record.driver_name,
            operator_hub: record.hub,
            region: record.region,
            status: 'Active',
            source: 'performance'
          })
        }
      })
      
      // Calculate deployment dates for all riders
      const allRiders = Array.from(ridersMap.values()).map(rider => {
        const riderRecords = performanceData.filter(p => p.rider_id === rider.rider_id)
        
        let deploymentDate = rider.deployment_date || 'N/A'
        let lastActiveDate = rider.last_active || 'N/A'
        
        if (riderRecords.length > 0) {
          const sortedDates = riderRecords
            .map(p => p.date)
            .filter(Boolean)
            .sort((a, b) => new Date(a) - new Date(b))
            
          if (sortedDates.length > 0) {
            deploymentDate = sortedDates[0].split('T')[0] || sortedDates[0]
            lastActiveDate = sortedDates[sortedDates.length - 1].split('T')[0] || sortedDates[sortedDates.length - 1]
          }
        }
        
        return {
          ...rider,
          deployment_date: deploymentDate,
          last_active: lastActiveDate
        }
      })
      
      setData(allRiders)
      setFilteredData(allRiders)
      setLoading(false)
    }
    fetchData()
  }, [])

  // Debounced search handler
  const handleSearchChange = (value) => {
    setSearchTerm(value)
    
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current)
    }
    
    searchTimeoutRef.current = setTimeout(() => {
      applyFilters(value, statusFilter, operatorHubFilter)
    }, 300)
  }

  const applyFilters = useCallback((search = searchTerm, status = statusFilter, hub = operatorHubFilter) => {
    let result = data
    
    if (search) {
      const searchLower = search.toLowerCase()
      result = result.filter(item => 
        (item.rider_name?.toLowerCase() || '').includes(searchLower) ||
        (item.rider_id?.toLowerCase() || '').includes(searchLower)
      )
    }
    
    if (status) {
      result = result.filter(item => item.status === status)
    }
    
    if (hub) {
      result = result.filter(item => item.operator_hub === hub)
    }
    
    setFilteredData(result)
    setCurrentPage(1)
  }, [data, searchTerm, statusFilter, operatorHubFilter])

  const clearFilters = () => {
    setStatusFilter('')
    setOperatorHubFilter('')
    setSearchTerm('')
    setFilteredData(data)
    setCurrentPage(1)
  }

  const getStatusColor = (status) => {
    return status === 'Active' 
      ? 'bg-green-100 text-green-800' 
      : 'bg-red-100 text-red-800'
  }

  // Memoized counts
  const activeCount = useMemo(() => 
    data.filter(item => item.status === 'Active').length,
    [data]
  )
  
  const inactiveCount = useMemo(() => 
    data.filter(item => item.status === 'Inactive').length,
    [data]
  )

  // Memoized unique operator hubs
  const uniqueOperatorHubs = useMemo(() => 
    [...new Set(data.map(item => item.operator_hub).filter(Boolean))].sort(),
    [data]
  )
  const totalPages = useMemo(() => 
    Math.ceil(filteredData.length / itemsPerPage),
    [filteredData.length]
  )
  
  const startIndex = useMemo(() => 
    (currentPage - 1) * itemsPerPage,
    [currentPage]
  )
  
  const paginatedData = useMemo(() => 
    filteredData.slice(startIndex, startIndex + itemsPerPage),
    [filteredData, startIndex]
  )

  const handlePageChange = (page) => {
    console.log('Page changed to:', page)
    setCurrentPage(page)
  }
  
  // Debug pagination
  useEffect(() => {
    console.log('Pagination debug:', {
      currentPage,
      totalPages,
      startIndex,
      itemsPerPage,
      filteredDataLength: filteredData.length,
      paginatedDataLength: paginatedData.length,
      firstItem: paginatedData[0]?.rider_id,
      lastItem: paginatedData[paginatedData.length - 1]?.rider_id
    })
  }, [currentPage, paginatedData, startIndex, totalPages, filteredData.length])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-maroon-500" />
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <div>
          <h1 className="text-xl font-bold text-white">Rider Data</h1>
          <p className="text-xs text-slate-400">Manage and track rider information</p>
        </div>
        
        {/* Status Summary */}
        <div className="flex gap-2">
          <div className="flex items-center gap-1 px-2.5 py-1 bg-green-900/30 rounded-lg">
            <UserCheck className="w-3.5 h-3.5 text-green-400" />
            <span className="text-xs font-medium text-green-400">{activeCount} Active</span>
          </div>
          <div className="flex items-center gap-1 px-2.5 py-1 bg-red-900/30 rounded-lg">
            <UserX className="w-3.5 h-3.5 text-red-400" />
            <span className="text-xs font-medium text-red-400">{inactiveCount} Inactive</span>
          </div>
        </div>
      </div>

      {/* Search and Filter */}
      <div className="bg-slate-800 rounded-xl shadow-sm border border-slate-700 p-2.5">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
          <div>
            <label className="flex items-center gap-1 text-[10px] font-semibold text-slate-300 mb-1">
              <Search className="w-3 h-3 text-maroon-500" />
              Search
            </label>
            <div className="relative">
              <input
                type="text"
                placeholder="Name or ID..."
                value={searchTerm}
                onChange={(e) => handleSearchChange(e.target.value)}
                className="w-full pl-2.5 pr-2.5 py-1.5 text-xs bg-slate-700/80 border border-slate-600 rounded-lg focus:ring-2 focus:ring-maroon-500 focus:border-maroon-500 outline-none transition-all duration-200 text-white placeholder-slate-400 hover:bg-slate-700"
              />
            </div>
          </div>
          <div>
            <label className="flex items-center gap-1 text-[10px] font-semibold text-slate-300 mb-1">
              <span className="w-3 h-3 rounded-full border-2 border-slate-500 flex items-center justify-center text-[6px] text-slate-500">●</span>
              Status
            </label>
            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value)
                applyFilters(searchTerm, e.target.value, operatorHubFilter)
              }}
              className="w-full px-2.5 py-1.5 text-xs bg-slate-700/80 border border-slate-600 rounded-lg focus:ring-2 focus:ring-maroon-500 focus:border-maroon-500 outline-none transition-all duration-200 text-white hover:bg-slate-700"
            >
              <option value="" className="bg-slate-700">All Status</option>
              <option value="Active" className="bg-slate-700">Active</option>
              <option value="Inactive" className="bg-slate-700">Inactive</option>
            </select>
          </div>
          <div>
            <label className="flex items-center gap-1 text-[10px] font-semibold text-slate-300 mb-1">
              <span className="w-3 h-3 rounded border-2 border-slate-500 flex items-center justify-center text-[6px] text-slate-500">⌂</span>
              Operator Hub
            </label>
            <select
              value={operatorHubFilter}
              onChange={(e) => {
                setOperatorHubFilter(e.target.value)
                applyFilters(searchTerm, statusFilter, e.target.value)
              }}
              className="w-full px-2.5 py-1.5 text-xs bg-slate-700/80 border border-slate-600 rounded-lg focus:ring-2 focus:ring-maroon-500 focus:border-maroon-500 outline-none transition-all duration-200 text-white hover:bg-slate-700"
            >
              <option value="" className="bg-slate-700">All Hubs</option>
              {uniqueOperatorHubs.map(hub => (
                <option key={hub} value={hub} className="bg-slate-700">{hub}</option>
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
                <th className="px-2 py-2 text-left text-[10px] font-semibold text-slate-300 uppercase tracking-wide">Rider ID</th>
                <th className="px-2 py-2 text-left text-[10px] font-semibold text-slate-300 uppercase tracking-wide">Rider Name</th>
                <th className="px-2 py-2 text-left text-[10px] font-semibold text-slate-300 uppercase tracking-wide">Operator Hub</th>
                <th className="px-2 py-2 text-left text-[10px] font-semibold text-slate-300 uppercase tracking-wide">Deployment Date</th>
                <th className="px-2 py-2 text-left text-[10px] font-semibold text-slate-300 uppercase tracking-wide">Last Active</th>
                <th className="px-2 py-2 text-left text-[10px] font-semibold text-slate-300 uppercase tracking-wide">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700">
              {paginatedData.map((row, index) => (
                <tr key={row.rider_id || row.id || index} className="hover:bg-slate-700/50 transition-all duration-200 group">
                  <td className="px-2 py-1.5 whitespace-nowrap text-xs font-semibold text-white">{row.rider_id}</td>
                  <td className="px-2 py-1.5 whitespace-nowrap text-xs text-slate-300">{row.rider_name}</td>
                  <td className="px-2 py-1.5 whitespace-nowrap text-xs text-slate-400">{row.operator_hub}</td>
                  <td className="px-2 py-1.5 whitespace-nowrap text-xs text-slate-400">{row.deployment_date}</td>
                  <td className="px-2 py-1.5 whitespace-nowrap text-xs text-slate-400">{row.last_active}</td>
                  <td className="px-2 py-1.5 whitespace-nowrap">
                    <span className={`inline-flex px-2 py-0.5 text-[10px] font-semibold rounded-full ${getStatusColor(row.status)}`}>
                      {row.status}
                    </span>
                  </td>
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
            Showing <span className="font-semibold text-white">{startIndex + 1}</span> to <span className="font-semibold text-white">{Math.min(startIndex + itemsPerPage, filteredData.length)}</span> of <span className="font-semibold text-white">{filteredData.length}</span> records
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
                    className={`min-w-[1.75rem] h-7 text-xs font-semibold rounded-lg transition-all duration-200 flex-shrink-0 ${
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
        Total: <span className="text-maroon-400 font-semibold">{filteredData.length}</span> of {data.length} records
      </div>
    </div>
  )
}

export default Rider
