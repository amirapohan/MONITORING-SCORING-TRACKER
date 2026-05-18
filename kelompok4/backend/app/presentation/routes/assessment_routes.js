const express = require("express");
const assessmentService = require("../../services/assessment_service");
const { buildErrorResponse } = require("../../core/api_error");

const router = express.Router();

router.post("/", async (req, res) => {
  try {
    const assessment = await assessmentService.createAssessment(req.body);

    res.status(201).json({
      data: assessment,
      message: "Assessment created successfully",
    });
  } catch (error) {
    res.status(error.statusCode || 500).json(buildErrorResponse(error));
  }
});

router.post("/:id/lock", async (req, res) => {
  try {
    const result = await assessmentService.lockAssessment(req.params.id);

    res.status(200).json({
      data: result,
      message: "Assessment locked successfully",
    });
  } catch (error) {
    res.status(error.statusCode || 500).json(buildErrorResponse(error));
  }
});

router.get("/team/:teamId", async (req, res) => {
  try {
    const { data, source } = await assessmentService.listAssessmentsByTeam(
      req.params.teamId
    );

    res.status(200).json({
      data,
      source, // "cache" = dari Redis, "repository" = dari PostgreSQL
      message: "Assessments retrieved successfully",
    });
  } catch (error) {
    res.status(error.statusCode || 500).json(buildErrorResponse(error));
  }
});

module.exports = router;
