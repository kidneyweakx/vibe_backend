import app from "./app";
import { bindRuntimeEnv } from "./env";

// Cloudflare Workers entry: export fetch handler
export default {
  fetch(request: Request, env: Record<string, string>, ctx: ExecutionContext) {
    bindRuntimeEnv(env);
    return app.fetch(request, env, ctx);
  },
};
