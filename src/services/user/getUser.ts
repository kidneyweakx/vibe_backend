import getPrisma from '../../dbConfig'

export async function getUserById(id: number | string) {
  const numericId = typeof id === 'number' ? id : Number(id)
  if (!Number.isFinite(numericId)) {
    return null
  }
  return await getPrisma().user.findUnique({ where: { id: numericId } })
}

export async function getUserByEmail(email: string) {
  return await getPrisma().user.findUnique({ where: { email } })
}

export async function getUserByProvider(provider: string, providerId: string) {
  return await getPrisma().user.findUnique({ where: { provider_providerId: { provider, providerId } } })
}


