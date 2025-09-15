#!/usr/bin/env node

/**
 * Example: Standalone Streaming Server
 * 
 * This demonstrates how to create a standalone streaming server
 * that can handle magnet links and provide secure streaming URLs
 */

import express from 'express';
import cors from 'cors';
import SecureStreamingServer from '../src/core/secureStreamingServer.js';

// Initialize the streaming server
const streamingServer = new SecureStreamingServer();

// Create Express app
const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Landing page
app.get('/', (req, res) => {
    res.send(`
        <html>
            <head>
                <title>Secure Streaming Server</title>
                <style>
                    body { font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto; padding: 20px; }
                    .endpoint { background: #f5f5f5; padding: 10px; margin: 10px 0; border-left: 4px solid #007cba; }
                    .method { color: #007cba; font-weight: bold; }
                    code { background: #eee; padding: 2px 4px; border-radius: 3px; }
                    .form { background: #f9f9f9; padding: 15px; border-radius: 5px; margin: 15px 0; }
                    input, textarea, button { margin: 5px 0; padding: 8px; width: 100%; box-sizing: border-box; }
                    button { background: #007cba; color: white; border: none; cursor: pointer; }
                    button:hover { background: #005a87; }
                </style>
            </head>
            <body>
                <h1>🔒 Secure Streaming Server</h1>
                <p>This server provides secure torrent streaming with signed URLs.</p>
                
                <h2>📡 Available Endpoints</h2>
                
                <div class="endpoint">
                    <div class="method">POST</div>
                    <code>/api/generate-url</code>
                    <p>Generate a secure signed URL for a magnet link</p>
                </div>
                
                <div class="endpoint">
                    <div class="method">GET</div>
                    <code>/stream/:token</code>
                    <p>Stream content using a signed token (supports range requests)</p>
                </div>
                
                <div class="endpoint">
                    <div class="method">GET</div>
                    <code>/stats</code>
                    <p>Get server statistics</p>
                </div>
                
                <h2>🧪 Test URL Generation</h2>
                <div class="form">
                    <h3>Generate Secure URL</h3>
                    <textarea id="magnetInput" placeholder="Enter magnet link here..." rows="3"></textarea>
                    <input type="number" id="fileIndex" placeholder="File index (default: 0)" value="0">
                    <input type="number" id="validityHours" placeholder="Validity in hours (default: 24)" value="24">
                    <button onclick="generateUrl()">Generate Secure URL</button>
                    <div id="result"></div>
                </div>
                
                <script>
                    async function generateUrl() {
                        const magnetLink = document.getElementById('magnetInput').value;
                        const fileIndex = parseInt(document.getElementById('fileIndex').value) || 0;
                        const validityHours = parseInt(document.getElementById('validityHours').value) || 24;
                        
                        if (!magnetLink) {
                            alert('Please enter a magnet link');
                            return;
                        }
                        
                        try {
                            const response = await fetch('/api/generate-url', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ magnetLink, fileIndex, validityHours })
                            });
                            
                            const result = await response.json();
                            
                            if (response.ok) {
                                document.getElementById('result').innerHTML = \`
                                    <h4>✅ Success!</h4>
                                    <p><strong>Stream URL:</strong> <a href="\${result.url}" target="_blank">\${result.url}</a></p>
                                    <p><strong>Expires:</strong> \${result.expiresAt}</p>
                                    <p><strong>Info Hash:</strong> \${result.infoHash}</p>
                                \`;
                            } else {
                                document.getElementById('result').innerHTML = \`
                                    <h4>❌ Error</h4>
                                    <p>\${result.error}</p>
                                \`;
                            }
                        } catch (error) {
                            document.getElementById('result').innerHTML = \`
                                <h4>❌ Error</h4>
                                <p>\${error.message}</p>
                            \`;
                        }
                    }
                </script>
            </body>
        </html>
    `);
});

