import { PrismaClient } from '@prisma/client'
import { PrismaLibSQL } from '@prisma/adapter-libsql'
import { getEnvVar } from './env'

let prismaInstance: PrismaClient | null = null

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

export const getPrisma = (): PrismaClient => {
  if (prismaInstance) return prismaInstance

  // Test/dev override: if DATABASE_URL is set to a SQLite URL, prefer it.
  const databaseUrl = (typeof process !== 'undefined' ? (process.env as any)?.DATABASE_URL : undefined) as string | undefined
  if (databaseUrl && /^(file:|:memory:)/i.test(databaseUrl)) {
    prismaInstance = new PrismaClient({ datasourceUrl: databaseUrl, log: ['error'] })
    return prismaInstance
  }

  const rawUrl = requireEnv('TURSO_DATABASE_URL')
  const authToken = requireEnv('TURSO_AUTH_TOKEN')

  // Normalize: if no scheme is provided, default to libsql:// as per Turso docs
  // Accept libsql://, https://, file:, :memory:
  const hasScheme = /^(libsql|https?):\/\//i.test(rawUrl) || /^(file:|:memory:)/i.test(rawUrl)
  const url = hasScheme ? rawUrl : `libsql://${rawUrl}`

  // Best-effort diagnostics: print the effective host and scheme (do not expose token)
  try {
    const probe = (url.startsWith('libsql://') ? url.replace(/^libsql:\/\//i, 'https://') : url)
    const u = new URL(probe)
    // eslint-disable-next-line no-console
    console.error('db:client:init', { scheme: u.protocol.replace(':', ''), host: u.host })
  } catch {}

  const adapter = new PrismaLibSQL({ url, authToken })
  prismaInstance = new PrismaClient({ adapter, log: ['error'] })
  return prismaInstance
}

export default getPrisma