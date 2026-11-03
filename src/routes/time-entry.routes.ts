import { Router } from "express";
import { TimeEntryController } from "../controllers/time-entry.controller.js";
import { authMiddleware } from "../middlewares/auth.middleware.js";

export const timeEntryRoutes = Router();

timeEntryRoutes.use(authMiddleware);

timeEntryRoutes.post("/time-entries/start", TimeEntryController.start);
timeEntryRoutes.patch("/time-entries/:id/stop", TimeEntryController.stop);
timeEntryRoutes.get("/time-entries/active", TimeEntryController.getActive);
timeEntryRoutes.get("/time-entries", TimeEntryController.list);
