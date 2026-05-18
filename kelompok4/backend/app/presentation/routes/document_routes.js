const express = require("express");
const documentService = require("../../services/document_service");
const { buildErrorResponse } = require("../../core/api_error");
const { handleDocumentUpload } = require("../middleware/document_upload");

const router = express.Router();

router.post("/", async (req, res) => {
  try {
    await handleDocumentUpload(req, res);

    const document = await documentService.createDocument(req.body, req.file);

    res.status(201).json({
      data: document,
      message: "Document created successfully",
    });
  } catch (error) {
    res.status(error.statusCode || 500).json(buildErrorResponse(error));
  }
});

router.get("/team/:teamId", async (req, res) => {
  try {
    const documents = await documentService.listDocumentsByTeam(req.params.teamId);

    res.status(200).json({
      data: documents,
      message: "Documents retrieved successfully",
    });
  } catch (error) {
    res.status(error.statusCode || 500).json(buildErrorResponse(error));
  }
});

router.get("/:id/download", async (req, res) => {
  try {
    const download = await documentService.getDocumentDownload(req.params.id);

    res.status(200).json({
      data: download,
      message: "Document download link retrieved successfully",
    });
  } catch (error) {
    res.status(error.statusCode || 500).json(buildErrorResponse(error));
  }
});

router.get("/:id", async (req, res) => {
  try {
    const document = await documentService.getDocumentDetail(req.params.id);

    res.status(200).json({
      data: document,
      message: "Document retrieved successfully",
    });
  } catch (error) {
    res.status(error.statusCode || 500).json(buildErrorResponse(error));
  }
});

router.post("/:id/review", async (req, res) => {
  try {
    const review = await documentService.createDocumentReview(req.params.id, req.body);

    res.status(201).json({
      data: review,
      message: "Document review created successfully",
    });
  } catch (error) {
    res.status(error.statusCode || 500).json(buildErrorResponse(error));
  }
});

module.exports = router;
