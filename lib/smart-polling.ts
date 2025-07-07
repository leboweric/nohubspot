/**
 * Smart Polling and Circuit Breaker Utilities
 * 
 * This module provides utilities to prevent resource exhaustion and API overload
 * by implementing circuit breaker patterns, request debouncing, and smart caching.
 */

// Circuit breaker state interface
interface CircuitBreakerState {
  failureCount: number
  lastFailureTime: number
  state: 'CLOSED' | 'OPEN' | 'HALF_OPEN'
}

// Global circuit breaker state storage
const circuitBreakers = new Map<string, CircuitBreakerState>()

// Configuration constants
const CIRCUIT_BREAKER_CONFIG = {
  MAX_FAILURES: 3,
  RESET_TIMEOUT: 30000, // 30 seconds
  HALF_OPEN_MAX_CALLS: 3
}

// Request cache with TTL
interface CacheEntry {
  data: any
  timestamp: number
  ttl: number
}

const requestCache = new Map<string, CacheEntry>()

// API call monitoring
let apiCallCount = 0
let lastResetTime = Date.now()
const MAX_CALLS_PER_MINUTE = 20

/**
 * Tracks API call frequency and warns if threshold is exceeded
 */
export const trackApiCall = (endpoint: string): void => {
  apiCallCount++
  const now = Date.now()
  
  // Reset counter every minute
  if (now - lastResetTime > 60000) {
    if (apiCallCount > MAX_CALLS_PER_MINUTE) {
      console.warn(`⚠️ HIGH API CALL FREQUENCY: ${apiCallCount} calls in the last minute`)
    }
    apiCallCount = 0
    lastResetTime = now
  }
}

/**
 * Circuit breaker implementation to prevent cascading failures
 */
export const getCircuitBreakerState = (endpoint: string): CircuitBreakerState => {
  if (!circuitBreakers.has(endpoint)) {
    circuitBreakers.set(endpoint, {
      failureCount: 0,
      lastFailureTime: 0,
      state: 'CLOSED'
    })
  }
  return circuitBreakers.get(endpoint)!
}

/**
 * Updates circuit breaker state based on request outcome
 */
export const updateCircuitBreaker = (endpoint: string, success: boolean): void => {
  const breaker = getCircuitBreakerState(endpoint)
  
  if (success) {
    // Reset on success
    breaker.failureCount = 0
    breaker.state = 'CLOSED'
  } else {
    // Increment failure count
    breaker.failureCount++
    breaker.lastFailureTime = Date.now()
    
    if (breaker.failureCount >= CIRCUIT_BREAKER_CONFIG.MAX_FAILURES) {
      breaker.state = 'OPEN'
      console.warn(`Circuit breaker OPEN for ${endpoint}`)
    }
  }
}

/**
 * Checks if circuit breaker allows the request
 */
export const canMakeRequest = (endpoint: string): boolean => {
  const breaker = getCircuitBreakerState(endpoint)
  const now = Date.now()
  
  switch (breaker.state) {
    case 'CLOSED':
      return true
    case 'OPEN':
      // Check if reset timeout has passed
      if (now - breaker.lastFailureTime > CIRCUIT_BREAKER_CONFIG.RESET_TIMEOUT) {
        breaker.state = 'HALF_OPEN'
        return true
      }
      return false
    case 'HALF_OPEN':
      // Allow limited requests to test if service is back
      return breaker.failureCount < CIRCUIT_BREAKER_CONFIG.HALF_OPEN_MAX_CALLS
    default:
      return false
  }
}

/**
 * Enhanced fetch with circuit breaker, caching, and monitoring
 */
export const smartFetch = async (
  url: string, 
  options: RequestInit = {},
  config: {
    cache?: boolean
    cacheTTL?: number
    skipCircuitBreaker?: boolean
  } = {}
): Promise<Response | null> => {
  const { cache = false, cacheTTL = 300000, skipCircuitBreaker = false } = config
  
  // Emergency disable check
  if (process.env.NEXT_PUBLIC_DISABLE_POLLING === 'true') {
    console.log('API calls disabled by environment variable')
    return null
  }
  
  // Track the API call
  trackApiCall(url)
  
  // Check cache first
  if (cache && options.method !== 'POST' && options.method !== 'PUT' && options.method !== 'DELETE') {
    const cacheKey = `${url}:${JSON.stringify(options)}`
    const cached = requestCache.get(cacheKey)
    
    if (cached && (Date.now() - cached.timestamp) < cached.ttl) {
      console.log(`Cache hit for ${url}`)
      return new Response(JSON.stringify(cached.data), {
        status: 200,
        headers: { 'content-type': 'application/json' }
      })
    }
  }
  
  // Circuit breaker check
  if (!skipCircuitBreaker && !canMakeRequest(url)) {
    console.log(`Circuit breaker blocking request to ${url}`)
    return null
  }
  
  try {
    const response = await fetch(url, options)
    
    // Update circuit breaker
    updateCircuitBreaker(url, response.ok)
    
    // Cache successful GET requests
    if (cache && response.ok && (!options.method || options.method === 'GET')) {
      const data = await response.clone().json()
      const cacheKey = `${url}:${JSON.stringify(options)}`
      requestCache.set(cacheKey, {
        data,
        timestamp: Date.now(),
        ttl: cacheTTL
      })
    }
    
    return response
  } catch (error) {
    updateCircuitBreaker(url, false)
    throw error
  }
}

