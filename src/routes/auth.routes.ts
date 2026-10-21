import { Router } from "express";
import { AuthController } from "../controllers/auth.controller.js";

export const authRoutes = Router();

authRoutes.post("/api/auth/google", AuthController.googleLogin);
authRoutes.post("/api/auth/logout", AuthController.logout);
