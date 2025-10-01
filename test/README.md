# Test Suite

Clean, elegant tests that don't lie. Real database, real tests, real results.

## Philosophy

- **No mocking** - Tests use real SQLite database
- **No cheating** - Tests actually test the functionality
- **Clean & simple** - Easy to read, easy to understand
- **Fast** - In-memory SQLite for speed

## Structure

```
test/
├── helpers/          # Test utilities
│   ├── db.ts        # Database helpers (no mocking)
│   └── api.ts       # API request helpers
├── unit/            # Service layer tests
│   ├── user.service.test.ts
│   ├── file.service.test.ts
│   ├── rate.service.test.ts
│   └── tag.service.test.ts
└── e2e/             # End-to-end API tests
    ├── auth.e2e.test.ts
    ├── user.e2e.test.ts
    └── photo-rating.e2e.test.ts
```

## Running Tests

```bash
# Run all tests
bun test

# Run only unit tests
bun test:unit

# Run only e2e tests
bun test:e2e

# Watch mode
bun test:watch

# With coverage
bun test:coverage
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
