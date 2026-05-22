// Lindungi endpoint internal (service-to-service) dengan shared key, BUKAN JWT.
// Service lain (mis. K4 Tracker) memanggil dengan header x-internal-api-key.
// Memakai INTERNAL_API_KEY yang sama yang sudah dipakai K2 untuk memanggil K1.
const internalApiKey = () => process.env.INTERNAL_API_KEY || ''

const internalApiKeyMiddleware = (req, res, next) => {
  const provided = req.headers['x-internal-api-key'] || ''
  const expected = internalApiKey()

  if (!expected || provided !== expected) {
    return res.status(401).json({
      success: false,
      message: 'Invalid or missing internal API key',
      code: 'INVALID_INTERNAL_KEY'
    })
  }

  next()
}

module.exports = internalApiKeyMiddleware
