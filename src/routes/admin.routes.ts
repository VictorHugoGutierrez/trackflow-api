import { Router } from "express";
import { AdminController } from "../controllers/admin.controller.js";
import { authMiddleware } from "../middlewares/auth.middleware.js";
import { superAdminMiddleware } from "../middlewares/super-admin.middleware.js";

export const adminRoutes = Router();

adminRoutes.use("/api/admin", authMiddleware, superAdminMiddleware);

adminRoutes.get("/api/admin/metrics", AdminController.getMetrics);
adminRoutes.get("/api/admin/tenants", AdminController.listTenants);
adminRoutes.post("/api/admin/tenants", AdminController.provisionTenant);
adminRoutes.get("/api/admin/tenants/:id", AdminController.getTenant);
adminRoutes.patch("/api/admin/tenants/:id", AdminController.updateTenant);
adminRoutes.delete("/api/admin/tenants/:id", AdminController.deleteTenant);
adminRoutes.get("/api/admin/logs", AdminController.getLogs);
