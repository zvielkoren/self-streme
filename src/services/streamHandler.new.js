import torrentService from './torrentService.new.js';
import externalService from './external/index.js';
import logger from '../utils/logger.js';
import { getTorrentStreams } from "../providers/torrents/index.js";

export async function getStreams(type, imdbId, metadata) {
  const streams = await getTorrentStreams(metadata);
  return streams;
}

// Initialize the torrent service
await torrentService.initialize().catch(error => {
  logger.error("Failed to initialize torrent service:", error);
  process.exit(1);
});

/**
 * Convert torrent info to Stremio stream object
 * @param {Object} torrentInfo 
 * @returns {Object} Stremio stream object
 */
function buildStream(torrentInfo) {
  try {
    const magnetMatch = torrentInfo.magnet.match(/btih:([^&]+)/i);
    if (!magnetMatch) {
      logger.warn('Invalid magnet link format:', torrentInfo.magnet);
      return null;
    }

    const stream = {
      name: 'Self-Streme',
      title: torrentInfo.title,
      infoHash: magnetMatch[1],
      fileIdx: 0,
      sources: [torrentInfo.magnet],
      seeders: torrentInfo.seeders,
      size: torrentInfo.size,
      provider: torrentInfo.provider
    };

    // Add quality info if available
    if (torrentInfo.quality) {
      stream.title += ` [${torrentInfo.quality}]`;
    }

    // Add provider name
    stream.title += ` [${torrentInfo.provider}]`;

    return stream;
  } catch (error) {
    logger.error('Error building stream:', error);
    return null;
  }
}

/**
 * Get all streams for a given type and ID, including both local and external
 * @param {string} type - 'movie' or 'series'
 * @param {string} id - IMDB ID
 * @returns {Promise<Array>} Array of stream objects
 */
async function getStreams(type, id) {
  try {
    logger.debug(`Getting streams for ${type}: ${id}`);

    // First get local torrent results
    const [error, torrentResults] = await torrentService.searchTorrents(id, type);
    if (error) {
      logger.error(`Error searching local torrents for ${id}:`, error);
    }

    // Convert local results to streams
    const localStreams = (torrentResults || [])
      .map(buildStream)
      .filter(Boolean);

    logger.info(`Found ${localStreams.length} local streams for ${id}`);

    // Get external streams and merge them with local streams
    const allStreams = await externalService.handleExternalSearch(id, type, localStreams);
    
    // Log final results
    logger.info(`Total available streams for ${id}: ${allStreams.length}`);
    allStreams.forEach((stream, index) => {
      logger.debug(`Stream ${index + 1}: ${stream.title} [${stream.source || 'unknown'}]`);
    });

    return allStreams;
  } catch (error) {
    logger.error('Error in getStreams:', error);
    // Return local streams as fallback if external search fails
    return localStreams || [];
  }
}

const streamHandler = {
  getStreams
};

export default streamHandler;
