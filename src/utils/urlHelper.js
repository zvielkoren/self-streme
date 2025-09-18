/**
 * URL Helper utility for proxy-aware URL detection
 */

/**
 * Get the base URL from request, considering proxy headers
 * @param {Object} req - Express request object
 * @returns {Object} - { protocol, host, baseUrl }
 */
export function getBaseUrlFromRequest(req) {
    // Check for explicit BASE_URL environment variable first
    if (process.env.BASE_URL) {
        const baseUrl = process.env.BASE_URL;
        const urlParts = new URL(baseUrl);
        return {
            protocol: urlParts.protocol.replace(':', ''),
            host: urlParts.host,
            baseUrl: baseUrl
        };
    }

    // Check for proxy headers (common in reverse proxy setups)
    const forwardedProto = req.get('X-Forwarded-Proto') || req.get('X-Forwarded-Protocol');
    const forwardedHost = req.get('X-Forwarded-Host') || req.get('X-Forwarded-Server');
    
    // Determine protocol
    let protocol;
    if (forwardedProto) {
        protocol = forwardedProto;
    } else if (req.secure || req.get('X-Forwarded-Ssl') === 'on') {
        protocol = 'https';
    } else {
        protocol = req.protocol;
    }

    // Determine host
    let host;
    if (forwardedHost) {
        host = forwardedHost;
    } else {
        host = req.get('host');
    }

    // Handle production environment fallback
    const isProduction = process.env.NODE_ENV === 'production';
    if (isProduction && (!host || host.includes('localhost') || host.includes('127.0.0.1') || host.includes('0.0.0.0'))) {
        // Fallback to render URL for production
        protocol = 'https';
        host = 'self-streme.onrender.com';
    }

    const baseUrl = `${protocol}://${host}`;

    return {
        protocol,
        host,
        baseUrl
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