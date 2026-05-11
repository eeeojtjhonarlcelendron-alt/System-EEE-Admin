import React from 'react'

// Add custom animations to document head
if (typeof document !== 'undefined') {
  const style = document.createElement('style')
  style.textContent = `
    @keyframes moveProgress {
      0% { background-position: 0% 50%; }
      100% { background-position: 200% 50%; }
    }
    @keyframes shimmer {
      0% { transform: translateX(-100%); }
      100% { transform: translateX(100%); }
    }
  `
  document.head.appendChild(style)
}

// Skeleton Card Component
export const SkeletonCard = ({ className = "" }) => (
  <div className={`bg-[hsl(220,18%,18%)] border border-[hsl(220,13%,30%)] rounded-lg p-4 ${className}`}>
    <div className="animate-pulse">
      <div className="h-4 bg-[hsl(220,13%,30%)] rounded w-3/4 mb-3"></div>
      <div className="h-8 bg-[hsl(220,13%,30%)] rounded w-1/2 mb-2"></div>
      <div className="h-3 bg-[hsl(220,13%,30%)] rounded w-full"></div>
    </div>
  </div>
)

// Skeleton Stats Card Component
export const SkeletonStatsCard = ({ className = "" }) => (
  <div className={`bg-[hsl(220,18%,18%)] border border-[hsl(220,13%,30%)] rounded-lg p-4 ${className}`}>
    <div className="animate-pulse">
      <div className="h-3 bg-[hsl(220,13%,30%)] rounded w-1/3 mb-2"></div>
      <div className="h-6 bg-[hsl(220,13%,30%)] rounded w-2/3 mb-1"></div>
      <div className="h-2 bg-[hsl(220,13%,30%)] rounded w-1/4"></div>
    </div>
  </div>
)

// Skeleton Chart Component
export const SkeletonChart = ({ className = "" }) => (
  <div className={`bg-[hsl(220,18%,18%)] border border-[hsl(220,13%,30%)] rounded-lg p-6 ${className}`}>
    <div className="animate-pulse">
      <div className="h-4 bg-[hsl(220,13%,30%)] rounded w-1/3 mb-4"></div>
      <div className="h-48 bg-[hsl(220,13%,30%)] rounded mb-4"></div>
      <div className="flex justify-between">
        <div className="h-3 bg-[hsl(220,13%,30%)] rounded w-1/4"></div>
        <div className="h-3 bg-[hsl(220,13%,30%)] rounded w-1/4"></div>
        <div className="h-3 bg-[hsl(220,13%,30%)] rounded w-1/4"></div>
      </div>
    </div>
  </div>
)

// Skeleton Table Component
export const SkeletonTable = ({ rows = 5, className = "" }) => (
  <div className={`bg-[hsl(220,18%,18%)] border border-[hsl(220,13%,30%)] rounded-lg overflow-hidden ${className}`}>
    <div className="animate-pulse">
      {/* Table Header */}
      <div className="border-b border-[hsl(220,13%,30%)] p-4">
        <div className="grid grid-cols-4 gap-4">
          <div className="h-3 bg-[hsl(220,13%,30%)] rounded"></div>
          <div className="h-3 bg-[hsl(220,13%,30%)] rounded"></div>
          <div className="h-3 bg-[hsl(220,13%,30%)] rounded"></div>
          <div className="h-3 bg-[hsl(220,13%,30%)] rounded"></div>
        </div>
      </div>
      {/* Table Rows */}
      {Array.from({ length: rows }).map((_, index) => (
        <div key={index} className="border-b border-[hsl(220,13%,30%)] p-4">
          <div className="grid grid-cols-4 gap-4">
            <div className="h-3 bg-[hsl(220,13%,30%)] rounded"></div>
            <div className="h-3 bg-[hsl(220,13%,30%)] rounded"></div>
            <div className="h-3 bg-[hsl(220,13%,30%)] rounded"></div>
            <div className="h-3 bg-[hsl(220,13%,30%)] rounded"></div>
          </div>
        </div>
      ))}
    </div>
  </div>
)

