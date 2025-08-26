import { Elysia } from "elysia";
import { fileModule } from "./modules/file";
import { user } from "./modules/user";
import { authRoutes } from "./routes/auth";
import { rateModule } from "./modules/rate";
import { tagModule } from "./modules/tag";
import { eventModule } from "./modules/event";
import { accessTokenMiddleware } from "./middlewares/accessToken";
import { fileAdminModule } from "./modules/file/admin";

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
      .use(user)
      .use(authRoutes)
      .use(rateModule)
      .use(tagModule)
      .use(eventModule)
  );

export default app;

