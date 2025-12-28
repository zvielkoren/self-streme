import P2PCoordinator from '../src/services/p2pCoordinator.js';
import TorrentService from '../src/services/torrentService.js';
import ScalableCacheManager from '../src/services/scalableCacheManager.js';
import logger from '../src/utils/logger.js';

/**
 * Example: Integrating P2P Hole Punching with Torrent Service
 *
 * This example shows how to enhance WebTorrent connectivity with
 * automatic NAT traversal and peer coordination.
 */

class EnhancedTorrentService {
  constructor(options = {}) {
    // Initialize cache manager
    this.cacheManager = new ScalableCacheManager({
      backend: 'memory',
      maxSize: 1000,
    });

    // Initialize torrent service
    this.torrentService = new TorrentService(this.cacheManager);

    // Initialize P2P coordinator
    this.p2p = new P2PCoordinator({
      signalingPort: options.signalingPort || 8080,
      enableSignaling: true,
      enableHolePunching: true,
      stunServers: [
        { host: 'stun.l.google.com', port: 19302 },
        { host: 'stun.cloudflare.com', port: 3478 },
      ],
    });

    // Track peer connections
    this.peerConnections = new Map();

    this.setupEventHandlers();
  }

  /**
   * Setup event handlers for P2P and torrent integration
   */
  setupEventHandlers() {
    // P2P Events
    this.p2p.on('initialized', (info) => {
      logger.info('P2P services initialized', {
        natType: info.natInfo?.type,
        publicAddress: info.natInfo?.publicAddress,
      });

      // Log connection strategy recommendation
      const strategy = this.p2p.getRecommendedStrategy();
      logger.info('Recommended connection strategy', {
        strategy: strategy.strategy,
        difficulty: strategy.difficulty,
        methods: strategy.methods,
      });
    });

    this.p2p.on('peer-registered', ({ peerId, metadata }) => {
      logger.info(`Peer registered: ${peerId}`, metadata);
    });

    this.p2p.on('peer-connected', ({ peerId, connection, method }) => {
      logger.info(`P2P connection established with ${peerId} via ${method}`);
      this.peerConnections.set(peerId, {
        connection,
        method,
        connectedAt: Date.now(),
      });
    });

    this.p2p.on('peer-disconnected', ({ peerId }) => {
      logger.info(`Peer disconnected: ${peerId}`);
      this.peerConnections.delete(peerId);
    });

    // WebTorrent Events
    if (this.torrentService.client) {
      // When we discover a new peer through DHT
      this.torrentService.client.on('peer', (peer) => {
        this.handleNewPeer(peer);
      });

      // When a wire connection is established
      this.torrentService.client.on('wire', (wire, addr) => {
        logger.debug(`Wire connection from: ${addr}`);
        this.handleWireConnection(wire, addr);
      });
    }
  }

  /**
   * Handle new peer discovery from DHT
   */
  async handleNewPeer(peer) {
    try {
      const peerId = peer.id || peer.addr;
      const [address, port] = peer.addr.split(':');

      logger.info(`Discovered peer: ${peerId} at ${address}:${port}`);

      // Register peer with P2P coordinator
      this.p2p.registerPeer(peerId, {
        address,
        port: parseInt(port),
        metadata: {
          source: 'dht',
          discoveredAt: Date.now(),
        },
      });

      // Attempt to establish enhanced P2P connection
      await this.attemptP2PConnection(peerId);
    } catch (error) {
      logger.debug(`Failed to setup P2P for peer: ${error.message}`);
    }
  }

  /**
   * Attempt to establish P2P connection with enhanced NAT traversal
   */
  async attemptP2PConnection(peerId) {
    try {
      // Check if we already have a connection
      if (this.peerConnections.has(peerId)) {
        logger.debug(`Already connected to ${peerId}`);
        return;
      }

      // Try to establish P2P connection with hole punching
      logger.info(`Attempting P2P connection to ${peerId}...`);
      const connection = await this.p2p.connectToPeer(peerId);

      logger.info(`Successfully connected to ${peerId} via ${connection.method}`);

      return connection;
    } catch (error) {
      logger.warn(`P2P connection failed for ${peerId}: ${error.message}`);
      // WebTorrent will continue using standard connections
    }
  }

  /**
   * Handle wire connection (WebTorrent protocol connection)
   */
  handleWireConnection(wire, addr) {
    // If wire connection fails, try hole punching as fallback
    wire.on('close', async () => {
      logger.debug(`Wire connection closed from ${addr}`);

      try {
        const peerId = addr.replace(/[:.]/g, '-');
        const existingConnection = this.peerConnections.get(peerId);

        if (!existingConnection) {
          logger.info(`Attempting hole-punched reconnection to ${addr}`);
          await this.attemptP2PConnection(peerId);
        }
      } catch (error) {
        logger.debug(`Hole punching fallback failed: ${error.message}`);
      }
    });

    wire.on('error', (error) => {
      logger.debug(`Wire error from ${addr}:`, error.message);
    });
  }

