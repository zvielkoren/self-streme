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

    async getStream(magnetUri, fileIdx = 0, retryCount = 0) {
        const maxRetries = 2; // Maximum number of retries
        
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
                logger.info(`Extracted info hash: ${infoHash}, retry: ${retryCount}`);

                // Check if torrent already exists by searching through active torrents
                let torrent = this.client.torrents.find(t => t.infoHash === infoHash);
                
                if (torrent) {
                    logger.info(`Found existing torrent for ${infoHash}`);
                } else {
                    logger.info(`Adding new torrent: ${magnetUri.substring(0, 50)}...`);
                    
                    // Add additional trackers to improve connectivity
                    const enhancedMagnetUri = this.enhanceMagnetUri(magnetUri);
                    torrent = this.client.add(enhancedMagnetUri, { 
                        path: config.torrent.downloadPath,
                        announce: config.torrent.trackers
                    });
                    logger.info(`Torrent add initiated with enhanced trackers`);
                }
                
                // Validate torrent object
                if (!torrent || typeof torrent.on !== 'function') {
                    logger.error(`Invalid torrent object - type: ${typeof torrent}, constructor: ${torrent && torrent.constructor ? torrent.constructor.name : 'unknown'}`);
                    
                    // Retry logic for failed torrent creation
                    if (retryCount < maxRetries) {
                        logger.info(`Retrying torrent creation (${retryCount + 1}/${maxRetries})`);
                        setTimeout(() => {
                            this.getStream(magnetUri, fileIdx, retryCount + 1)
                                .then(resolve)
                                .catch(reject);
                        }, 5000); // Wait 5 seconds before retry
                        return;
                    }
                    
                    return reject(new Error('Invalid torrent object after retries'));
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
                }, 120000); // Increased timeout to 120 seconds for better reliability

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

            // Attempt to get stream with retry logic
            let torrentStream;
            try {
                torrentStream = await this.getStream(magnetUri);
            } catch (streamError) {
                logger.error(`Failed to get torrent stream for ${infoHash}:`, streamError.message);
                
                // Try fallback: direct file access if available
                const fallbackStream = await this.tryFallbackFileStream(infoHash);
                if (fallbackStream) {
                    logger.info(`Using fallback file stream for ${infoHash}`);
                    return this.streamFromFile(req, res, fallbackStream.path, fallbackStream.size, infoHash);
                }
                
                // No fallback available
                if (!res.headersSent) {
                    return res.status(404).json({ error: 'Stream not found or timed out' });
                }
                return;
            }
            
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

            logger.info(`Hash to video conversion successful: ${infoHash} -> ${file.name} (${fileSize} bytes)`);

            // Check if file exists on disk and use file stream for better performance
            const filePath = path.join(config.torrent.downloadPath, file.path);
            const useFileStream = await this.shouldUseFileStream(filePath, fileSize, torrentStream.torrent);
            
            if (useFileStream) {
                logger.info(`Using file stream for ${infoHash}: ${filePath}`);
                return this.streamFromFile(req, res, filePath, fileSize, infoHash);
            } else {
                logger.info(`Using torrent stream for ${infoHash} (file not ready)`);
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

    /**
     * Check if we should use file stream instead of torrent stream
     * @param {string} filePath - Path to the downloaded file
     * @param {number} expectedSize - Expected file size
     * @param {object} torrent - Torrent object for progress check
     * @returns {Promise<boolean>}
     */
    async shouldUseFileStream(filePath, expectedSize, torrent) {
        try {
            // Check if file exists
            if (!fs.existsSync(filePath)) {
                return false;
            }

            const stats = fs.statSync(filePath);
            const downloadedSize = stats.size;
            
            // If file is completely downloaded, always use file stream
            if (downloadedSize >= expectedSize) {
                logger.debug(`File fully downloaded: ${downloadedSize}/${expectedSize} bytes`);
                return true;
            }

            // If file is partially downloaded but has significant progress (>10%), use file stream
            const progress = downloadedSize / expectedSize;
            if (progress > 0.1 && torrent.progress > 0.05) {
                logger.debug(`File partially downloaded: ${(progress * 100).toFixed(1)}% (${downloadedSize}/${expectedSize} bytes), torrent progress: ${(torrent.progress * 100).toFixed(1)}%`);
                return true;
            }

            return false;
        } catch (error) {
            logger.debug(`Error checking file stream availability: ${error.message}`);
            return false;
        }
    }

    /**
     * Stream content from downloaded file on disk
     * @param {object} req - Request object
     * @param {object} res - Response object  
     * @param {string} filePath - Path to the file
     * @param {number} fileSize - Size of the file
     * @param {string} infoHash - Info hash for logging
     */
    async streamFromFile(req, res, filePath, fileSize, infoHash) {
        try {
            const range = req.headers.range;
            
            // Handle connection cleanup
            req.on('close', () => {
                logger.debug(`File stream connection closed for ${infoHash}`);
            });

            req.on('error', (err) => {
                logger.error(`File stream request error for ${infoHash}:`, err);
            });

            if (range) {
                // Parse range header
                const parts = range.replace(/bytes=/, "").split("-");
                const start = parseInt(parts[0], 10);
                const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
                
                // Validate range
                if (start >= fileSize || end >= fileSize || start > end) {
                    logger.error(`Invalid range for file ${infoHash}: ${start}-${end}/${fileSize}`);
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
                const stream = fs.createReadStream(filePath, { start, end });
                stream.on('error', (err) => {
                    logger.error(`File stream error for ${infoHash}:`, err);
                });
                stream.pipe(res);
                
            } else {
                // No range requested, send entire file
                res.writeHead(200, {
                    'Content-Length': fileSize,
                    'Content-Type': 'video/mp4',
                    'Access-Control-Allow-Origin': '*'
                });
                
                const stream = fs.createReadStream(filePath);
                stream.on('error', (err) => {
                    logger.error(`Full file stream error for ${infoHash}:`, err);
                });
                stream.pipe(res);
            }
            
        } catch (error) {
            logger.error(`File streaming error for ${infoHash}:`, error);
            if (!res.headersSent) {
                res.status(500).json({ error: 'Failed to stream file' });
            }
        }
    }

    /**
     * Try to find a fallback file stream for direct access
     * @param {string} infoHash - Torrent info hash
     * @returns {Promise<object|null>} File stream info or null
     */
    async tryFallbackFileStream(infoHash) {
        try {
            // Look for any files in download directory that might match this hash
            const downloadPath = config.torrent.downloadPath;
            if (!fs.existsSync(downloadPath)) {
                return null;
            }
            
            // Check for any subdirectories or files that contain the hash
            const items = fs.readdirSync(downloadPath);
            for (const item of items) {
                const itemPath = path.join(downloadPath, item);
                const stats = fs.statSync(itemPath);
                
                if (stats.isDirectory()) {
                    // Check if directory name contains hash or look for video files inside
                    const videoFiles = this.findVideoFilesInDirectory(itemPath);
                    if (videoFiles.length > 0) {
                        const firstVideo = videoFiles[0];
                        const videoStats = fs.statSync(firstVideo);
                        if (videoStats.size > 1024 * 1024) { // At least 1MB
                            logger.info(`Found fallback video file: ${firstVideo}`);
                            return {
                                path: firstVideo,
                                size: videoStats.size
                            };
                        }
                    }
                } else if (stats.isFile()) {
                    // Check if it's a video file
                    const ext = path.extname(item).toLowerCase();
                    const videoExtensions = ['.mp4', '.mkv', '.avi', '.mov', '.m4v', '.webm', '.flv'];
                    if (videoExtensions.includes(ext) && stats.size > 1024 * 1024) {
                        logger.info(`Found fallback video file: ${itemPath}`);
                        return {
                            path: itemPath,
                            size: stats.size
                        };
                    }
                }
            }
            
            return null;
        } catch (error) {
            logger.debug(`Error in fallback file stream search: ${error.message}`);
            return null;
        }
    }

    /**
     * Find video files in a directory
     * @param {string} dirPath - Directory path
     * @returns {Array<string>} Array of video file paths
     */
    findVideoFilesInDirectory(dirPath) {
        try {
            const items = fs.readdirSync(dirPath);
            const videoExtensions = ['.mp4', '.mkv', '.avi', '.mov', '.m4v', '.webm', '.flv'];
            
            return items
                .map(item => path.join(dirPath, item))
                .filter(itemPath => {
                    try {
                        const stats = fs.statSync(itemPath);
                        if (stats.isFile()) {
                            const ext = path.extname(itemPath).toLowerCase();
                            return videoExtensions.includes(ext);
                        }
                        return false;
                    } catch (err) {
                        return false;
                    }
                });
        } catch (error) {
            return [];
        }
    }

    /**
     * Enhance magnet URI with additional trackers for better connectivity
     * @param {string} magnetUri - Original magnet URI
     * @returns {string} Enhanced magnet URI with additional trackers
     */
    enhanceMagnetUri(magnetUri) {
        // If magnet already has trackers, don't duplicate
        if (magnetUri.includes('&tr=')) {
            return magnetUri;
        }
        
        // Add configured trackers to magnet URI
        const trackers = config.torrent.trackers.map(t => `&tr=${encodeURIComponent(t)}`).join('');
        return magnetUri + trackers;
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
