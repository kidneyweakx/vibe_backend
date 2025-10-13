import { Elysia } from 'elysia'
import getPrisma from '../../dbConfig'
import { calculateEloUpdate, eloToScore } from '../../utils/eloRating'
import { accessTokenMiddleware } from '../../middlewares/accessToken'

export const backfillRoutes = new Elysia({ prefix: '/backfill' })
  .use(accessTokenMiddleware)
  .post('/user-stats', async () => {
    const prisma = getPrisma()

    console.log('🚀 Starting user stats backfill...')

    try {
      // Get all users
      const users = await prisma.user.findMany({
        orderBy: { createdAt: 'asc' }
      })

      console.log(`📊 Found ${users.length} users to process`)

      const results = {
        total: users.length,
        processed: 0,
        updated: 0,
        noRatings: 0,
        errors: [] as string[]
      }

      for (const user of users) {
        try {
          // Get all ratings received by this user, in chronological order
          const ratings = await prisma.rating.findMany({
            where: { ratedUserId: user.id },
            orderBy: { createdAt: 'asc' },
            include: { rater: true }
          })

          let elo = 1500.0
          let likes = 0
          let normals = 0
          let lastRatedAt = null

          // Recalculate Elo by replaying all ratings in order
          for (const rating of ratings) {
            const raterElo = rating.rater.eloRating || 1500.0

            const { newRatedUserElo } = calculateEloUpdate(
              elo,
              raterElo,
              rating.type as 'like' | 'normal'
            )

            elo = newRatedUserElo
            lastRatedAt = rating.createdAt

            if (rating.type === 'like') likes++
            else if (rating.type === 'normal') normals++

            // Update rating with raterEloAtTime if missing
            if (!rating.raterEloAtTime) {
              await prisma.rating.update({
                where: { id: rating.id },
                data: { raterEloAtTime: raterElo }
              })
            }
          }

          const totalRatings = likes + normals
          const totalScore = eloToScore(elo)

          // Update user stats
          await prisma.user.update({
            where: { id: user.id },
            data: {
              eloRating: elo,
              totalScore,
              likeCount: likes,
              normalCount: normals,
              totalRatings,
              lastRatedAt
            }
          })

          results.processed++

          if (totalRatings > 0) {
            results.updated++
            console.log(`✅ ${user.email}: Elo=${elo.toFixed(1)}, Score=${totalScore}, Ratings=${totalRatings}`)
          } else {
            results.noRatings++
            console.log(`⚪ ${user.email}: No ratings`)
          }

        } catch (error) {
          const errorMsg = `Error processing ${user.email}: ${error instanceof Error ? error.message : 'Unknown error'}`
          results.errors.push(errorMsg)
          console.error(`❌ ${errorMsg}`)
        }
      }

      console.log('📈 Backfill complete!', results)

      return {
        success: true,
        message: 'User stats backfill completed',
        results
      }

    } catch (error) {
      console.error('Fatal backfill error:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }
  })
  .get('/user-stats/preview', async () => {
    // Preview what will be updated without making changes
    const prisma = getPrisma()

    const users = await prisma.user.findMany({
      take: 10,
      include: {
        receivedRatings: {
          select: {
            type: true,
            createdAt: true
          }
        }
      }
    })

    const preview = users.map(user => {
      const likes = user.receivedRatings.filter(r => r.type === 'like').length
      const normals = user.receivedRatings.filter(r => r.type === 'normal').length
      const total = likes + normals

      return {
        email: user.email,
        current: {
          eloRating: user.eloRating,
          totalScore: user.totalScore,
          likeCount: user.likeCount,
          normalCount: user.normalCount,
          totalRatings: user.totalRatings
        },
        actual: {
          likes,
          normals,
          total
        },
        needsUpdate: user.totalRatings !== total || user.likeCount !== likes || user.normalCount !== normals
      }
    })

    return {
      preview,
      totalUsers: await prisma.user.count(),
      usersNeedingUpdate: preview.filter(p => p.needsUpdate).length
    }
  })
