import { Router } from "express";

import authRoutes from "./auth.routes";
import googleAuthRoutes from "./googleAuth.routes";

const router = Router();

router.use("/auth", authRoutes);
router.use("/auth", googleAuthRoutes);

router.get("/", (_req, res) => {
  res.json({
    success: true,
    message: "Welcome to identity-and-sso-service API",
    version: "1.0.0",
  });
});

export default router;
