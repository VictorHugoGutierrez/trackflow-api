import { FastifyInstance } from "fastify";
import { AdminController } from "../controllers/admin.controller.js";
import { authMiddleware } from "../middlewares/auth.middleware.js";
import { superAdminMiddleware } from "../middlewares/super-admin.middleware.js";

export async function adminRoutes(app: FastifyInstance) {
  app.addHook("preHandler", authMiddleware);
  app.addHook("preHandler", superAdminMiddleware);

  app.get("/api/admin/metrics", AdminController.getMetrics);
  app.get("/api/admin/tenants", AdminController.listTenants);
  app.patch("/api/admin/tenants/:id", AdminController.updateTenant);
}
