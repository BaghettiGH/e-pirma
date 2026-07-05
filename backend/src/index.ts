import { Elysia } from "elysia";
import { cors} from "@elysiajs/cors";
import { authRoutes } from "./routes/auth";
import { documentRoutes } from "./routes/documents";
import { boxRoutes } from "./routes/boxes";
import { sendRoutes } from "./routes/send";
import { signRoutes } from "./routes/sign";

const app = new Elysia()
  .use(cors({ origin: process.env.FRONTEND_URL || "http://localhost:5173" }))
  .get("/health", () => ({
    status: "ok",
    service: "esign-backend",
    timestamp: new Date().toISOString(),
  }))
  .use(authRoutes)
  .use(documentRoutes)
  .use(boxRoutes)
  .use(sendRoutes)
  .use(signRoutes)
  .listen(process.env.PORT || 3001);

console.log(`🦊 Elysia is running at ${app.server?.hostname}:${app.server?.port}`);
