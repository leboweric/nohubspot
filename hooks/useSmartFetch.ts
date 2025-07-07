/**
 * React hook for smart API fetching with circuit breaker and caching
 */

import { useState, useEffect, useCallback } from 'react'
import { smartFetch } from '@/lib/smart-polling'

interface UseSmartFetchOptions {
  cache?: boolean
  cacheTTL?: number
  skipCircuitBreaker?: boolean
  debounceMs?: number
}

interface UseSmartFetchResult<T> {
  data: T | null
  loading: boolean
  error: string | null
  refetch: () => Promise<void>
}

export const useSmartFetch = <T = any>(
  url: string | null,
  options: RequestInit = {},
  config: UseSmartFetchOptions = {}
): UseSmartFetchResult<T> => {
  const [data, setData] = useState<T | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchData = useCallback(async () => {
    if (!url) return

    setLoading(true)
    setError(null)

    try {
      const response = await smartFetch(url, options, config)
      
      if (!response) {
        // Circuit breaker blocked the request or polling disabled
        setLoading(false)
        return
      }

      if (response.ok) {
        const result = await response.json()
        setData(result)
      } else {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setLoading(false)
    }
  }, [url, JSON.stringify(options), JSON.stringify(config)])

  useEffect(() => {
    if (url) {
      fetchData()
    }
  }, [fetchData])

  return {
    data,
    loading,
    error,
    refetch: fetchData
  }
}

/**
 * Hook for debounced API calls (useful for search)
 */
export const useDebouncedSmartFetch = <T = any>(
  url: string | null,
  options: RequestInit = {},
  config: UseSmartFetchOptions & { debounceMs?: number } = {}
): UseSmartFetchResult<T> => {
  const { debounceMs = 1000, ...smartFetchConfig } = config
  const [debouncedUrl, setDebouncedUrl] = useState(url)

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      setDebouncedUrl(url)
    }, debounceMs)

    return () => clearTimeout(timeoutId)
  }, [url, debounceMs])

  return useSmartFetch<T>(debouncedUrl, options, smartFetchConfig)
}

/**
 * Hook for throttled window focus refetching
 */
export const useThrottledFocusRefetch = (
  refetchFn: () => Promise<void>,
  throttleMs: number = 30000
): void => {
  useEffect(() => {
    let lastFocusTime = 0

    const handleFocus = () => {
      const now = Date.now()
      if (now - lastFocusTime > throttleMs) {
        console.log('Window focus detected, refetching data after cooldown')
        refetchFn()
        lastFocusTime = now
      } else {
        console.log('Window focus ignored - still in cooldown period')
      }
    }

    window.addEventListener('focus', handleFocus)
    return () => window.removeEventListener('focus', handleFocus)
  }, [refetchFn, throttleMs])
}