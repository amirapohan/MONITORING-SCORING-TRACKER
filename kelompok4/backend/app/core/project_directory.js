// Cross-service project lookup.
//
// `projects` & `bids` dimiliki Project Bidding service (kelompok 2), bukan
// service ini. Untuk menautkan milestone ke project + memverifikasi bahwa
// talent sudah "awarded" (bid Accepted), K4 memanggil internal API K2:
//
//   GET {BIDDING_INTERNAL_URL}/internal/projects/:id   header: x-internal-api-key
//
// Mengembalikan { id, status, clientId, acceptedTalentIds: [...] } atau null
// bila project tidak ada. Pola sama dengan user_directory.js (K4 -> K1).

function getBiddingInternalBaseUrl() {
  return (
    process.env.BIDDING_INTERNAL_URL ||
    process.env.BIDDING_SERVICE_URL ||
    "http://svc-bidding:8080"
  ).replace(/\/+$/, "");
}

function getInternalApiKey() {
  return process.env.INTERNAL_API_KEY || "";
}

function normalizeProject(body) {
  if (!body || typeof body !== "object") {
    return null;
  }

  // Tolerate { data: {...} } | { project: {...} } | {...} shapes.
  const data = body.data || body;
  const project = data.project || data;

  if (!project || project.id === undefined || project.id === null) {
    return null;
  }

  const acceptedTalentIds = Array.isArray(project.acceptedTalentIds)
    ? project.acceptedTalentIds.map((value) => String(value))
    : [];

  return {
    id: String(project.id),
    title: project.title ?? project.projectTitle ?? null,
    status: project.status ?? null,
    clientId: project.clientId ?? project.mitraId ?? null,
    acceptedTalentIds,
  };
}

async function getProjectById(projectId) {
  const url = `${getBiddingInternalBaseUrl()}/internal/projects/${encodeURIComponent(projectId)}`;

  const response = await fetch(url, {
    method: "GET",
    headers: {
      "x-internal-api-key": getInternalApiKey(),
      Accept: "application/json",
    },
  });

  if (response.status === 404) {
    return null;
  }

  if (!response.ok) {
    const error = new Error(
      `Bidding service returned ${response.status} while resolving project '${projectId}'`,
    );
    error.statusCode = 502;
    throw error;
  }

  const body = await response.json().catch(() => null);
  return normalizeProject(body);
}

module.exports = {
  getProjectById,
};
