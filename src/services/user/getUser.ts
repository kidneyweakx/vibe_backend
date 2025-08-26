import getPrisma from '../../dbConfig'

export async function getUserById(id: string) {
  return await getPrisma().user.findUnique({ where: { id } })
}

export async function getUserByEmail(email: string) {
  return await getPrisma().user.findUnique({ where: { email } })
}

export async function getUserByProvider(provider: string, providerId: string) {
  return await getPrisma().user.findUnique({ where: { provider_providerId: { provider, providerId } } })
}


