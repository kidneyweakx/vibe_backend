# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a photo rating backend service built with Elysia (Bun runtime), deployable to Cloudflare Workers. Users upload photos, rate others' photos (like/normal), and view rankings. The service supports authentication (Google OAuth, Apple, password), event management, tagging, and reporting.

## Common Commands

### Development
```bash
bun run dev                    # Local development with hot reload (port 8181)
bun run wrangler:dev          # Cloudflare Workers local development
```

### Testing
```bash
bun test                       # Run all tests
bun test --watch              # Watch mode
bun test --coverage           # With coverage
bun run load-test             # Artillery load tests
bun run load-test:stress      # Stress tests
bun run load-test:spike       # Spike tests
bun run load-test:endurance   # Endurance tests
```

### Deployment
```bash
bun run deploy                # Deploy to staging (wrangler)
bun run deploy:prod           # Deploy to production
wrangler tail                 # Stream logs from deployed worker
```

### Database & Scripts
```bash
bun run init-tags             # Initialize tag system (Chinese)
bun run init-tags:en          # Initialize tag system (English)
bun run cleanup:r2dev         # Clean up R2 development storage
bun run test:seed             # Seed fake test data
```

## Architecture

### Database Configuration (dbConfig.ts)
- **Development**: Uses local SQLite when `DATABASE_URL` is set to `file:` or `:memory:`
- **Production**: Uses Cloudflare D1 via PrismaD1 adapter (env.DB binding)
- **Turso fallback**: Configured for libsql connection via `TURSO_DATABASE_URL` and `TURSO_AUTH_TOKEN`
- Singleton pattern with connection guard (`isConnecting` flag)

### Dual Runtime Support
- **Local development**: `src/server.ts` - Bun native server on port 8181 with Swagger docs
- **Cloudflare Workers**: `src/index.ts` - exports fetch handler, binds runtime env via `bindRuntimeEnv()`

### Environment Variables
- Uses custom env system (`src/env.ts`) that works across Bun and Cloudflare Workers
- `bindRuntimeEnv()` stores env in `globalThis.__ENV` for Workers runtime
- `getEnvVar()` checks both `globalThis.__ENV` and `process.env`

### Route Organization
All routes mounted under `/api` prefix in `src/app.ts`. **The backend has been streamlined to only include endpoints actively used by the iOS client (32 endpoints total).**

#### Client-facing Routes:
- **auth** (6 endpoints): Google OAuth, Apple OAuth, password auth, profile creation, signout
- **user** (7 endpoints): Profile get/update, user info, shareable links, QR codes, profile picture, account deletion
- **file** (6 endpoints): Presigned URLs, photo upload/complete, get user photos, photo deletion, reporting
- **rate** (2 endpoints): Rate photos, get random unrated photos
- **tag** (5 endpoints): Get all tags, create tags, photo tagging (get/add), search photos by tags
- **event** (1 endpoint): List active events
- **info** (3 endpoints): Home info, profile info, journey dashboard
- **onboarding** (1 endpoint): Complete onboarding

#### Admin-only Routes (separate module):
- **admin** (prefix: `/api/admin`):
  - Photos: List all photos, delete photos
  - Reports: List reported photos, list all reports
  - Rankings: Get user rankings leaderboard
  - Events: Upload events, delete events

### Middleware Chain
1. **CORS**: Dynamic origin handling for dev/admin portals with credentials support
2. **accessTokenMiddleware**: Requires `X-Access-Token` header or Bearer token matching `API_ACCESS_TOKEN`
3. **authMiddleware**: Optional JWT auth, extracts user from Bearer token
4. **requireAuth**: Enforces authentication, returns 401 if no valid user

### Service Layer Pattern
Services in `src/services/` contain business logic, separated from route handlers. Key services:
- **auth**: Token generation/verification, user lookup from JWT
- **file**: Upload orchestration, R2 presigned URLs, photo CRUD, reporting
- **rate**: Photo rating logic, score calculation, random photo selection with deduplication
- **tag**: Tag management, photo-tag relationships
- **user**: User CRUD, shareable links, profile pictures
- **event**: Event image management
- **r2**: S3-compatible presigned URL generation for Cloudflare R2

### Photo Rating System
- Two rating types: "like" (❤️) and "normal" (🔄)
- `getRandomPhotosForRating()` implements smart photo selection:
  - Excludes rater's own photos
  - Excludes already-rated photos
  - Excludes guest users and profile pictures
  - Filters photos with ≥2 reports
  - Request deduplication via `requestQueue` Map
  - 10-second database timeout protection
  - Returns 1 photo per user (distinct userId)
  - Generates presigned URLs for selected photos

### Storage Architecture
- **R2 Storage**: Cloudflare R2 for photo storage (S3-compatible)
- **Photo keys**: Generated via `generatePhotoKey()` - `{userId}/{timestamp}-{random}.{ext}`
- **Profile pictures**: Stored under `profile-pictures/` prefix
- **Presigned URLs**: 7-day expiration for reads, short-lived for uploads
- AWS SDK S3 client configured for R2 endpoints

### Authentication Flow
1. OAuth (Google/Apple) or password registration
2. JWT token generation (via `jose` library)
3. Token stored client-side, sent as Bearer token
4. `authMiddleware` validates and decodes JWT
5. User object attached to request context

### Concurrency & Performance
- Global request concurrency limit: 5 concurrent requests per user (`activeRequests` Map in app.ts)
- Request queue deduplication in photo selection service
- Timeout protections on database queries (10s)
- Enhanced logging with timestamps and context throughout

### Testing Infrastructure
- Unit tests in `test/unit/` for services and routes
- Integration tests in `test/integration/`
- E2E tests in `test/e2e/`
- Load testing via Artillery with multiple test profiles (load, stress, spike, endurance)
- Test runner: `test/run-tests.ts` orchestrates Artillery tests
- Quick smoke test: `test/quick-test.ts`
- Monitoring script: `test/monitor.ts`

### Database Schema Notes
- All models use `cuid()` for IDs
- Cascade deletes configured (user deletion removes photos, ratings, reports)
- Unique constraints:
  - One rating per user per photo (`raterId`, `photoId`)
  - One tag per photo (`photoId`, `tagId`)
  - Provider uniqueness (`provider`, `providerId`)
- Photo tags use join table (`PhotoTag`) for many-to-many

## Development Workflow

When adding new features:
1. Define route in appropriate `src/routes/{module}/` directory
2. Implement business logic in `src/services/{module}/`
3. Add service to module's `index.ts` exports
4. Register route in module's route index (`src/routes/{module}/index.ts`)
5. Use `requireAuth` middleware for protected endpoints
6. Add appropriate logging with timestamps and context
7. Handle errors with descriptive messages

## Key Files
- `src/app.ts`: Main Elysia app with route registration and middleware
- `src/dbConfig.ts`: Prisma client initialization with D1/Turso/SQLite support
- `src/env.ts`: Cross-runtime environment variable handling
- `prisma/schema.prisma`: Database schema
- `wrangler.toml`: Cloudflare Workers configuration with D1 and R2 bindings
