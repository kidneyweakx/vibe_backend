import { beforeAll, afterAll } from 'bun:test'
import { execSync } from 'child_process'
import { resolve } from 'path'
import { existsSync, rmSync } from 'fs'

const DEFAULT_TEST_DB_URL = 'file:./prisma/test.db'

process.env.DATABASE_URL = DEFAULT_TEST_DB_URL

try {
  const testDbPath = resolve(process.cwd(), 'prisma', 'test.db')
  if (existsSync(testDbPath)) {
    rmSync(testDbPath)
  }

  execSync('bunx prisma migrate reset --force --skip-generate', {
    env: {
      ...process.env,
      DATABASE_URL: process.env.DATABASE_URL || DEFAULT_TEST_DB_URL
    },
    stdio: 'inherit'
  })
} catch (error) {
  console.error('Failed to run Prisma migrations for test database')
  throw error
}

// Store original console methods
const originalConsoleError = console.error
const originalConsoleWarn = console.warn

// Suppress console.error and console.warn during tests
beforeAll(() => {
  console.error = () => {}
  console.warn = () => {}
})

// Restore console methods after tests
afterAll(() => {
  console.error = originalConsoleError
  console.warn = originalConsoleWarn
})

// Export for use in test files if needed
export const suppressConsole = () => {
  console.error = () => {}
  console.warn = () => {}
}

export const restoreConsole = () => {
  console.error = originalConsoleError
  console.warn = originalConsoleWarn
}
