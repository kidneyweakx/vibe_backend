import { Elysia } from 'elysia'
import { z } from 'zod'
import { AuthService } from '../../services/auth/service'

// Create logger for this module
const logger = {
  info: (message: string, data?: any) => {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] [AppleVerify] ${message}`, data ? JSON.stringify(data, null, 2) : '');
  },
  warn: (message: string, data?: any) => {
    const timestamp = new Date().toISOString();
    console.warn(`[${timestamp}] [AppleVerify] WARN: ${message}`, data ? JSON.stringify(data, null, 2) : '');
  },
  error: (message: string, error?: any) => {
    const timestamp = new Date().toISOString();
    console.error(`[${timestamp}] [AppleVerify] ERROR: ${message}`, error ? JSON.stringify(error, null, 2) : '');
  }
};

// Zod schema for Apple verification
const AppleVerifySchema = z.object({
  idToken: z.string().min(1, 'idToken is required'),
  nonce: z.string().min(1, 'nonce is required'),
  userIdentifier: z.string().min(1, 'userIdentifier is required'),
  email: z.string().email().optional(),
  fullName: z.object({
    givenName: z.string().optional(),
    familyName: z.string().optional()
  }).optional()
});

export const appleVerifyRoute = new Elysia()
  .post('/apple/verify', async ({ body, set }) => {
    const startTime = Date.now();
    
    logger.info('Apple verification request started', {
      hasIdToken: !!body.idToken,
      hasNonce: !!body.nonce,
      hasUserIdentifier: !!body.userIdentifier,
      hasEmail: !!body.email,
      hasFullName: !!body.fullName
    });
    
    try {
      // Validate request body with Zod
      logger.info('Validating request body with Zod');
      const validatedBody = AppleVerifySchema.parse(body);
      
      logger.info('Request validation successful', {
        userIdentifier: validatedBody.userIdentifier,
        email: validatedBody.email ? 'present' : 'missing',
        fullName: validatedBody.fullName ? 'present' : 'missing'
      });

      // Add timeout protection for the entire auth process
      const authTimeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Apple authentication timeout after 15 seconds')), 15000);
      });

      logger.info('Starting Apple token verification');
      const authResponsePromise = AuthService.signInWithApple({
        idToken: validatedBody.idToken,
        nonce: validatedBody.nonce,
        userIdentifier: validatedBody.userIdentifier,
        email: validatedBody.email,
        fullName: validatedBody.fullName
      });

      // Race between auth and timeout
      const authResponse = await Promise.race([authResponsePromise, authTimeoutPromise]);
      
      const duration = Date.now() - startTime;
      logger.info('Apple verification completed successfully', {
        duration: `${duration}ms`,
        hasUser: !!authResponse.user,
        hasToken: !!authResponse.token,
        userId: authResponse.user?.id
      });
      
      return authResponse
    } catch (error) {
      const duration = Date.now() - startTime;
      
      // Handle timeout errors
      if (error instanceof Error && error.message.includes('timeout')) {
        logger.error('Apple authentication timed out', {
          duration: `${duration}ms`,
          timeout: '15 seconds'
        });
        
        set.status = 504;
        return { success: false, error: 'Authentication timeout' };
      }
      
      // Handle Zod validation errors
      if (error instanceof z.ZodError) {
        logger.error('Request validation failed', {
          duration: `${duration}ms`,
          validationErrors: error.errors.map(e => ({
            field: e.path.join('.'),
            message: e.message,
            received: e.received
          }))
        });
        
        set.status = 400;
        return { 
          success: false, 
          error: 'Invalid request data',
          details: error.errors.map(e => ({
            field: e.path.join('.'),
            message: e.message
          }))
        };
      }
      
      // Handle database connection errors
      if (error instanceof Error && (
        error.message.includes('Database configuration error') ||
        error.message.includes('TURSO_DATABASE_URL') ||
        error.message.includes('TURSO_AUTH_TOKEN') ||
        error.message.includes('Prisma') ||
        error.message.includes('connection')
      )) {
        logger.error('Database connection error during Apple verification', {
          duration: `${duration}ms`,
          error: error.message,
          stack: error.stack
        });
        
        set.status = 503;
        return { success: false, error: 'Service temporarily unavailable' };
      }
      
      // Handle other errors
      const message = error instanceof Error ? error.message : 'Apple authentication failed'
      const isAuthError = /invalid|unauthor/i.test(message)
      
      logger.error('Apple verification failed', {
        duration: `${duration}ms`,
        error: message,
        stack: error instanceof Error ? error.stack : undefined,
        isAuthError,
        statusCode: isAuthError ? 401 : 500
      });
      
      set.status = isAuthError ? 401 : 500
      return { success: false, error: message }
    }
  })


