import logger from '../utils/logger.js';
import WebTorrent from 'webtorrent';
import { config } from '../config/index.js';
import fs from 'fs';
import path from 'path';

class TorrentService {
    constructor() {
        // Ensure download directory exists
        this.ensureDownloadPath();
        
        this.client = new WebTorrent({
            maxConns: config.torrent.maxConnections,
            downloadLimit: config.torrent.downloadLimit,
            uploadLimit: config.torrent.uploadLimit
        });
        this.activeTorrents = new Map();
        this.initialize();
    }

    ensureDownloadPath() {
        try {
            if (!fs.existsSync(config.torrent.downloadPath)) {
                fs.mkdirSync(config.torrent.downloadPath, { recursive: true });
                logger.info(`Created download directory: ${config.torrent.downloadPath}`);
            }
        } catch (error) {
            logger.error('Failed to create download directory:', error);
        }
    }

    initialize() {
        this.client.on('error', error => logger.error('WebTorrent client error:', error));
        this.client.on('warning', warning => logger.warn('WebTorrent warning:', warning));
    }

    async getStream(magnetUri, fileIdx = 0) {
        return new Promise((resolve, reject) => {
            try {
                if (!magnetUri || !magnetUri.startsWith('magnet:')) {
                    return reject(new Error('Invalid magnet URI'));
                }

                const existing = this.activeTorrents.get(magnetUri);
                if (existing && existing.file) {
                    logger.debug(`Using existing torrent stream for ${magnetUri.substring(0, 50)}...`);
                    return resolve(existing);
                }

                // Extract info hash from magnet URI for duplicate checking
                const infoHashMatch = magnetUri.match(/xt=urn:btih:([^&]+)/i);
                if (!infoHashMatch) {
                    return reject(new Error('Invalid magnet URI: no info hash found'));
                }
                const infoHash = infoHashMatch[1];
                logger.info(`Extracted info hash: ${infoHash}`);

                // Check if torrent already exists by searching through active torrents
                let torrent = this.client.torrents.find(t => t.infoHash === infoHash);
                
                if (torrent) {
                    logger.info(`Found existing torrent for ${infoHash}`);
                } else {
                    logger.info(`Adding new torrent: ${magnetUri.substring(0, 50)}...`);
                    torrent = this.client.add(magnetUri, { path: config.torrent.downloadPath });
                    logger.info(`Torrent add initiated`);
                }
                
                // Validate torrent object
                if (!torrent || typeof torrent.on !== 'function') {
                    logger.error(`Invalid torrent object - type: ${typeof torrent}, constructor: ${torrent && torrent.constructor ? torrent.constructor.name : 'unknown'}`);
                    return reject(new Error('Invalid torrent object'));
                }

                logger.info(`Valid torrent object confirmed`);

                // Function to process torrent when it's ready
                const processTorrent = () => {
                    logger.info(`Torrent ready: ${torrent.name || 'Unknown'}, files: ${torrent.files.length}`);
                    
                    const videoExtensions = ['mp4','mkv','avi','mov','m4v','webm','flv'];
                    const files = torrent.files.filter(f => {
                        const ext = f.name.split('.').pop().toLowerCase();
                        return videoExtensions.includes(ext);
                    });
                    
                    if (files.length === 0) {
                        logger.error(`No video files found in torrent. Files: ${torrent.files.map(f => f.name).join(', ')}`);
                        return reject(new Error('No video files found'));
                    }
                    
                    const file = files[fileIdx] || files[0];
                    logger.info(`Selected file: ${file.name} (${file.length} bytes)`);

                    const stream = {
                        file,
                        torrent,
                        createStream: (start, end) => {
                            if (start !== undefined && end !== undefined) {
                                return file.createReadStream({ start, end });
                            }
                            return file.createReadStream();
                        },
                        destroy: () => torrent.destroy(),
                        lastAccessed: Date.now()
                    };

                    this.activeTorrents.set(magnetUri, stream);
                    resolve(stream);
                };

                // Check if torrent is already ready (for existing torrents)
                if (torrent.ready) {
                    logger.debug(`Torrent already ready for ${magnetUri.substring(0, 50)}...`);
                    processTorrent();
                    return;
                }

                // For new torrents or torrents that aren't ready yet, set up event listeners
                const timeout = setTimeout(() => {
                    logger.error(`Torrent timeout for: ${magnetUri.substring(0, 50)}...`);
                    if (torrent && typeof torrent.destroy === 'function') {
                        torrent.destroy();
                    }
                    reject(new Error('Torrent adding timeout'));
                }, 60000); // Increased timeout to 60 seconds

                torrent.on('ready', () => {
                    clearTimeout(timeout);
                    processTorrent();
                });

                torrent.on('error', error => {
                    clearTimeout(timeout);
                    logger.error(`Torrent error for ${magnetUri.substring(0, 50)}...:`, error);
                    reject(error);
                });

                // Log progress for debugging
                torrent.on('download', () => {
                    logger.debug(`Download progress: ${(torrent.progress * 100).toFixed(1)}%`);
                });

            } catch (error) {
                logger.error('getStream error:', error);
                reject(error);
            }
        });
    }

