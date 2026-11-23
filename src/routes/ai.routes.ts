import { Router } from "express";
import { AiController } from "../controllers/ai.controller.js";
import { authMiddleware } from "../middlewares/auth.middleware.js";
import { requireTenant } from "../middlewares/tenant.middleware.js";

export const aiRoutes = Router();

aiRoutes.post("/api/ai/chat", authMiddleware, requireTenant, AiController.chat);
