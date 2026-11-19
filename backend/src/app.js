const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const routes = require('./routes');
const config = require('./config/environment');
const { errorHandler } = require('./middleware/error.middleware');
const { notFound } = require('./utils/api-response');

const app = express();

// Trust reverse proxy (e.g. Nginx, Docker bridge, AWS ALB) in production
if (config.isProd) {
  app.set('trust proxy', 1);
}

// CORS Configuration
let corsOptions = { credentials: true };
if (config.corsOrigin && config.corsOrigin !== '*') {
  const allowedOrigins = config.corsOrigin.split(',').map((o) => o.trim());
  corsOptions.origin = (origin, callback) => {
    // Allow requests with no origin (mobile apps, curl, server-to-server)
    if (!origin || allowedOrigins.includes(origin) || allowedOrigins.includes('*')) {
      return callback(null, true);
    }
    return callback(new Error(`Origin ${origin} not allowed by CORS policy`));
  };
} else {
  corsOptions.origin = true;
}

// Middleware
app.use(cors(corsOptions));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Production security headers
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  next();
});

// Logging: Combined in production, dev in development, disabled in test
if (process.env.NODE_ENV === 'production') {
  app.use(morgan('combined'));
} else if (process.env.NODE_ENV !== 'test') {
  app.use(morgan('dev'));
}

// API Routes
app.use('/api', routes);

// Root route
app.get('/', (req, res) => {
  res.json({
    app: 'Mentora API',
    tagline: 'Understand. Visualize. Learn.',
    status: 'Running',
    version: '1.0.0',
    environment: config.env,
    documentation: '/api/health',
  });
});

// 404 handler for undefined routes
app.use((req, res) => {
  return notFound(res, `Route not found: ${req.method} ${req.originalUrl}`);
});

// Centralized error handler
app.use(errorHandler);

module.exports = app;

