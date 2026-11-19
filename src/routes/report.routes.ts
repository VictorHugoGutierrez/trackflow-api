import { Router } from "express";
import { InvoiceController } from "../controllers/invoice.controller.js";
import { authMiddleware } from "../middlewares/auth.middleware.js";
import { requireTenant } from "../middlewares/tenant.middleware.js";

export const reportRoutes = Router();

// Rota de exportação CSV (acessível por membros também)
reportRoutes.get("/api/reports/export/csv", authMiddleware, requireTenant, InvoiceController.exportCsv);
