import express from "express";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";
import { config } from "./config/index.js";
import logger from "./utils/logger.js";
import addon, { addonRouter } from "./addon.js";
import streamService from "./core/streamService.js";
import secureStreamService from "./core/secureStreamService.js";
import manifest from "./manifest.js";

// File paths
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);


// Initialize Express app
const app = express();

// Basic error handler
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({ error: 'Something broke!' });
});

// Trust Render's proxy
app.set('trust proxy', 1);

// CORS configuration for Render
app.use(cors({
    origin: '*',
    methods: ['GET', 'HEAD', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Accept', 'Origin'],
    credentials: true
}));

// Serve installation page at root
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'install.html'));
});

// Serve static files from src directory
app.use(express.static(path.join(__dirname)));

// Status endpoints
app.get('/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Explicit manifest endpoint
app.get('/manifest.json', (req, res) => {
    const isProduction = process.env.NODE_ENV === 'production';
    const hostName = isProduction ? 'self-streme.onrender.com' : req.get('host');
    const protocol = isProduction ? 'https' : req.protocol;
    
    // Create a copy of the manifest with the correct URL
    const manifestResponse = {
        ...manifest,
        url: `${protocol}://${hostName}`,
        logo: `${protocol}://${hostName}/logo.png`
    };
    
    res.setHeader('Content-Type', 'application/json');
    res.json(manifestResponse);
});

app.get('/status', (req, res) => {
    res.json({
        status: 'ok',
        version: process.env.npm_package_version || '1.0.0',
        environment: process.env.NODE_ENV || 'development',
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        timestamp: new Date().toISOString()
    });
});

// Secure streaming endpoint for signed URLs
app.get("/secure-stream/:token", async (req, res) => {
    try {
        const { token } = req.params;
        await secureStreamService.streamingServer.streamContent(req, res, token);
    } catch (error) {
        logger.error('Secure stream error:', error);
        if (!res.headersSent) {
            res.status(500).json({ error: 'Streaming error' });
        }
    }
});

// API endpoint to generate secure URLs for testing/debugging
app.post("/api/generate-secure-url", express.json(), async (req, res) => {
    try {
        const { magnetLink, fileIndex = 0, validityHours = 24 } = req.body;
        
        if (!magnetLink) {
            return res.status(400).json({ error: 'Magnet link is required' });
        }
        
        const secureUrl = await secureStreamService.streamingServer.generateSignedUrl(
            magnetLink, 
            fileIndex, 
            validityHours
        );
        
        res.json(secureUrl);
    } catch (error) {
        logger.error('Error generating secure URL:', error);
        res.status(500).json({ error: error.message });
    }
});

// Server statistics endpoint
app.get("/api/stats", (req, res) => {
    try {
        const stats = secureStreamService.getStats();
        res.json(stats);
    } catch (error) {
        logger.error('Error getting stats:', error);
        res.status(500).json({ error: 'Failed to get stats' });
    }
});

// iOS stream caching endpoint
app.get("/stream/cache/:infoHash", async (req, res) => {
    try {
        const { infoHash } = req.params;
        const streamInfo = streamService.handler.getStreamInfo(infoHash);
        
        if (!streamInfo) {
            return res.status(404).json({ error: 'Stream not found' });
        }

        // Return cached stream info for iOS
        res.json({
            streams: [streamService.handler.formatStream(streamInfo, true)]
        });
    } catch (error) {
        logger.error('Stream cache error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Direct streaming endpoint
// Proxy streaming endpoint
app.get("/stream/proxy/:infoHash", async (req, res) => {
    try {
        const { infoHash } = req.params;
        const streamInfo = streamService.handler.getStreamInfo(infoHash);
        
        if (!streamInfo) {
            return res.status(404).json({ error: 'Stream not found' });
        }

        // Stream through our proxy service
        await proxyService.streamTorrent(req, res, infoHash);
        
    } catch (error) {
        logger.error('Proxy stream error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Main streaming endpoint - Updated to use secure streams
app.get("/stream/:type/:imdbId", async (req, res) => {
    try {
        const { type, imdbId } = req.params;
        const isIOS = /iPad|iPhone|iPod/.test(req.headers['user-agent']);
        
        // Use secure stream service instead of regular stream service
        const streams = await secureStreamService.getStreams(type, imdbId);
        
        res.json({ streams });
    } catch (error) {
        logger.error('Stream request error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Initialize server
async function startServer() {
    try {
        const port = process.env.PORT || 7000;
        const host = process.env.HOST || '0.0.0.0';
        
        // Mount the Stremio addon router
        app.use('/', addonRouter);

        app.listen(port, host, () => {
            const isProduction = process.env.NODE_ENV === 'production';
            const hostName = isProduction ? 'self-streme.onrender.com' : `${host}:${port}`;
            
            // For HTTP/HTTPS URLs
            const protocol = isProduction ? 'https' : 'http';
            const fullUrl = `${protocol}://${hostName}`;
            
            logger.info(`Server running on port ${port}`);
            logger.info(`Environment: ${process.env.NODE_ENV || 'development'}`);
            logger.info(`Full URL: ${fullUrl}`);
            logger.info(`Add to Stremio: stremio://${hostName}/manifest.json`);
        });

    } catch (error) {
        logger.error('Failed to start servers:', error);
        process.exit(1);
    }
}

// Clean up on process termination
process.on('SIGINT', () => {
    logger.info('Shutting down...');
    // Graceful shutdown
    process.exit(0);
});

process.on('SIGTERM', () => {
    logger.info('Shutting down...');
    // Graceful shutdown
    process.exit(0);
});

// Start servers
startServer();
