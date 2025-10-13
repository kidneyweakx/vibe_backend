import { PrismaClient } from '@prisma/client'
import { PrismaD1 } from '@prisma/adapter-d1'
import { PrismaLibSQL } from '@prisma/adapter-libsql'
import { createClient } from '@libsql/client'
import { getEnvVar } from './env'

let prismaInstance: PrismaClient | null = null
let isConnecting = false

// Performance monitoring
const queryMetrics = {
  totalQueries: 0,
  slowQueries: 0,
  errors: 0,
  lastReset: Date.now()
}

// Reset metrics every hour
setInterval(() => {
  if (queryMetrics.totalQueries > 0) {
    console.log('[DB Metrics]', {
      ...queryMetrics,
      avgSlowRate: (queryMetrics.slowQueries / queryMetrics.totalQueries).toFixed(3)
    })
  }
  queryMetrics.totalQueries = 0
  queryMetrics.slowQueries = 0
  queryMetrics.errors = 0
  queryMetrics.lastReset = Date.now()
}, 60 * 60 * 1000)

/**
 * Enhanced Prisma client with performance optimizations
 */
export const getPrismaV2 = (env?: any): PrismaClient => {
  if (prismaInstance) return prismaInstance

  if (isConnecting) {
    throw new Error('Database connection is being established, please wait')
  }

  isConnecting = true

  try {
    // 1. Development SQLite override
    const databaseUrl = process.env?.DATABASE_URL
    if (databaseUrl && /^(file:|:memory:)/i.test(databaseUrl)) {
      prismaInstance = createOptimizedClient({
        datasourceUrl: databaseUrl
      })
      return prismaInstance
    }

    // 2. Turso/libSQL connection
    const tursoUrl = process.env?.TURSO_DATABASE_URL || getEnvVar('TURSO_DATABASE_URL')
    const tursoToken = process.env?.TURSO_AUTH_TOKEN || getEnvVar('TURSO_AUTH_TOKEN')

    if (tursoUrl && tursoToken) {
      const libsql = createClient({
        url: tursoUrl,
        authToken: tursoToken,
        // Connection pool settings
        intMode: 'number'
      })
      
      const adapter = new PrismaLibSQL(libsql)
      prismaInstance = createOptimizedClient({ adapter })
      return prismaInstance
    }

    // 3. D1 binding (Cloudflare Workers)
    const envToUse = env || (globalThis as any).__ENV

    if (!envToUse?.DB) {
      throw new Error(
        'No database connection available.\n' +
        '- For Workers: ensure env.DB is bound\n' +
        '- For scripts: set TURSO_DATABASE_URL and TURSO_AUTH_TOKEN\n' +
        '- For local dev: use DATABASE_URL=file:./dev.db'
      )
    }

    const adapter = new PrismaD1(envToUse.DB)
    prismaInstance = createOptimizedClient({ adapter })
    return prismaInstance
  } finally {
    isConnecting = false
  }
}

/**
 * Create Prisma client with optimizations and middleware
 */
function createOptimizedClient(options: any): PrismaClient {
  const client = new PrismaClient({
    ...options,
    log: process.env.NODE_ENV === 'development' 
      ? ['query', 'warn', 'error'] 
      : ['error'],
    errorFormat: 'minimal'
  })

  // Add query performance middleware
  client.$use(async (params, next) => {
    const startTime = Date.now()
    
    try {
      const result = await next(params)
      const duration = Date.now() - startTime
      
      queryMetrics.totalQueries++
      
      // Log slow queries (> 100ms)
      if (duration > 100) {
        queryMetrics.slowQueries++
        console.warn(`[Slow Query] ${params.model}.${params.action} took ${duration}ms`)
      }
      
      return result
    } catch (error) {
      queryMetrics.errors++
      throw error
    }
  })

  return client
}

/**
 * Optimized query helpers
 */
export const queryHelpers = {
  /**
   * Batch fetch with automatic chunking
   */
  async batchFetch<T>(
    ids: string[] | number[],
    fetcher: (chunk: typeof ids) => Promise<T[]>,
    chunkSize: number = 100
  ): Promise<T[]> {
    const results: T[] = []
    
    for (let i = 0; i < ids.length; i += chunkSize) {
      const chunk = ids.slice(i, i + chunkSize)
      const chunkResults = await fetcher(chunk)
      results.push(...chunkResults)
    }
    
    return results
  },

  /**
   * Retry query with exponential backoff
   */
  async retryQuery<T>(
    query: () => Promise<T>,
    maxRetries: number = 3,
    baseDelay: number = 100
  ): Promise<T> {
    let lastError: any
    
    for (let i = 0; i < maxRetries; i++) {
      try {
        return await query()
      } catch (error) {
        lastError = error
        
        if (i < maxRetries - 1) {
          const delay = baseDelay * Math.pow(2, i)
          await new Promise(resolve => setTimeout(resolve, delay))
        }
      }
    }
    
    throw lastError
  },

  /**
   * Execute query with timeout
   */
  async withTimeout<T>(
    query: Promise<T>,
    timeoutMs: number = 5000,
    timeoutError?: string
  ): Promise<T> {
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(
        () => reject(new Error(timeoutError || `Query timeout after ${timeoutMs}ms`)),
        timeoutMs
      )
    })
    
    return Promise.race([query, timeoutPromise])
  }
}

/**
 * Connection health check
 */
export async function checkDatabaseHealth(): Promise<{
  healthy: boolean
  latency: number
  error?: string
}> {
  const startTime = Date.now()
  
  try {
    const prisma = getPrismaV2()
    await prisma.$queryRaw`SELECT 1`
    
    return {
      healthy: true,
      latency: Date.now() - startTime
    }
  } catch (error) {
    return {
      healthy: false,
      latency: Date.now() - startTime,
      error: error instanceof Error ? error.message : 'Unknown error'
    }
  }
}

// Export singleton getter
export default getPrismaV2
