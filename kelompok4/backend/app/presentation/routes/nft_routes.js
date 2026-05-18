const express = require("express");
const nftService = require("../../services/nft_service");
const { buildErrorResponse } = require("../../core/api_error");

const router = express.Router();

router.get("/team/:teamId", async (req, res) => {
  try {
    const nftRecords = await nftService.listNftsByTeam(req.params.teamId);

    res.status(200).json({
      data: nftRecords,
      message: "NFT records retrieved successfully",
    });
  } catch (error) {
    res.status(error.statusCode || 500).json(buildErrorResponse(error));
  }
});

router.get("/:id/verify", async (req, res) => {
  try {
    const result = await nftService.verifyNft(req.params.id);

    res.status(200).json({
      data: result,
      message: "NFT verification completed successfully",
    });
  } catch (error) {
    res.status(error.statusCode || 500).json(buildErrorResponse(error));
  }
});

module.exports = router;
