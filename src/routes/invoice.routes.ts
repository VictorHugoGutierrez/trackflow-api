import { Router } from "express";
import { InvoiceController } from "../controllers/invoice.controller.js";
import { authMiddleware } from "../middlewares/auth.middleware.js";
import { requireTenant } from "../middlewares/tenant.middleware.js";
import { requireRole } from "../middlewares/role.middleware.js";

export const invoiceRoutes = Router();

const financeGuard = [
  authMiddleware,
  requireTenant,
  requireRole(
    ["OWNER", "MANAGER"],
    "Apenas proprietários e gestores possuem permissão para acessar relatórios e faturamento.",
  ),
];

invoiceRoutes.use("/api/reports", ...financeGuard);
invoiceRoutes.use("/api/invoices", ...financeGuard);

invoiceRoutes.get("/api/reports/summary", ...financeGuard, InvoiceController.getReportSummary);
invoiceRoutes.get("/api/reports/export/csv", authMiddleware, requireTenant, InvoiceController.exportCsv);
invoiceRoutes.post("/api/reports/ai-insight", ...financeGuard, InvoiceController.generateAiInsight);
invoiceRoutes.post("/api/reports/ai-summary", ...financeGuard, InvoiceController.generateAiInsight);

invoiceRoutes.get("/api/invoices", InvoiceController.listInvoices);
invoiceRoutes.get("/api/invoices/:id/pdf", InvoiceController.generatePdf);
invoiceRoutes.post("/api/invoices/generate", InvoiceController.generateInvoice);
invoiceRoutes.post("/api/invoices", InvoiceController.generateInvoice);
invoiceRoutes.post("/api/invoices/:id/send", InvoiceController.sendInvoice);
invoiceRoutes.patch("/api/invoices/:id/status", InvoiceController.updateStatus);
