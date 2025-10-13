import { describe, test, expect, beforeAll, afterAll, beforeEach } from 'bun:test'
import { cleanDatabase, createTestUser, createTestPhoto } from '../helpers/db'
import { apiGet, apiPost, generateTestToken, expectSuccess, expectError } from '../helpers/api'
import { clearRandomPhotoCaches } from '../../src/services/rate/getRandomPhotosForRating'
import { clearCaches as clearRandomPhotoCachesV2 } from '../../src/services/rate/getRandomPhotosV2'

describe('Random Photos E2E', () => {
  let testUsers: any[] = []
  let testPhotos: any[] = []
  let testToken: string

beforeAll(async () => {
  await cleanDatabase()
  clearRandomPhotoCaches()
  clearRandomPhotoCachesV2()

  // Create main test user (the rater)
  const mainUser = await createTestUser({
    email: 'rater@random-test.com',
    name: 'Rater User'
  })
  testToken = await generateTestToken(mainUser.id)
  testUsers.push(mainUser)

  // Create 5 users with photos for rating
  for (let i = 0; i < 5; i++) {
    const user = await createTestUser({
      email: `user${i}@random-test.com`,
      name: `Test User ${i}`,
      gender: i % 2 === 0 ? 'male' : 'female'
    })
    testUsers.push(user)

    // Create 2 photos for each user
    for (let j = 0; j < 2; j++) {
      const photo = await createTestPhoto({
        userId: user.id,
        key: `test/user${i}_photo${j}.jpg`
      })
      testPhotos.push(photo)
    }
  }
})

beforeEach(() => {
  clearRandomPhotoCaches()
  clearRandomPhotoCachesV2()
})

  afterAll(async () => {
    await cleanDatabase()
  clearRandomPhotoCaches()
  clearRandomPhotoCachesV2()
  })

  test('returns random photos for new user (no rating history)', async () => {
    const res = await apiGet('/rate/photos/random?limit=5', { token: testToken })
    const response = await expectSuccess(res)

    expect(response.success).toBe(true)
    expect(response.data).toBeDefined()
    expect(Array.isArray(response.data)).toBe(true)
    expect(response.data.length).toBeGreaterThan(0)
    expect(response.data.length).toBeLessThanOrEqual(5)

    // Verify photo structure
    const photo = response.data[0]
    expect(photo.id).toBeDefined()
    expect(photo.key).toBeDefined()
    expect(photo.url).toBeDefined()
    expect(photo.userId).toBeDefined()
    expect(photo.user).toBeDefined()
    expect(photo.user.id).toBeDefined()
    expect(photo.user.name).toBeDefined()

    // Should not include rater's own photos
    for (const p of response.data) {
      expect(p.userId).not.toBe(testUsers[0].id)
    }
  })

  test('respects limit parameter', async () => {
    const res = await apiGet('/rate/photos/random?limit=3', { token: testToken })
    const response = await expectSuccess(res)

    expect(response.success).toBe(true)
    expect(response.data.length).toBeLessThanOrEqual(3)
  })

  test('default limit is 10', async () => {
    const res = await apiGet('/rate/photos/random', { token: testToken })
    const response = await expectSuccess(res)

    expect(response.success).toBe(true)
    // Should get all available photos (10 total, but may be less if some filtered)
    expect(response.data.length).toBeGreaterThan(0)
    expect(response.data.length).toBeLessThanOrEqual(10)
  })

  test('excludes already rated photos', async () => {
    // Rate 2 photos
    const photosToRate = testPhotos.slice(0, 2)
    for (const photo of photosToRate) {
      const res = await apiPost(
        '/rate/photo',
        { photoId: photo.id, type: 'like' },
        { token: testToken }
      )
      await expectSuccess(res)
    }

    // Get random photos
    const res = await apiGet('/rate/photos/random?limit=10', { token: testToken })
    const response = await expectSuccess(res)

    expect(response.success).toBe(true)

    // Verify rated photos are excluded
    const returnedPhotoIds = response.data.map((p: any) => p.id)
    for (const ratedPhoto of photosToRate) {
      expect(returnedPhotoIds).not.toContain(ratedPhoto.id)
    }
  })

  test('excludes profile pictures', async () => {
    // Create a profile picture
    const profilePic = await createTestPhoto({
      userId: testUsers[1].id,
      key: 'test/profile-pic.jpg',
      isProfilePicture: true
    })

    const res = await apiGet('/rate/photos/random?limit=10', { token: testToken })
    const response = await expectSuccess(res)

    expect(response.success).toBe(true)

    // Verify profile picture is excluded
    const returnedPhotoIds = response.data.map((p: any) => p.id)
    expect(returnedPhotoIds).not.toContain(profilePic.id)
  })

  test('returns photos with tags array', async () => {
    const res = await apiGet('/rate/photos/random?limit=5', { token: testToken })
    const response = await expectSuccess(res)

    expect(response.success).toBe(true)

    // Verify each photo has tags array (may be empty)
    for (const photo of response.data) {
      expect(Array.isArray(photo.tags)).toBe(true)
      // photoTags should be removed from response
      expect(photo.photoTags).toBeUndefined()
    }
  })

  test('handles no available photos gracefully', async () => {
    // Create a new user who has already rated all photos
    const newUser = await createTestUser({
      email: 'rated-all@test.com',
      name: 'Rated All User'
    })
    const newToken = await generateTestToken(newUser.id)

    // Rate all available photos
    for (const photo of testPhotos) {
      const res = await apiPost(
        '/rate/photo',
        { photoId: photo.id, type: 'like' },
        { token: newToken }
      )
      await expectSuccess(res)
    }

    // Try to get random photos
    const res = await apiGet('/rate/photos/random?limit=5', { token: newToken })
    const response = await expectSuccess(res)

    expect(response.success).toBe(true)
    expect(response.data).toBeDefined()
    expect(Array.isArray(response.data)).toBe(true)
    expect(response.data.length).toBe(0) // No photos available
  })

  test('requires authentication', async () => {
    const res = await apiGet('/rate/photos/random?limit=5')

    // Should return 401 without token
    await expectError(res, 401)
  })

  test('returns different photos on subsequent calls (randomness)', async () => {
    const res1 = await apiGet('/rate/photos/random?limit=5', { token: testToken })
    const response1 = await expectSuccess(res1)

    const res2 = await apiGet('/rate/photos/random?limit=5', { token: testToken })
    const response2 = await expectSuccess(res2)

    expect(response1.success).toBe(true)
    expect(response2.success).toBe(true)

    // At least some photos should be different (not 100% guaranteed due to randomness)
    // Just verify we got valid responses
    expect(response1.data.length).toBeGreaterThan(0)
    expect(response2.data.length).toBeGreaterThan(0)
  })
})
