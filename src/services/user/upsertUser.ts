import getPrisma from '../../dbConfig'

export interface CreateUserData {
  email: string
  name?: string
  avatar?: string
  gender?: string
  provider: 'google' | 'apple' | 'password' | 'test' | 'guest'
  providerId: string
  passwordHash?: string
}

export async function upsertUser(data: CreateUserData) {
  const prisma = getPrisma()
  const safeEmail = data.email && data.email.trim().length > 0 ? data.email : `${data.provider}_${data.providerId}@placeholder.local`
  try {
    return await prisma.user.upsert({
      where: { provider_providerId: { provider: data.provider, providerId: data.providerId } },
      update: { email: safeEmail, name: data.name, avatar: data.avatar, gender: data.gender, updatedAt: new Date() },
      create: { ...data, email: safeEmail }
    })
  } catch (error: any) {
    const message: string = typeof error?.message === 'string' ? error.message.toLowerCase() : ''
    const isUniqueEmailConflict = error?.code === 'P2002' || (message.includes('unique constraint') && message.includes('email'))
    if (!isUniqueEmailConflict) throw error
    const existingByEmail = await prisma.user.findUnique({ where: { email: safeEmail } })
    if (!existingByEmail) throw error
    return prisma.user.update({
      where: { id: existingByEmail.id },
      data: {
        provider: data.provider,
        providerId: data.providerId,
        name: data.name ?? existingByEmail.name,
        avatar: data.avatar ?? existingByEmail.avatar,
        gender: data.gender ?? existingByEmail.gender ?? undefined,
        updatedAt: new Date()
      }
    })
  }
}


