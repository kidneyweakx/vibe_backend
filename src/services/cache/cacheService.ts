/**
 * Centralized Cache Service
 * 
 * Provides in-memory caching with TTL, LRU eviction, and automatic cleanup
 * Optimized for Cloudflare Workers environment
 */

interface CacheEntry<T> {
  value: T
  expiresAt: number
  accessCount: number
  lastAccessed: number
  size: number // Approximate memory size in bytes
}

interface CacheStats {
  hits: number
  misses: number
  evictions: number
  totalSize: number
  itemCount: number
}

export class CacheService<T = any> {
  private cache = new Map<string, CacheEntry<T>>()
  private stats: CacheStats = {
    hits: 0,
    misses: 0,
    evictions: 0,
    totalSize: 0,
    itemCount: 0
  }
  
  constructor(
    private readonly maxSize: number = 50 * 1024 * 1024, // 50MB default
    private readonly maxItems: number = 10000,
    private readonly defaultTTL: number = 5 * 60 * 1000 // 5 minutes
  ) {
    // Periodic cleanup
    if (typeof setInterval !== 'undefined') {
      setInterval(() => this.cleanup(), 60 * 1000) // Every minute
    }
  }

  /**
   * Get item from cache
   */
  get(key: string): T | null {
    const entry = this.cache.get(key)
    
    if (!entry) {
      this.stats.misses++
      return null
    }
    
    if (entry.expiresAt < Date.now()) {
      this.delete(key)
      this.stats.misses++
      return null
    }
    
    // Update access stats
    entry.accessCount++
    entry.lastAccessed = Date.now()
    this.stats.hits++
    
    return entry.value
  }

  /**
   * Set item in cache with optional TTL
   */
  set(key: string, value: T, ttl?: number): void {
    const size = this.estimateSize(value)
    
    // Check if we need to evict items
    while (
      (this.stats.totalSize + size > this.maxSize || 
       this.cache.size >= this.maxItems) && 
      this.cache.size > 0
    ) {
      this.evictLRU()
    }
    
    // Remove old entry if exists
    if (this.cache.has(key)) {
      this.delete(key)
    }
    
    const entry: CacheEntry<T> = {
      value,
      expiresAt: Date.now() + (ttl || this.defaultTTL),
      accessCount: 0,
      lastAccessed: Date.now(),
      size
    }
    
    this.cache.set(key, entry)
    this.stats.totalSize += size
    this.stats.itemCount++
  }

  /**
   * Delete item from cache
   */
  delete(key: string): boolean {
    const entry = this.cache.get(key)
    if (!entry) return false
    
    this.cache.delete(key)
    this.stats.totalSize -= entry.size
    this.stats.itemCount--
    
    return true
  }

  /**
   * Clear all cache
   */
  clear(): void {
    this.cache.clear()
    this.stats.totalSize = 0
    this.stats.itemCount = 0
  }

  /**
   * Get or set with factory function
   */
  async getOrSet(
    key: string,
    factory: () => Promise<T>,
    ttl?: number
  ): Promise<T> {
    const cached = this.get(key)
    if (cached !== null) return cached
    
    const value = await factory()
    this.set(key, value, ttl)
    return value
  }

  /**
   * Get cache statistics
   */
  getStats(): CacheStats {
    return { ...this.stats }
  }

  /**
   * Private: Cleanup expired entries
   */
  private cleanup(): void {
    const now = Date.now()
    let cleanedCount = 0
    
    for (const [key, entry] of this.cache.entries()) {
      if (entry.expiresAt < now) {
        this.delete(key)
        cleanedCount++
      }
    }
    
    if (cleanedCount > 0) {
      console.log(`[Cache] Cleaned up ${cleanedCount} expired entries`)
    }
  }

  /**
   * Private: Evict least recently used item
   */
  private evictLRU(): void {
    let oldestKey: string | null = null
    let oldestAccess = Date.now()
    
    for (const [key, entry] of this.cache.entries()) {
      if (entry.lastAccessed < oldestAccess) {
        oldestAccess = entry.lastAccessed
        oldestKey = key
      }
    }
    
    if (oldestKey) {
      this.delete(oldestKey)
      this.stats.evictions++
    }
  }

  /**
   * Private: Estimate size of value in bytes
   */
  private estimateSize(value: any): number {
    if (value === null || value === undefined) return 0
    
    const type = typeof value
    
    if (type === 'boolean') return 4
    if (type === 'number') return 8
    if (type === 'string') return value.length * 2 // UTF-16
    
    if (type === 'object') {
      if (value instanceof Date) return 8
      if (Array.isArray(value)) {
        return value.reduce((sum, item) => sum + this.estimateSize(item), 24)
      }
      
      // Regular object
      let size = 24 // Object overhead
      for (const key in value) {
        if (value.hasOwnProperty(key)) {
          size += key.length * 2 + this.estimateSize(value[key]) + 8
        }
      }
      return size
    }
    
    return 24 // Default
  }
}

/**
 * Global cache instances
 */
export const caches = {
  // User profile cache (5 minutes TTL)
  userProfiles: new CacheService(10 * 1024 * 1024, 1000, 5 * 60 * 1000),
  
  // Photo data cache (10 minutes TTL)
  photos: new CacheService(20 * 1024 * 1024, 5000, 10 * 60 * 1000),
  
  // Presigned URLs cache (1 hour TTL)
  urls: new CacheService(5 * 1024 * 1024, 2000, 60 * 60 * 1000),
  
  // Query results cache (2 minutes TTL)
  queries: new CacheService(15 * 1024 * 1024, 500, 2 * 60 * 1000),
  
  // Tag cache (30 minutes TTL)
  tags: new CacheService(1 * 1024 * 1024, 100, 30 * 60 * 1000)
}

/**
 * Cache key builders
 */
export const cacheKeys = {
  userProfile: (userId: string | number) => `user:${userId}`,
  userPhotos: (userId: string | number) => `photos:user:${userId}`,
  photo: (photoId: string) => `photo:${photoId}`,
  presignedUrl: (key: string) => `url:${key}`,
  randomPhotos: (userId: string | number) => `random:${userId}`,
  rankings: (page: number = 1) => `rankings:${page}`,
  tags: () => 'tags:all',
  photoTags: (photoId: string) => `tags:photo:${photoId}`
}

/**
 * Clear all caches
 */
export function clearAllCaches(): void {
  Object.values(caches).forEach(cache => cache.clear())
  console.log('[Cache] All caches cleared')
}

/**
 * Get cache statistics summary
 */
export function getCacheStatsSummary() {
  const summary: Record<string, CacheStats> = {}
  
  for (const [name, cache] of Object.entries(caches)) {
    summary[name] = cache.getStats()
  }
  
  return summary
}
