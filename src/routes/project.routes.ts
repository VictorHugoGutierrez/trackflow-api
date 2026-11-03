import { Router } from "express";
import { ProjectController } from "../controllers/project.controller.js";
import { authMiddleware } from "../middlewares/auth.middleware.js";

export const projectRoutes = Router();

projectRoutes.use(authMiddleware);

projectRoutes.post("/api/projects", ProjectController.createProject);
projectRoutes.get("/api/projects", ProjectController.getProjects);
projectRoutes.patch("/api/projects/:id", ProjectController.alterProject);
projectRoutes.delete("/api/projects/:id", ProjectController.deleteProject);
