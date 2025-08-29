import logger from '../../utils/logger.js';

/**
 * Merge local and external streams, removing duplicates
 * @param {Array} localStreams - Streams from local search
 * @param {Array} externalStreams - Streams from external search
 * @returns {Array} Merged and deduplicated streams
 */
function mergeStreams(localStreams = [], externalStreams = []) {
    logger.info(`Merging ${localStreams.length} local and ${externalStreams.length} external streams`);

    const seen = new Set();
    const merged = [];

    // Process local streams first (giving them priority)
    for (const stream of localStreams) {
        const key = stream.infoHash || stream.url;
        if (key && !seen.has(key)) {
            seen.add(key);
            merged.push({
                ...stream,
                source: 'local'
            });
        }
    }

    // Add external streams if they're not duplicates
    for (const stream of externalStreams) {
        const key = stream.infoHash || stream.url;
        if (key && !seen.has(key)) {
            seen.add(key);
            merged.push(stream);
        }
    }

    // Sort by seeders if available
    merged.sort((a, b) => (b.seeders || 0) - (a.seeders || 0));

    logger.info(`Total merged streams: ${merged.length}`);
    return merged;
}

export default {
    mergeStreams
};
