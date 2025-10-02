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
      const eventName = 'Test Event'
      const description = 'Test event description'

      const result = await uploadEventImage(base64Image, eventName, description)

      expect(result.id).toBeDefined()
      expect(result.name).toBe(eventName)
      expect(result.description).toBe(description)
      expect(result.imageUrl).toBeDefined()
      expect(result.imageUrl).toContain('.png')

      // Verify event was created in database
      const event = await getPrisma().event.findUnique({
        where: { id: result.id }
      })
      expect(event).toBeDefined()
      expect(event!.name).toBe(eventName)
    })

    test('handles different image formats', async () => {
      const base64Image = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=='

      const result = await uploadEventImage(base64Image, 'JPEG Event', 'Test', 'jpg')

      expect(result.imageUrl).toContain('.jpg')
    })

    test('creates event with optional description', async () => {
      const base64Image = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=='

      const result = await uploadEventImage(base64Image, 'No Description Event')

      expect(result.id).toBeDefined()
      expect(result.name).toBe('No Description Event')
      expect(result.description).toBeNull()
    })
  })

  describe('deleteEvent', () => {
    test('deletes event from database and R2', async () => {
      // First create an event
      const base64Image = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=='
      const event = await uploadEventImage(base64Image, 'Delete Test Event', 'Will be deleted')

      // Delete the event
      const result = await deleteEvent(event.id)

      expect(result.success).toBe(true)

      // Verify event is deleted from database
      const deletedEvent = await getPrisma().event.findUnique({
        where: { id: event.id }
      })
      expect(deletedEvent).toBeNull()
    })

    test('throws error when deleting non-existent event', async () => {
      await expect(deleteEvent('non-existent-id')).rejects.toThrow()
    })
  })

  describe('listEvents', () => {
    test('lists all events', async () => {
      const base64Image = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=='

      // Create multiple events
      await uploadEventImage(base64Image, 'Event 1', 'First event')
      await uploadEventImage(base64Image, 'Event 2', 'Second event')
      await uploadEventImage(base64Image, 'Event 3', 'Third event')

      const events = await listEvents()

      expect(events.length).toBe(3)
      expect(events[0].name).toBeDefined()
      expect(events[0].imageUrl).toBeDefined()
    })

    test('returns empty array when no events exist', async () => {
      const events = await listEvents()

      expect(events).toEqual([])
    })

    test('orders events by creation date descending', async () => {
      const base64Image = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=='

      const event1 = await uploadEventImage(base64Image, 'First', 'First created')
      await new Promise(resolve => setTimeout(resolve, 10)) // Small delay
      const event2 = await uploadEventImage(base64Image, 'Second', 'Second created')

      const events = await listEvents()

      expect(events[0].id).toBe(event2.id) // Most recent first
      expect(events[1].id).toBe(event1.id)
    })
  })
})
