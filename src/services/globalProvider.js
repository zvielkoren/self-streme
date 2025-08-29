import { searchTorrentio } from '../providers/torrents/torrentio.js';
import { searchJackett } from '../providers/torrents/jackett.js';
import { search1337x } from '../providers/torrents/1337x.js';
// import { searchEztv } from '../providers/torrents/eztv.js';
import { searchPirateBay } from '../providers/torrents/piratebay.js';
import logger from '../../utils/logger.js';

async function searchAll(metadata) {
    logger.info(`🌍 Global Scraping for: ${metadata.title} (${metadata.year})`);

    const providers = [
        searchTorrentio(metadata),
        searchJackett(metadata),
        search1337x(metadata),
        // searchEztv(metadata),
        searchPirateBay(metadata),
        // future: YTS, Nyaa, Google scraper...
    ];

    let results = [];
    try {
        const streamsArray = await Promise.allSettled(providers);

        streamsArray.forEach(res => {
            if (res.status === 'fulfilled') {
                results.push(...res.value);
            } else {
                logger.warn(`Provider failed: ${res.reason}`);
            }
        });

        // סינון כפילויות לפי infoHash / Magnet
        const unique = {};
        results = results.filter(s => {
            if (!s.infoHash) return true;
            if (unique[s.infoHash]) return false;
            unique[s.infoHash] = true;
            return true;
        });

        logger.info(`✅ Global provider found ${results.length} streams`);
        return results;
    } catch (err) {
        logger.error(`Global provider error: ${err.message}`);
        return [];
    }
}

export default { searchAll };
