import app from '../../src/app'

// Real API testing - no mocking, just clean request/response
export async function apiRequest(
  path: string,
  options: {
    method?: string
    body?: any
    headers?: Record<string, string>
  } = {}
) {
  const method = options.method || 'GET'
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'X-Access-Token': process.env.API_ACCESS_TOKEN || 'test-token',
    ...options.headers
  }

  const request = new Request(`http://localhost/api${path}`, {
    method,
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined
  })

  return app.handle(request)
}

export async function apiGet(path: string, headers?: Record<string, string>) {
  return apiRequest(path, { method: 'GET', headers })
}

export async function apiPost(
  path: string,
  body: any,
  headers?: Record<string, string>
) {
  return apiRequest(path, { method: 'POST', body, headers })
}

export async function apiPut(
  path: string,
  body: any,
  headers?: Record<string, string>
) {
  return apiRequest(path, { method: 'PUT', body, headers })
}

export async function apiDelete(
  path: string,
  headers?: Record<string, string>
) {
  return apiRequest(path, { method: 'DELETE', headers })
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
