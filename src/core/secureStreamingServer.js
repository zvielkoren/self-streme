import crypto from 'crypto';
import WebTorrent from 'webtorrent';
import express from 'express';
import logger from '../utils/logger.js';
import { config } from '../config/index.js';

/**
 * Secure Streaming Server
 * 
 * This server handles torrent streaming securely by:
 * 1. Accepting magnet links server-side only
 * 2. Generating temporary signed URLs for secure access
 * 3. Supporting range requests for proper video playback
 * 4. Managing torrent lifecycle and cleanup
 */
class SecureStreamingServer {
    constructor() {
        this.client = new WebTorrent({
            maxConns: config.torrent.maxConnections || 100,
            downloadLimit: config.torrent.downloadLimit || 0,
            uploadLimit: config.torrent.uploadLimit || 0
        });
        
        // Active torrents: infoHash -> torrent instance
        this.activeTorrents = new Map();
        
        // Signed URLs: token -> { infoHash, fileIndex, expiresAt, magnetLink }
        this.signedUrls = new Map();
        
        // Secret key for URL signing
        this.secretKey = process.env.STREAM_SECRET_KEY || crypto.randomBytes(32).toString('hex');
        
        this.setupCleanup();
        this.initializeWebTorrentHandlers();
        
        logger.info('SecureStreamingServer initialized');
    }

    /**
     * Initialize WebTorrent client event handlers
     */
    initializeWebTorrentHandlers() {
        this.client.on('error', (error) => {
            logger.error('WebTorrent client error:', error);
        });

        this.client.on('warning', (warning) => {
            logger.warn('WebTorrent warning:', warning);
        });

        this.client.on('torrent', (torrent) => {
            logger.info(`Added torrent: ${torrent.infoHash}`);
        });
    }

    /**
     * Extract info hash from magnet link
     * @param {string} magnetLink - The magnet URI
     * @returns {string|null} - The extracted info hash
     */
    extractInfoHash(magnetLink) {
        if (!magnetLink) return null;
        const match = magnetLink.match(/btih:([a-fA-F0-9]+)/i);
        return match ? match[1].toLowerCase() : null;
    }

    /**
     * Generate a signed URL for secure streaming
     * @param {string} magnetLink - The magnet link
     * @param {number} fileIndex - Index of the file to stream (default: 0)
     * @param {number} validityHours - Hours the URL should be valid (default: 24)
     * @returns {Promise<Object>} - Object containing the signed URL and metadata
     */
    async generateSignedUrl(magnetLink, fileIndex = 0, validityHours = 24) {
        try {
            const infoHash = this.extractInfoHash(magnetLink);
            if (!infoHash) {
                throw new Error('Invalid magnet link: no info hash found');
            }

            // Create signing token
            const expiresAt = Date.now() + (validityHours * 60 * 60 * 1000);
            const payload = JSON.stringify({ infoHash, fileIndex, expiresAt });
            const signature = crypto
                .createHmac('sha256', this.secretKey)
                .update(payload)
                .digest('hex');
            
            const token = Buffer.from(payload).toString('base64') + '.' + signature;

            // Store the signed URL data
            this.signedUrls.set(token, {
                infoHash,
                fileIndex,
                expiresAt,
                magnetLink,
                createdAt: Date.now()
            });

            // Get torrent metadata if available
            let torrentInfo = null;
            try {
                torrentInfo = await this.getTorrentInfo(magnetLink);
            } catch (error) {
                logger.warn('Could not get torrent info immediately:', error.message);
            }

            const baseUrl = config.server.baseUrl || `http://127.0.0.1:${config.server.port}`;
            const streamUrl = `${baseUrl}/secure-stream/${token}`;

            return {
                url: streamUrl,
                token,
                expiresAt: new Date(expiresAt).toISOString(),
                torrentInfo,
                infoHash
            };

        } catch (error) {
            logger.error('Error generating signed URL:', error);
            throw error;
        }
    }

