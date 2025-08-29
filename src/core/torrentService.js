import logger from '../utils/logger.js';
import WebTorrent from 'webtorrent';
import { config } from '../config/index.js';

/**
 * Core torrent service for managing torrent downloads and streams
 */
class TorrentService {
    constructor() {
        this.client = new WebTorrent({
            maxConns: config.torrent.maxConnections,
            downloadLimit: config.torrent.downloadLimit,
            uploadLimit: config.torrent.uploadLimit
        });
        
        this.activeTorrents = new Map();
        this.initialize();
    }

    /**
     * Initialize event listeners
     */
    initialize() {
        this.client.on('error', error => {
            logger.error('WebTorrent client error:', error);
        });

        this.client.on('warning', warning => {
            logger.warn('WebTorrent warning:', warning);
        });
    }

    /**
     * Add a torrent and get its stream
     * @param {string} magnetUri 
     * @param {Object} options
     * @returns {Promise<Object>}
     */
    async getStream(magnetUri, options = {}) {
        return new Promise((resolve, reject) => {
            try {
                // Check if torrent is already active
                const existing = this.activeTorrents.get(magnetUri);
                if (existing) {
                    logger.debug(`Reusing existing torrent for ${magnetUri}`);
                    return resolve(existing);
                }

                logger.info(`Adding new torrent: ${magnetUri}`);
                const torrent = this.client.add(magnetUri, {
                    path: config.torrent.downloadPath,
                    ...options
                });

                const timeout = setTimeout(() => {
                    torrent.destroy();
                    reject(new Error('Torrent adding timeout'));
                }, 30000);

                torrent.on('ready', () => {
                    clearTimeout(timeout);
                    
                    // Find the largest video file
                    const files = torrent.files.filter(file => {
                        const ext = file.name.split('.').pop().toLowerCase();
                        return ['mp4', 'mkv', 'avi', 'mov', 'm4v'].includes(ext);
                    });

                    if (files.length === 0) {
                        torrent.destroy();
                        return reject(new Error('No video files found'));
                    }

                    const file = files.reduce((a, b) => a.length > b.length ? a : b);
                    
                    const stream = {
                        file,
                        torrent,
                        createStream: (start, end) => file.createReadStream({ start, end }),
                        destroy: () => torrent.destroy()
                    };

                    this.activeTorrents.set(magnetUri, stream);
                    resolve(stream);
                });

                torrent.on('error', error => {
                    clearTimeout(timeout);
                    logger.error(`Torrent error for ${magnetUri}:`, error);
                    reject(error);
                });

            } catch (error) {
                logger.error('Torrent stream error:', error);
                reject(error);
            }
        });
    }

    /**
     * Clean up old torrents
     */
    cleanup() {
        const now = Date.now();
        for (const [magnetUri, stream] of this.activeTorrents.entries()) {
            const lastAccessed = stream.lastAccessed || 0;
            if (now - lastAccessed > config.torrent.cleanupInterval) {
                logger.debug(`Cleaning up inactive torrent: ${magnetUri}`);
                stream.destroy();
                this.activeTorrents.delete(magnetUri);
            }
        }
    }

    /**
     * Destroy the client and cleanup
     */
    destroy() {
        this.client.destroy();
        this.activeTorrents.clear();
    }
}

export default new TorrentService();
