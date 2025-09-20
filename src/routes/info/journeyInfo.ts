import { Elysia } from 'elysia'
import { getJourneyDashboard } from '../../services/rate/journeyService'

// Create logger for this module
const logger = {
  info: (message: string, data?: any) => {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] [JourneyInfo] ${message}`, data ? JSON.stringify(data, null, 2) : '');
  },
  warn: (message: string, data?: any) => {
    const timestamp = new Date().toISOString();
    console.warn(`[${timestamp}] [JourneyInfo] WARN: ${message}`, data ? JSON.stringify(data, null, 2) : '');
  },
  error: (message: string, error?: any) => {
    const timestamp = new Date().toISOString();
    console.error(`[${timestamp}] [JourneyInfo] ERROR: ${message}`, error ? JSON.stringify(error, null, 2) : '');
  }
};

export const journeyInfoRoute = new Elysia()
  .get('/journeyInfo/:userId', async ({ params, set }) => {
    const startTime = Date.now();
    const { userId } = params as { userId: string }
    
    logger.info('Journey info request started', { userId });
    
    try {
      if (!userId) {
        logger.warn('Missing userId parameter');
        set.status = 400
        return { success: false, error: 'User ID is required' }
      }
      
      logger.info('Starting journey dashboard data fetch', { userId });
      
      // Add timeout protection
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Journey info request timeout after 25 seconds')), 25000);
      });

      const journeyDataPromise = getJourneyDashboard(userId);
      
      // Race between the actual operation and timeout
      const journeyData = await Promise.race([journeyDataPromise, timeoutPromise]);
      
      const duration = Date.now() - startTime;
      logger.info('Journey info request completed successfully', { 
        userId, 
        duration: `${duration}ms`,
        dataSize: JSON.stringify(journeyData).length,
        totalScore: journeyData.totalScore,
        totalRatings: journeyData.totalRatings,
        overallRank: journeyData.overallRank
      });
      
      return {
        success: true,
        data: journeyData
      }
    } catch (error: any) {
      const duration = Date.now() - startTime;
      logger.error('Journey info request failed', { 
        userId, 
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
