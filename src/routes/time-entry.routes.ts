import { Router } from "express";
import { TimeEntryController } from "../controllers/time-entry.controller.js";
import { authMiddleware } from "../middlewares/auth.middleware.js";

export const timeEntryRoutes = Router();

timeEntryRoutes.use(authMiddleware);

timeEntryRoutes.post("/api/time-entries/start", TimeEntryController.start);
timeEntryRoutes.patch("/api/time-entries/:id/stop", TimeEntryController.stop);
timeEntryRoutes.get("/api/time-entries/active", TimeEntryController.getActive);
timeEntryRoutes.get("/api/time-entries", TimeEntryController.list);
