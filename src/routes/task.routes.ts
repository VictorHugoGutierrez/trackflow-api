import { Router } from "express";
import { TaskController } from "../controllers/task.controller.js";
import { authMiddleware } from "../middlewares/auth.middleware.js";
import { requireTenant } from "../middlewares/tenant.middleware.js";

export const taskRoutes = Router();

taskRoutes.use("/api/tasks", authMiddleware, requireTenant);

taskRoutes.post("/api/tasks", TaskController.createTask);
taskRoutes.get("/api/tasks", TaskController.getTasks);
taskRoutes.patch("/api/tasks/:id", TaskController.alterTask);
taskRoutes.delete("/api/tasks/:id", TaskController.deleteTask);
