require('dotenv').config();

module.exports = {
  database: {
    host: process.env.DATABASE_HOST || 'db-match',
    port: parseInt(process.env.DATABASE_PORT || '5432', 10),
    user: process.env.DATABASE_USER || 'match',
    password: process.env.DATABASE_PASSWORD || 'match',
    database: process.env.DATABASE_NAME || 'match',
    url: process.env.DATABASE_URL,
  },
  app: {
    env: process.env.NODE_ENV || 'development',
    port: parseInt(process.env.PORT || '8080', 10),
  },
  mockSSO: {
    url: process.env.MOCK_SSO_URL || 'http://svc-auth:8080',
    secret: process.env.MOCK_SSO_SECRET || '',
  },
};
