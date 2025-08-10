import app from "./app";

// Cloudflare Workers entry: export fetch handler
export default {
  fetch: app.fetch,
};
