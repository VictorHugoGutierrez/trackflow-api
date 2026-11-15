import { Router } from "express";
import { AiController } from "../controllers/ai.controller.js";
import { authMiddleware } from "../middlewares/auth.middleware.js";

export const aiRoutes = Router();

aiRoutes.post("/api/ai/chat", authMiddleware, AiController.chat);
