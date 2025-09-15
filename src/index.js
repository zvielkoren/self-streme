import express from "express";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";
import { config } from "./config/index.js";
import logger from "./utils/logger.js";
import addon, { addonRouter } from "./addon.js";
import streamService from "./core/streamService.js";
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
    res.setHeader('Content-Type', 'application/json');
    res.json(manifest);
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

// Streaming endpoints
app.get("/stream/:type/:imdbId", async (req, res) => {
    try {
        const { type, imdbId } = req.params;
        const streams = await streamService.getStreams(type, imdbId);
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
            // Set the base URL for the manifest
            process.env.BASE_URL = process.env.BASE_URL || (process.env.NODE_ENV === 'production' 
                ? 'self-streme.onrender.com'
                : `${host}:${port}`);
            
            const publicUrl = `https://${process.env.BASE_URL}`;
            logger.info(`Server running on port ${port}`);
            logger.info(`Public URL: ${publicUrl}`);
            logger.info(`Add to Stremio: stremio://${process.env.BASE_URL}/manifest.json`);
        });

    } catch (error) {
        logger.error('Failed to start servers:', error);
        process.exit(1);
    }
}

// Clean up on process termination
process.on('SIGINT', () => {
    logger.info('Shutting down...');
    streamService.destroy();
    process.exit(0);
});

process.on('SIGTERM', () => {
    logger.info('Shutting down...');
    streamService.destroy();
    process.exit(0);
});

// Start servers
startServer();
