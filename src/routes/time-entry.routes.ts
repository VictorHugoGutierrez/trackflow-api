import { Router } from "express";
import { TimeEntryController } from "../controllers/time-entry.controller.js";
import { authMiddleware } from "../middlewares/auth.middleware.js";
import { requireTenant } from "../middlewares/tenant.middleware.js";

export const timeEntryRoutes = Router();

timeEntryRoutes.use("/api/time-entries", authMiddleware, requireTenant);

timeEntryRoutes.post("/api/time-entries/start", TimeEntryController.start);
timeEntryRoutes.patch("/api/time-entries/:id/stop", TimeEntryController.stop);
timeEntryRoutes.get("/api/time-entries/active", TimeEntryController.getActive);
timeEntryRoutes.get("/api/time-entries", TimeEntryController.list);
timeEntryRoutes.post("/api/time-entries", TimeEntryController.createManual);
timeEntryRoutes.patch("/api/time-entries/:id", TimeEntryController.update);
timeEntryRoutes.delete("/api/time-entries/:id", TimeEntryController.delete);
