import { Router } from "express";
import { TeamController } from "../controllers/team.controller.js";
import { authMiddleware } from "../middlewares/auth.middleware.js";
import { requireTenant } from "../middlewares/tenant.middleware.js";
import { requireRole } from "../middlewares/role.middleware.js";

export const teamRoutes = Router();

const teamGuard = [
  authMiddleware,
  requireTenant,
  requireRole(
    ["OWNER", "MANAGER", "SUPER_ADMIN"],
    "Apenas proprietários e gestores possuem permissão para gerenciar a equipe.",
  ),
];

teamRoutes.get("/dashboard/team", ...teamGuard, TeamController.listMembers);
teamRoutes.post("/dashboard/team/invite", ...teamGuard, TeamController.inviteMember);
teamRoutes.delete("/dashboard/team/:id", ...teamGuard, TeamController.removeMember);
teamRoutes.post("/dashboard/team/:id", ...teamGuard, TeamController.removeMember);

teamRoutes.get("/api/team", ...teamGuard, TeamController.listMembers);
teamRoutes.post("/api/team/invite", ...teamGuard, TeamController.inviteMember);
teamRoutes.post("/api/team", ...teamGuard, TeamController.inviteMember);
teamRoutes.delete("/api/team/:id", ...teamGuard, TeamController.removeMember);
