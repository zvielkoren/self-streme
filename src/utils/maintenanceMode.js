/**
 * Maintenance Mode Utility
 *
 * Allows administrators to put the service in maintenance mode to prevent
 * access during updates, fixes, or scheduled maintenance.
 *
 * Features:
 * - Enable/disable maintenance mode via environment variable or API
 * - Custom maintenance message
 * - Whitelist IPs that can bypass maintenance mode
 * - Scheduled maintenance windows
 * - Graceful responses with maintenance page
 */

import fs from 'fs';
import path from 'path';
import logger from './logger.js';

class MaintenanceMode {
  constructor() {
    this.enabled = process.env.MAINTENANCE_MODE === 'true';
    this.message = process.env.MAINTENANCE_MESSAGE || 'Service is currently under maintenance. Please try again later.';
    this.estimatedEndTime = process.env.MAINTENANCE_END_TIME || null;
    this.whitelistedIPs = this.parseWhitelistedIPs();
    this.bypassToken = process.env.MAINTENANCE_BYPASS_TOKEN || null;
    this.statusFile = path.join(process.cwd(), 'data', 'maintenance.json');

    // Load status from file if it exists
    this.loadStatus();

    logger.info(`[Maintenance] Mode initialized: ${this.enabled ? 'ENABLED' : 'DISABLED'}`);
    if (this.enabled) {
      logger.warn(`[Maintenance] Service is in MAINTENANCE MODE: ${this.message}`);
    }
  }

  /**
   * Parse whitelisted IPs from environment variable
   */
  parseWhitelistedIPs() {
    const ips = process.env.MAINTENANCE_WHITELIST_IPS || '';
    return ips.split(',').map(ip => ip.trim()).filter(ip => ip.length > 0);
  }

  /**
   * Load maintenance status from file
   */
  loadStatus() {
    try {
      if (fs.existsSync(this.statusFile)) {
        const data = JSON.parse(fs.readFileSync(this.statusFile, 'utf8'));
        this.enabled = data.enabled || this.enabled;
        this.message = data.message || this.message;
        this.estimatedEndTime = data.estimatedEndTime || this.estimatedEndTime;

        // Check if scheduled maintenance window has passed
        if (this.estimatedEndTime) {
          const endTime = new Date(this.estimatedEndTime);
          if (Date.now() > endTime.getTime()) {
            logger.info('[Maintenance] Scheduled maintenance window has passed, disabling maintenance mode');
            this.disable();
          }
        }
      }
    } catch (error) {
      logger.error('[Maintenance] Failed to load status from file:', error.message);
    }
  }

