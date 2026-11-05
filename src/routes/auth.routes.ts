import { Router } from "express";
import { AuthController } from "../controllers/auth.controller.js";
import { authMiddleware } from "../middlewares/auth.middleware.js";

export const authRoutes = Router();

authRoutes.post("/api/auth/register", AuthController.register);
authRoutes.post("/api/auth/login", AuthController.login);
authRoutes.post("/api/auth/google", AuthController.googleLogin);
authRoutes.post("/api/auth/logout", AuthController.logout);
authRoutes.get("/api/auth/me", authMiddleware, AuthController.me);
authRoutes.patch("/api/auth/settings", authMiddleware, AuthController.updateSettings);
authRoutes.patch("/api/users/settings", authMiddleware, AuthController.updateSettings);
authRoutes.patch("/api/auth/profile", authMiddleware, AuthController.updateProfile);
authRoutes.patch("/api/users/profile", authMiddleware, AuthController.updateProfile);
