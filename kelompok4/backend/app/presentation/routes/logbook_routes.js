const express = require("express");
const logbookService = require("../../services/logbook_service");
const { buildErrorResponse } = require("../../core/api_error");

const router = express.Router();

router.post("/", async (req, res) => {
  try {
    const logbook = await logbookService.createLogbook(req.body);

    res.status(201).json({
      data: logbook,
      message: "Logbook created successfully",
    });
  } catch (error) {
    res.status(error.statusCode || 500).json(buildErrorResponse(error));
  }
});

router.get("/team/:teamId/latest", async (req, res) => {
  try {
    const latestLogbook = await logbookService.getLatestLogbookByTeam(
      req.params.teamId
    );

    res.status(200).json({
      data: latestLogbook,
      message: "Latest logbook retrieved successfully",
    });
  } catch (error) {
    res.status(error.statusCode || 500).json(buildErrorResponse(error));
  }
});

router.get("/team/:teamId", async (req, res) => {
  try {
    const logbooks = await logbookService.listLogbooksByTeam(req.params.teamId);

    res.status(200).json({
      data: logbooks,
      message: "Logbooks retrieved successfully",
    });
  } catch (error) {
    res.status(error.statusCode || 500).json(buildErrorResponse(error));
  }
});

module.exports = router;
