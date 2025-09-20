import { Elysia } from "elysia";
import { fileModule } from "./routes/file";
import { userRoutes } from "./routes/user";
import { authRoutes } from "./routes/auth";
import { rateModule } from "./routes/rate";
import { tagRoutes } from "./routes/tag";
import { eventModule } from "./routes/event";
import { infoModule } from "./routes/info";
import { accessTokenMiddleware } from "./middlewares/accessToken";
import { fileAdminModule } from "./routes/file/admin";
import { onboardingModule } from "./routes/onboarding";

// Enhanced logging utility
const createLogger = (context: string) => ({
  info: (message: string, data?: any) => {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] [${context}] ${message}`, data ? JSON.stringify(data, null, 2) : '');
  },
  warn: (message: string, data?: any) => {
    const timestamp = new Date().toISOString();
    console.warn(`[${timestamp}] [${context}] WARN: ${message}`, data ? JSON.stringify(data, null, 2) : '');
  },
  error: (message: string, error?: any) => {
    const timestamp = new Date().toISOString();
    console.error(`[${timestamp}] [${context}] ERROR: ${message}`, error ? JSON.stringify(error, null, 2) : '');
  },
  debug: (message: string, data?: any) => {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] [${context}] DEBUG: ${message}`, data ? JSON.stringify(data, null, 2) : '');
  }
});

// 全局請求限制
const activeRequests = new Map<string, number>()
const MAX_CONCURRENT_REQUESTS = 5

export const app = new Elysia({ aot: false })
  // 添加中間件來限制並行請求
  .use(async ({ request, set }: { request: Request; set: any }) => {
    const requestId = `${request.method}-${request.url}`
    const currentCount = activeRequests.get(requestId) || 0
    
    if (currentCount >= MAX_CONCURRENT_REQUESTS) {
      set.status = 429
      return {
        success: false,
        error: 'Too many concurrent requests, please try again later'
      }
    }
    
    activeRequests.set(requestId, currentCount + 1)
    
    // 在請求結束時清理計數
    const originalOnAfterHandle = app.onAfterHandle
    app.onAfterHandle(({ request }: { request: Request }) => {
      const currentCount = activeRequests.get(requestId) || 0
      activeRequests.set(requestId, Math.max(0, currentCount - 1))
    })
  })
  // Global request logging middleware with enhanced debugging
  .onRequest(({ request, set }: { request: Request; set: any }) => {
    const startTime = Date.now();
    const timestamp = new Date().toISOString();
    const method = request.method;
    const url = new URL(request.url);
    const pathname = url.pathname;
    const userAgent = request.headers.get('user-agent') || 'Unknown';
    const authorization = request.headers.get('authorization') ? 'Present' : 'None';
    const contentType = request.headers.get('content-type') || 'None';
    
    // Store start time and logger for response logging
    (request as any).startTime = startTime;
    (request as any).logger = createLogger(`${method} ${pathname}`);
    
    const logger = createLogger(`${method} ${pathname}`);
    logger.info(`Request started`, {
      userAgent,
      authorization,
      contentType,
      query: Object.fromEntries(url.searchParams.entries())
    });
  })
  .onAfterHandle(({ request, set, response }: { request: Request; set: any; response: any }) => {
    const endTime = Date.now();
    const duration = endTime - ((request as any).startTime || endTime);
    const timestamp = new Date().toISOString();
    const method = request.method;
    const url = new URL(request.url);
    const pathname = url.pathname;
    const status = set.status || 200;
    const logger = (request as any).logger || createLogger(`${method} ${pathname}`);
    
    logger.info(`Request completed`, {
      status,
      duration: `${duration}ms`,
      responseSize: response ? JSON.stringify(response).length : 0
    });
    
    // Log slow requests
    if (duration > 1000) {
      logger.warn(`Slow request detected`, { duration: `${duration}ms` });
    }
    
    // Log response body for debugging (be careful with sensitive data)
    if (status >= 400) {
      logger.error(`Error response`, { response });
    }
  })
  .onError(({ request, set, error }: { request: Request; set: any; error: any }) => {
    const endTime = Date.now();
    const duration = endTime - ((request as any).startTime || endTime);
    const timestamp = new Date().toISOString();
    const method = request.method;
    const url = new URL(request.url);
    const pathname = url.pathname;
    const status = set.status || 500;
    const logger = (request as any).logger || createLogger(`${method} ${pathname}`);
    
    logger.error(`Request failed`, {
      status,
      duration: `${duration}ms`,
      error: {
        message: error.message,
        stack: error.stack,
        name: error.name
      }
    });
    
    return { success: false, error: error.message };
  })
  .group("/api", (grouped: any) =>
    grouped
      // Basic CORS for dev/admin portal
      .onRequest(({ request, set }: { request: Request; set: any }) => {
        const originHeader = request.headers.get('origin');
        if (originHeader) {
          set.headers["Access-Control-Allow-Origin"] = originHeader;
          set.headers["Access-Control-Allow-Credentials"] = "true";
          set.headers["Vary"] = "Origin";
        } else {
          set.headers["Access-Control-Allow-Origin"] = "*";
        }
        set.headers["Access-Control-Allow-Headers"] = "Authorization, X-Access-Token, Content-Type";
        set.headers["Access-Control-Allow-Methods"] = "GET, POST, PUT, PATCH, DELETE, OPTIONS";
      })
      .options("/*", ({ set }: { set: any }) => {
        set.status = 204
        return null
      })
      .use(accessTokenMiddleware)
      .use(fileModule)
      .use(fileAdminModule)
      .use(onboardingModule)
      .use(userRoutes)
      .use(authRoutes)
      .use(rateModule)
      .use(tagRoutes)
      .use(eventModule)
      .use(infoModule)
  );

export default app;

