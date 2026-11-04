import { Router } from "express";
import { ClientController } from "../controllers/client.controller.js";
import { authMiddleware } from "../middlewares/auth.middleware.js";
import { requireTenant } from "../middlewares/tenant.middleware.js";

export const clientRoutes = Router();

clientRoutes.use("/api/clients", authMiddleware, requireTenant);

clientRoutes.post("/api/clients", ClientController.createClient);
clientRoutes.get("/api/clients", ClientController.getClients);
clientRoutes.patch("/api/clients/:id", ClientController.alterClient);
clientRoutes.delete("/api/clients/:id", ClientController.deleteClient);
