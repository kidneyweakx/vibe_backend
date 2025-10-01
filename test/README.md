# Test Suite

Clean, elegant tests that don't lie. Real database, real tests, real results.

## Philosophy

- **No mocking** - Tests use real SQLite database
- **No cheating** - Tests actually test the functionality
- **Clean & simple** - Easy to read, easy to understand
- **Fast** - SQLite for speed

## Structure

```
test/
├── helpers/                    # Test utilities
│   ├── db.ts                  # Database helpers
│   └── api.ts                 # API request helpers
├── unit/                      # Service tests
│   ├── user.service.test.ts
│   ├── file.service.test.ts
│   ├── rate.service.test.ts
│   └── tag.service.test.ts
├── e2e/                       # E2E API tests
│   ├── auth.e2e.test.ts
│   ├── user.e2e.test.ts
│   └── photo-rating.e2e.test.ts
├── setup.ts                   # Test initialization
├── load-test-simple.yml       # Local load test config
├── load-test-production.yml   # Production load test config
└── parse-load-report.js       # Report parser
```

## Quick Start

### Unit & E2E Tests

```bash
# Run all tests
bun test

# Run only unit tests
bun test:unit

# Run only e2e tests
bun test:e2e

# Watch mode
bun test:watch
```

### Load Testing

**Local environment:**
```bash
# Start server first
bun run dev

# In another terminal
bun run load-test
```

**Production environment:**
```bash
bun run load-test:prod
```

## Load Test Results

The report shows:
- **Throughput**: Requests/sec
- **Response times**: min/median/p95/p99/max
- **Success rate**: % of successful requests
- **Performance grade**: A+ to D rating

### Example Output
```
📊 PRODUCTION LOAD TEST REPORT
═══════════════════════════════════════════════════════

🎯 OVERALL PERFORMANCE:
   Total Requests:        17,948
   Successful (2xx):      17,948
   Success Rate:          100.00%

⚡ THROUGHPUT:
   Requests/sec (avg):    85.47 req/s

⏱️  RESPONSE TIMES:
   Median (p50):          27ms
   95th percentile:       128ms
   99th percentile:       207ms

✅ Performance Grade:     ✨ GREAT (A)
```

## Writing Tests

### Guidelines

1. **Use real database** - No mocks, no stubs
2. **Clean state** - Each test starts with clean database
3. **Test real behavior** - Not implementation details
4. **Clear assertions** - One concept per test
5. **Descriptive names** - Test name explains what it tests

### Example Test

```typescript
import { describe, test, expect, beforeEach, afterAll } from 'bun:test'
import { cleanDatabase, closeDatabase, createTestUser } from '../helpers/db'
import { UserService } from '../../src/services/user/serviceAdapter'

describe('UserService', () => {
  beforeEach(async () => {
    await cleanDatabase()
  })

  afterAll(async () => {
    await closeDatabase()
  })

  test('creates new user', async () => {
    const user = await UserService.upsertUser({
      email: 'test@example.com',
      provider: 'test',
      providerId: 'test123'
    })

    expect(user.email).toBe('test@example.com')
  })
})
```

## Test Database

- Uses real SQLite: `prisma/test.db`
- Automatically cleaned between tests
- Same schema as production
- Fast enough for unit tests

## Load Tests

For performance testing, see Artillery configs in test root:
- `artillery-config.yml` - Standard load test
- `artillery-stress.yml` - Stress test
- `artillery-spike.yml` - Spike test
- `artillery-endurance.yml` - Endurance test

Run with: `bun load-test`
