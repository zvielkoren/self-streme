import axios from 'axios';
import logger from '../../utils/logger.js';
import { config } from '../../config/index.js';

// Example external APIs - Replace with actual APIs in production
const EXTERNAL_APIS = {
    TORRENTIO: 'https://torrentio.strem.fun/stream/movie/',
    JACKETT: config.external?.jackett?.url || 'http://localhost:9117/api/v2.0/indexers/all/results',
    JACKETT_API_KEY: config.external?.jackett?.apiKey
};

/**
 * Search external sources for streams
 * @param {Object} metadata - Content metadata
 * @returns {Promise<Array>} Array of stream objects
 */
async function searchExternal(metadata) {
    logger.info(`Searching external sources for: ${metadata.title} (${metadata.year})`);
    const streams = [];

    try {
        // Example: Search Torrentio
        if (metadata.type === 'movie') {
            const torrentioUrl = `${EXTERNAL_APIS.TORRENTIO}${metadata.imdbId}.json`;
            const torrentioResponse = await axios.get(torrentioUrl, { timeout: 5000 });
            
            if (torrentioResponse.data?.streams) {
                const torrentioStreams = torrentioResponse.data.streams.map(stream => ({
                    ...stream,
                    source: 'torrentio'
                }));
                streams.push(...torrentioStreams);
            }
        }

        // Example: Search Jackett if configured
        if (EXTERNAL_APIS.JACKETT_API_KEY) {
            const jackettResponse = await axios.get(EXTERNAL_APIS.JACKETT, {
                params: {
                    apikey: EXTERNAL_APIS.JACKETT_API_KEY,
                    Query: `${metadata.title} ${metadata.year}`,
                    Category: metadata.type === 'movie' ? '2000' : '5000'
                },
                timeout: 10000
            });

            if (jackettResponse.data?.Results) {
                const jackettStreams = jackettResponse.data.Results.map(result => ({
                    name: 'Self-Streme',
                    title: `${result.Title} [Jackett]`,
                    infoHash: result.MagnetUri?.match(/btih:([^&]+)/i)?.[1],
                    fileIdx: 0,
                    sources: [result.MagnetUri],
                    seeders: result.Seeders,
                    source: 'jackett'
                })).filter(stream => stream.infoHash);
                
                streams.push(...jackettStreams);
            }
        }

        // Example: Add a direct stream (for demonstration)
        if (metadata.type === 'movie') {
            streams.push({
                name: 'Self-Streme',
                title: `${metadata.title} [Direct]`,
                url: `https://example.com/movies/${metadata.imdbId}/stream.mp4`,
                source: 'direct'
            });
        }

        logger.info(`Found ${streams.length} external streams`);
        return streams;
    } catch (error) {
        logger.error('Error searching external sources:', error.message);
        return [];
    }
}

export default {
    searchExternal
};
