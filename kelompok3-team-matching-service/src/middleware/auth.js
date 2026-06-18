const config = require('../config/database');

// Internal API key shared with the Identity & SSO service (svc-auth).
function internalApiKey() {
  return process.env.INTERNAL_SERVICE_KEY || config.mockSSO.secret || '';
}

// Base URL of svc-auth (MOCK_SSO_URL in nexus, e.g. http://svc-auth:8080).
function authBaseUrl() {
  return String(config.mockSSO.url || '').replace(/\/+$/, '');
}

// svc-auth roles -> team-matching role vocabulary.
function mapRole(role) {
  if (role === 'talent') return 'student';
  return role; // client / admin pass through
}

// Validate a bearer token against svc-auth's real internal endpoint:
//   POST {auth}/internal/validate-token   header: x-internal-api-key
//   body: { token }   ->   { success, data: { user: <jwt payload> } }
async function verifyTokenWithSSO(token) {
  const url = `${authBaseUrl()}/internal/validate-token`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-internal-api-key': internalApiKey(),
      Accept: 'application/json',
    },
    body: JSON.stringify({ token }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    const err = new Error('invalid_token');
    err.detail = text;
    err.status = res.status;
    throw err;
  }

  const body = await res.json().catch(() => ({}));
  const payload = (body && body.data && body.data.user) || body.user || body;

  if (!payload || !payload.id) {
    const err = new Error('invalid_token');
    err.status = 401;
    throw err;
  }

  // Shape expected by downstream handlers (req.user.student_id / role).
  return {
    ...payload,
    student_id: payload.id,
    student_name: payload.name || 'Unknown Student',
    auth_role: payload.role,
    role: mapRole(payload.role),
  };
}

/** Express middleware to protect routes using the real Identity & SSO service */
async function authMiddleware(req, res, next) {
  try {
    const auth = req.get('authorization') || '';
    const m = auth.match(/Bearer\s+(.+)/i);
    if (!m) return res.status(401).json({ error: 'missing_token' });

    const token = m[1].trim();

    // ==========================================
    // TOKEN LOKAL
    // ==========================================
    if (token === 'POToken') {
      req.user = { 
        student_id: 'nim-po-001', 
        student_name: 'Product Owner', 
        role: 'student',
        program_studi: 'Teknologi Informasi'
      };
      return next();
    }

    if (token === 'TalentToken') {
      req.user = { 
        student_id: 'nim-talent-001', 
        student_name: 'Talent', 
        role: 'student',
        program_studi: 'Teknologi Informasi'
      };
      return next();
    }

    if (token === 'ClientToken') {
      req.user = { 
        student_id: 'nim-client-001', 
        student_name: 'Client User', 
        role: 'student', 
        program_studi: 'Sistem Informasi'
      };
      return next();
    }
    // ==========================================

    // Jika token bukan salah satu dari token lokal di atas, 
    // sistem akan otomatis melemparnya ke SSO asli.
    const user = await verifyTokenWithSSO(token);

    // Attach user info to request for downstream handlers
    req.user = user;
    return next();
  } catch (err) {
    return res.status(401).json({ error: 'invalid_token' });
  }
}

module.exports = authMiddleware;
module.exports.verifyTokenWithSSO = verifyTokenWithSSO;