  /**
   * Add torrent with enhanced P2P connectivity
   */
  async addTorrent(magnetUri, options = {}) {
    try {
      logger.info('Adding torrent with P2P enhancement...');

      // Add torrent using standard service
      const torrent = await this.torrentService.addTorrent(magnetUri, options);

      // Create room for this torrent's swarm
      const infoHash = torrent.infoHash;
      const roomId = `torrent-${infoHash}`;

      logger.info(`Created P2P room for torrent: ${roomId}`);

      return torrent;
    } catch (error) {
      logger.error('Failed to add torrent:', error);
      throw error;
    }
  }

  /**
   * Get comprehensive statistics
   */
  getStats() {
    const torrentStats = this.torrentService.getClientStats();
    const p2pStats = this.p2p.getStats();

    return {
      torrents: torrentStats,
      p2p: p2pStats,
      peerConnections: {
        total: this.peerConnections.size,
        connections: Array.from(this.peerConnections.entries()).map(([peerId, info]) => ({
          peerId,
          method: info.method,
          duration: Date.now() - info.connectedAt,
        })),
      },
    };
  }

  /**
   * Initialize all services
   */
  async initialize() {
    logger.info('Initializing Enhanced Torrent Service...');

    // Initialize P2P coordinator
    await this.p2p.initialize();

    // Wait a bit for NAT detection to complete
    await new Promise(resolve => setTimeout(resolve, 2000));

    logger.info('Enhanced Torrent Service ready');

    return {
      natInfo: this.p2p.getNATInfo(),
      strategy: this.p2p.getRecommendedStrategy(),
    };
  }

  /**
   * Shutdown all services
   */
  async shutdown() {
    logger.info('Shutting down Enhanced Torrent Service...');

    // Shutdown torrent service
    await this.torrentService.shutdown();

    // Shutdown P2P coordinator
    await this.p2p.shutdown();

    logger.info('Shutdown complete');
  }
}

// ============================================================================
// Example Usage
// ============================================================================

async function main() {
  const service = new EnhancedTorrentService({
    signalingPort: 8080,
  });

  try {
    // Initialize services
    const info = await service.initialize();

    console.log('\n=== P2P Service Initialized ===');
    console.log('NAT Type:', info.natInfo?.type);
    console.log('Public Address:', info.natInfo?.publicAddress?.address);
    console.log('Public Port:', info.natInfo?.publicAddress?.port);
    console.log('Hairpinning Support:', info.natInfo?.hairpinning ? 'Yes' : 'No');
    console.log('Strategy:', info.strategy.strategy);
    console.log('Recommended Methods:', info.strategy.methods.join(', '));
    console.log('Difficulty:', info.strategy.difficulty);
    console.log('\n');

    // Example: Add a torrent
    // Uncomment to test with a real magnet link
    /*
    const magnetUri = 'magnet:?xt=urn:btih:...';
    const torrent = await service.addTorrent(magnetUri);

    console.log('Torrent added:', torrent.name);
    console.log('Info Hash:', torrent.infoHash);

    // Monitor stats every 10 seconds
    const statsInterval = setInterval(() => {
      const stats = service.getStats();

      console.log('\n=== Stats Update ===');
      console.log('Active Torrents:', stats.torrents.activeTorrents);
      console.log('Download Speed:', (stats.torrents.downloadSpeed / 1024 / 1024).toFixed(2), 'MB/s');
      console.log('Upload Speed:', (stats.torrents.uploadSpeed / 1024 / 1024).toFixed(2), 'MB/s');
      console.log('DHT Nodes:', stats.torrents.dhtNodes);
      console.log('P2P Connections:', stats.peerConnections.total);
      console.log('NAT Type:', stats.p2p.natType);

      if (stats.peerConnections.total > 0) {
        console.log('\nP2P Connection Details:');
        stats.peerConnections.connections.forEach(conn => {
          console.log(`  - ${conn.peerId}: ${conn.method} (${Math.floor(conn.duration / 1000)}s)`);
        });
      }
    }, 10000);
    */

    // Keep running for demonstration
    console.log('Service running. Press Ctrl+C to stop.\n');

    // Graceful shutdown
    process.on('SIGINT', async () => {
      console.log('\nShutting down...');
      await service.shutdown();
      process.exit(0);
    });

  } catch (error) {
    console.error('Error:', error);
    await service.shutdown();
    process.exit(1);
  }
}

// Run example if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}

export default EnhancedTorrentService;
