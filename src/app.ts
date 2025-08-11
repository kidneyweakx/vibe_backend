import { Elysia } from "elysia";
import { fileModule } from "./modules/file";
import { user } from "./modules/user";
import { auth } from "./modules/auth";
import { rateModule } from "./modules/rate";
import { tagModule } from "./modules/tag";
import { eventModule } from "./modules/event";
import { accessTokenMiddleware } from "./middleware/accessToken";

export const app = new Elysia({ aot: false })
  .group("/api", (grouped) =>
    grouped
      .use(accessTokenMiddleware)
      .use(fileModule)
      .use(user)
      .use(auth)
      .use(rateModule)
      .use(tagModule)
      .use(eventModule)
  );

export default app;

