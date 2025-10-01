import getPrisma from '../../dbConfig'

export async function ratePhoto(raterId: string, photoId: string, type: 'like' | 'normal') {
  try {
    if (!['like', 'normal'].includes(type)) {
      return { success: false, error: 'Type must be "like" or "normal"' }
    }

    const photo = await getPrisma().photo.findUnique({ where: { id: photoId }, include: { user: true } })
    if (!photo) {
      return { success: false, error: 'Photo not found' }
    }

    if (photo.userId === raterId) {
      return { success: false, error: 'Cannot rate your own photo' }
    }

    // Check if already rated
    const existingRating = await getPrisma().rating.findUnique({
      where: { raterId_photoId: { raterId, photoId } }
    })
    if (existingRating) {
      return { success: false, error: 'You have already rated this photo' }
    }

    if (raterId.startsWith('guest_')) {
      await getPrisma().user.upsert({
        where: { id: raterId },
        update: {},
        create: { id: raterId, email: `${raterId}@guest.local`, name: 'Guest User', provider: 'guest', providerId: raterId }
      })
    } else {
      const rater = await getPrisma().user.findUnique({ where: { id: raterId } })
      if (!rater) {
        return { success: false, error: 'Rater user not found' }
      }
    }

    const rating = await getPrisma().rating.create({
      data: { raterId, ratedUserId: photo.userId, photoId, type }
    })

    return { success: true, rating: { id: rating.id, type: rating.type, createdAt: rating.createdAt } }
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' }
  }
}


