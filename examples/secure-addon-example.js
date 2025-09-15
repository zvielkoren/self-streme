#!/usr/bin/env node

/**
 * Example: How to create and use a Stremio addon with secure torrent streaming
 * 
 * This script demonstrates:
 * 1. Setting up the secure streaming server
 * 2. Creating signed URLs for magnet links
 * 3. Integrating with Stremio addon
 */

import express from 'express';
import { addonBuilder } from 'stremio-addon-sdk';
import SecureStreamingServer from '../src/core/secureStreamingServer.js';

// Initialize the secure streaming server
const streamingServer = new SecureStreamingServer();

// Create Stremio addon manifest
const manifest = {
    id: 'com.example.secure-stremio',
    version: '1.0.0',
    name: 'Secure Torrent Addon',
    description: 'Example Stremio addon with secure torrent streaming',
    types: ['movie', 'series'],
    resources: ['stream', 'meta'],
    idPrefixes: ['tt'],
    catalogs: [],
    behaviorHints: {
        p2p: false,  // We handle P2P server-side, not in Stremio
        adult: false
    }
};

// Create addon builder
const builder = new addonBuilder(manifest);

// Mock content database (in real app, use TMDB/OMDB)
const mockContent = {
    'tt1375666': {
        id: 'tt1375666',
        type: 'movie',
        name: 'Inception',
        poster: 'https://image.tmdb.org/t/p/w500/9gk7adHYeDvHkCSEqAvQNLV5Uge.jpg',
        background: 'https://image.tmdb.org/t/p/original/s3TBrRGB1iav7gFOCNx3H31MoES.jpg',
        description: 'A skilled thief is given a chance at redemption if he can successfully perform inception.',
        year: 2010,
        imdbRating: 8.8,
        genre: ['Action', 'Sci-Fi', 'Thriller'],
        director: ['Christopher Nolan'],
        cast: ['Leonardo DiCaprio', 'Marion Cotillard', 'Tom Hardy'],
        runtime: '148 min'
    }
};

// Mock torrent sources (in real app, integrate with torrent providers)
const mockTorrents = {
    'tt1375666': [
        {
            title: 'Inception (2010) 1080p BluRay x264',
            quality: '1080p',
            size: 2147483648, // 2GB
            seeders: 1245,
            magnet: 'magnet:?xt=urn:btih:inception1080p&dn=Inception.2010.1080p.BluRay.x264&tr=udp://tracker.openbittorrent.com:80',
            source: 'Example Provider'
        },
        {
            title: 'Inception (2010) 720p BluRay x264',
            quality: '720p', 
            size: 1073741824, // 1GB
            seeders: 892,
            magnet: 'magnet:?xt=urn:btih:inception720p&dn=Inception.2010.720p.BluRay.x264&tr=udp://tracker.openbittorrent.com:80',
            source: 'Example Provider'
        }
    ]
};

// Define meta handler - provides content information to Stremio
builder.defineMetaHandler(async ({ type, id }) => {
    console.log(`[META] Request for ${type}:${id}`);
    
    const content = mockContent[id];
    if (!content) {
        return { meta: null };
    }
    
    return { meta: content };
});

// Define stream handler - provides SECURE stream URLs to Stremio
builder.defineStreamHandler(async ({ type, id }) => {
    console.log(`[STREAM] Request for ${type}:${id}`);
    
    try {
        // Get torrent sources for this content
        const torrents = mockTorrents[id] || [];
        
        if (torrents.length === 0) {
            console.log(`[STREAM] No torrents found for ${id}`);
            return { streams: [] };
        }
        
        // Convert each torrent to a secure stream
        const secureStreams = [];
        
        for (const torrent of torrents) {
            try {
                // Generate secure signed URL (this is the key security feature)
                const secureUrl = await streamingServer.generateSignedUrl(
                    torrent.magnet,
                    0,  // file index
                    24  // 24 hour validity
                );
                
                // Create stream object for Stremio
                const stream = {
                    // IMPORTANT: Use secure URL, NOT the magnet link
                    url: secureUrl.url,
                    
                    // Stream metadata
                    title: `${torrent.title} [${torrent.quality}]`,
                    quality: torrent.quality,
                    
                    // Additional info for user
                    name: `${torrent.source} - ${torrent.quality}`,
                    
                    // Behavior hints for Stremio
                    behaviorHints: {
                        notWebReady: true,  // Requires download
                        bingeGroup: `secure-${torrent.quality}`
                    }
                };
                
                // Add size and seeders if available
                if (torrent.size) {
                    stream.title += ` (${formatFileSize(torrent.size)})`;
                }
                if (torrent.seeders) {
                    stream.title += ` 👥${torrent.seeders}`;
                }
                
                secureStreams.push(stream);
                
                console.log(`[STREAM] Generated secure URL for ${torrent.title}`);
                
            } catch (error) {
                console.error(`[STREAM] Error generating secure URL:`, error.message);
                // Continue with other torrents
            }
        }
        
        console.log(`[STREAM] Returning ${secureStreams.length} secure streams for ${id}`);
        return { streams: secureStreams };
        
    } catch (error) {
        console.error(`[STREAM] Error processing streams for ${id}:`, error.message);
        return { streams: [] };
    }
});

// Helper function to format file sizes
function formatFileSize(bytes) {
    if (!bytes) return '';
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return (bytes / Math.pow(1024, i)).toFixed(1) + ' ' + sizes[i];
}

// Create Express app
const app = express();

// Add CORS for Stremio
app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
    next();
});

// Mount the addon interface
const addonInterface = builder.getInterface();
app.use(addonInterface);

// Add the secure streaming endpoint
app.get('/secure-stream/:token', async (req, res) => {
    try {
        await streamingServer.streamContent(req, res, req.params.token);
    } catch (error) {
        console.error('Streaming error:', error);
        if (!res.headersSent) {
            res.status(500).json({ error: 'Streaming failed' });
        }
    }
});

// Add debug endpoint to show stats
app.get('/debug/stats', (req, res) => {
    const stats = streamingServer.getStats();
    res.json(stats);
});

// Start the server
const PORT = process.env.PORT || 7001;
app.listen(PORT, () => {
    console.log('🚀 Secure Stremio Addon started!');
    console.log(`📡 Server: http://localhost:${PORT}`);
    console.log(`📋 Manifest: http://localhost:${PORT}/manifest.json`);
    console.log(`🎬 Install in Stremio: stremio://localhost:${PORT}/manifest.json`);
    console.log('');
    console.log('🔒 Security Features:');
    console.log('   ✅ Magnet links never exposed to Stremio');
    console.log('   ✅ Signed URLs with 24-hour expiration');
    console.log('   ✅ Server-side torrent handling');
    console.log('   ✅ Range request support for seeking');
    console.log('');
    console.log('📖 To test:');
    console.log(`   1. Add addon to Stremio: http://localhost:${PORT}/manifest.json`);
    console.log('   2. Search for "Inception" in Stremio');
    console.log('   3. Select a secure stream source');
    console.log(`   4. Check stats: http://localhost:${PORT}/debug/stats`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
    console.log('Shutting down gracefully...');
    streamingServer.destroy();
    process.exit(0);
});

process.on('SIGINT', () => {
    console.log('Shutting down gracefully...');
    streamingServer.destroy();
    process.exit(0);
});