import { Router } from "express";
import { TaskController } from "../controllers/task.controller.js";
import { authMiddleware } from "../middlewares/auth.middleware.js";

export const taskRoutes = Router();

taskRoutes.use(authMiddleware);

taskRoutes.post("/tasks", TaskController.createTask);
taskRoutes.get("/tasks", TaskController.getTasks);
taskRoutes.patch("/tasks/:id", TaskController.alterTask);
taskRoutes.delete("/tasks/:id", TaskController.deleteTask);
