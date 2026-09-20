import { FastifyInstance } from "fastify";
import { ClientController } from "../controllers/client.controller.js";
import { authMiddleware } from "../middlewares/auth.middleware.js";


export async function clientRoutes(app: FastifyInstance) {
  app.addHook("onRequest", authMiddleware);
  app.post("/clients", ClientController.createClient);
  app.get("/clients", ClientController.getClients);
  app.patch("/clients/:id", ClientController.alterClient);
  app.delete("/clients/:id", ClientController.deleteClient);
}