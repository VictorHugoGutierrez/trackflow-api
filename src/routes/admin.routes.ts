import { Router } from "express";
import { AdminController } from "../controllers/admin.controller.js";
import { authMiddleware } from "../middlewares/auth.middleware.js";
import { superAdminMiddleware } from "../middlewares/super-admin.middleware.js";

export const adminRoutes = Router();

adminRoutes.use(authMiddleware);
adminRoutes.use(superAdminMiddleware);

adminRoutes.get("/api/admin/metrics", AdminController.getMetrics);
adminRoutes.get("/api/admin/tenants", AdminController.listTenants);
adminRoutes.patch("/api/admin/tenants/:id", AdminController.updateTenant);
