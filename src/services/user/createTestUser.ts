import { upsertUser } from './upsertUser'

export async function createTestUser(email: string, name?: string) {
  return await upsertUser({ email, name: name || 'Test User', provider: 'test', providerId: `test_${Date.now()}` })
}


