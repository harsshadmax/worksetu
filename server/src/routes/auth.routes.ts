import { Router } from "express";
import * as authController from "../controllers/auth.controller";
import { requireAnyRole } from "../middleware/auth";

const router = Router();

router.post("/customer/register", authController.registerCustomer);
router.post("/customer/login", authController.loginCustomer);
router.post("/worker/register", authController.registerWorker);
router.post("/worker/login", authController.loginWorker);
// No POST /auth/admin/register — Section 7.4: admin accounts are
// provisioned only by direct DB seed/migration, never a public endpoint.
router.post("/admin/login", authController.loginAdmin);

router.post("/refresh", authController.refresh);
router.post("/logout", requireAnyRole, authController.logout);
router.post("/logout-all", requireAnyRole, authController.logoutAll);

router.post("/password-reset/request", authController.passwordResetRequest);
router.post("/password-reset/confirm", authController.passwordResetConfirm);
router.post("/verify-otp", requireAnyRole, authController.verifyOtp);

export default router;
