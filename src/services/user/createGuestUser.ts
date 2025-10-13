import { createHash } from 'crypto'
import getPrisma from '../../dbConfig'

export async function createGuestUser(deviceId: string) {
  const prisma = getPrisma()

  const normalizedDeviceId = deviceId.trim()
  if (!normalizedDeviceId) {
    throw new Error('Device identifier is required for guest users')
  }

  // Generate a deterministic guest email using a hash of the device ID to reduce collision risk
  const guestEmailSuffix = createHash('sha256')
    .update(normalizedDeviceId)
    .digest('hex')
    .slice(0, 16)
  const guestEmail = `guest_${guestEmailSuffix}@guest.local`

  const user = await prisma.user.create({
    data: {
      email: guestEmail,
      name: 'Guest User',
      provider: 'guest',
      providerId: normalizedDeviceId,
      deviceId: normalizedDeviceId,
      isGuest: true
    }
  })

  return user
}
