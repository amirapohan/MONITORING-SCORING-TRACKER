const appName = 'team-matching-service';
const config = require('./config/database');
const prisma = require('./core/prisma');
const rabbitmq = require('./utils/rabbitmq');
const { startIdentityConsumer } = require('./consumers/identityConsumer');

async function main() {
  console.log(`${appName} is running.`);
  console.log(`Environment: ${config.app.env}`);
  console.log(`Server port: ${config.app.port}`);

  try {
    console.log('\n[DB] Testing connection...');
    await prisma.$queryRaw`SELECT NOW()`;
    console.log('[DB] ✓ Connection successful');
  } catch (error) {
    console.error('[DB] ✗ Connection failed:', error.message);
    process.exit(1);
  }

  try {
    await rabbitmq.connect();
    await startIdentityConsumer();
  } catch (error) {
    console.warn('[RabbitMQ] Connection failed, events will be unavailable:', error.message);
  }

  console.log('\nApplication ready for development.\n');

  const app = require('./app');
  const server = app.listen(config.app.port, () => {
    console.log(`HTTP server listening on http://localhost:${config.app.port}`);
  });

  process.on('SIGINT', async () => {
    console.log('\nShutting down gracefully...');
    server.close(() => console.log('HTTP server closed'));
    await rabbitmq.close();
    await prisma.$disconnect();
    process.exit(0);
  });
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
