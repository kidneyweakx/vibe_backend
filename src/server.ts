import { app } from "./app";
import { swagger } from "@elysiajs/swagger";

const port = Number(process.env.PORT || 8181);
app.use(swagger()).listen(port);

console.log(`🦊 Elysia is running at http://${app.server?.hostname}:${app.server?.port}/swagger`);


