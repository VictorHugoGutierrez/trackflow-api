import { Router } from "express";
import { AuthController } from "../controllers/auth.controller";

export const authRoutes = Router();

authRoutes.post("/auth/google", AuthController.googleLogin);
authRoutes.post("/auth/logout", AuthController.logout);
