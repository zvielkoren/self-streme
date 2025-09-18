import logger from '../utils/logger.js';
import WebTorrent from 'webtorrent';
import pump from 'pump';
import rangeParser from 'range-parser';

class ProxyService {
    constructor() {
        this.client = new WebTorrent();
        this.activeStreams = new Map();
    }

    async streamTorrent(req, res, infoHash) {
        try {
            // Get or create torrent
            let torrent = this.client.get(infoHash) || 
                         await this.addTorrent(infoHash);

            // Wait for torrent metadata
            if (!torrent.files || !torrent.files.length) {
                await new Promise(resolve => torrent.once('metadata', resolve));
            }

            // Get the largest file
            const file = torrent.files.reduce((a, b) => 
                a.length > b.length ? a : b);

            // Handle range requests
            const range = req.headers.range;
            const ranges = range ? rangeParser(file.length, range) : null;
            
            res.setHeader('Accept-Ranges', 'bytes');
            res.setHeader('Content-Type', 'video/mp4');
            res.setHeader('Cache-Control', 'no-cache');
            
            if (!range) {
                res.setHeader('Content-Length', file.length);
                pump(file.createReadStream(), res);
            } else {
                const { start, end } = ranges[0];
                res.statusCode = 206;
                res.setHeader('Content-Length', end - start + 1);
                res.setHeader('Content-Range', 
                    `bytes ${start}-${end}/${file.length}`);
                pump(file.createReadStream({ start, end }), res);
            }

            // Track active stream
            this.activeStreams.set(infoHash, {
                torrent,
                lastAccessed: Date.now()
            });

        } catch (error) {
            logger.error('Streaming error:', error);
            res.status(500).send('Streaming error');
        }
    }

    async addTorrent(infoHash) {
        return new Promise((resolve, reject) => {
            // Check if torrent already exists in WebTorrent client
            let torrent = this.client.get(infoHash);
            if (torrent) {
                logger.debug(`Found existing torrent in client for ${infoHash}`);
                return resolve(torrent);
            }

            const magnet = `magnet:?xt=urn:btih:${infoHash}`;
            torrent = this.client.add(magnet, {
                announce: [
                    "wss://tracker.openwebtorrent.com",
                    "wss://tracker.btorrent.xyz"
                ]
            });

            torrent.once('ready', () => resolve(torrent));
            torrent.once('error', reject);
        });
    }

    cleanup() {
        const now = Date.now();
        for (const [infoHash, stream] of this.activeStreams) {
            if (now - stream.lastAccessed > 3600000) { // 1 hour
                stream.torrent.destroy();
                this.activeStreams.delete(infoHash);
            }
        }
    }

    destroy() {
        this.client.destroy();
    }
}

export default new ProxyService();