/**
 * Debounced function creator
 */
export const debounce = <T extends (...args: any[]) => any>(
  func: T,
  delay: number
): ((...args: Parameters<T>) => void) => {
  let timeoutId: NodeJS.Timeout
  
  return (...args: Parameters<T>) => {
    clearTimeout(timeoutId)
    timeoutId = setTimeout(() => func(...args), delay)
  }
}

/**
 * Smart polling class with exponential backoff
 */
export class SmartPoller {
  private fetchFunction: () => Promise<any>
  private baseInterval: number
  private currentInterval: number
  private maxInterval: number
  private failureCount: number
  private isActive: boolean
  private timeoutId: NodeJS.Timeout | null = null
  
  constructor(
    fetchFunction: () => Promise<any>,
    baseInterval: number = 5000
  ) {
    this.fetchFunction = fetchFunction
    this.baseInterval = baseInterval
    this.currentInterval = baseInterval
    this.maxInterval = 300000 // 5 minutes max
    this.failureCount = 0
    this.isActive = false
  }
  
  start(): void {
    this.isActive = true
    this.poll()
  }
  
  stop(): void {
    this.isActive = false
    if (this.timeoutId) {
      clearTimeout(this.timeoutId)
      this.timeoutId = null
    }
  }
  
  private async poll(): Promise<void> {
    if (!this.isActive) return
    
    try {
      await this.fetchFunction()
      // Success - reset interval
      this.currentInterval = this.baseInterval
      this.failureCount = 0
    } catch (error) {
      // Failure - increase interval with exponential backoff
      this.failureCount++
      this.currentInterval = Math.min(
        this.currentInterval * Math.pow(2, this.failureCount),
        this.maxInterval
      )
      console.warn(`Polling failed ${this.failureCount} times. Next attempt in ${this.currentInterval}ms`)
    }
    
    if (this.isActive) {
      this.timeoutId = setTimeout(() => this.poll(), this.currentInterval)
    }
  }
}

/**
 * Visibility-aware polling hook helper
 */
export const createVisibilityAwarePoller = (
  pollFunction: () => Promise<any>,
  interval: number
): (() => void) => {
  let intervalId: NodeJS.Timeout | null = null
  
  const startPolling = () => {
    if (!document.hidden && !intervalId) {
      intervalId = setInterval(pollFunction, interval)
    }
  }
  
  const stopPolling = () => {
    if (intervalId) {
      clearInterval(intervalId)
      intervalId = null
    }
  }
  
  const handleVisibilityChange = () => {
    if (document.hidden) {
      stopPolling()
    } else {
      startPolling()
    }
  }
  
  document.addEventListener('visibilitychange', handleVisibilityChange)
  startPolling()
  
  // Return cleanup function
  return () => {
    stopPolling()
    document.removeEventListener('visibilitychange', handleVisibilityChange)
  }
}

/**
 * Memory usage monitoring
 */
export const checkMemoryUsage = (): void => {
  if (typeof window !== 'undefined' && 'performance' in window && 'memory' in performance) {
    const memory = (performance as any).memory
    const used = memory.usedJSHeapSize / 1048576 // MB
    const limit = memory.jsHeapSizeLimit / 1048576 // MB
    
    if (used > limit * 0.8) {
      console.warn(`⚠️ HIGH MEMORY USAGE: ${used.toFixed(1)}MB / ${limit.toFixed(1)}MB`)
    }
  }
}

/**
 * Clear expired cache entries
 */
export const clearExpiredCache = (): void => {
  const now = Date.now()
  for (const [key, entry] of requestCache.entries()) {
    if (now - entry.timestamp > entry.ttl) {
      requestCache.delete(key)
    }
  }
}

// Auto-cleanup expired cache entries every 5 minutes
if (typeof window !== 'undefined') {
  setInterval(clearExpiredCache, 300000)
  
  // Monitor memory usage every 30 seconds
  setInterval(checkMemoryUsage, 30000)
}