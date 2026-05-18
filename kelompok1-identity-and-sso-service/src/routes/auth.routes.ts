import { Router } from "express";
import { body } from "express-validator";

import { authController } from "../controllers/auth.controller";
import authenticate from "../middlewares/authenticate";
import authorize from "../middlewares/authorize";
import { createRateLimiter } from "../middlewares/rateLimit";
import { validate } from "../middlewares/validate";

const loginLimiter = createRateLimiter({ windowMs: 15 * 60 * 1000, max: 10, keyPrefix: "login" });
const registerLimiter = createRateLimiter({ windowMs: 60 * 60 * 1000, max: 5, keyPrefix: "register" });

const router = Router();

const baseRegisterValidation = [
  body("name").trim().notEmpty().withMessage("Name is required"),
  body("email").isEmail().withMessage("Valid email is required").normalizeEmail(),
  body("password")
    .isLength({ min: 8 })
    .withMessage("Password must be at least 8 characters"),
];

const publicRegisterValidation = [
  ...baseRegisterValidation,
  body("role")
    .optional()
    .isIn(["talent", "client"])
    .withMessage("Role must be talent or client"),
];

const adminRegisterValidation = [
  ...baseRegisterValidation,
  body("role")
    .optional()
    .isIn(["talent", "client", "admin"])
    .withMessage("Role must be talent, client, or admin"),
];

const loginValidation = [
  body("email").isEmail().withMessage("Valid email is required").normalizeEmail(),
  body("password").notEmpty().withMessage("Password is required"),
];

const updateProfileValidation = [
  body("name").optional().trim().notEmpty().withMessage("Name cannot be empty"),
  body("password")
    .optional()
    .isLength({ min: 8 })
    .withMessage("Password must be at least 8 characters"),
];

// Public
router.post("/register", registerLimiter, publicRegisterValidation, validate, authController.register);
router.post("/login", loginLimiter, loginValidation, validate, authController.login);
router.post("/refresh", authController.refreshToken);

// Protected
router.post(
  "/logout",
  authenticate,
  authorize(["talent", "client", "admin"]),
  authController.logout,
);
router.get(
  "/profile",
  authenticate,
  authorize(["talent", "client", "admin"]),
  authController.getProfile,
);
router.put(
  "/profile",
  authenticate,
  authorize(["talent", "client", "admin"]),
  updateProfileValidation,
  validate,
  authController.updateProfile,
);

// Admin-only
router.post(
  "/register/admin",
  authenticate,
  authorize(["admin"]),
  adminRegisterValidation,
  validate,
  authController.register,
);
router.patch(
  "/users/:id/deactivate",
  authenticate,
  authorize(["admin"]),
  authController.deactivateUser,
);

export default router;
