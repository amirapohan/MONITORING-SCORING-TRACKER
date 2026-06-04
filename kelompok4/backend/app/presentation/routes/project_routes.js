const express = require("express");
const projectCompletionService = require("../../services/project_completion_service");
const { buildErrorResponse } = require("../../core/api_error");

const router = express.Router();

router.post("/:projectId/complete", async (req, res) => {
  try {
    const result = await projectCompletionService.completeProject(req.params.projectId, req.body);

    res.status(201).json({
      data: result,
      message: "Project completed successfully",
    });
  } catch (error) {
    res.status(error.statusCode || 500).json(buildErrorResponse(error));
  }
});

module.exports = router;
