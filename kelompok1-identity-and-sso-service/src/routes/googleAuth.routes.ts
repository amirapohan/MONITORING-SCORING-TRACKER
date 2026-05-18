import { Router } from "express";
import { body } from "express-validator";

import { googleAuthController } from "../controllers/googleAuth.controller";
import { createRateLimiter } from "../middlewares/rateLimit";
import { validate } from "../middlewares/validate";

const googleLoginLimiter = createRateLimiter({ windowMs: 15 * 60 * 1000, max: 10, keyPrefix: "google-login" });

const router = Router();

router.post(
  "/google",
  googleLoginLimiter,
  body("idToken").trim().notEmpty().withMessage("Google idToken is required"),
  validate,
  googleAuthController.login,
);

export default router;
