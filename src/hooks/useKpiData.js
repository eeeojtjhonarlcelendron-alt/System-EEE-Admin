import { useQuery, useInfiniteQuery } from '@tanstack/react-query'
import { getKpiRecords, getRecentKpiRecords } from '../lib/data'

// Hook for paginated KPI data
export function useKpiData(filters = {}, pageSize = 50) {
  return useInfiniteQuery({
    queryKey: ['kpiRecords', filters, pageSize],
    queryFn: ({ pageParam = 0 }) => 
      getKpiRecordsPaginated(pageParam, pageSize, filters),
    getNextPageParam: (lastPage, allPages) => {
      if (lastPage.data.length < pageSize) return undefined
      return allPages.length
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
    cacheTime: 10 * 60 * 1000, // 10 minutes
  })
}

// Hook for recent KPI data (dashboard use)
export function useRecentKpiData(days = 30, filters = {}) {
  return useQuery({
    queryKey: ['recentKpi', days, filters],
    queryFn: () => getRecentKpiRecords(days, filters),
    staleTime: 2 * 60 * 1000, // 2 minutes
    cacheTime: 5 * 60 * 1000, // 5 minutes
  })
}
