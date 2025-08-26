import { getUserById } from './getUser'

export async function generateShareableLink(userId: string) {
  const user = await getUserById(userId)
  if (!user) throw new Error('User not found')
  return {
    userId: user.id,
    userName: user.name,
    userAvatar: user.avatar,
    shareUrl: `${process.env.FRONTEND_URL || 'https://vibe.app'}/user/${userId}`,
    apiUrl: `${process.env.API_URL || 'http://localhost:8181'}/user/info/${userId}`,
    qrCodeUrl: `${process.env.API_URL || 'http://localhost:8181'}/user/qr/${userId}`,
    createdAt: new Date().toISOString()
  }
}


