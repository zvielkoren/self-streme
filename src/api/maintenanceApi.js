/**
 * Maintenance Mode API Routes
 *
 * Provides API endpoints for controlling and monitoring maintenance mode.
 *
 * Endpoints:
 * - GET  /api/maintenance/status - Get current maintenance status
 * - POST /api/maintenance/enable - Enable maintenance mode (admin only)
 * - POST /api/maintenance/disable - Disable maintenance mode (admin only)
 */

import express from 'express';
import maintenanceMode from '../utils/maintenanceMode.js';
import logger from '../utils/logger.js';

const router = express.Router();

/**
 * Middleware to check admin access
 * Requires ADMIN_TOKEN in header or query parameter
 */
function requireAdmin(req, res, next) {
  const adminToken = process.env.ADMIN_TOKEN || 'admin123'; // Change this in production!

  // Check header
  const headerToken = req.headers['x-admin-token'];
  // Check query parameter
  const queryToken = req.query.admin_token;

  if (headerToken === adminToken || queryToken === adminToken) {
    return next();
  }

  logger.warn(`[Maintenance API] Unauthorized access attempt from ${req.ip}`);
  return res.status(401).json({
    error: 'Unauthorized',
    message: 'Admin token required. Set X-Admin-Token header or admin_token query parameter.'
  });
}

/**
 * GET /api/maintenance/status
 * Get current maintenance status (public endpoint)
 */
router.get('/status', (req, res) => {
  try {
    const status = maintenanceMode.getStatus();

    res.json({
      success: true,
      ...status
    });
  } catch (error) {
    logger.error('[Maintenance API] Error getting status:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to get maintenance status'
    });
  }
});

/**
 * POST /api/maintenance/enable
 * Enable maintenance mode (admin only)
 *
 * Body:
 * {
 *   "message": "Custom maintenance message (optional)",
 *   "estimatedEndTime": "2025-11-21T10:00:00Z (optional)"
 * }
 */
router.post('/enable', requireAdmin, (req, res) => {
  try {
    const { message, estimatedEndTime } = req.body || {};

    maintenanceMode.enable(message, estimatedEndTime);

    logger.info(`[Maintenance API] Maintenance mode ENABLED by ${req.ip}`);
    if (message) logger.info(`[Maintenance API] Message: ${message}`);
    if (estimatedEndTime) logger.info(`[Maintenance API] End time: ${estimatedEndTime}`);

    res.json({
      success: true,
      message: 'Maintenance mode enabled',
      status: maintenanceMode.getStatus()
    });
  } catch (error) {
    logger.error('[Maintenance API] Error enabling maintenance mode:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to enable maintenance mode'
    });
  }
});

/**
 * POST /api/maintenance/disable
 * Disable maintenance mode (admin only)
 */
router.post('/disable', requireAdmin, (req, res) => {
  try {
    maintenanceMode.disable();

    logger.info(`[Maintenance API] Maintenance mode DISABLED by ${req.ip}`);

    res.json({
      success: true,
      message: 'Maintenance mode disabled',
      status: maintenanceMode.getStatus()
    });
  } catch (error) {
    logger.error('[Maintenance API] Error disabling maintenance mode:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to disable maintenance mode'
    });
  }
});

/**
 * PUT /api/maintenance/update
 * Update maintenance settings without disabling (admin only)
 *
 * Body:
 * {
 *   "message": "Updated message (optional)",
 *   "estimatedEndTime": "2025-11-21T12:00:00Z (optional)"
 * }
 */
router.put('/update', requireAdmin, (req, res) => {
  try {
    const { message, estimatedEndTime } = req.body || {};

    if (message) {
      maintenanceMode.message = message;
      logger.info(`[Maintenance API] Updated message: ${message}`);
    }

    if (estimatedEndTime) {
      maintenanceMode.estimatedEndTime = estimatedEndTime;
      logger.info(`[Maintenance API] Updated end time: ${estimatedEndTime}`);
    }

    maintenanceMode.saveStatus();

    res.json({
      success: true,
      message: 'Maintenance settings updated',
      status: maintenanceMode.getStatus()
    });
  } catch (error) {
    logger.error('[Maintenance API] Error updating maintenance settings:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to update maintenance settings'
    });
  }
});

/**
 * GET /api/maintenance/test
 * Test endpoint to verify maintenance mode is working (public)
 */
router.get('/test', (req, res) => {
  res.json({
    success: true,
    message: 'Maintenance API is working',
    maintenanceMode: maintenanceMode.isEnabled(),
    currentTime: new Date().toISOString()
  });
});

export default router;
