import { existsSync, statSync, readFileSync } from 'fs'
import { resolve } from 'path'
import { execSync } from 'child_process'

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
