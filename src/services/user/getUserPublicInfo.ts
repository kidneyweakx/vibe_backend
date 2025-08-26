import getPrisma from '../../dbConfig'

export async function getUserPublicInfo(userId: string) {
  const user = await getPrisma().user.findUnique({
    where: { id: userId },
    select: { id: true, name: true, avatar: true, gender: true, createdAt: true }
  })
  if (!user) throw new Error('User not found')
  const photoCount = await getPrisma().photo.count({ where: { userId } })
  const likeCount = await getPrisma().rating.count({ where: { ratedUserId: userId, type: 'like' } })
  const normalCount = await getPrisma().rating.count({ where: { ratedUserId: userId, type: 'normal' } })
  const totalRatings = likeCount + normalCount
  const totalScore = totalRatings > 0 ? Math.round(((likeCount * 1 + normalCount * 0.2) / totalRatings) * 100) : 0
  const recentPhotos = await getPrisma().photo.findMany({
    where: { userId },
    select: { id: true, url: true, uploadedAt: true },
    orderBy: { uploadedAt: 'desc' },
    take: 6
  })
  return {
    user: { id: user.id, name: user.name, avatar: user.avatar, gender: user.gender, memberSince: user.createdAt },
    stats: { totalScore, likeCount, normalCount, totalRatings, photoCount },
    recentPhotos,
    shareInfo: {
      shareUrl: `${process.env.FRONTEND_URL || 'https://vibe.app'}/user/${userId}`,
      shareText: `查看 ${user.name} 在 Vibe 的個人資料！總分: ${totalScore}/100 ⭐`,
      qrCodeUrl: `${process.env.API_URL || 'http://localhost:8181'}/user/qr/${userId}`
    }
  }
}


