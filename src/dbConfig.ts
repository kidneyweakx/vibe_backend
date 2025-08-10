import { PrismaClient } from '@prisma/client'
import { PrismaLibSQL } from "@prisma/adapter-libsql"
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

  const url = requireEnv('TURSO_DATABASE_URL')
  const authToken = requireEnv('TURSO_AUTH_TOKEN')

  const adapter = new PrismaLibSQL({ url, authToken })
  prismaInstance = new PrismaClient({ adapter })
  return prismaInstance
}

export default getPrisma