import getPrisma from '../../dbConfig'

export async function getUserByDeviceId(deviceId: string) {
  const prisma = getPrisma()

  return prisma.user.findFirst({
    where: {
      deviceId,
      isDeleted: false
    }
  })
}
