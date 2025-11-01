/**
 * URL Helper utility for proxy-aware URL detection
 * Handles Cloudflare, nginx, Apache, Plesk, and other reverse proxies automatically
 */

/**
 * Detect if request came through HTTPS based on various proxy headers
 * @param {Object} req - Express request object
 * @returns {boolean} - true if HTTPS detected
 */
function isSecureRequest(req) {
  // Direct HTTPS connection
  if (req.secure) return true;

  // Standard X-Forwarded-Proto header
  const forwardedProto =
    req.get("X-Forwarded-Proto") || req.get("X-Forwarded-Protocol");
  if (forwardedProto === "https") return true;

  // Cloudflare-specific CF-Visitor header
  const cfVisitor = req.get("CF-Visitor");
  if (cfVisitor) {
    try {
      const visitor = JSON.parse(cfVisitor);
      if (visitor.scheme === "https") return true;
    } catch (e) {
      // Invalid JSON, ignore
    }
  }

  // Cloudflare CF-Proto header
  if (req.get("CF-Proto") === "https") return true;

  // Azure/AWS specific headers
  if (req.get("X-ARR-SSL") || req.get("X-Forwarded-Ssl") === "on") return true;

  // Front-End-Https header (IIS)
  if (req.get("Front-End-Https") === "on") return true;

  // Non-standard but common headers
  if (req.get("X-Url-Scheme") === "https") return true;
  if (req.get("X-Forwarded-Scheme") === "https") return true;

  // Check if we're behind any reverse proxy and in production
  // If so, assume HTTPS (safer default for CDNs)
  const isProxied =
    req.get("X-Forwarded-For") ||
    req.get("CF-Connecting-IP") ||
    req.get("X-Real-IP") ||
    req.get("Via");

  const isProduction = process.env.NODE_ENV === "production";

  if (isProxied && isProduction) {
    // In production behind a proxy, default to HTTPS unless explicitly HTTP
    return forwardedProto !== "http";
  }

  return false;
}

/**
 * Get the actual host/domain from request headers
 * @param {Object} req - Express request object
 * @returns {string} - Host/domain
 */
function getActualHost(req) {
  // Priority order for host detection

  // 1. X-Forwarded-Host (most common for reverse proxies)
  const forwardedHost =
    req.get("X-Forwarded-Host") || req.get("X-Forwarded-Server");
  if (forwardedHost) {
    // Handle comma-separated list (take first)
    return forwardedHost.split(",")[0].trim();
  }

  // 2. CF-Host (Cloudflare)
  const cfHost = req.get("CF-Host");
  if (cfHost) return cfHost;

  // 3. X-Original-Host
  const originalHost = req.get("X-Original-Host");
  if (originalHost) return originalHost;

  // 4. Host header (standard)
  const host = req.get("Host");
  if (host) return host;

  // 5. Fallback to hostname
  return req.hostname || "localhost";
}

/**
 * Get the base URL from request, considering proxy headers
 * Works with Cloudflare, nginx, Apache, Plesk, and other proxies automatically
 * @param {Object} req - Express request object
 * @returns {Object} - { protocol, host, baseUrl }
 */
export function getBaseUrlFromRequest(req) {
  // Check for explicit BASE_URL environment variable first
  // This allows manual override if needed
  if (process.env.BASE_URL) {
    try {
      const baseUrl = process.env.BASE_URL.trim();
      const urlParts = new URL(baseUrl);
      return {
        protocol: urlParts.protocol.replace(":", ""),
        host: urlParts.host,
        baseUrl: baseUrl,
      };
    } catch (e) {
      console.error("Invalid BASE_URL environment variable:", e.message);
      // Fall through to auto-detection
    }
  }

  // Auto-detect protocol (HTTP vs HTTPS)
  const protocol = isSecureRequest(req) ? "https" : "http";

  // Auto-detect host/domain
  const host = getActualHost(req);

  // Handle localhost/internal IPs in production
  const isProduction = process.env.NODE_ENV === "production";
  const isLocalHost =
    host.includes("localhost") ||
    host.includes("127.0.0.1") ||
    host.includes("0.0.0.0") ||
    host.startsWith("10.") ||
    host.startsWith("172.") ||
    host.startsWith("192.168.");

  if (isProduction && isLocalHost) {
    // In production, if we somehow got a local host,
    // check for Render/Heroku/Railway platform URLs
    if (process.env.RENDER_EXTERNAL_URL) {
      return {
        protocol: "https",
        host: new URL(process.env.RENDER_EXTERNAL_URL).host,
        baseUrl: process.env.RENDER_EXTERNAL_URL,
      };
    }

    if (process.env.RAILWAY_STATIC_URL) {
      return {
        protocol: "https",
        host: new URL(process.env.RAILWAY_STATIC_URL).host,
        baseUrl: process.env.RAILWAY_STATIC_URL,
      };
    }

    if (process.env.HEROKU_APP_NAME) {
      const herokuUrl = `https://${process.env.HEROKU_APP_NAME}.herokuapp.com`;
      return {
        protocol: "https",
        host: `${process.env.HEROKU_APP_NAME}.herokuapp.com`,
        baseUrl: herokuUrl,
      };
    }

    // Last resort fallback for production
    console.warn(
      "Production mode but detected local host. Please set BASE_URL environment variable.",
    );
  }

  const baseUrl = `${protocol}://${host}`;

  return {
    protocol,
    host,
    baseUrl,
  };
}

/**
 * Get proxy-aware base URL string
 * @param {Object} req - Express request object
 * @returns {string} - Complete base URL
 */
export function getProxyAwareBaseUrl(req) {
  return getBaseUrlFromRequest(req).baseUrl;
}

/**
 * Check if request is from Cloudflare
 * @param {Object} req - Express request object
 * @returns {boolean}
 */
export function isCloudflareRequest(req) {
  return !!(
    req.get("CF-Ray") ||
    req.get("CF-Visitor") ||
    req.get("CF-Connecting-IP")
  );
}

/**
 * Get client's real IP address (works behind proxies/CDNs)
 * @param {Object} req - Express request object
 * @returns {string} - Client IP address
 */
export function getClientIp(req) {
  // Cloudflare
  const cfIp = req.get("CF-Connecting-IP");
  if (cfIp) return cfIp;

  // Standard proxy headers
  const forwardedFor = req.get("X-Forwarded-For");
  if (forwardedFor) {
    // Take first IP in comma-separated list
    return forwardedFor.split(",")[0].trim();
  }

  // X-Real-IP
  const realIp = req.get("X-Real-IP");
  if (realIp) return realIp;

  // Fallback to connection IP
  return req.ip || req.connection?.remoteAddress || "unknown";
}
