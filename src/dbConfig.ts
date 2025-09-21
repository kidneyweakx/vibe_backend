import { PrismaClient } from '@prisma/client'
import { PrismaD1 } from '@prisma/adapter-d1'
import { getEnvVar } from './env'

let prismaInstance: PrismaClient | null = null
let isConnecting = false

const requireEnv = (name: string): string => {
  const value = getEnvVar(name)
  if (!value) {
    throw new Error(
      `Database configuration error: environment variable '${name}' is missing or empty.\n` +
      `- Ensure it is set as a Cloudflare Worker secret: wrangler secret put ${name}\n` +
      `- For local dev, set it in your environment before starting the server.\n`
    )
  }
  return value
}

export const getPrisma = (env?: any): PrismaClient => {
  if (prismaInstance) return prismaInstance
  
  if (isConnecting) {
    throw new Error('Database connection is being established, please wait')
  }
  
  isConnecting = true
  
  try {
    // 開發環境 SQLite 覆蓋
    const databaseUrl = process.env?.DATABASE_URL
    if (databaseUrl && /^(file:|:memory:)/i.test(databaseUrl)) {
      prismaInstance = new PrismaClient({ 
        datasourceUrl: databaseUrl, 
        log: ['error']
      })
      return prismaInstance
    }

    // 從全域環境獲取 env，如果沒有傳遞參數
    const envToUse = env || (globalThis as any).__ENV
    
    if (!envToUse || !envToUse.DB) {
      throw new Error('D1 database binding not found. Make sure env.DB is available.')
    }

    const adapter = new PrismaD1(envToUse.DB)
    
    prismaInstance = new PrismaClient({ 
      adapter, 
      log: ['error']
    })
    
    return prismaInstance
  } finally {
    isConnecting = false
  }
}

export default getPrisma