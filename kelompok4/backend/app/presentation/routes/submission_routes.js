const express = require("express");
const submissionService = require("../../services/milestone_submission_service");
const { buildErrorResponse, validationError } = require("../../core/api_error");
const { handleSubmissionUpload } = require("../middleware/submission_upload");

const router = express.Router();

router.post("/", async (req, res) => {
  try {
    await handleSubmissionUpload(req, res);

    const submission = await submissionService.createSubmission(req.body, req.file);

    res.status(201).json({
      data: submission,
      message: "Submission created successfully",
    });
  } catch (error) {
    if (error instanceof SyntaxError) {
      res.status(400).json(buildErrorResponse(validationError("Field 'links' must be valid JSON")));
      return;
    }

    res.status(error.statusCode || 500).json(buildErrorResponse(error));
  }
});

router.get("/", async (req, res) => {
  try {
    const submissions = await submissionService.listSubmissions(req.query);

    res.status(200).json({
      data: submissions,
      message: "Submissions retrieved successfully",
    });
  } catch (error) {
    res.status(error.statusCode || 500).json(buildErrorResponse(error));
  }
});

router.get("/:id/download", async (req, res) => {
  try {
    const download = await submissionService.getSubmissionDownload(req.params.id);

    res.status(200).json({
      data: download,
      message: "Submission download link retrieved successfully",
    });
  } catch (error) {
    res.status(error.statusCode || 500).json(buildErrorResponse(error));
  }
});

router.post("/:id/review", async (req, res) => {
  try {
    const review = await submissionService.createSubmissionReview(req.params.id, req.body);

    res.status(201).json({
      data: review,
      message: "Submission review created successfully",
    });
  } catch (error) {
    res.status(error.statusCode || 500).json(buildErrorResponse(error));
  }
});

router.get("/:id", async (req, res) => {
  try {
    const submission = await submissionService.getSubmissionDetail(req.params.id);

    res.status(200).json({
      data: submission,
      message: "Submission retrieved successfully",
    });
  } catch (error) {
    res.status(error.statusCode || 500).json(buildErrorResponse(error));
  }
});

module.exports = router;