// Progress Bar Loader Component
export const ProgressBarLoader = ({ className = "", progress = 0, loadingStage = "" }) => (
  <div 
    className={`fixed inset-0 z-[9999] flex items-center justify-center ${className}`}
    style={{ pointerEvents: 'none' }}
  >
    <div className="bg-slate-800 rounded-xl p-6 shadow-2xl border border-white/20 max-w-md w-full mx-4">
      <div className="flex flex-col items-center space-y-4">
        {/* Animated dots */}
        <div className="flex items-center space-x-2">
          <div className="w-3 h-3 bg-[#a83030] rounded-full animate-pulse"></div>
          <div className="w-3 h-3 bg-[#a83030] rounded-full animate-pulse" style={{ animationDelay: '200ms' }}></div>
          <div className="w-3 h-3 bg-[#a83030] rounded-full animate-pulse" style={{ animationDelay: '400ms' }}></div>
        </div>
        
        {/* Loading stage text */}
        {loadingStage && <p className="text-sm text-white/90 text-center">{loadingStage}</p>}
        
        {/* Progress bar */}
        <div className="w-full">
          <div className="w-full bg-white/20 rounded-full h-3 overflow-hidden">
            <div 
              className="h-full bg-gradient-to-r from-[#a83030] to-[#c94c4c] rounded-full transition-all duration-1000 ease-out"
              style={{ width: `${Math.min(progress, 100)}%` }}
            ></div>
          </div>
          <div className="flex justify-center mt-2">
            <span className="text-xs text-white/80">{Math.round(progress)}%</span>
          </div>
        </div>
      </div>
    </div>
  </div>
)

// Skeleton Loading Spinner Component
export const SkeletonSpinner = ({ className = "" }) => (
  <div className={`flex items-center justify-center p-8 ${className}`}>
    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[hsl(0,58%,42%)]"></div>
  </div>
)

// Skeleton Dashboard Layout
export const SkeletonDashboard = () => (
  <div className="space-y-6">
    {/* Stats Cards Row */}
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      <SkeletonStatsCard />
      <SkeletonStatsCard />
      <SkeletonStatsCard />
      <SkeletonStatsCard />
    </div>
    
    {/* Charts Row */}
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <SkeletonChart />
      <SkeletonChart />
    </div>
    
    {/* Table Section */}
    <SkeletonTable rows={8} />
  </div>
)

// Skeleton KPI Layout
export const SkeletonKPI = () => (
  <div className="space-y-6">
    {/* Filters Row */}
    <div className="flex justify-between items-center">
      <div className="flex gap-4">
        <div className="animate-pulse">
          <div className="h-10 bg-[hsl(220,13%,30%)] rounded w-32"></div>
        </div>
        <div className="animate-pulse">
          <div className="h-10 bg-[hsl(220,13%,30%)] rounded w-32"></div>
        </div>
      </div>
      <div className="animate-pulse">
        <div className="h-10 bg-[hsl(220,13%,30%)] rounded w-24"></div>
      </div>
    </div>
    
    {/* Stats Cards */}
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      <SkeletonStatsCard />
      <SkeletonStatsCard />
      <SkeletonStatsCard />
      <SkeletonStatsCard />
    </div>
    
    {/* Table */}
    <SkeletonTable rows={10} />
  </div>
)

// Skeleton Performance Layout
export const SkeletonPerformance = () => (
  <div className="space-y-6">
    {/* Filters Row */}
    <div className="flex justify-between items-center">
      <div className="flex gap-4">
        <div className="animate-pulse">
          <div className="h-10 bg-[hsl(220,13%,30%)] rounded w-32"></div>
        </div>
        <div className="animate-pulse">
          <div className="h-10 bg-[hsl(220,13%,30%)] rounded w-32"></div>
        </div>
      </div>
      <div className="animate-pulse">
        <div className="h-10 bg-[hsl(220,13%,30%)] rounded w-24"></div>
      </div>
    </div>
    
    {/* Stats Cards */}
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      <SkeletonStatsCard />
      <SkeletonStatsCard />
      <SkeletonStatsCard />
      <SkeletonStatsCard />
    </div>
    
    {/* Table */}
    <SkeletonTable rows={15} />
  </div>
)

// Skeleton Rider Layout
export const SkeletonRider = () => (
  <div className="space-y-6">
    {/* Filters Row */}
    <div className="flex justify-between items-center">
      <div className="flex gap-4">
        <div className="animate-pulse">
          <div className="h-10 bg-[hsl(220,13%,30%)] rounded w-48"></div>
        </div>
        <div className="animate-pulse">
          <div className="h-10 bg-[hsl(220,13%,30%)] rounded w-32"></div>
        </div>
        <div className="animate-pulse">
          <div className="h-10 bg-[hsl(220,13%,30%)] rounded w-32"></div>
        </div>
      </div>
      <div className="animate-pulse">
        <div className="h-10 bg-[hsl(220,13%,30%)] rounded w-24"></div>
      </div>
    </div>
    
    {/* Stats Cards */}
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      <SkeletonStatsCard />
      <SkeletonStatsCard />
      <SkeletonStatsCard />
      <SkeletonStatsCard />
    </div>
    
    {/* Table */}
    <SkeletonTable rows={20} />
  </div>
)
