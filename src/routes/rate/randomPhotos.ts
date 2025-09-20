import { Elysia } from 'elysia'
import { getRandomPhotosForRating } from './service'

// Create logger for this module
const logger = {
  info: (message: string, data?: any) => {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] [RandomPhotos] ${message}`, data ? JSON.stringify(data, null, 2) : '');
  },
  warn: (message: string, data?: any) => {
    const timestamp = new Date().toISOString();
    console.warn(`[${timestamp}] [RandomPhotos] WARN: ${message}`, data ? JSON.stringify(data, null, 2) : '');
  },
  error: (message: string, error?: any) => {
    const timestamp = new Date().toISOString();
    console.error(`[${timestamp}] [RandomPhotos] ERROR: ${message}`, error ? JSON.stringify(error, null, 2) : '');
  }
};

export const randomPhotosRoute = new Elysia()
  .get('/photos/random', async ({ query, set }) => {
    const startTime = Date.now();
    const userId = query.userId as string
    const limit = parseInt(query.limit as string) || 10
    
    logger.info('Random photos request started', { 
      userId, 
      limit,
      requestedLimit: query.limit 
    });
    
    try {
      if (!userId) {
        logger.warn('Missing userId parameter');
        set.status = 400
        return { success: false, error: 'userId is required' }
      }
      
      logger.info('Starting random photos fetch process', { userId, limit });
      
      // Add timeout protection
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Random photos request timeout after 15 seconds')), 15000);
      });

      const photosPromise = getRandomPhotosForRating(userId, limit);
      
      // Race between the actual operation and timeout
      const photos = await Promise.race([photosPromise, timeoutPromise]);
      
      const duration = Date.now() - startTime;
      logger.info('Random photos request completed successfully', { 
        userId, 
        limit,
        actualCount: photos.length,
        duration: `${duration}ms`,
        photoIds: photos.map(p => p.id).slice(0, 5) // Log first 5 photo IDs for debugging
      });
      
      return { success: true, data: photos }
    } catch (error: any) {
      const duration = Date.now() - startTime;
      logger.error('Random photos request failed', { 
        userId, 
        limit,
        duration: `${duration}ms`,
        error: error.message,
        stack: error.stack,
        code: error.code
      });
      
      if (error.message.includes('timeout')) {
        set.status = 504
        return { success: false, error: 'Request timeout' }
      }
      set.status = 500
      return { success: false, error: error.message }
    }
  })


