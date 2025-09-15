import express from "express";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";
import { config } from "./config/index.js";
import logger from "./utils/logger.js";
import addon, { addonRouter } from "./addon.js";
import streamService from "./core/streamService.js";

// Initialize Express app
const app = express();

// CORS configuration for Render
app.use(cors({
    origin: '*',
    methods: ['GET', 'HEAD', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Accept', 'Origin'],
    credentials: true
}));

// Health check endpoint for Render
app.get('/health', (req, res) => {
    res.status(200).json({ status: 'ok' });
});

// Manifest endpoint at root for Render
app.get('/', (req, res) => {
    res.redirect('/manifest.json');
});

// Status endpoints
app.get('/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
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

// File paths
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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
            const publicUrl = process.env.PUBLIC_URL || `http://${host}:${port}`;
            logger.info(`Server running on port ${port}`);
            logger.info(`Public URL: ${publicUrl}`);
            logger.info(`Add to Stremio: stremio://${publicUrl}/manifest.json`);
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
