// Cross-service user lookup.
//
// `users` are owned by the Identity & SSO service (group 1), not this service,
// so the milestone-submission review flow resolves a reviewer's id/role via
// svc-auth's internal API instead of a local `users` table.
//
//   GET {AUTH_INTERNAL_URL}/internal/users/:id   header: X-API-key
//
// Returns { id, role } or null when the user does not exist.

function getAuthInternalBaseUrl() {
  return (
    process.env.AUTH_INTERNAL_URL ||
    process.env.AUTH_SERVICE_URL ||
    "http://svc-auth:8080"
  ).replace(/\/+$/, "");
}

function getInternalApiKey() {
  return process.env.INTERNAL_API_KEY || "";
}

function normalizeUser(body) {
  if (!body || typeof body !== "object") {
    return null;
  }

  // svc-auth returns { success, message, data: { user: {...} } }.
  // Also tolerate {data:{...}} | {user:{...}} | {...} shapes.
  const data = body.data || body;
  const user = data.user || data;

  if (!user || !user.id) {
    return null;
  }

  return {
    id: user.id,
    role: user.role,
  };
}

async function getUserById(id) {
  const url = `${getAuthInternalBaseUrl()}/internal/users/${encodeURIComponent(id)}`;

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
      `Identity service returned ${response.status} while resolving user '${id}'`,
    );
    error.statusCode = 502;
    throw error;
  }

  const body = await response.json().catch(() => null);
  return normalizeUser(body);
}

module.exports = {
  getUserById,
};
