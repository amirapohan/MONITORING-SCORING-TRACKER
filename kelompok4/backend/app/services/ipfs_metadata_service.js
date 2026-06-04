const { configurationError } = require("../core/api_error");

function getPinataJwt() {
  const value = process.env.PINATA_JWT;

  if (!value || !value.trim()) {
    throw configurationError("Missing required environment variable: PINATA_JWT");
  }

  return value.trim();
}

function formatPinataError(body, statusText) {
  if (!body) {
    return statusText;
  }

  if (typeof body === "string") {
    return body;
  }

  if (body.error && typeof body.error === "string") {
    return body.error;
  }

  if (body.error && typeof body.error === "object") {
    const reason = body.error.reason || body.error.message;
    const details = body.error.details;
    if (reason && details) {
      return `${reason}: ${details}`;
    }

    if (reason) {
      return reason;
    }
  }

  if (body.message) {
    return body.message;
  }

  return statusText;
}

async function pinMetadataJson(metadata) {
  const response = await fetch("https://api.pinata.cloud/pinning/pinJSONToIPFS", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${getPinataJwt()}`,
    },
    body: JSON.stringify({
      pinataContent: metadata,
      pinataMetadata: {
        name: metadata.name || "certificate-metadata",
      },
    }),
  });

  const body = await response.json().catch(() => null);

  if (!response.ok || !body || !body.IpfsHash) {
    throw configurationError(
      `Pinata metadata upload failed: ${formatPinataError(body, response.statusText)}`,
    );
  }

  return {
    cid: body.IpfsHash,
    metadataUri: `ipfs://${body.IpfsHash}`,
  };
}

module.exports = {
  pinMetadataJson,
};
