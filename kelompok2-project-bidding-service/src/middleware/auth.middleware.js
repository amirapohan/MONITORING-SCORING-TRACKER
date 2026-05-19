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

const authMiddleware = (req, res, next) => {
  try {
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
      id: userId,
      type: userType.toLowerCase()
    };

    // Lanjut ke middleware/controller berikutnya
    next();

  } catch (error) {
    console.error('Auth middleware error:', error);
    return res.status(500).json({
      success: false,
      message: 'Authentication error',
      code: 'AUTH_ERROR',
      error: error.message
    });
  }
};

module.exports = authMiddleware;
