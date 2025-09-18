import logger from "../../utils/logger.js";

/**
 * Mock provider for testing when external services are not available
 */
class MockProvider {
    constructor() {
        this.name = 'MockProvider';
    }

    async search(params) {
        const { query, year, type, imdbId } = params;
        logger.info(`[Mock] Searching for: ${query} (${year}) [${type}]`);

        // Simulate some delay like a real provider
        await new Promise(resolve => setTimeout(resolve, 100));

        // Generate mock streams based on the title
        const mockStreams = this.generateMockStreams(query, year, type, imdbId);
        
        logger.info(`[Mock] Generated ${mockStreams.length} mock streams`);
        return mockStreams;
    }

    generateMockStreams(title, year, type, imdbId) {
        const qualities = ['1080p', '720p', '480p'];
        const sources = ['WebRip', 'BluRay', 'HDRip'];
        
        return qualities.map((quality, index) => {
            const source = sources[index % sources.length];
            const seeders = Math.floor(Math.random() * 1000) + 50;
            const size = this.generateSize(quality);
            const infoHash = this.generateMockInfoHash(imdbId, quality);
            
            return {
                name: 'MockProvider',
                title: `${title} ${year} ${quality} ${source} [Mock]`,
                quality: quality,
                size: size,
                seeders: seeders,
                source: 'mock',
                // Generate a fake magnet link for testing with consistent hash
                magnet: this.generateMockMagnet(title, year, quality, infoHash),
                infoHash: infoHash,
                type: type
            };
        });
    }

    generateSize(quality) {
        const sizes = {
            '1080p': '2.1 GB',
            '720p': '1.4 GB', 
            '480p': '800 MB'
        };
        return sizes[quality] || '1.2 GB';
    }

    generateMockMagnet(title, year, quality, infoHash) {
        // Use the same hash that's in the infoHash property to ensure consistency
        return `magnet:?xt=urn:btih:${infoHash}&dn=${encodeURIComponent(title + ' ' + year + ' ' + quality)}&tr=udp%3A%2F%2Ftracker.example.com%3A1337`;
    }

    generateMockInfoHash(input, quality = '') {
        // Generate a consistent but fake hash for testing
        const combined = input + quality;
        let hash = '';
        for (let i = 0; i < 40; i++) {
            hash += Math.abs(combined.charCodeAt(i % combined.length) + i).toString(16).slice(-1);
        }
        return hash.substring(0, 40);
    }
}

export default new MockProvider();