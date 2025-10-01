# Security Configuration

## JWT Token Configuration

### iOS App API
- **Token Expiry**: 30 days
- **Implementation**: All non-admin API endpoints use JWT authentication
- **Location**: `src/services/auth/service.ts:42`

Users authenticate via Google OAuth, Apple OAuth, or password, receiving a JWT token valid for 30 days.

## Admin API Security (Hybrid Model)

The admin API implements a **two-tier security model** based on runtime environment:

### Local Development (Full Access)
- **Environment**: Bun runtime (`bun run dev`)
- **Access**: Unrestricted read + write operations
- **Authentication**: No admin key required
- **Use Case**: Local administration, content management, development

### Cloudflare Workers (Read-Only)
- **Environment**: Cloudflare Workers deployment
- **Access**: Read-only operations with `ADMIN_API_KEY`
- **Write Protection**: DELETE/POST operations return 403
- **Use Case**: Remote monitoring, read-only dashboard

### API Endpoints

#### Read-Only (Available on Cloudflare with key)
- `GET /api/admin/photos` - List all photos
- `GET /api/admin/reports` - List reported photos
- `GET /api/admin/reports/all` - Full reports list
- `GET /api/admin/rankings` - User rankings leaderboard

#### Write-Only (Local environment only)
- `DELETE /api/admin/photos/:photoId` - Delete photo
- `DELETE /api/admin/events/:eventId` - Delete event
- `POST /api/admin/events` - Upload event

### Setup Instructions

#### 1. Local Development
```bash
# No additional configuration needed
bun run dev

# Admin API available at http://localhost:8181/api/admin
```

#### 2. Cloudflare Deployment (Read-Only)
```bash
# Set admin key secret
wrangler secret put ADMIN_API_KEY

# For production environment
wrangler secret put ADMIN_API_KEY --env production

# Deploy
bun run deploy
# or
bun run deploy:prod
```

#### 3. Making Admin Requests

**Local (Full Access)**:
```bash
curl http://localhost:8181/api/admin/photos

curl -X DELETE http://localhost:8181/api/admin/photos/photo123
```

**Cloudflare (Read-Only)**:
```bash
# Read operations work with key
curl -H "X-Admin-Key: your_admin_key" \
  https://your-worker.workers.dev/api/admin/photos

# Write operations fail with 403
curl -X DELETE \
  -H "X-Admin-Key: your_admin_key" \
  https://your-worker.workers.dev/api/admin/photos/photo123
# Returns: {"success": false, "error": "Write operations only available in local environment"}
```

## Implementation Details

### Runtime Detection
- **File**: `src/utils/runtime.ts`
- **Detection**: Checks for `globalThis.__ENV` (Cloudflare) or `process.versions.bun` (local)

### Middleware
- **Admin Auth**: `src/middlewares/admin.ts`
  - `adminMiddleware`: Validates environment and admin key
  - `requireWritePermission`: Blocks writes on Cloudflare

### Environment Variables
- `ADMIN_API_KEY`: Admin access key for Cloudflare (set via `wrangler secret`)
- `JWT_SECRET`: JWT signing key (both environments)

## Security Rationale

### Why Hybrid Model?

1. **Local Full Access**
   - Safe: Only accessible from localhost
   - Convenient: No key management for development
   - Complete: Full CRUD operations for content management

2. **Cloudflare Read-Only**
   - Monitoring: View stats and reports remotely
   - Safety: Write operations cannot be performed remotely
   - Key-based: Additional layer with `ADMIN_API_KEY`

### Alternative Approaches Considered

1. **Environment Isolation** - Admin routes only local
   - Pros: Maximum security
   - Cons: No remote monitoring

2. **IP Whitelist + Special Key** - Cloudflare IP filtering
   - Pros: Remote management possible
   - Cons: Requires fixed IP or VPN

3. **Client Certificates (mTLS)** - Certificate-based auth
   - Pros: Strongest security
   - Cons: Requires Cloudflare Enterprise plan

4. **Hybrid Model** ✓ (Implemented)
   - Pros: Balance of security and convenience
   - Cons: No remote writes (acceptable trade-off)

## Best Practices

1. **Generate Strong Admin Key**
   ```bash
   openssl rand -base64 32
   ```

2. **Rotate Keys Regularly**
   ```bash
   wrangler secret put ADMIN_API_KEY --env production
   ```

3. **Monitor Admin Access**
   - Check Cloudflare logs for admin API usage
   - Set up alerts for suspicious patterns

4. **Use HTTPS Only**
   - Cloudflare enforces HTTPS by default
   - Never send `X-Admin-Key` over HTTP

5. **Keep JWT Secret Secure**
   - Never commit to version control
   - Rotate if compromised
   - Use strong random values (32+ bytes)
