import { Router } from "express";
import { publicRateLimit } from "../middleware/rate-limit";
import { getPlatformStats } from "../controllers/public.controller";

const router = Router();

router.get("/stats", publicRateLimit, getPlatformStats);

export default router;
