import { useQuery, useInfiniteQuery } from '@tanstack/react-query'
import { getPerformanceRecordsPaginated, getRecentPerformanceRecords } from '../lib/data'

// Hook for paginated performance data
export function usePerformanceData(filters = {}, pageSize = 50) {
  return useInfiniteQuery({
    queryKey: ['performanceRecords', filters, pageSize],
    queryFn: ({ pageParam = 0 }) => 
      getPerformanceRecordsPaginated(pageParam, pageSize, filters),
    getNextPageParam: (lastPage, allPages) => {
      if (lastPage.data.length < pageSize) return undefined
      return allPages.length
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
    cacheTime: 10 * 60 * 1000, // 10 minutes
  })
}

// Hook for recent performance data (dashboard use)
export function useRecentPerformanceData(days = 30, filters = {}) {
  return useQuery({
    queryKey: ['recentPerformance', days, filters],
    queryFn: () => getRecentPerformanceRecords(days, filters),
    staleTime: 2 * 60 * 1000, // 2 minutes
    cacheTime: 5 * 60 * 1000, // 5 minutes
  })
}
