/**
 * Rate Limiting Middleware
 * 
 * Token bucket algorithm with sliding window for better performance
 */

import { Elysia } from 'elysia'

interface RateLimitConfig {
  windowMs: number // Time window in milliseconds
  maxRequests: number // Max requests per window
  keyGenerator?: (ctx: any) => string // Custom key generation
  skipSuccessfulRequests?: boolean // Don't count successful requests
  skipFailedRequests?: boolean // Don't count failed requests
  message?: string // Custom error message
}

interface TokenBucket {
  tokens: number
  lastRefill: number
  requestTimes: number[] // Sliding window of request times
}

class RateLimiter {
  private buckets = new Map<string, TokenBucket>()
  private cleanupInterval: NodeJS.Timeout | null = null
  
  constructor(private config: RateLimitConfig) {
    // Cleanup old buckets periodically
    this.cleanupInterval = setInterval(
      () => this.cleanup(),
      Math.max(config.windowMs, 60000) // At least every minute
    )
  }
  
  /**
   * Check if request should be rate limited
   */
  shouldLimit(key: string): { limited: boolean; retryAfter?: number } {
    const now = Date.now()
    let bucket = this.buckets.get(key)
    
    if (!bucket) {
      bucket = {
        tokens: this.config.maxRequests,
        lastRefill: now,
        requestTimes: []
      }
      this.buckets.set(key, bucket)
    }
    
    // Remove old requests from sliding window
    bucket.requestTimes = bucket.requestTimes.filter(
      time => now - time < this.config.windowMs
    )
    
    // Refill tokens based on time passed
    const timePassed = now - bucket.lastRefill
    const tokensToAdd = Math.floor(
      (timePassed / this.config.windowMs) * this.config.maxRequests
    )
    
    if (tokensToAdd > 0) {
      bucket.tokens = Math.min(
        this.config.maxRequests,
        bucket.tokens + tokensToAdd
      )
      bucket.lastRefill = now
    }
    
    // Check sliding window
    if (bucket.requestTimes.length >= this.config.maxRequests) {
      const oldestRequest = bucket.requestTimes[0]
      const retryAfter = Math.ceil(
        (oldestRequest + this.config.windowMs - now) / 1000
      )
      return { limited: true, retryAfter }
    }
    
    // Check token bucket
    if (bucket.tokens <= 0) {
      const retryAfter = Math.ceil(
        (this.config.windowMs - timePassed) / 1000
      )
      return { limited: true, retryAfter }
    }
    
    // Consume token and record request
    bucket.tokens--
    bucket.requestTimes.push(now)
    
    return { limited: false }
  }
  
  /**
   * Cleanup old buckets
   */
  private cleanup(): void {
    const now = Date.now()
    const expired: string[] = []
    
    for (const [key, bucket] of this.buckets.entries()) {
      const lastRequest = Math.max(
        bucket.lastRefill,
        ...bucket.requestTimes
      )
      
      if (now - lastRequest > this.config.windowMs * 2) {
        expired.push(key)
      }
    }
    
    expired.forEach(key => this.buckets.delete(key))
    
    if (expired.length > 0) {
      console.log(`[RateLimiter] Cleaned up ${expired.length} expired buckets`)
    }
  }
  
  /**
   * Destroy rate limiter
   */
  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval)
      this.cleanupInterval = null
    }
    this.buckets.clear()
  }
}

/**
 * Rate limiting configurations for different endpoints
 */
export const rateLimitConfigs = {
  // Strict limit for auth endpoints
  auth: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    maxRequests: 5,
    message: 'Too many authentication attempts, please try again later'
  },
  
  // Moderate limit for photo uploads
  upload: {
    windowMs: 60 * 60 * 1000, // 1 hour
    maxRequests: 50,
    message: 'Upload rate limit exceeded'
  },
  
  // Standard API limit
  api: {
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 100,
    message: 'Too many requests, please slow down'
  },
  
  // Relaxed limit for read operations
  read: {
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 200,
    message: 'Too many requests'
  },
  
  // Very strict limit for expensive operations
  expensive: {
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 10,
    message: 'This operation is rate limited, please wait'
  }
}

// Global rate limiters
const limiters = new Map<string, RateLimiter>()

/**
 * Create rate limiting middleware
 */
export function createRateLimitMiddleware(
  name: string,
  config: RateLimitConfig
): any {
  // Get or create limiter
  let limiter = limiters.get(name)
  if (!limiter) {
    limiter = new RateLimiter(config)
    limiters.set(name, limiter)
  }
  
  return async (ctx: any) => {
    // Generate key (default: IP + user ID)
    const key = config.keyGenerator
      ? config.keyGenerator(ctx)
      : `${ctx.request.headers.get('cf-connecting-ip') || ctx.ip}:${ctx.user?.id || 'anon'}`
    
    const { limited, retryAfter } = limiter.shouldLimit(key)
    
    if (limited) {
      ctx.set.status = 429
      ctx.set.headers['Retry-After'] = String(retryAfter || 60)
      ctx.set.headers['X-RateLimit-Limit'] = String(config.maxRequests)
      ctx.set.headers['X-RateLimit-Remaining'] = '0'
      ctx.set.headers['X-RateLimit-Reset'] = String(
        new Date(Date.now() + (retryAfter || 60) * 1000).toISOString()
      )
      
      return {
        success: false,
        error: config.message || 'Rate limit exceeded',
        retryAfter
      }
    }
    
    // Set rate limit headers
    ctx.set.headers['X-RateLimit-Limit'] = String(config.maxRequests)
    ctx.set.headers['X-RateLimit-Remaining'] = String(
      config.maxRequests - 1
    )
  }
}

/**
 * Rate limit middleware for Elysia
 */
export const rateLimitPlugin = (config: RateLimitConfig) => {
  const limiter = new RateLimiter(config)
  
  return new Elysia()
    .derive(async ({ request, user, set }: any) => {
      const key = config.keyGenerator
        ? config.keyGenerator({ request, user })
        : `${request.headers.get('cf-connecting-ip') || '127.0.0.1'}:${user?.id || 'anon'}`
      
      const { limited, retryAfter } = limiter.shouldLimit(key)
      
      if (limited) {
        set.status = 429
        set.headers['Retry-After'] = String(retryAfter || 60)
        
        return {
          rateLimited: true,
          error: config.message || 'Rate limit exceeded',
          retryAfter
        }
      }
      
      return { rateLimited: false }
    })
}

/**
 * Cleanup all rate limiters
 */
export function cleanupRateLimiters(): void {
  limiters.forEach(limiter => limiter.destroy())
  limiters.clear()
  console.log('[RateLimiter] All limiters cleaned up')
}
