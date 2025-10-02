import { Elysia } from 'elysia'
import { unhidePhoto, permanentlyHidePhoto } from '../../services/photo/autoHide'
import getPrisma from '../../dbConfig'

export const moderatePhotoRoute = new Elysia()
  // Approve photo - unhide and dismiss reports
  .post('/photos/:photoId/approve', async ({ params, headers, set }) => {
    try {
      const { photoId } = params
      const adminId = headers['x-admin-id'] || 'admin'

      await unhidePhoto(photoId, adminId)

      return {
        success: true,
        message: 'Photo approved and unhidden'
      }
    } catch (error: any) {
      console.error('Photo approval error:', error)
      set.status = 400
      return { success: false, error: error.message }
    }
  })

  // Reject photo - permanently hide
  .post('/photos/:photoId/reject', async ({ params, headers, set }) => {
    try {
      const { photoId } = params
      const adminId = headers['x-admin-id'] || 'admin'

      await permanentlyHidePhoto(photoId, adminId)

      return {
        success: true,
        message: 'Photo rejected and permanently hidden'
      }
    } catch (error: any) {
      console.error('Photo rejection error:', error)
      set.status = 400
      return { success: false, error: error.message }
    }
  })

  // Get photos needing moderation
  .get('/photos/pending', async ({ query, set }) => {
    try {
      const page = parseInt(query.page as string) || 1
      const limit = Math.min(parseInt(query.limit as string) || 20, 100)
      const skip = (page - 1) * limit

      const prisma = getPrisma()

      const [photos, totalCount] = await Promise.all([
        prisma.photo.findMany({
          where: {
            OR: [
              { status: 'pending_review' },
              { status: 'hidden' }
            ]
          },
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true
              }
            },
            reports: {
              where: { status: 'pending' },
              include: {
                reporter: {
                  select: {
                    id: true,
                    name: true,
                    email: true
                  }
                }
              },
              orderBy: { createdAt: 'desc' }
            }
          },
          orderBy: { createdAt: 'desc' },
          skip,
          take: limit
        }),
        prisma.photo.count({
          where: {
            OR: [
              { status: 'pending_review' },
              { status: 'hidden' }
            ]
          }
        })
      ])

      return {
        success: true,
        data: {
          photos,
          pagination: {
            page,
            limit,
            totalCount,
            totalPages: Math.ceil(totalCount / limit),
            hasMore: skip + photos.length < totalCount
          }
        }
      }
    } catch (error: any) {
      console.error('Get pending photos error:', error)
      set.status = 500
      return { success: false, error: error.message }
    }
  })

  // Get photo moderation details
  .get('/photos/:photoId/moderation', async ({ params, set }) => {
    try {
      const { photoId } = params
      const prisma = getPrisma()

      const photo = await prisma.photo.findUnique({
        where: { id: photoId },
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
              createdAt: true
            }
          },
          reports: {
            include: {
              reporter: {
                select: {
                  id: true,
                  name: true,
                  email: true
                }
              }
            },
            orderBy: { createdAt: 'desc' }
          },
          ratings: {
            select: {
              type: true,
              createdAt: true
            }
          }
        }
      })

      if (!photo) {
        set.status = 404
        return { success: false, error: 'Photo not found' }
      }

      // Calculate stats
      const likeCount = photo.ratings.filter(r => r.type === 'like').length
      const normalCount = photo.ratings.filter(r => r.type === 'normal').length
      const reportCount = photo.reports.length
      const pendingReportCount = photo.reports.filter(r => r.status === 'pending').length

      return {
        success: true,
        data: {
          photo,
          stats: {
            likeCount,
            normalCount,
            totalRatings: likeCount + normalCount,
            reportCount,
            pendingReportCount
          }
        }
      }
    } catch (error: any) {
      console.error('Get moderation details error:', error)
      set.status = 500
      return { success: false, error: error.message }
    }
  })
