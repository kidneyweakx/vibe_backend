import { Elysia } from "elysia";

export const accessTokenMiddleware = new Elysia()
  .derive(({ headers, request }) => {
    if (request.method === 'OPTIONS') {
      return { accessToken: undefined } as any
    }
    const accessToken = headers['x-access-token'] || headers['authorization']?.replace('Bearer ', '');
    const expectedToken = process.env.API_ACCESS_TOKEN;
    
    if (!accessToken) {
      throw new Error('Access token is required');
    }
    
    if (accessToken !== expectedToken) {
      throw new Error('Invalid access token');
    }
    
    return { accessToken };
  })
  .onError(({ error, set }) => {
    if (error.message === 'Access token is required' || error.message === 'Invalid access token') {
      set.status = 401;
      return {
        error: 'Unauthorized',
        message: error.message
      };
    }
  });


