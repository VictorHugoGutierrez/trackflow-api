import { FastifyInstance } from "fastify";
import { TimeEntryController } from "../controllers/time-entry.controller.js";
import { authMiddleware } from "../middlewares/auth.middleware.js";

export async function timeEntryRoutes(app: FastifyInstance) {
  app.addHook("preHandler", authMiddleware);

  app.post("/api/time-entries/start", TimeEntryController.start);
  app.patch("/api/time-entries/:id/stop", TimeEntryController.stop);
  app.get("/api/time-entries/active", TimeEntryController.getActive);
  app.get("/api/time-entries", TimeEntryController.list);
}
