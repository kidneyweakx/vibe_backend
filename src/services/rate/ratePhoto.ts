import getPrisma from '../../dbConfig'

export async function ratePhoto(raterId: string, photoId: string, type: 'like' | 'normal') {
  if (!['like', 'normal'].includes(type)) {
    throw new Error('Type must be "like" or "normal"')
  }
  const photo = await getPrisma().photo.findUnique({ where: { id: photoId }, include: { user: true } })
  if (!photo) throw new Error('Photo not found')
  if (photo.userId === raterId) throw new Error('Cannot rate your own photo')
  if (raterId.startsWith('guest_')) {
    await getPrisma().user.upsert({ where: { id: raterId }, update: {}, create: { id: raterId, email: `${raterId}@guest.local`, name: 'Guest User', provider: 'guest', providerId: raterId } })
  } else {
    const rater = await getPrisma().user.findUnique({ where: { id: raterId } })
    if (!rater) throw new Error('Rater user not found')
  }
  const rating = await getPrisma().rating.upsert({
    where: { raterId_photoId: { raterId, photoId } },
    update: { type },
    create: { raterId, ratedUserId: photo.userId, photoId, type }
  })
  return { success: true, rating: { id: rating.id, type: rating.type, createdAt: rating.createdAt } }
}


