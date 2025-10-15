import getPrisma from '../../dbConfig'

export async function createReport(params: {
  photoId: string
  reporterId?: number | string
  reason: string
  details?: string
}) {
  const prisma = getPrisma()
  const { photoId, reporterId, reason, details } = params

  const photo = await prisma.photo.findUnique({ where: { id: photoId } })
  if (!photo) throw new Error('Photo not found')

  let resolvedReporterId: string | undefined

  if (reporterId !== undefined) {
    if (typeof reporterId === 'number') {
      resolvedReporterId = String(reporterId)
    } else if (typeof reporterId === 'string') {
      const trimmed = reporterId.trim()
      if (!trimmed) {
        throw new Error('Invalid reporter identifier')
      }
      resolvedReporterId = trimmed
    } else {
      throw new Error('Invalid reporter identifier')
    }
  }

  if (resolvedReporterId !== undefined) {
    const existingReport = await prisma.report.findUnique({
      where: {
        photoId_reporterId: {
          photoId,
          reporterId: resolvedReporterId
        }
      }
    })

    if (existingReport) {
      throw new Error('You have already reported this photo')
    }
  }

  return await prisma.report.create({
    data: {
      photoId,
      reporterId: resolvedReporterId,
      reason,
      details,
      status: 'pending'
    }
  })
}

export async function listReportsByPhoto(photoId: string) {
  const prisma = getPrisma()
  const reports = await prisma.report.findMany({
    where: { photoId },
    orderBy: { createdAt: 'desc' },
    include: {
      photo: { select: { id: true, userId: true, key: true, url: true, uploadedAt: true } },
      reporter: { select: { id: true, email: true, name: true } }
    }
  })
  const count = await prisma.report.count({ where: { photoId } })
  return { reports, count }
}

export async function listAllReports(page: number = 1, limit: number = 20) {
  const prisma = getPrisma()
  const skip = (page - 1) * limit
  const [reports, totalCount] = await Promise.all([
    prisma.report.findMany({
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
      include: {
        photo: { select: { id: true, userId: true, key: true, url: true, uploadedAt: true } },
        reporter: { select: { id: true, email: true, name: true } }
      }
    }),
    prisma.report.count()
  ])
  return { reports, totalCount, hasMore: skip + reports.length < totalCount }
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


