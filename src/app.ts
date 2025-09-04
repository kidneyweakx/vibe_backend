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

export const app = new Elysia({ aot: false })
  .group("/api", (grouped) =>
    grouped
      // Basic CORS for dev/admin portal
      .onRequest(({ request, set }) => {
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
      .options("/*", ({ set }) => {
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