    /**
     * Stream a torrent over HTTP
     * @param {Object} req - Express request object
     * @param {Object} res - Express response object  
     * @param {string} infoHash - Torrent info hash
     */
    async streamTorrent(req, res, infoHash) {
        try {
            if (!infoHash) {
                logger.error('No infoHash provided for streaming');
                return res.status(400).json({ error: 'Missing torrent info hash' });
            }

            // Convert infoHash to magnet URI - add trackers for better connectivity
            const trackers = config.torrent.trackers.map(t => `&tr=${encodeURIComponent(t)}`).join('');
            const magnetUri = `magnet:?xt=urn:btih:${infoHash}${trackers}`;
            logger.info(`Starting torrent stream for hash: ${infoHash}`);
            
            // Check if response is already sent (avoid multiple headers)
            if (res.headersSent) {
                logger.warn(`Headers already sent for ${infoHash}`);
                return;
            }

            const torrentStream = await this.getStream(magnetUri);
            
            if (!torrentStream || !torrentStream.file) {
                logger.error(`No valid torrent stream found for ${infoHash}`);
                return res.status(404).json({ error: 'Stream not found' });
            }

            const file = torrentStream.file;
            const fileSize = file.length;
            
            if (!fileSize || fileSize <= 0) {
                logger.error(`Invalid file size for ${infoHash}: ${fileSize}`);
                return res.status(500).json({ error: 'Invalid file size' });
            }

            // Get range header for partial content support
            const range = req.headers.range;
            
            // Handle connection cleanup
            req.on('close', () => {
                logger.debug(`Connection closed for ${infoHash}`);
            });

            req.on('error', (err) => {
                logger.error(`Request error for ${infoHash}:`, err);
            });
            
            if (range) {
                // Parse range header
                const parts = range.replace(/bytes=/, "").split("-");
                const start = parseInt(parts[0], 10);
                const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
                
                // Validate range
                if (start >= fileSize || end >= fileSize || start > end) {
                    logger.error(`Invalid range for ${infoHash}: ${start}-${end}/${fileSize}`);
                    return res.status(416).json({ error: 'Invalid range' });
                }
                
                const chunksize = (end - start) + 1;
                
                // Set headers for partial content
                res.writeHead(206, {
                    'Content-Range': `bytes ${start}-${end}/${fileSize}`,
                    'Accept-Ranges': 'bytes',
                    'Content-Length': chunksize,
                    'Content-Type': 'video/mp4',
                    'Access-Control-Allow-Origin': '*',
                    'Access-Control-Allow-Headers': 'Range'
                });
                
                // Create read stream for the range
                const stream = torrentStream.createStream(start, end);
                stream.on('error', (err) => {
                    logger.error(`Stream error for ${infoHash}:`, err);
                });
                stream.pipe(res);
                
            } else {
                // No range requested, send entire file
                res.writeHead(200, {
                    'Content-Length': fileSize,
                    'Content-Type': 'video/mp4',
                    'Access-Control-Allow-Origin': '*'
                });
                
                const stream = torrentStream.createStream();
                stream.on('error', (err) => {
                    logger.error(`Full stream error for ${infoHash}:`, err);
                });
                stream.pipe(res);
            }
            
            // Update last accessed time
            torrentStream.lastAccessed = Date.now();
            
        } catch (error) {
            logger.error(`Torrent streaming error for ${infoHash}:`, error);
            
            // Only send error response if headers not already sent
            if (!res.headersSent) {
                res.status(500).json({ error: 'Failed to stream torrent' });
            }
        }
    }

    cleanup() {
        const now = Date.now();
        for (const [magnetUri, stream] of this.activeTorrents.entries()) {
            const lastAccessed = stream.lastAccessed || 0;
            if (now - lastAccessed > config.torrent.cleanupInterval) {
                stream.destroy();
                this.activeTorrents.delete(magnetUri);
            }
        }
    }

    destroy() {
        this.client.destroy();
        this.activeTorrents.clear();
    }
}

export default new TorrentService();
