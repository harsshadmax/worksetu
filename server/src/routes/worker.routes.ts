import { Router } from "express";
import { requireProvider } from "../middleware/auth";
import * as workerController from "../controllers/worker.controller";

const router = Router();

router.patch("/me/availability", requireProvider, workerController.updateAvailability);

export default router;
