import getPrisma from '../../dbConfig'

export async function createReport(params: { photoId: string; reporterId?: string; reason: string }) {
  const prisma = getPrisma()
  const { photoId, reporterId, reason } = params
  const photo = await prisma.photo.findUnique({ where: { id: photoId } })
  if (!photo) throw new Error('Photo not found')
  return await prisma.report.create({ data: { photoId, reporterId, reason } })
}

export async function listReportsByPhoto(photoId: string) {
  const prisma = getPrisma()
  const reports = await prisma.report.findMany({ where: { photoId }, orderBy: { createdAt: 'desc' } })
  const count = await prisma.report.count({ where: { photoId } })
  return { reports, count }
}

export async function aggregateReportedPhotos(minReports: number = 2, page: number = 1, limit: number = 20) {
  const prisma = getPrisma()
  const skip = (page - 1) * limit
  const aggregated = await prisma.$queryRaw<Array<{ photoId: string; reportCount: number }>>`
    SELECT photoId, COUNT(*) as reportCount
    FROM reports
    GROUP BY photoId
    HAVING COUNT(*) >= ${minReports}
    ORDER BY reportCount DESC
    LIMIT ${limit} OFFSET ${skip}
  `
  const photoIds = aggregated.map((a) => a.photoId)
  const photos = await prisma.photo.findMany({ where: { id: { in: photoIds } } })
  return aggregated.map((a) => ({
    photo: photos.find((p) => p.id === a.photoId)!,
    reportCount: Number(a.reportCount)
  }))
}


