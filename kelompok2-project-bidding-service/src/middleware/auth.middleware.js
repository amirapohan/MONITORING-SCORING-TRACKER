const authInternalUrl = () => (
  process.env.AUTH_INTERNAL_URL ||
  process.env.AUTH_SERVICE_URL ||
  'http://svc-auth:8080'
).replace(/\/+$/, '');

const internalApiKey = () => process.env.INTERNAL_API_KEY || '';

const normalizeUserType = (role) => {
  const normalized = String(role || '').toLowerCase();
  if (normalized === 'talent' || normalized === 'student') return 'talent';
  if (normalized === 'client' || normalized === 'mitra') return 'client';
  if (normalized === 'admin') return 'admin';
  return normalized;
};

const verifyBearerToken = async (token) => {
  const response = await fetch(`${authInternalUrl()}/internal/validate-token`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-internal-api-key': internalApiKey(),
      Accept: 'application/json'
    },
    body: JSON.stringify({ token })
  });

  if (!response.ok) {
    throw new Error(`Identity service rejected token with ${response.status}`);
  }

  const body = await response.json().catch(() => ({}));
  const payload = (body && body.data && body.data.user) || body.user || body;
  if (!payload || !payload.id) {
    throw new Error('Identity service returned invalid user payload');
  }

  return {
    id: String(payload.id),
    type: normalizeUserType(payload.role || payload.type),
    role: payload.role,
    email: payload.email,
    name: payload.name
  };
};

const authMiddleware = async (req, res, next) => {
  try {
    const authorization = req.headers.authorization || '';
    const bearerMatch = authorization.match(/^Bearer\s+(.+)$/i);
    if (bearerMatch) {
      req.user = await verifyBearerToken(bearerMatch[1].trim());
      return next();
    }
    const userId = req.headers['x-user-id'];
    const userType = req.headers['x-user-type'];
    if (!userId || !userType) {
      return res.status(401).json({
        success: false,
        message: 'Missing required headers: X-User-ID and X-User-Type',
        code: 'MISSING_AUTH_HEADERS'
      });
    }
    const normalizedUserType = normalizeUserType(userType);
    const validUserTypes = ['talent', 'client', 'admin'];
    if (!validUserTypes.includes(normalizedUserType)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid X-User-Type. Must be "talent", "client"/"mitra", or "admin"',
        code: 'INVALID_USER_TYPE'
      });
    }
    req.user = {
      id: String(userId),
      type: normalizedUserType
    };
    next();

  } catch (error) {
    console.error('Auth middleware error:', error);
    return res.status(401).json({
      success: false,
      message: 'Authentication error',
      code: 'AUTH_ERROR',
      error: error.message
    });
  }
};

module.exports = authMiddleware;
