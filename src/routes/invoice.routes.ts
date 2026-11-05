import { Router } from "express";
import { InvoiceController } from "../controllers/invoice.controller.js";
import { authMiddleware } from "../middlewares/auth.middleware.js";
import { requireTenant } from "../middlewares/tenant.middleware.js";

export const invoiceRoutes = Router();

invoiceRoutes.use("/api/invoices", authMiddleware, requireTenant);
invoiceRoutes.use("/api/reports", authMiddleware, requireTenant);

invoiceRoutes.get("/api/invoices", InvoiceController.listInvoices);
invoiceRoutes.post("/api/invoices", InvoiceController.createInvoice);
invoiceRoutes.patch("/api/invoices/:id/status", InvoiceController.updateStatus);

invoiceRoutes.post("/api/reports/ai-summary", InvoiceController.generateAiSummary);
