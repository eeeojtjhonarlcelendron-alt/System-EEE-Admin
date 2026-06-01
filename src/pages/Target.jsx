import { useState, useEffect } from 'react'
import { Target as TargetIcon, Save, RefreshCw, CheckCircle, AlertCircle } from 'lucide-react'

const CATEGORIES = [
  'Cost Per Parcel',
  'Delivered Ado',
  'Dispatched Ado',
  'Success Rate',
  'Delivered Prod',
  'Assigned Prod',
  'Fleet Count'
]

const STORAGE_KEY = 'dashboard_targets'

function Target() {
  const [targets, setTargets] = useState({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState({ type: '', text: '' })

  useEffect(() => {
    fetchTargets()
  }, [])

  const fetchTargets = () => {
    try {
      setLoading(true)
      const stored = localStorage.getItem(STORAGE_KEY)
      if (stored) {
        setTargets(JSON.parse(stored))
      } else {
        // Initialize with defaults
        const defaultTargets = {}
        CATEGORIES.forEach(cat => {
          defaultTargets[cat] = 0
        })
        setTargets(defaultTargets)
      }
    } catch (error) {
      console.error('Error fetching targets:', error)
      showMessage('error', 'Failed to load targets')
    } finally {
      setLoading(false)
    }
  }

  const handleTargetChange = (category, value) => {
    setTargets(prev => ({
      ...prev,
      [category]: parseFloat(value) || 0
    }))
  }

  const saveTargets = () => {
    try {
      setSaving(true)
      localStorage.setItem(STORAGE_KEY, JSON.stringify(targets))
      showMessage('success', 'Targets saved successfully')
    } catch (error) {
      console.error('Error saving targets:', error)
      showMessage('error', 'Failed to save targets')
    } finally {
      setSaving(false)
    }
  }

  const showMessage = (type, text) => {
    setMessage({ type, text })
    setTimeout(() => {
      setMessage({ type: '', text: '' })
    }, 3000)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="w-8 h-8 text-maroon-500 animate-spin" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-maroon-500/20 rounded-lg">
            <TargetIcon className="w-6 h-6 text-maroon-500" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white">Target Settings</h1>
            <p className="text-sm text-slate-400">Set target percentages for Dashboard metrics</p>
          </div>
        </div>
        <button
          onClick={saveTargets}
          disabled={saving}
          className="flex items-center gap-2 px-4 py-2 bg-maroon-600 hover:bg-maroon-700 text-white rounded-lg transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {saving ? (
            <RefreshCw className="w-4 h-4 animate-spin" />
          ) : (
            <Save className="w-4 h-4" />
          )}
          {saving ? 'Saving...' : 'Save Targets'}
        </button>
      </div>

      {/* Message */}
      {message.text && (
        <div className={`flex items-center gap-2 px-4 py-3 rounded-lg ${
          message.type === 'success' 
            ? 'bg-green-500/20 text-green-400 border border-green-500/30' 
            : 'bg-red-500/20 text-red-400 border border-red-500/30'
        }`}>
          {message.type === 'success' ? (
            <CheckCircle className="w-5 h-5" />
          ) : (
            <AlertCircle className="w-5 h-5" />
          )}
          <span className="text-sm">{message.text}</span>
        </div>
      )}

      {/* Target Form */}
      <div className="bg-slate-800/80 backdrop-blur-sm rounded-lg border border-slate-600/50 p-6">
        <h2 className="text-lg font-semibold text-white mb-4">Target Values</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {CATEGORIES.map(category => (
            <div key={category} className="space-y-2">
              <label className="block text-sm font-medium text-slate-300">
                {category}
              </label>
              <div className="relative">
                <input
                  type="number"
                  value={targets[category] || 0}
                  onChange={(e) => handleTargetChange(category, e.target.value)}
                  className="w-full px-4 py-2 bg-slate-700/50 border border-slate-600/50 rounded-lg text-white focus:ring-2 focus:ring-maroon-500/50 focus:border-maroon-500 outline-none transition-all"
                  placeholder="Enter target value"
                  step="0.1"
                  min="0"
                />
                {category === 'Success Rate' && (
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">
                    %
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Info Section */}
      <div className="bg-slate-800/50 rounded-lg border border-slate-700/50 p-4">
        <div className="flex items-start gap-3">
          <TargetIcon className="w-5 h-5 text-maroon-500 mt-0.5 flex-shrink-0" />
          <div className="space-y-1">
            <h3 className="text-sm font-medium text-white">How Targets Work</h3>
            <p className="text-xs text-slate-400">
              Set target percentages for each metric category. These targets will appear as horizontal lines 
              in the Dashboard's Delivery Trend and Last vs Prior 7 Days charts to help visualize performance 
              against goals.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

export default Target
