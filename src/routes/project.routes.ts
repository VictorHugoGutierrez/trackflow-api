import { Router } from "express";
import { ProjectController } from "../controllers/project.controller.js";
import { authMiddleware } from "../middlewares/auth.middleware.js";
import { requireTenant } from "../middlewares/tenant.middleware.js";
import { requireRole } from "../middlewares/role.middleware.js";

export const projectRoutes = Router();

projectRoutes.use("/api/projects", authMiddleware, requireTenant);

projectRoutes.post("/api/projects", ProjectController.createProject);
projectRoutes.get("/api/projects", ProjectController.getProjects);
projectRoutes.patch("/api/projects/:id", ProjectController.alterProject);
projectRoutes.patch(
  "/api/projects/:id/status",
  requireRole(
    ["OWNER", "MANAGER", "SUPER_ADMIN"],
    "Apenas proprietários e gestores possuem permissão para concluir ou reabrir projetos.",
  ),
  ProjectController.updateStatus,
);
projectRoutes.delete("/api/projects/:id", ProjectController.deleteProject);