    /**
     * Verify and decode a signed URL token
     * @param {string} token - The signed token
     * @returns {Object|null} - Decoded token data or null if invalid
     */
    verifySignedUrl(token) {
        try {
            const [payloadBase64, signature] = token.split('.');
            if (!payloadBase64 || !signature) return null;

            const payload = Buffer.from(payloadBase64, 'base64').toString('utf8');
            const expectedSignature = crypto
                .createHmac('sha256', this.secretKey)
                .update(payload)
                .digest('hex');

            if (signature !== expectedSignature) {
                logger.warn('Invalid signature for token');
                return null;
            }

            const data = JSON.parse(payload);
            
            // Check expiration
            if (Date.now() > data.expiresAt) {
                logger.warn('Token expired');
                return null;
            }

            // Get stored URL data
            const urlData = this.signedUrls.get(token);
            if (!urlData) {
                logger.warn('Token not found in active URLs');
                return null;
            }

            return urlData;

        } catch (error) {
            logger.error('Error verifying signed URL:', error);
            return null;
        }
    }

    /**
     * Get torrent information without starting download
     * @param {string} magnetLink - The magnet link
     * @returns {Promise<Object>} - Torrent metadata
     */
    async getTorrentInfo(magnetLink) {
        return new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
                reject(new Error('Timeout getting torrent info'));
            }, 10000);

            const torrent = this.client.add(magnetLink, { 
                path: config.media.tempPath || './temp',
                destroyStoreOnDestroy: true
            });

            torrent.on('ready', () => {
                clearTimeout(timeout);
                
                const videoFiles = torrent.files.filter(file => 
                    this.isVideoFile(file.name)
                );

                const info = {
                    name: torrent.name,
                    infoHash: torrent.infoHash,
                    length: torrent.length,
                    files: videoFiles.map((file, index) => ({
                        name: file.name,
                        length: file.length,
                        index
                    })),
                    videoFiles: videoFiles.length
                };

                resolve(info);
            });

            torrent.on('error', (error) => {
                clearTimeout(timeout);
                reject(error);
            });
        });
    }

    /**
     * Check if a file is a video file
     * @param {string} filename - The filename to check
     * @returns {boolean} - True if it's a video file
     */
    isVideoFile(filename) {
        const videoExtensions = ['.mp4', '.mkv', '.avi', '.mov', '.m4v', '.webm', '.flv', '.wmv'];
        const ext = filename.toLowerCase().substring(filename.lastIndexOf('.'));
        return videoExtensions.includes(ext);
    }

    /**
     * Get or create a torrent for streaming
     * @param {string} magnetLink - The magnet link
     * @param {number} fileIndex - Index of the file to stream
     * @returns {Promise<Object>} - Stream object with torrent and file info
     */
    async getTorrentStream(magnetLink, fileIndex = 0) {
        const infoHash = this.extractInfoHash(magnetLink);
        
        // Check if we already have this torrent
        let torrent = this.activeTorrents.get(infoHash);
        
        if (!torrent) {
            // Add new torrent
            torrent = await new Promise((resolve, reject) => {
                const timeout = setTimeout(() => {
                    reject(new Error('Timeout adding torrent'));
                }, 30000);

                const newTorrent = this.client.add(magnetLink, {
                    path: config.media.tempPath || './temp'
                });

                newTorrent.on('ready', () => {
                    clearTimeout(timeout);
                    this.activeTorrents.set(infoHash, newTorrent);
                    resolve(newTorrent);
                });

                newTorrent.on('error', (error) => {
                    clearTimeout(timeout);
                    reject(error);
                });
            });
        }

        // Get video files
        const videoFiles = torrent.files.filter(file => this.isVideoFile(file.name));
        
        if (videoFiles.length === 0) {
            throw new Error('No video files found in torrent');
        }

        const file = videoFiles[fileIndex] || videoFiles[0];
        
        return {
            torrent,
            file,
            infoHash,
            totalLength: file.length,
            name: file.name
        };
    }

    /**
     * Stream content with range request support
     * @param {Object} req - Express request object
     * @param {Object} res - Express response object
     * @param {string} token - Signed URL token
     */
    async streamContent(req, res, token) {
        try {
            // Verify the signed URL
            const urlData = this.verifySignedUrl(token);
            if (!urlData) {
                return res.status(403).json({ error: 'Invalid or expired token' });
            }

            // Get the torrent stream
            const streamData = await this.getTorrentStream(urlData.magnetLink, urlData.fileIndex);
            const { file, totalLength, name } = streamData;

            // Handle range requests for video seeking
            const range = req.headers.range;
            let start = 0;
            let end = totalLength - 1;

            if (range) {
                const parts = range.replace(/bytes=/, "").split("-");
                start = parseInt(parts[0], 10);
                end = parts[1] ? parseInt(parts[1], 10) : totalLength - 1;
            }

            const chunksize = (end - start) + 1;

            // Set appropriate headers
            res.writeHead(range ? 206 : 200, {
                'Content-Range': range ? `bytes ${start}-${end}/${totalLength}` : undefined,
                'Accept-Ranges': 'bytes',
                'Content-Length': chunksize,
                'Content-Type': this.getContentType(name),
                'Cache-Control': 'no-cache',
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Headers': 'Range',
            });

            // Create stream and pipe to response
            const stream = file.createReadStream({ start, end });
            
            stream.on('error', (error) => {
                logger.error('Stream error:', error);
                if (!res.headersSent) {
                    res.status(500).end();
                }
            });

            stream.pipe(res);

            // Update last accessed time
            urlData.lastAccessed = Date.now();

        } catch (error) {
            logger.error('Error streaming content:', error);
            if (!res.headersSent) {
                res.status(500).json({ error: 'Streaming error' });
            }
        }
    }

    /**
     * Get content type for a file
     * @param {string} filename - The filename
     * @returns {string} - MIME type
     */
    getContentType(filename) {
        const ext = filename.toLowerCase().substring(filename.lastIndexOf('.'));
        const mimeTypes = {
            '.mp4': 'video/mp4',
            '.mkv': 'video/x-matroska',
            '.avi': 'video/x-msvideo',
            '.mov': 'video/quicktime',
            '.m4v': 'video/mp4',
            '.webm': 'video/webm',
            '.flv': 'video/x-flv',
            '.wmv': 'video/x-ms-wmv'
        };
        return mimeTypes[ext] || 'application/octet-stream';
    }

    /**
     * Setup cleanup for expired URLs and inactive torrents
     */
    setupCleanup() {
        // Clean up expired URLs every 5 minutes
        setInterval(() => {
            const now = Date.now();
            for (const [token, data] of this.signedUrls.entries()) {
                if (now > data.expiresAt) {
                    this.signedUrls.delete(token);
                    logger.debug(`Cleaned up expired token: ${token.substring(0, 10)}...`);
                }
            }
        }, 5 * 60 * 1000);

        // Clean up inactive torrents every 30 minutes
        setInterval(() => {
            const now = Date.now();
            const inactivityThreshold = 30 * 60 * 1000; // 30 minutes

            for (const [infoHash, torrent] of this.activeTorrents.entries()) {
                // Check if any signed URLs are still using this torrent
                const isActive = Array.from(this.signedUrls.values()).some(urlData => 
                    urlData.infoHash === infoHash && 
                    (now - (urlData.lastAccessed || urlData.createdAt)) < inactivityThreshold
                );

                if (!isActive) {
                    logger.info(`Cleaning up inactive torrent: ${infoHash}`);
                    torrent.destroy();
                    this.activeTorrents.delete(infoHash);
                }
            }
        }, 30 * 60 * 1000);
    }

    /**
     * Get stats about active torrents and signed URLs
     * @returns {Object} - Server statistics
     */
    getStats() {
        return {
            activeTorrents: this.activeTorrents.size,
            activeSignedUrls: this.signedUrls.size,
            webtorrentStats: {
                torrents: this.client.torrents.length,
                downloadSpeed: this.client.downloadSpeed,
                uploadSpeed: this.client.uploadSpeed,
                progress: this.client.progress
            }
        };
    }

    /**
     * Shutdown the server gracefully
     */
    destroy() {
        logger.info('Shutting down SecureStreamingServer...');
        
        // Clear all signed URLs
        this.signedUrls.clear();
        
        // Destroy all torrents
        this.activeTorrents.clear();
        
        // Destroy WebTorrent client
        this.client.destroy(() => {
            logger.info('WebTorrent client destroyed');
        });
    }
}

export default SecureStreamingServer;