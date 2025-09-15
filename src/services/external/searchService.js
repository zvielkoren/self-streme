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
            const cleanImdbId = metadata.imdbId.replace(/\.(json|txt|html)$/, '');
            const torrentioUrl = `${EXTERNAL_APIS.TORRENTIO}${cleanImdbId}`;
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

        // Add direct stream if available in configured sources
        if (metadata.type === 'movie' && config.external?.directStream?.enabled) {
            const cleanImdbId = metadata.imdbId.replace(/\.(json|txt|html)$/, '');
            const baseUrl = config.external.directStream.baseUrl || process.env.DIRECT_STREAM_URL;
            
            if (baseUrl) {
                try {
                    // Check if the stream exists first
                    const streamUrl = `${baseUrl}/movies/${cleanImdbId}/stream.mp4`;
                    const headResponse = await axios.head(streamUrl, { timeout: 5000 });
                    
                    if (headResponse.status === 200) {
                        logger.debug(`Direct stream available for ${cleanImdbId}`);
                        streams.push({
                            name: 'Self-Streme',
                            title: `${metadata.title} [Direct] [${headResponse.headers['content-type'] || 'video/mp4'}]`,
                            url: streamUrl,
                            source: 'direct',
                            size: headResponse.headers['content-length'],
                            quality: metadata.quality || '1080p'
                        });
                    }
                } catch (error) {
                    logger.debug(`No direct stream found for ${cleanImdbId}: ${error.message}`);
                }
            } else {
                logger.warn('Direct streaming enabled but no base URL configured');
            }
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
