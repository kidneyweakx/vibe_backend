import { describe, test, expect, beforeEach, afterAll } from 'bun:test'
import { cleanDatabase, closeDatabase } from '../helpers/db'
import { uploadEventImage } from '../../src/services/event/uploadEventImage'
import { deleteEvent } from '../../src/services/event/deleteEvent'
import { listEvents } from '../../src/services/event/listEvents'
import getPrisma from '../../src/dbConfig'

describe('Event Service', () => {
  beforeEach(async () => {
    await cleanDatabase()
  })

  afterAll(async () => {
    await closeDatabase()
  })

  describe('uploadEventImage', () => {
    test('uploads event image to R2 and creates database record', async () => {
      // Small test base64 image (1x1 pixel PNG)
      const base64Image = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=='

      const result = await uploadEventImage({
        title: 'Test Event',
        description: 'Test event description',
        imageBase64: base64Image,
        startsAt: new Date('2025-01-01'),
        endsAt: new Date('2025-12-31')
      })

      expect(result.id).toBeDefined()
      expect(result.title).toBe('Test Event')
      expect(result.description).toBe('Test event description')
      expect(result.imageUrl).toBeDefined()
      expect(result.format).toBe('webp') // Always converts to webp

      // Verify event was created in database
      const event = await getPrisma().event.findUnique({
        where: { id: result.id }
      })
      expect(event).toBeDefined()
      expect(event!.title).toBe('Test Event')
    })

    test('creates event without end date', async () => {
      const base64Image = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=='

      const result = await uploadEventImage({
        title: 'No End Date Event',
        imageBase64: base64Image,
        startsAt: new Date('2025-01-01')
      })

      expect(result.id).toBeDefined()
      expect(result.endsAt).toBeNull()
    })

    test('creates event with optional description', async () => {
      const base64Image = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=='

      const result = await uploadEventImage({
        title: 'No Description Event',
        imageBase64: base64Image,
        startsAt: new Date('2025-01-01')
      })

      expect(result.id).toBeDefined()
      expect(result.title).toBe('No Description Event')
      expect(result.description).toBeNull()
    })
  })

  describe('deleteEvent', () => {
    test('deletes event from database and R2', async () => {
      // First create an event
      const base64Image = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=='
      const event = await uploadEventImage({
        title: 'Delete Test Event',
        description: 'Will be deleted',
        imageBase64: base64Image,
        startsAt: new Date('2025-01-01')
      })

      // Delete the event
      const result = await deleteEvent(event.id)

      expect(result.success).toBe(true)

      // Verify event is deleted from database
      const deletedEvent = await getPrisma().event.findUnique({
        where: { id: event.id }
      })
      expect(deletedEvent).toBeNull()
    })

    test('returns error when deleting non-existent event', async () => {
      const result = await deleteEvent('non-existent-id')

      expect(result.success).toBe(false)
      expect(result.error).toBe('Event not found')
    })
  })

  describe('listEvents', () => {
    test('lists all events', async () => {
      const base64Image = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=='

      // Create multiple events
      await uploadEventImage({
        title: 'Event 1',
        description: 'First event',
        imageBase64: base64Image,
        startsAt: new Date('2025-01-01')
      })
      await uploadEventImage({
        title: 'Event 2',
        description: 'Second event',
        imageBase64: base64Image,
        startsAt: new Date('2025-02-01')
      })
      await uploadEventImage({
        title: 'Event 3',
        description: 'Third event',
        imageBase64: base64Image,
        startsAt: new Date('2025-03-01')
      })

      const events = await listEvents()

      expect(events.length).toBe(3)
      expect(events[0].title).toBeDefined()
      expect(events[0].imageUrl).toBeDefined()
    })

    test('returns empty array when no events exist', async () => {
      const events = await listEvents()

      expect(events).toEqual([])
    })

    test('orders events by creation date descending', async () => {
      const base64Image = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=='

      const event1 = await uploadEventImage({
        title: 'First',
        description: 'First created',
        imageBase64: base64Image,
        startsAt: new Date('2025-01-01')
      })
      await new Promise(resolve => setTimeout(resolve, 10)) // Small delay
      const event2 = await uploadEventImage({
        title: 'Second',
        description: 'Second created',
        imageBase64: base64Image,
        startsAt: new Date('2025-02-01')
      })

      const events = await listEvents()

      expect(events[0].id).toBe(event2.id) // Most recent first
      expect(events[1].id).toBe(event1.id)
    })
  })
})
