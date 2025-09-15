import logger from '../utils/logger.js';
import WebTorrent from 'webtorrent';
import { config } from '../config/index.js';

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

    initialize() {
        this.client.on('error', error => logger.error('WebTorrent client error:', error));
        this.client.on('warning', warning => logger.warn('WebTorrent warning:', warning));
    }

    async getStream(magnetUri, fileIdx = 0) {
        return new Promise((resolve, reject) => {
            try {
                const existing = this.activeTorrents.get(magnetUri);
                if (existing) return resolve(existing);

                const torrent = this.client.add(magnetUri, { path: config.torrent.downloadPath });
                const timeout = setTimeout(() => {
                    torrent.destroy();
                    reject(new Error('Torrent adding timeout'));
                }, 30000);

                torrent.on('ready', () => {
                    clearTimeout(timeout);
                    const files = torrent.files.filter(f => ['mp4','mkv','avi','mov','m4v'].includes(f.name.split('.').pop().toLowerCase()));
                    if (files.length === 0) return reject(new Error('No video files found'));
                    const file = files[fileIdx] || files[0];

                    const stream = {
                        file,
                        torrent,
                        createStream: (start,end) => file.createReadStream({start,end}),
                        destroy: () => torrent.destroy()
                    };

                    this.activeTorrents.set(magnetUri, stream);
                    resolve(stream);
                });

                torrent.on('error', error => {
                    clearTimeout(timeout);
                    reject(error);
                });

            } catch (error) {
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
            // Convert infoHash to magnet URI
            const magnetUri = `magnet:?xt=urn:btih:${infoHash}`;
            logger.info(`Starting torrent stream for hash: ${infoHash}`);
            
            const torrentStream = await this.getStream(magnetUri);
            const file = torrentStream.file;
            
            // Get range header for partial content support
            const range = req.headers.range;
            const fileSize = file.length;
            
            if (range) {
                // Parse range header
                const parts = range.replace(/bytes=/, "").split("-");
                const start = parseInt(parts[0], 10);
                const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
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
                stream.pipe(res);
                
            } else {
                // No range requested, send entire file
                res.writeHead(200, {
                    'Content-Length': fileSize,
                    'Content-Type': 'video/mp4',
                    'Access-Control-Allow-Origin': '*'
                });
                
                const stream = torrentStream.createStream();
                stream.pipe(res);
            }
            
            // Update last accessed time
            torrentStream.lastAccessed = Date.now();
            
        } catch (error) {
            logger.error(`Torrent streaming error for ${infoHash}:`, error);
            res.status(500).json({ error: 'Failed to stream torrent' });
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
