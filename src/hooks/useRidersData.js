import { useQuery, useInfiniteQuery } from '@tanstack/react-query'
import { getRiders, getRiderHubStats } from '../lib/data'

// Hook for paginated riders data
export function useRidersData(filters = {}, pageSize = 50) {
  return useInfiniteQuery({
    queryKey: ['riders', filters, pageSize],
    queryFn: ({ pageParam = 0 }) => 
      getRidersPaginated(pageParam, pageSize, filters),
    getNextPageParam: (lastPage, allPages) => {
      if (lastPage.data.length < pageSize) return undefined
      return allPages.length
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
    cacheTime: 10 * 60 * 1000, // 10 minutes
  })
}

// Hook for rider hub stats (dashboard use)
export function useRiderHubStats() {
  return useQuery({
    queryKey: ['riderHubStats'],
    queryFn: () => getRiderHubStats(),
    staleTime: 10 * 60 * 1000, // 10 minutes
    cacheTime: 30 * 60 * 1000, // 30 minutes
  })
}
