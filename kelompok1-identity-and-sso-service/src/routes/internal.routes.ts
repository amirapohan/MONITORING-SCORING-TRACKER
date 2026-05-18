import { Router } from "express";
import { body, param } from "express-validator";

import { internalController } from "../controllers/internal.controller";
import { validate } from "../middlewares/validate";

const router = Router();

const projectCompletionValidation = [
  body("talent_id").isUUID().withMessage("talent_id must be a valid UUID"),
  body("project_id").trim().notEmpty().withMessage("project_id is required"),
  body("token_id").trim().notEmpty().withMessage("token_id is required"),
  body("ipfs_uri").trim().notEmpty().withMessage("ipfs_uri is required"),
  body("completion_date")
    .isISO8601()
    .withMessage("completion_date must be a valid ISO date"),
];

router.get("/users/:id", internalController.getUser);
router.get("/users", internalController.listUsers);
router.post("/validate-token", internalController.validateToken);
router.get("/audit-logs", internalController.listAuditLogs);
router.post(
  "/project-completions",
  projectCompletionValidation,
  validate,
  internalController.createProjectCompletion,
);
router.get(
  "/talents/:talentId/project-completions",
  param("talentId").isUUID().withMessage("talentId must be a valid UUID"),
  validate,
  internalController.listProjectCompletions,
);

export default router;