  /**
   * Save maintenance status to file
   */
  saveStatus() {
    try {
      const dataDir = path.dirname(this.statusFile);
      if (!fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir, { recursive: true });
      }

      const data = {
        enabled: this.enabled,
        message: this.message,
        estimatedEndTime: this.estimatedEndTime,
        lastUpdated: new Date().toISOString()
      };

      fs.writeFileSync(this.statusFile, JSON.stringify(data, null, 2));
    } catch (error) {
      logger.error('[Maintenance] Failed to save status to file:', error.message);
    }
  }

  /**
   * Enable maintenance mode
   */
  enable(message = null, estimatedEndTime = null) {
    this.enabled = true;
    if (message) this.message = message;
    if (estimatedEndTime) this.estimatedEndTime = estimatedEndTime;

    this.saveStatus();

    logger.warn(`[Maintenance] ENABLED - ${this.message}`);
    if (this.estimatedEndTime) {
      logger.warn(`[Maintenance] Estimated end time: ${this.estimatedEndTime}`);
    }
  }

  /**
   * Disable maintenance mode
   */
  disable() {
    this.enabled = false;
    this.saveStatus();
    logger.info('[Maintenance] DISABLED - Service is now available');
  }

  /**
   * Check if maintenance mode is enabled
   */
  isEnabled() {
    // Auto-disable if scheduled end time has passed
    if (this.enabled && this.estimatedEndTime) {
      const endTime = new Date(this.estimatedEndTime);
      if (Date.now() > endTime.getTime()) {
        logger.info('[Maintenance] Scheduled maintenance window has passed, auto-disabling');
        this.disable();
        return false;
      }
    }

    return this.enabled;
  }

  /**
   * Check if IP is whitelisted
   */
  isWhitelisted(ip) {
    if (!ip) return false;

    // Clean IP (remove IPv6 prefix if present)
    const cleanIP = ip.replace('::ffff:', '');

    return this.whitelistedIPs.includes(cleanIP) ||
           this.whitelistedIPs.includes('127.0.0.1') && cleanIP === '127.0.0.1' ||
           this.whitelistedIPs.includes('localhost') && (cleanIP === '127.0.0.1' || cleanIP === '::1');
  }

  /**
   * Check if request has valid bypass token
   */
  hasBypassToken(req) {
    if (!this.bypassToken) return false;

    // Check query parameter
    if (req.query && req.query.bypass === this.bypassToken) return true;

    // Check header
    if (req.headers && req.headers['x-maintenance-bypass'] === this.bypassToken) return true;

    return false;
  }

  /**
   * Get maintenance status info
   */
  getStatus() {
    return {
      enabled: this.enabled,
      message: this.message,
      estimatedEndTime: this.estimatedEndTime,
      timeRemaining: this.getTimeRemaining()
    };
  }

  /**
   * Get time remaining until maintenance ends
   */
  getTimeRemaining() {
    if (!this.estimatedEndTime) return null;

    const endTime = new Date(this.estimatedEndTime);
    const now = Date.now();
    const remaining = endTime.getTime() - now;

    if (remaining <= 0) return 'Maintenance window has ended';

    const hours = Math.floor(remaining / (1000 * 60 * 60));
    const minutes = Math.floor((remaining % (1000 * 60 * 60)) / (1000 * 60));

    if (hours > 0) {
      return `${hours} hour${hours !== 1 ? 's' : ''} ${minutes} minute${minutes !== 1 ? 's' : ''}`;
    } else {
      return `${minutes} minute${minutes !== 1 ? 's' : ''}`;
    }
  }

  /**
   * Express middleware for maintenance mode
   */
  middleware() {
    return (req, res, next) => {
      // Skip if maintenance mode is disabled
      if (!this.isEnabled()) {
        return next();
      }

      // Allow access to maintenance status endpoint
      if (req.path === '/maintenance/status' || req.path === '/api/maintenance/status') {
        return next();
      }

      // Allow access to maintenance control endpoints (for admins)
      if (req.path.startsWith('/maintenance/') || req.path.startsWith('/api/maintenance/')) {
        return next();
      }

      // Get client IP
      const clientIP = req.ip || req.connection.remoteAddress || req.headers['x-forwarded-for'];

      // Check if IP is whitelisted
      if (this.isWhitelisted(clientIP)) {
        logger.debug(`[Maintenance] Whitelisted IP bypassing maintenance mode: ${clientIP}`);
        return next();
      }

      // Check for bypass token
      if (this.hasBypassToken(req)) {
        logger.debug('[Maintenance] Valid bypass token, allowing access');
        return next();
      }

      // Block access - return maintenance page
      logger.debug(`[Maintenance] Blocking access from: ${clientIP}`);

      // Return JSON for API requests
      if (req.path.startsWith('/api/') || req.accepts('json')) {
        return res.status(503).json({
          error: 'Service Unavailable',
          message: this.message,
          estimatedEndTime: this.estimatedEndTime,
          timeRemaining: this.getTimeRemaining(),
          maintenanceMode: true
        });
      }

      // Return HTML page for browser requests
      const maintenancePage = this.generateMaintenancePage();
      res.status(503).type('html').send(maintenancePage);
    };
  }

  /**
   * Generate HTML maintenance page
   */
  generateMaintenancePage() {
    const timeInfo = this.estimatedEndTime
      ? `<p class="time-remaining">Estimated completion: <strong>${new Date(this.estimatedEndTime).toLocaleString()}</strong></p>
         <p class="time-remaining">Time remaining: <strong>${this.getTimeRemaining()}</strong></p>`
      : '';

    return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Service Maintenance</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }

        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 20px;
        }

        .container {
            background: white;
            border-radius: 20px;
            padding: 60px 40px;
            max-width: 600px;
            width: 100%;
            box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
            text-align: center;
        }

        .icon {
            font-size: 80px;
            margin-bottom: 20px;
            animation: pulse 2s ease-in-out infinite;
        }

        @keyframes pulse {
            0%, 100% { transform: scale(1); opacity: 1; }
            50% { transform: scale(1.1); opacity: 0.8; }
        }

        h1 {
            color: #333;
            font-size: 32px;
            margin-bottom: 20px;
            font-weight: 700;
        }

        .message {
            color: #666;
            font-size: 18px;
            line-height: 1.6;
            margin-bottom: 30px;
        }

        .time-remaining {
            color: #667eea;
            font-size: 16px;
            margin: 10px 0;
        }

        .time-remaining strong {
            color: #764ba2;
        }

        .info {
            background: #f8f9fa;
            border-left: 4px solid #667eea;
            padding: 15px 20px;
            margin-top: 30px;
            text-align: left;
            border-radius: 4px;
        }

        .info p {
            color: #666;
            font-size: 14px;
            margin: 5px 0;
        }

        .refresh-btn {
            display: inline-block;
            margin-top: 30px;
            padding: 12px 30px;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            text-decoration: none;
            border-radius: 25px;
            font-weight: 600;
            transition: transform 0.2s, box-shadow 0.2s;
            cursor: pointer;
            border: none;
            font-size: 16px;
        }

        .refresh-btn:hover {
            transform: translateY(-2px);
            box-shadow: 0 10px 20px rgba(102, 126, 234, 0.4);
        }

        @media (max-width: 600px) {
            .container {
                padding: 40px 20px;
            }

            h1 {
                font-size: 24px;
            }

            .message {
                font-size: 16px;
            }
        }
    </style>
    <script>
        // Auto-refresh every 30 seconds
        setTimeout(() => {
            location.reload();
        }, 30000);
    </script>
