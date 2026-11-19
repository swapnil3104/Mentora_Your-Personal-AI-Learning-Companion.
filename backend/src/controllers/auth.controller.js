const authService = require('../services/auth.service');
const { success, created } = require('../utils/api-response');

/**
 * Register Controller
 */
const register = async (req, res, next) => {
  try {
    const { name, email, password } = req.body;
    const result = await authService.registerUser({ name, email, password });
    return created(res, result, 'Registration successful');
  } catch (error) {
    next(error);
  }
};

/**
 * Login Controller
 */
const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;
    const result = await authService.loginUser({ email, password });
    return success(res, result, 'Login successful');
  } catch (error) {
    next(error);
  }
};

/**
 * Logout Controller
 */
const logout = async (req, res, next) => {
  try {
    // For JWT, token invalidation is typically handled client-side by discarding the token,
    // or through a token blacklist. Mentora returns success response.
    return success(res, null, 'Logged out successfully');
  } catch (error) {
    next(error);
  }
};

/**
 * Get Current User Profile Controller
 */
const me = async (req, res, next) => {
  try {
    const userProfile = await authService.getUserProfile(req.user.id);
    return success(res, userProfile, 'User profile retrieved');
  } catch (error) {
    next(error);
  }
};

module.exports = {
  register,
  login,
  logout,
  me,
};

