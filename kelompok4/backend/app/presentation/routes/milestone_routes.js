const express = require("express");
const milestoneService = require("../../services/milestone_service");
const { buildErrorResponse } = require("../../core/api_error");

const router = express.Router();

router.post("/", async (req, res) => {
  try {
    const milestone = await milestoneService.createMilestone(req.body);

    res.status(201).json({
      data: milestone,
      message: "Milestone created successfully",
    });
  } catch (error) {
    res.status(error.statusCode || 500).json(buildErrorResponse(error));
  }
});

router.get("/", async (req, res) => {
  try {
    const milestones = await milestoneService.listMilestones(req.query);

    res.status(200).json({
      data: milestones,
      message: "Milestones retrieved successfully",
    });
  } catch (error) {
    res.status(error.statusCode || 500).json(buildErrorResponse(error));
  }
});

router.get("/:id", async (req, res) => {
  try {
    const milestone = await milestoneService.getMilestoneById(req.params.id, {
      actorId: req.query.actorId,
      actorRole: req.query.actorRole,
    });

    res.status(200).json({
      data: milestone,
      message: "Milestone retrieved successfully",
    });
  } catch (error) {
    res.status(error.statusCode || 500).json(buildErrorResponse(error));
  }
});

router.patch("/:id", async (req, res) => {
  try {
    const milestone = await milestoneService.updateMilestone(req.params.id, req.body);

    res.status(200).json({
      data: milestone,
      message: "Milestone updated successfully",
    });
  } catch (error) {
    res.status(error.statusCode || 500).json(buildErrorResponse(error));
  }
});

module.exports = router;
