import getPrisma from '../../dbConfig'
import { getPresignedGetUrl } from '../../routes/file/presign'

// 請求隊列，防止並行請求過多
const requestQueue = new Map<string, Promise<any>>()

// Create logger for this module
const logger = {
  info: (message: string, data?: any) => {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] [GetRandomPhotos] ${message}`, data ? JSON.stringify(data, null, 2) : '');
  },
  warn: (message: string, data?: any) => {
    const timestamp = new Date().toISOString();
    console.warn(`[${timestamp}] [GetRandomPhotos] WARN: ${message}`, data ? JSON.stringify(data, null, 2) : '');
  },
  error: (message: string, error?: any) => {
    const timestamp = new Date().toISOString();
    console.error(`[${timestamp}] [GetRandomPhotos] ERROR: ${message}`, error ? JSON.stringify(error, null, 2) : '');
  }
};

export async function getRandomPhotosForRating(userId: string, limit: number = 10) {
  const startTime = Date.now();
  const requestKey = `random-photos-${userId}-${limit}`
  
  if (requestQueue.has(requestKey)) {
    logger.info('Request already in progress, waiting for result', { userId, limit })
    return await requestQueue.get(requestKey)
  }
  
  const requestPromise = executeRandomPhotosRequest(userId, limit, startTime)
  requestQueue.set(requestKey, requestPromise)
  
  try {
    const result = await requestPromise
    return result
  } finally {
    requestQueue.delete(requestKey)
  }
}

async function executeRandomPhotosRequest(userId: string, limit: number, startTime: number) {
  logger.info('Starting random photos fetch', { userId, limit });
  
  try {
    const dbTimeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error('Database query timeout after 10 seconds')), 10000);
    });

    const dbQueryPromise = getPrisma().photo.findMany({
      where: {
        AND: [
          { userId: { not: userId } },
          { userId: { not: { startsWith: 'guest' } } },
          { key: { not: { startsWith: 'profile-pictures/' } } },
          { ratings: { none: { raterId: userId } } }
        ]
      },
      include: { 
        user: { select: { id: true, name: true, gender: true } }
      },
      orderBy: { uploadedAt: 'desc' },
      distinct: ['userId'],
      take: limit * 8
    });

    const latestPerUser = await Promise.race([dbQueryPromise, dbTimeoutPromise]);
    
    logger.info('Latest photos query completed', {
      foundCount: latestPerUser.length,
      requestedMultiplier: limit * 8
    });
    
    logger.info('Querying reported photos to filter out');
    
    // filter out photos with >= 2 reports using raw query (avoids type coupling)
    const reported = await getPrisma().$queryRaw<Array<{ photoId: string; reportCount: number | bigint }>>`
      SELECT photoId, COUNT(*) as reportCount
      FROM reports
      GROUP BY photoId
      HAVING COUNT(*) >= 2
    `;
    
    logger.info('Reported photos query completed', {
      reportedCount: reported.length
    });
    
    const excluded = new Set(reported.map((r) => r.photoId));
    const candidates = latestPerUser.filter((p) => !excluded.has(p.id));
    
    logger.info('Filtering completed', {
      originalCount: latestPerUser.length,
      excludedCount: excluded.size,
      candidateCount: candidates.length
    });
    
    const shuffled = candidates.sort(() => 0.5 - Math.random());
    const selected = shuffled.slice(0, limit);
    
    logger.info('Random selection completed', {
      selectedCount: selected.length,
      requestedLimit: limit
    });
    
    logger.info('Generating presigned URLs for selected photos');
    
    // 順序處理 presigned URLs 避免並行過多
    const withSignedUrl = []
    for (let i = 0; i < selected.length; i++) {
      const photo = selected[i]
      try {
        const url = await getPresignedGetUrl(photo.key, 60 * 60 * 24 * 7);
        logger.info(`Generated presigned URL for photo ${i + 1}/${selected.length}`, {
          photoId: photo.id,
          userId: photo.userId,
          key: photo.key
        });
        withSignedUrl.push({ ...photo, url });
      } catch (error) {
        logger.error(`Failed to generate presigned URL for photo ${i + 1}`, {
          photoId: photo.id,
          key: photo.key,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
        withSignedUrl.push({
          ...photo,
          url: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com/${process.env.R2_BUCKET_NAME}/${photo.key}`
        });
      }
    }
    
    const duration = Date.now() - startTime;
    logger.info('Random photos fetch completed successfully', {
      userId,
      limit,
      finalCount: withSignedUrl.length,
      duration: `${duration}ms`,
      photoIds: withSignedUrl.map(p => p.id)
    });
    
    return withSignedUrl;
  } catch (error: any) {
    const duration = Date.now() - startTime;
    logger.error('Random photos fetch failed', {
      userId,
      limit,
      duration: `${duration}ms`,
      error: error.message,
      stack: error.stack,
      code: error.code
    });
    throw error;
  }
}


