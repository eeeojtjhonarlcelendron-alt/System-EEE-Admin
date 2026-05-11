import { useState, useEffect, useRef } from 'react'
import { Plus, Edit, Trash2, X, Loader2, Building2, User, Search, CheckCircle, AlertCircle, AlertTriangle } from 'lucide-react'
import { getClusterLeaders, createClusterLeader, updateClusterLeader, deleteClusterLeader, getPerformanceRecords, getUniqueHubs, syncClusterToKpiRecords, clearClusterFromKpiRecords, checkHubsInKpiRecords } from '../lib/data'

function Clustering() {
  const [data, setData] = useState([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editingItem, setEditingItem] = useState(null)
  const [formData, setFormData] = useState({
    leader_name: '',
    hubs: []
  })
  const [availableHubs, setAvailableHubs] = useState([])
  const [selectedHubs, setSelectedHubs] = useState([])
  const [hubSearch, setHubSearch] = useState('')
  const [isSyncing, setIsSyncing] = useState(false)
  const [message, setMessage] = useState({ type: '', text: '' })
  const modalRef = useRef(null)

  const showMessage = (type, text) => {
    setMessage({ type, text })
    setTimeout(() => setMessage({ type: '', text: '' }), 5000)
  }

  useEffect(() => {
    async function fetchData() {
      setLoading(true)
      const { data: records, error } = await getClusterLeaders()
      if (!error && records) {
        setData(records)
      }
      
      setLoading(false)
    }
    fetchData()
  }, [])

  // Update available hubs when data changes (outside modal)
  useEffect(() => {
    if (!showModal) {
      async function updateAvailableHubs() {
        const { data: uniqueHubs, error } = await getUniqueHubs()
        
        if (error) {
          console.error('Failed to fetch unique hubs:', error)
          setAvailableHubs([])
          return
        }
        
        // Get hubs already assigned to cluster leaders
        const assignedHubs = data?.flatMap(r => r.hubs || []) || []
        const availableHubsList = uniqueHubs.filter(hub => !assignedHubs.includes(hub))
        
        setAvailableHubs(availableHubsList.sort((a, b) => a.localeCompare(b)))
      }
      updateAvailableHubs()
    }
  }, [data, showModal])

  useEffect(() => {
    async function updateAvailableHubs() {
      if (editingItem) {
        setFormData({
          leader_name: editingItem.leader_name || '',
          hubs: editingItem.hubs || []
        })
        setSelectedHubs(editingItem.hubs || [])
        
        // When editing, include current leader's hubs in available list
        const { data: performanceData } = await getPerformanceRecords()
        const uniqueHubs = [...new Set(performanceData?.map(p => p.hub).filter(Boolean) || [])]
        
        // Get hubs assigned to OTHER cluster leaders (excluding current)
        const assignedHubs = data
          .filter(r => r.id !== editingItem.id)
          .flatMap(r => r.hubs || [])
        const availableHubsList = uniqueHubs.filter(hub => !assignedHubs.includes(hub))
        
        setAvailableHubs(availableHubsList.sort((a, b) => a.localeCompare(b)))
      } else {
        setFormData({ leader_name: '', hubs: [] })
        setSelectedHubs([])
        
        // Reset available hubs to exclude all assigned hubs
        const assignedHubs = data?.flatMap(r => r.hubs || []) || []
        const { data: performanceData } = await getPerformanceRecords()
        const uniqueHubs = [...new Set(performanceData?.map(p => p.hub).filter(Boolean) || [])]
        const availableHubsList = uniqueHubs.filter(hub => !assignedHubs.includes(hub))
        setAvailableHubs(availableHubsList.sort((a, b) => a.localeCompare(b)))
      }
      setHubSearch('')
    }
    
    if (showModal) {
      updateAvailableHubs()
    }
  }, [editingItem, showModal, data])

  const handleAdd = () => {
    setEditingItem(null)
    setShowModal(true)
  }

  const handleEdit = (item) => {
    setEditingItem(item)
    setShowModal(true)
  }

  const handleDelete = async (id) => {
    if (!confirm('Are you sure you want to delete this cluster leader?')) return
    
    // Find the item to get its hubs
    const itemToDelete = data.find(item => item.id === id)
    if (itemToDelete && itemToDelete.hubs && itemToDelete.hubs.length > 0) {
      // Clear cluster name from KPI records for these hubs
      await clearClusterFromKpiRecords(itemToDelete.hubs)
    }
    
    const { error } = await deleteClusterLeader(id)
    if (error) {
      showMessage('error', 'Delete failed: ' + error.message)
    } else {
      setData(prev => prev.filter(item => item.id !== id))
      showMessage('success', 'Cluster leader deleted successfully')
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    
    const submitData = {
      leader_name: formData.leader_name,
      hubs: selectedHubs
    }

    let result
    if (editingItem) {
      // Calculate hubs that were removed
      const previousHubs = editingItem.hubs || []
      const removedHubs = previousHubs.filter(hub => !selectedHubs.includes(hub))
      
      // Clear cluster name from removed hubs
      if (removedHubs.length > 0) {
        setIsSyncing(true)
        await clearClusterFromKpiRecords(removedHubs)
        setIsSyncing(false)
      }
      
      result = await updateClusterLeader(editingItem.id, submitData)
    } else {
      result = await createClusterLeader(submitData)
    }

    if (result.error) {
      showMessage('error', 'Save failed: ' + result.error.message)
    } else {
      // Check which hubs exist in KPI records
      let syncCount = 0
      if (selectedHubs.length > 0) {
        setIsSyncing(true)
        const hubCheck = await checkHubsInKpiRecords(selectedHubs)
        
        if (hubCheck.notFound.length > 0) {
          console.warn(`Hubs not found in KPI records:`, hubCheck.notFound)
          showMessage('warning', `${hubCheck.notFound.length} hub(s) not found in KPI records: ${hubCheck.notFound.join(', ')}. These hubs won't be synced.`)
        }
        
        const syncResult = await syncClusterToKpiRecords(formData.leader_name, selectedHubs)
        syncCount = syncResult.count || 0
        setIsSyncing(false)
      }
      
      if (editingItem) {
        setData(prev => prev.map(item => item.id === editingItem.id ? result.data : item))
      } else {
        setData(prev => [result.data, ...prev])
      }
      setShowModal(false)
      setEditingItem(null)
      
      // Show success message
      if (syncCount > 0) {
        showMessage('success', `Cluster leader saved and synced to ${syncCount} KPI records`)
      } else {
        showMessage('success', 'Cluster leader saved successfully')
      }
    }
  }

  const toggleHub = (hub) => {
    setSelectedHubs(prev => 
      prev.includes(hub) 
        ? prev.filter(h => h !== hub)
        : [...prev, hub]
    )
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-[hsl(0,58%,42%)]" />
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-3">
        <div>
          <h1 className="text-xl font-bold text-white">Clustering Management</h1>
          <p className="text-slate-400 mt-0.5 text-xs">Manage cluster leaders and their assigned hubs</p>
        </div>
        <button
          onClick={handleAdd}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-[hsl(0,58%,42%)] hover:bg-[hsl(0,58%,48%)] text-white rounded-lg transition-all duration-180 font-medium text-xs shadow-sm hover:shadow-md hover:scale-105"
        >
          <Plus className="w-3.5 h-3.5" />
          Add Cluster Leader
        </button>
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

      {/* Data Table */}
      <div className="bg-[hsl(220,20%,14%)] rounded-[14px] border border-[hsl(220,13%,30%)] shadow-[0_2px_8px_rgba(0,0,0,0.05)] overflow-hidden">
        <div className="overflow-x-auto max-h-[calc(100vh-280px)]">
          <table className="w-full">
            <thead className="bg-[hsl(220,18%,18%)] sticky top-0 z-10">
              <tr className="border-b border-[hsl(220,13%,30%)]">
                <th className="px-4 py-3 text-left text-[11px] font-semibold text-[hsl(220,10%,70%)] uppercase tracking-wide">Cluster Leader</th>
                <th className="px-4 py-3 text-left text-[11px] font-semibold text-[hsl(220,10%,70%)] uppercase tracking-wide">Assigned Hubs</th>
                <th className="px-4 py-3 text-left text-[11px] font-semibold text-[hsl(220,10%,70%)] uppercase tracking-wide">Hub Count</th>
                <th className="px-4 py-3 text-right text-[11px] font-semibold text-[hsl(220,10%,70%)] uppercase tracking-wide">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[hsl(220,13%,30%)]">
              {data.map((row) => (
                <tr key={row.id} className="hover:bg-[hsl(220,18%,18%)] transition-all duration-180">
                  <td className="px-4 py-3 whitespace-nowrap">
                    <div className="flex items-center gap-2">
                      <div className="p-2 rounded-lg bg-[hsl(0,58%,42%)]/20">
                        <User className="w-4 h-4 text-[hsl(0,58%,42%)]" />
                      </div>
                      <span className="text-sm font-semibold text-[hsl(220,15%,95%)]">{row.leader_name}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1">
                      {row.hubs && row.hubs.length > 0 ? (
                        row.hubs.map((hub, idx) => (
                          <span key={idx} className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] bg-[hsl(220,18%,18%)] border border-[hsl(220,13%,30%)] rounded text-[hsl(220,8%,55%)]">
                            <Building2 className="w-3 h-3" />
                            {hub}
                          </span>
                        ))
                      ) : (
                        <span className="text-[hsl(220,8%,55%)] text-xs">No hubs assigned</span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm text-[hsl(220,8%,55%)]">
                    {row.hubs ? row.hubs.length : 0}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => handleEdit(row)}
                        className="p-1.5 text-[hsl(220,8%,55%)] hover:text-[hsl(220,15%,95%)] hover:bg-[hsl(220,18%,18%)] rounded-lg transition-all duration-180"
                        title="Edit"
                      >
                        <Edit className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(row.id)}
                        className="p-1.5 text-[hsl(220,8%,55%)] hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-all duration-180"
                        title="Delete"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {data.length === 0 && (
          <div className="text-center py-8 text-[hsl(220,8%,55%)] text-xs">
            No cluster leaders found. Click "Add Cluster Leader" to create one.
          </div>
        )}
      </div>

      <div className="text-xs text-[hsl(220,8%,55%)] font-medium">
        Showing <span className="text-[hsl(220,15%,95%)] font-semibold">{data.length}</span> cluster leaders
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-[70] p-4">
          <div className="bg-[hsl(220,20%,14%)] rounded-[14px] border border-[hsl(220,13%,30%)] shadow-[0_4px_16px_rgba(0,0,0,0.07)] w-full max-w-lg">
            <div className="flex items-center justify-between p-4 border-b border-[hsl(220,13%,30%)]">
              <h3 className="text-base font-semibold text-[hsl(220,15%,95%)]">
                {editingItem ? 'Edit Cluster Leader' : 'Add Cluster Leader'}
              </h3>
              <button
                onClick={() => setShowModal(false)}
                className="p-1 text-[hsl(220,8%,55%)] hover:text-[hsl(220,15%,95%)] transition-all duration-180 hover:scale-110"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="p-4 space-y-4">
              <div>
                <label className="block text-[11px] font-medium text-[hsl(220,10%,70%)] mb-1.5">
                  Cluster Leader Name
                </label>
                <input
                  type="text"
                  value={formData.leader_name}
                  onChange={(e) => setFormData(prev => ({ ...prev, leader_name: e.target.value }))}
                  className="w-full px-3 py-2 text-sm bg-[hsl(220,18%,18%)] border border-[hsl(220,13%,30%)] rounded-[6px] focus:border-[hsl(0,58%,42%)] outline-none text-[hsl(220,15%,95%)]"
                  placeholder="Enter cluster leader name"
                  required
                />
              </div>

              <div>
                <label className="block text-[11px] font-medium text-[hsl(220,10%,70%)] mb-1.5">
                  Assign Hubs
                </label>
                <div className="relative mb-2">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-[hsl(220,8%,55%)]" />
                  <input
                    type="text"
                    value={hubSearch}
                    onChange={(e) => setHubSearch(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 text-sm bg-[hsl(220,18%,18%)] border border-[hsl(220,13%,30%)] rounded-[6px] focus:border-[hsl(0,58%,42%)] outline-none text-[hsl(220,15%,95%)] placeholder-[hsl(220,8%,55%)]"
                    placeholder="Search hubs..."
                  />
                </div>
                <div className="max-h-48 overflow-y-auto bg-[hsl(220,18%,18%)] border border-[hsl(220,13%,30%)] rounded-[6px] p-2 space-y-1">
                  {availableHubs.length > 0 ? (
                    availableHubs
                      .filter(hub => hub.toLowerCase().includes(hubSearch.toLowerCase()))
                      .map(hub => (
                      <label key={hub} className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-[hsl(220,20%,14%)] cursor-pointer transition-colors">
                        <input
                          type="checkbox"
                          checked={selectedHubs.includes(hub)}
                          onChange={() => toggleHub(hub)}
                          className="w-4 h-4 rounded border-[hsl(220,13%,30%)] bg-[hsl(220,18%,18%)] text-[hsl(0,58%,42%)] focus:ring-[hsl(0,58%,42%)]"
                        />
                        <span className="text-sm text-[hsl(220,15%,95%)]">{hub}</span>
                      </label>
                    ))
                  ) : (
                    <p className="text-[hsl(220,8%,55%)] text-xs p-2">No hubs available. All hubs are already assigned to other cluster leaders.</p>
                  )}
                  {availableHubs.length > 0 && availableHubs.filter(hub => hub.toLowerCase().includes(hubSearch.toLowerCase())).length === 0 && (
                    <p className="text-[hsl(220,8%,55%)] text-xs p-2">No hubs match your search.</p>
                  )}
                </div>
                {selectedHubs.length > 0 && (
                  <p className="text-[10px] text-[hsl(220,8%,55%)] mt-1">
                    {selectedHubs.length} hub(s) selected
                  </p>
                )}
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  disabled={isSyncing}
                  className="px-3 py-1.5 text-xs border border-[hsl(220,13%,30%)] hover:bg-[hsl(220,18%,18%)] text-[hsl(220,8%,55%)] rounded-[6px] transition-all duration-180 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSyncing}
                  className="px-3 py-1.5 text-xs bg-[hsl(0,58%,42%)] hover:bg-[hsl(0,58%,48%)] text-white rounded-[6px] transition-all duration-180 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  {isSyncing ? (
                    <>
                      <Loader2 className="w-3 h-3 animate-spin" />
                      Syncing...
                    </>
                  ) : (
                    editingItem ? 'Update' : 'Create'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

export default Clustering
