import logger from "../../utils/logger.js";

/**
 * Mock provider for testing iOS functionality
 */
class MockProvider {
    constructor() {
        this.name = "Mock";
    }

    async search(params) {
        logger.info(`🔍 [Mock] Testing with: ${params.query} ${params.year}`);
        
        // Return a mock torrent result for testing
        return [{
            title: `${params.query} (${params.year}) 1080p`,
            name: `${params.query} Test Movie`,
            magnet: "magnet:?xt=urn:btih:c12fe1c06bba254a9dc9f519b335aa7c1367a88a&dn=Test+Movie+1080p",
            quality: "1080p",
            size: "2.5 GB",
            seeders: 150,
            source: "mock"
        }];
    }
}

export default new MockProvider();