const express = require('express');
const router = express.Router();
const authController = require('../controllers/auth.controller');
const { validateRegister, validateLogin } = require('../middleware/validation.middleware');
const { authenticate } = require('../middleware/auth.middleware');

// Public auth routes
router.post('/register', validateRegister, authController.register);
router.post('/login', validateLogin, authController.login);
router.post('/logout', authController.logout);

// Protected auth routes
router.get('/me', authenticate, authController.me);

module.exports = router;

