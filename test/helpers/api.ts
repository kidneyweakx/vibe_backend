import app from '../../src/app'
import { AuthService } from '../../src/services/auth/service'

// Real API testing - no mocking, just clean request/response
export async function apiRequest(
  path: string,
  options: {
    method?: string
    body?: any
    headers?: Record<string, string>
    token?: string // Optional JWT token for authenticated requests
  } = {}
) {
  const method = options.method || 'GET'
  const headers: Record<string, string> = {
    'X-Access-Token': process.env.API_ACCESS_TOKEN || 'test-token',
    ...options.headers
  }

  // Only set Content-Type if there's a body
  if (options.body) {
    headers['Content-Type'] = 'application/json'
  }

  // Add JWT token if provided
  if (options.token) {
    headers['Authorization'] = `Bearer ${options.token}`
  }

  const request = new Request(`http://localhost/api${path}`, {
    method,
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined
  })

  return app.handle(request)
}

/**
 * Generate a JWT token for a test user
 */
export async function generateTestToken(userId: string): Promise<string> {
  return AuthService.generateJWTAsync(userId)
}

export async function apiGet(path: string, options?: { headers?: Record<string, string>; token?: string }) {
  return apiRequest(path, { method: 'GET', ...options })
}

export async function apiPost(
  path: string,
  body: any,
  options?: { headers?: Record<string, string>; token?: string }
) {
  return apiRequest(path, { method: 'POST', body, ...options })
}

export async function apiPut(
  path: string,
  body: any,
  options?: { headers?: Record<string, string>; token?: string }
) {
  return apiRequest(path, { method: 'PUT', body, ...options })
}

export async function apiDelete(
  path: string,
  options?: { headers?: Record<string, string>; token?: string }
) {
  return apiRequest(path, { method: 'DELETE', ...options })
}

export async function expectSuccess(response: Response) {
  if (response.status >= 400) {
    const body = await response.text()
    throw new Error(
      `Expected success but got ${response.status}: ${body}`
    )
  }
  return response.json()
}

export async function expectError(response: Response, status: number) {
  if (response.status !== status) {
    const body = await response.text()
    throw new Error(
      `Expected ${status} but got ${response.status}: ${body}`
    )
  }
  return response.json()
}
