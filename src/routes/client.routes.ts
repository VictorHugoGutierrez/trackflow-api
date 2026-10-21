import { Router } from "express";
import { ClientController } from "../controllers/client.controller.js";
import { authMiddleware } from "../middlewares/auth.middleware.js";

export const clientRoutes = Router();

clientRoutes.use(authMiddleware);

clientRoutes.post("/clients", ClientController.createClient);
clientRoutes.get("/clients", ClientController.getClients);
clientRoutes.patch("/clients/:id", ClientController.alterClient);
clientRoutes.delete("/clients/:id", ClientController.deleteClient);
