const app = require('./app');
const config = require('./config/environment');
const prisma = require('./config/database');

const server = app.listen(config.port, async () => {
  console.log(`=========================================`);
  console.log(` Mentora Backend Server Running on :${config.port}`);
  console.log(` Environment: ${config.env}`);
  console.log(` Database: Connected via Prisma`);
  console.log(` AI Service Target: ${config.aiServiceUrl}`);
  console.log(`=========================================`);

  try {
    await prisma.$connect();
    console.log('PostgreSQL database connection established successfully.');
  } catch (error) {
    console.error('Failed to connect to PostgreSQL database:', error.message);
  }
});

// Graceful shutdown
const shutdown = async () => {
  console.log('\nShutting down Mentora backend gracefully...');
  server.close(async () => {
    await prisma.$disconnect();
    console.log('Database disconnected. Process terminated.');
    process.exit(0);
  });
};

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

