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
