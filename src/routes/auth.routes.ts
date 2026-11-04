import { Router } from "express";
import { AuthController } from "../controllers/auth.controller";
import { authMiddleware } from "../middlewares/auth.middleware";

export const authRoutes = Router();

authRoutes.post("/api/auth/register", AuthController.register);
authRoutes.post("/api/auth/login", AuthController.login);
authRoutes.post("/api/auth/google", AuthController.googleLogin);
authRoutes.post("/api/auth/logout", AuthController.logout);
authRoutes.get("/api/auth/me", authMiddleware, AuthController.me);
