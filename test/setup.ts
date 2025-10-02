import { existsSync, statSync, readFileSync } from 'fs'
import { resolve } from 'path'
import { execSync } from 'child_process'

// Suppress verbose console logs during tests (keep errors and critical messages)
const originalLog = console.log
const originalInfo = console.info

console.log = (...args: any[]) => {
  // Only show logs that start with ✅, 📦, or ❌
  const firstArg = args[0]?.toString() || ''
  if (firstArg.startsWith('✅') || firstArg.startsWith('📦') || firstArg.startsWith('❌')) {
    originalLog(...args)
  }
}
console.info = () => {} // Suppress info logs

// Keep console.error and console.warn for actual issues

// Load .env.test file for testing environment
const envTestPath = resolve(process.cwd(), '.env.test')
if (existsSync(envTestPath)) {
  const envContent = readFileSync(envTestPath, 'utf-8')
  envContent.split('\n').forEach(line => {
    const trimmed = line.trim()
    if (trimmed && !trimmed.startsWith('#')) {
      const [key, ...valueParts] = trimmed.split('=')
      if (key && valueParts.length > 0) {
        const value = valueParts.join('=')
        process.env[key.trim()] = value.trim()
      }
    }
  })
  console.log('✅ Loaded .env.test configuration')
}

const TEST_DB_PATH = resolve(process.cwd(), 'prisma', 'test.db')

// Initialize test database schema before running tests
async function setupTestDatabase() {
  const dbExists = existsSync(TEST_DB_PATH)
  const needsInit = !dbExists || statSync(TEST_DB_PATH).size === 0

  if (needsInit) {
    console.log('📦 Initializing test database schema...')
    try {
      execSync('bunx prisma db push --skip-generate --accept-data-loss', {
        stdio: 'inherit',
        env: {
          ...process.env,
          DATABASE_URL: 'file:test.db'
        }
      })
      console.log('✅ Test database initialized')
    } catch (error) {
      console.error('❌ Failed to initialize test database:', error)
      process.exit(1)
    }
  }
}

// Run setup
await setupTestDatabase()
