import getPrisma from '../../dbConfig'

// Configuration
const AUTO_HIDE_THRESHOLD = 3 // Hide photo after 3 reports
const REVIEW_THRESHOLD = 2 // Flag for review after 2 reports

export async function checkAndHidePhoto(photoId: string): Promise<{
  hidden: boolean
  reportCount: number
  status: string
}> {
  const prisma = getPrisma()

  // Count pending reports for this photo
  const reportCount = await prisma.report.count({
    where: {
      photoId,
      status: 'pending'
    }
  })

  console.log(`Photo ${photoId} has ${reportCount} pending reports`)

  const photo = await prisma.photo.findUnique({
    where: { id: photoId }
  })

  if (!photo) {
    throw new Error('Photo not found')
  }

  // Already hidden, no action needed
  if (photo.status === 'hidden') {
    return { hidden: true, reportCount, status: 'hidden' }
  }

  // Auto-hide if threshold reached
  if (reportCount >= AUTO_HIDE_THRESHOLD) {
    await prisma.photo.update({
      where: { id: photoId },
      data: {
        status: 'hidden',
        hiddenAt: new Date(),
        hiddenReason: 'auto_reports'
      }
    })

    console.log(`✅ Photo ${photoId} auto-hidden due to ${reportCount} reports`)
    return { hidden: true, reportCount, status: 'hidden' }
  }

  // Flag for review if reaching threshold
  if (reportCount >= REVIEW_THRESHOLD && photo.status === 'active') {
    await prisma.photo.update({
      where: { id: photoId },
      data: {
        status: 'pending_review'
      }
    })

    console.log(`⚠️  Photo ${photoId} flagged for review (${reportCount} reports)`)
    return { hidden: false, reportCount, status: 'pending_review' }
  }

  return { hidden: false, reportCount, status: photo.status }
}

export async function unhidePhoto(photoId: string, reviewedBy: string): Promise<void> {
  const prisma = getPrisma()

  await prisma.photo.update({
    where: { id: photoId },
    data: {
      status: 'active',
      hiddenAt: null,
      hiddenReason: null
    }
  })

  // Mark all reports as reviewed
  await prisma.report.updateMany({
    where: {
      photoId,
      status: 'pending'
    },
    data: {
      status: 'dismissed',
      reviewedAt: new Date(),
      reviewedBy
    }
  })

  console.log(`✅ Photo ${photoId} unhidden by admin ${reviewedBy}`)
}

export async function permanentlyHidePhoto(photoId: string, reviewedBy: string): Promise<void> {
  const prisma = getPrisma()

  await prisma.photo.update({
    where: { id: photoId },
    data: {
      status: 'deleted',
      hiddenAt: new Date(),
      hiddenReason: 'admin_action'
    }
  })

  // Mark all reports as action taken
  await prisma.report.updateMany({
    where: {
      photoId,
      status: 'pending'
    },
    data: {
      status: 'action_taken',
      reviewedAt: new Date(),
      reviewedBy
    }
  })

  console.log(`🚫 Photo ${photoId} permanently hidden by admin ${reviewedBy}`)
}
