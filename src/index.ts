import { Elysia } from "elysia";
import { swagger } from '@elysiajs/swagger'
import { fileModule } from "./modules/file";
import { user } from "./modules/user";
import { auth } from "./modules/auth";

const app = new Elysia()
  .use(swagger())
  .use(fileModule)
  .use(user)
  .use(auth)
  .listen(8181);

console.log(
  `🦊 Elysia is running at http://${app.server?.hostname}:${app.server?.port}/swagger`
);
