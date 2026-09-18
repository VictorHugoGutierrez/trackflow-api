import { FastifyInstance } from "fastify";
import { AuthController } from "../controllers/auth.controller.js";

export async function authRoutes(app: FastifyInstance) {
  app.post("/api/auth/google", AuthController.googleLogin);
  app.post("/api/auth/logout", AuthController.logout);
}
