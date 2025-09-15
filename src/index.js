import express from "express";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";
import { config } from "./config/index.js";
import logger from "./utils/logger.js";
import addon, { addonApp } from "./addon.js";
import streamService from "./core/streamService.js";
import torrentService from "./core/torrentService.js";
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

// Serve iOS fix test page
app.get('/test-ios-fix', (req, res) => {
    res.sendFile(path.join(__dirname, 'test-ios-fix.html'));
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
        await torrentService.streamTorrent(req, res, infoHash);
        
    } catch (error) {
        logger.error('Proxy stream error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Main streaming endpoint
app.get("/stream/:type/:imdbId", async (req, res) => {
    try {
        const { type, imdbId } = req.params;
        const userAgent = req.headers['user-agent'] || '';
        const streams = await streamService.getStreams(type, imdbId, undefined, undefined, userAgent);
        res.json({ streams });
    } catch (error) {
        logger.error('Stream request error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// iOS-specific stream endpoint that provides HTTP streams instead of magnets
app.get("/stream/:type/:imdbId.json", async (req, res) => {
    try {
        const { type, imdbId } = req.params;
        const userAgent = req.headers['user-agent'] || '';
        
        logger.info(`Stream request: ${type}:${imdbId} from ${userAgent.substring(0, 50)}...`);
        
        // Detect iOS
        const isIOS = streamService.isIOSDevice(userAgent);
        logger.info(`iOS device detected: ${isIOS}`);
        
        const streams = await streamService.getStreams(type, imdbId, undefined, undefined, userAgent);
        
        if (streams.length > 0) {
            logger.info(`Found ${streams.length} streams for ${imdbId} (iOS: ${isIOS})`);
        } else {
            logger.warn(`No streams found for ${imdbId}`);
        }

        res.json({ streams });
    } catch (error) {
        logger.error('Stream endpoint error:', error);
        res.status(500).json({ streams: [] });
    }
});

// Initialize server
async function startServer() {
    try {
        const port = process.env.PORT || 7000;
        const host = process.env.HOST || '0.0.0.0';

        // For now, disable the addon mounting until we fix the interface issue
        // app.use('/', addonApp);

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