</head>
<body>
    <div class="container">
        <div class="icon">🔧</div>
        <h1>Service Under Maintenance</h1>
        <p class="message">${this.message}</p>
        ${timeInfo}

        <button class="refresh-btn" onclick="location.reload()">
            Refresh Page
        </button>

        <div class="info">
            <p><strong>What's happening?</strong></p>
            <p>We're performing scheduled maintenance to improve our service. The service will be back online shortly.</p>
            <p style="margin-top: 10px;"><strong>Note:</strong> This page will automatically refresh every 30 seconds.</p>
        </div>
    </div>
</body>
</html>
    `.trim();
  }

  /**
   * API handler to get maintenance status
   */
  statusHandler() {
    return (req, res) => {
      res.json(this.getStatus());
    };
  }

  /**
   * API handler to enable maintenance mode (admin only)
   */
  enableHandler() {
    return (req, res) => {
      const { message, estimatedEndTime } = req.body || {};

      this.enable(message, estimatedEndTime);

      res.json({
        success: true,
        message: 'Maintenance mode enabled',
        status: this.getStatus()
      });
    };
  }

  /**
   * API handler to disable maintenance mode (admin only)
   */
  disableHandler() {
    return (req, res) => {
      this.disable();

      res.json({
        success: true,
        message: 'Maintenance mode disabled',
        status: this.getStatus()
      });
    };
  }
}

// Export singleton instance
let maintenanceModeInstance = null;

export function getMaintenanceMode() {
  if (!maintenanceModeInstance) {
    maintenanceModeInstance = new MaintenanceMode();
  }
  return maintenanceModeInstance;
}

export default getMaintenanceMode();
