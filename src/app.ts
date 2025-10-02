import { Elysia } from "elysia";
import { fileModule } from "./routes/file";
import { userRoutes } from "./routes/user";
import { authRoutes } from "./routes/auth";
import { rateModule } from "./routes/rate";
import { tagRoutes } from "./routes/tag";
import { eventModule } from "./routes/event";
import { infoModule } from "./routes/info";
import { accessTokenMiddleware } from "./middlewares/accessToken";
import { adminModule } from "./routes/admin";
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
        set.headers["Access-Control-Allow-Headers"] = "Authorization, X-Access-Token, X-Admin-Key, Content-Type";
        set.headers["Access-Control-Allow-Methods"] = "GET, POST, PUT, PATCH, DELETE, OPTIONS";
      })
      .options("/*", ({ set }: { set: any }) => {
        set.status = 204
        return null
      })
      // Admin routes - no accessToken required, use X-Admin-Key instead
      .use(adminModule)
      // Regular routes - require accessToken
      .use(accessTokenMiddleware)
      .use(authRoutes)
      .use(onboardingModule)
      .use(userRoutes)
      .use(fileModule)
      .use(rateModule)
      .use(tagRoutes)
      .use(eventModule)
      .use(infoModule)
  );

export default app;

