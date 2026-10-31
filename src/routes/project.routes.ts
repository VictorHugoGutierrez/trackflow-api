import { Router } from "express";
import { ProjectController } from "../controllers/project.controller.js";
import { authMiddleware } from "../middlewares/auth.middleware.js";

export const projectRoutes = Router();

projectRoutes.use(authMiddleware);

projectRoutes.post("/projects", ProjectController.createProject);
projectRoutes.get("/projects", ProjectController.getProjects);
projectRoutes.patch("/projects/:id", ProjectController.alterProject);
projectRoutes.delete("/projects/:id", ProjectController.deleteProjects);
