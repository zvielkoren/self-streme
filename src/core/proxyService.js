import logger from '../utils/logger.js';
import axios from 'axios';
import https from 'https';
import NodeCache from 'node-cache';

/**
 * Core proxy service for managing and rotating proxies
 */
class ProxyService {
    constructor() {
        this.proxies = [];
        this.currentIndex = 0;
        this.cache = new NodeCache({ stdTTL: 3600 }); // Cache proxy test results for 1 hour
        this.initialize();
    }

    /**
     * Initialize proxy list
     */
    async initialize() {
        try {
            await this.updateProxyList();

            // Start periodic proxy testing every 30 minutes
            setInterval(() => this.testProxies(), 1800000);
        } catch (error) {
            logger.error('Proxy service initialization error:', error);
        }
    }

    /**
     * Update proxy list from ProxyScrape
     */
    async updateProxyList() {
        try {
            // Use https.Agent to bypass SSL verification (safe for dev/testing)
            const httpsAgent = new https.Agent({ rejectUnauthorized: false });

            const response = await axios.get(
                'https://api.proxyscrape.com/v2/?request=getproxies&protocol=http&timeout=5000&country=all&ssl=yes&anonymity=elite&simplified=true',
                { httpsAgent }
            );

            if (response.data) {
                const newProxies = response.data
                    .split('\n')
                    .filter(line => line.trim())
                    .map(line => `http://${line.trim()}`);

                // Merge new proxies with existing, remove duplicates
                this.proxies = [...new Set([...this.proxies, ...newProxies])];
                logger.info(`Updated proxy list: ${this.proxies.length} proxies`);
            }
        } catch (error) {
            logger.error('Failed to update proxy list:', error.message);
        }
    }

    /**
     * Test proxies for availability
     */
    async testProxies() {
        const testUrl = 'https://www.google.com';
        const timeout = 5000;

        for (const proxy of this.proxies) {
            try {
                const start = Date.now();
                await axios.get(testUrl, {
                    proxy: {
                        host: proxy.split('://')[1].split(':')[0],
                        port: parseInt(proxy.split(':')[2]),
                        protocol: proxy.split(':')[0]
                    },
                    timeout
                });

                const latency = Date.now() - start;
                this.cache.set(proxy, { working: true, latency });
                logger.debug(`Proxy ${proxy} OK (${latency}ms)`);
            } catch (error) {
                this.cache.set(proxy, { working: false });
                logger.debug(`Proxy ${proxy} failed: ${error.message}`);
            }
        }
    }

    /**
     * Get next working proxy
     * @returns {string|null}
     */
    getProxy() {
        const workingProxies = this.proxies.filter(proxy => {
            const status = this.cache.get(proxy);
            return status && status.working;
        });

        if (workingProxies.length === 0) {
            return null;
        }

        // Round-robin selection
        this.currentIndex = (this.currentIndex + 1) % workingProxies.length;
        return workingProxies[this.currentIndex];
    }

    /**
     * Create axios instance with proxy
     * @returns {Object}
     */
    createAxiosInstance() {
        const proxy = this.getProxy();
        if (!proxy) return axios.create();

        return axios.create({
            proxy: {
                host: proxy.split('://')[1].split(':')[0],
                port: parseInt(proxy.split(':')[2]),
                protocol: proxy.split(':')[0]
            }
        });
    }

    /**
     * Clean up resources
     */
    destroy() {
        this.cache.flushAll();
        this.proxies = [];
        logger.info('ProxyService destroyed.');
    }
}

export default new ProxyService();
