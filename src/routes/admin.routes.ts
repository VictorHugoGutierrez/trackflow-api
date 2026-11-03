import { Router } from "express";
import { AdminController } from "../controllers/admin.controller.js";
import { authMiddleware } from "../middlewares/auth.middleware.js";
import { superAdminMiddleware } from "../middlewares/super-admin.middleware.js";

export const adminRoutes = Router();

adminRoutes.use(authMiddleware);
adminRoutes.use(superAdminMiddleware);

adminRoutes.get("/admin/metrics", AdminController.getMetrics);
adminRoutes.get("/admin/tenants", AdminController.listTenants);
adminRoutes.patch("/admin/tenants/:id", AdminController.updateTenant);