// Generate secure URL endpoint
app.post('/api/generate-url', async (req, res) => {
    try {
        const { magnetLink, fileIndex = 0, validityHours = 24 } = req.body;
        
        if (!magnetLink) {
            return res.status(400).json({ error: 'Magnet link is required' });
        }
        
        if (!magnetLink.startsWith('magnet:')) {
            return res.status(400).json({ error: 'Invalid magnet link format' });
        }
        
        console.log(`[GENERATE] Creating secure URL for magnet link`);
        console.log(`[GENERATE] File index: ${fileIndex}, Validity: ${validityHours}h`);
        
        const result = await streamingServer.generateSignedUrl(
            magnetLink,
            fileIndex,
            validityHours
        );
        
        console.log(`[GENERATE] ✅ Generated secure URL, expires: ${result.expiresAt}`);
        
        res.json(result);
        
    } catch (error) {
        console.error('[GENERATE] ❌ Error:', error.message);
        res.status(500).json({ error: error.message });
    }
});

// Stream content endpoint with range support
app.get('/stream/:token', async (req, res) => {
    const { token } = req.params;
    console.log(`[STREAM] Request for token: ${token.substring(0, 20)}...`);
    
    try {
        await streamingServer.streamContent(req, res, token);
        console.log(`[STREAM] ✅ Streaming started successfully`);
    } catch (error) {
        console.error(`[STREAM] ❌ Error:`, error.message);
        if (!res.headersSent) {
            res.status(500).json({ error: 'Streaming failed' });
        }
    }
});

// Server statistics endpoint
app.get('/stats', (req, res) => {
    try {
        const stats = streamingServer.getStats();
        res.json(stats);
    } catch (error) {
        console.error('[STATS] Error:', error.message);
        res.status(500).json({ error: 'Failed to get stats' });
    }
});

// Health check endpoint
app.get('/health', (req, res) => {
    res.json({ 
        status: 'ok', 
        timestamp: new Date().toISOString(),
        uptime: process.uptime()
    });
});

// Error handling middleware
app.use((error, req, res, next) => {
    console.error('[ERROR]', error.message);
    res.status(500).json({ error: 'Internal server error' });
});

// Start server
const PORT = process.env.PORT || 8000;
const HOST = process.env.HOST || '0.0.0.0';

app.listen(PORT, HOST, () => {
    console.log('🚀 Secure Streaming Server Started!');
    console.log('');
    console.log(`📡 Server URL: http://${HOST}:${PORT}`);
    console.log(`🌐 Web Interface: http://localhost:${PORT}`);
    console.log(`📊 Statistics: http://localhost:${PORT}/stats`);
    console.log(`💓 Health Check: http://localhost:${PORT}/health`);
    console.log('');
    console.log('🔧 API Endpoints:');
    console.log(`   POST http://localhost:${PORT}/api/generate-url`);
    console.log(`   GET  http://localhost:${PORT}/stream/:token`);
    console.log('');
    console.log('🔒 Security Features:');
    console.log('   ✅ Signed URL tokens with expiration');
    console.log('   ✅ Server-side torrent handling');
    console.log('   ✅ Range request support for video seeking');
    console.log('   ✅ Automatic cleanup of expired content');
    console.log('');
    console.log('📖 Example Usage:');
    console.log('   1. Visit the web interface for easy testing');
    console.log('   2. Or use curl to generate URLs:');
    console.log(`      curl -X POST http://localhost:${PORT}/api/generate-url \\`);
    console.log('           -H "Content-Type: application/json" \\');
    console.log('           -d \'{"magnetLink": "magnet:?xt=urn:btih:..."}\'');
    console.log('   3. Use the returned URL in video players that support HTTP streaming');
});

// Graceful shutdown
process.on('SIGTERM', gracefulShutdown);
process.on('SIGINT', gracefulShutdown);

function gracefulShutdown() {
    console.log('\\n🛑 Shutting down gracefully...');
    console.log('   ⏳ Cleaning up active torrents...');
    
    streamingServer.destroy();
    
    console.log('   ✅ Cleanup complete');
    process.exit(0);
}