const dotenv = require('dotenv');
const path = require('path');

// Load environment variables from .env file
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const isProd = process.env.NODE_ENV === 'production';
const jwtSecret = process.env.JWT_SECRET || 'mentora_fallback_secret_key_2026';

if (isProd) {
  if (jwtSecret === 'mentora_fallback_secret_key_2026' || jwtSecret.length < 32) {
    console.warn('\x1b[33m%s\x1b[0m', '[SECURITY WARNING] Production environment detected with default/short JWT_SECRET. Please configure a cryptographically secure 32+ character JWT_SECRET.');
  }
}

const config = {
  env: process.env.NODE_ENV || 'development',
  isProd,
  port: parseInt(process.env.PORT, 10) || 5000,
  databaseUrl: process.env.DATABASE_URL,
  corsOrigin: process.env.CORS_ORIGIN || '*',
  jwt: {
    secret: jwtSecret,
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  },
  aiServiceUrl: process.env.AI_SERVICE_URL || 'http://localhost:8000',
  upload: {
    dir: process.env.UPLOAD_DIR || './uploads',
    maxSizeMb: parseInt(process.env.MAX_FILE_SIZE_MB, 10) || 25,
  }
};

module.exports = config;

