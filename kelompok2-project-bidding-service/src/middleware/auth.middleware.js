/**
 * Auth Middleware
 * 
 * Middleware ini melakukan:
 * 1. Extract user info dari request headers
 * 2. Validasi bahwa user_id dan user_type ada
 * 3. Attach info ke req.user untuk digunakan di controller/service
 * 
 * Expected Headers:
 * - X-User-ID: ID dari user (mahasiswa_id atau mitra_id)
 * - X-User-Type: Tipe user ('talent' atau 'mitra')
 */

const authInternalUrl = () => (
  process.env.AUTH_INTERNAL_URL ||
  process.env.AUTH_SERVICE_URL ||
  'http://svc-auth:8080'
).replace(/\/+$/, '');

const internalApiKey = () => process.env.INTERNAL_API_KEY || '';

const mapRoleToUserType = (role) => {
  if (role === 'talent' || role === 'student') return 'talent';
  if (role === 'client' || role === 'mitra') return 'mitra';
  return role;
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
    type: mapRoleToUserType(payload.role),
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

    // Extract dari header (case-insensitive di Express)
    const userId = req.headers['x-user-id'];
    const userType = req.headers['x-user-type'];

    // Validasi: kedua field harus ada
    if (!userId || !userType) {
      return res.status(401).json({   // 401 = Unauthorized
        success: false,
        message: 'Missing required headers: X-User-ID and X-User-Type',
        code: 'MISSING_AUTH_HEADERS'
      });
    }

    // Validasi: user_type harus talent atau mitra
    const validUserTypes = ['talent', 'mitra'];
    if (!validUserTypes.includes(userType.toLowerCase())) {
      return res.status(400).json({    // 400 = Bad Request
        success: false,
        message: 'Invalid X-User-Type. Must be "talent" or "mitra"',
        code: 'INVALID_USER_TYPE'
      });
    }

    // Attach user info ke request object
    // Ini bisa diakses di controller dengan: req.user.id, req.user.type
    req.user = {
      id: String(userId),
      type: userType.toLowerCase()
    };

    // Lanjut ke middleware/controller berikutnya
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
