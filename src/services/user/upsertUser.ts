import getPrisma from '../../dbConfig'

export interface CreateUserData {
  email: string
  name?: string
  avatar?: string
  gender?: string
  provider: string
  providerId: string
  passwordHash?: string
  isGuest?: boolean
}

export async function upsertUser(data: CreateUserData) {
  const startTime = Date.now();
  const logger = {
    info: (message: string, data?: any) => {
      const timestamp = new Date().toISOString();
      console.log(`[${timestamp}] [UpsertUser] ${message}`, data ? JSON.stringify(data, null, 2) : '');
    },
    error: (message: string, error?: any) => {
      const timestamp = new Date().toISOString();
      console.error(`[${timestamp}] [UpsertUser] ERROR: ${message}`, error ? JSON.stringify(error, null, 2) : '');
    },
    warn: (message: string, data?: any) => {
      const timestamp = new Date().toISOString();
      console.warn(`[${timestamp}] [UpsertUser] WARN: ${message}`, data ? JSON.stringify(data, null, 2) : '');
    },
    debug: (message: string, data?: any) => {
      const timestamp = new Date().toISOString();
      console.log(`[${timestamp}] [UpsertUser] DEBUG: ${message}`, data ? JSON.stringify(data, null, 2) : '');
    }
  };

  logger.info('Starting user upsert operation', {
    provider: data.provider,
    providerId: data.providerId,
    email: data.email,
    hasName: !!data.name,
    hasAvatar: !!data.avatar,
    hasGender: !!data.gender
  });

  // Calculate safeEmail outside of try block so it's available in catch
  const safeEmail = data.email && data.email.trim().length > 0 ? data.email : `${data.provider}_${data.providerId}@placeholder.local`

  try {
    logger.info('Obtaining Prisma client');
    const prisma = getPrisma()
    logger.info('Prisma client obtained successfully')
    
    logger.info('Attempting user upsert', { 
      safeEmail,
      originalEmail: data.email,
      provider: data.provider,
      providerId: data.providerId
    });
    
    const dbOperationStart = Date.now();
    const result = await prisma.user.upsert({
      where: { provider_providerId: { provider: data.provider, providerId: data.providerId } },
      update: {
        email: safeEmail,
        name: data.name,
        avatar: data.avatar,
        gender: data.gender,
        isGuest: data.isGuest ?? false,
        updatedAt: new Date()
      },
      create: {
        ...data,
        email: safeEmail,
        isGuest: data.isGuest ?? false
      }
    });
    const dbOperationDuration = Date.now() - dbOperationStart;

    const duration = Date.now() - startTime;
    logger.info('User upsert completed successfully', {
      userId: result.id,
      duration: `${duration}ms`,
      dbOperationDuration: `${dbOperationDuration}ms`,
      wasCreated: !result.updatedAt || (result.updatedAt.getTime() - result.createdAt.getTime()) < 1000
    });

    return result;
  } catch (error: any) {
    const duration = Date.now() - startTime;
    logger.error('User upsert failed', {
      duration: `${duration}ms`,
      error: error.message,
      code: error.code,
      provider: data.provider,
      providerId: data.providerId
    });

    const message: string = typeof error?.message === 'string' ? error.message.toLowerCase() : ''
    const isUniqueEmailConflict = error?.code === 'P2002' || (message.includes('unique constraint') && message.includes('email'))
    
    if (!isUniqueEmailConflict) {
      logger.error('Non-unique constraint error, rethrowing', { error: error.message });
      throw error;
    }

    logger.info('Handling unique email conflict, attempting update');
    
    try {
      const prisma = getPrisma()
      logger.debug('Looking up existing user by email', { safeEmail });
      
      const existingByEmail = await prisma.user.findUnique({ where: { email: safeEmail } })
      
      if (!existingByEmail) {
        logger.error('No existing user found for email conflict resolution');
        throw error;
      }

      logger.info('Found existing user, updating provider info', { 
        existingUserId: existingByEmail.id,
        existingProvider: existingByEmail.provider,
        existingProviderId: existingByEmail.providerId
      });
      
      const updateStart = Date.now();
      const updatedUser = await prisma.user.update({
        where: { id: existingByEmail.id },
        data: {
          provider: data.provider,
          providerId: data.providerId,
          name: data.name ?? existingByEmail.name,
          avatar: data.avatar ?? existingByEmail.avatar,
          gender: data.gender ?? existingByEmail.gender ?? undefined,
          updatedAt: new Date()
        }
      });
      const updateDuration = Date.now() - updateStart;

      const totalDuration = Date.now() - startTime;
      logger.info('User update completed successfully', {
        userId: updatedUser.id,
        totalDuration: `${totalDuration}ms`,
        updateDuration: `${updateDuration}ms`
      });

      return updatedUser;
    } catch (updateError: any) {
      const totalDuration = Date.now() - startTime;
      logger.error('User update failed during conflict resolution', {
        totalDuration: `${totalDuration}ms`,
        error: updateError.message,
        code: updateError.code
      });
      throw updateError;
    }
  }
}


