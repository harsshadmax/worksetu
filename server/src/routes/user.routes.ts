import { Router } from "express";
import { requireAnyRole } from "../middleware/auth";
import { authenticatedRateLimit } from "../middleware/rate-limit";
import { updateProfile, updatePreferences } from "../controllers/user.controller";

const router = Router();

router.patch("/me", requireAnyRole, authenticatedRateLimit, updateProfile);
router.patch("/me/preferences", requireAnyRole, authenticatedRateLimit, updatePreferences);

export default router;
