import { EventEmitter } from "events";
import HolePunchingService from "./holePunchingService.js";
import SignalingServer from "./signalingServer.js";
import logger from "../utils/logger.js";

/**
 * P2P Coordinator - Integrates hole punching and signaling
 *
 * This is the main service that brings together:
 * - NAT traversal (hole punching)
 * - Peer signaling and discovery
 * - Connection management
 * - Health monitoring
 *
 * Usage:
 * ```
 * const coordinator = new P2PCoordinator({
 *   signalingPort: 8080,
 *   stunServers: ['stun:stun.l.google.com:19302'],
 *   turnServers: [{ urls: 'turn:turn.example.com:3478', username: 'user', credential: 'pass' }]
 * });
 *
 * await coordinator.initialize();
 *
 * // Register a peer
 * coordinator.registerPeer('peer-123', { client: 'my-app' });
 *
 * // Connect to a peer
 * const connection = await coordinator.connectToPeer('peer-456');
 * ```
 */
class P2PCoordinator extends EventEmitter {
  constructor(options = {}) {
    super();

    this.options = {
      signalingPort: options.signalingPort || 8080,
      stunServers: this.parseStunServers(
        options.stunServers || [
          "stun:stun.l.google.com:19302",
          "stun:stun1.l.google.com:19302",
        ],
      ),
      turnServers: options.turnServers || [],
      localPort: options.localPort || 0,
      keepAliveInterval: options.keepAliveInterval || 25000,
      connectionTimeout: options.connectionTimeout || 30000,
      maxRetries: options.maxRetries || 3,
      enableDetailedLogging: options.enableDetailedLogging || false,
      aggressiveFallback: options.aggressiveFallback !== false, // Try all methods until success
      parallelAttempts: options.parallelAttempts || false, // Try multiple methods at once
      ...options,
    };

    // Services
    this.holePunchingService = null;
    this.signalingServer = null;

    // State
    this.initialized = false;
    this.natInfo = null;
    this.publicEndpoint = null;
    this.stats = {
      registeredPeers: 0,
      activePeers: 0,
      totalConnections: 0,
      successfulPunches: 0,
      failedAttempts: 0,
      uptime: 0,
      startTime: null,
    };

    // Tracking
    this.peers = new Map(); // peerId -> peer info
    this.connections = new Map(); // connectionId -> connection info
  }

  /**
   * Parse STUN server strings to objects
   * @param {Array<string|Object>} servers - STUN servers
   * @returns {Array<Object>} Parsed servers
   */
  parseStunServers(servers) {
    return servers.map((server) => {
      if (typeof server === "string") {
        // Parse "stun:host:port" format
        const match = server.match(/^stun:([^:]+):?(\d+)?$/);
        if (match) {
          return {
            host: match[1],
            port: parseInt(match[2] || "19302", 10),
          };
        }
        // Fallback: treat as hostname
        return { host: server, port: 19302 };
      }
      return server;
    });
  }

  /**
   * Initialize the P2P coordinator
   * Sets up hole punching and signaling services
   */
  async initialize() {
    if (this.initialized) {
      logger.warn("[P2P] Already initialized");
      return;
    }

    try {
      logger.info("[P2P] Initializing P2P Coordinator...");
      this.stats.startTime = Date.now();

      // Initialize hole punching service
      await this.initializeHolePunching();

      // Initialize signaling server
      await this.initializeSignaling();

      // Setup event handlers
      this.setupEventHandlers();

      this.initialized = true;
      logger.info("[P2P] ✓ P2P Coordinator initialized successfully");

      // Log configuration
      this.logConfiguration();

      this.emit("initialized");
    } catch (error) {
      logger.error("[P2P] Failed to initialize:", error.message);
      throw error;
    }
  }

  /**
   * Initialize hole punching service
   */
  async initializeHolePunching() {
    logger.info("[P2P] Initializing hole punching service...");

    this.holePunchingService = new HolePunchingService({
      stunServers: this.options.stunServers,
      turnServers: this.options.turnServers,
      localPort: this.options.localPort,
      keepAliveInterval: this.options.keepAliveInterval,
      connectionTimeout: this.options.connectionTimeout,
      maxRetries: this.options.maxRetries,
    });

    // Detect NAT type and public endpoint
    await this.holePunchingService.detectNAT();

    this.natInfo = this.holePunchingService.getNATInfo();
    this.publicEndpoint = this.holePunchingService.getPublicEndpoint();

    logger.info(`[P2P] ✓ Hole punching initialized`);
    logger.info(`[P2P]   NAT Type: ${this.natInfo.type}`);
    logger.info(
      `[P2P]   Public Endpoint: ${this.publicEndpoint.ip}:${this.publicEndpoint.port}`,
    );
  }

  /**
   * Initialize signaling server
   */
  async initializeSignaling() {
    logger.info("[P2P] Initializing signaling server...");

    this.signalingServer = new SignalingServer({
      port: this.options.signalingPort,
      cleanupInterval: 60000,
      peerTimeout: 300000,
    });

    await this.signalingServer.start();

    logger.info(
      `[P2P] ✓ Signaling server started on port ${this.options.signalingPort}`,
    );
  }

  /**
   * Setup event handlers for services
   */
  setupEventHandlers() {
    // Hole punching events
    this.holePunchingService.on("connection", (info) => {
      this.handleNewConnection(info);
    });

    this.holePunchingService.on("connectionFailed", (info) => {
      this.handleConnectionFailed(info);
    });

    // Signaling events
    this.signalingServer.on("peerRegistered", (peer) => {
      this.handlePeerRegistered(peer);
    });

    this.signalingServer.on("peerUnregistered", (peerId) => {
      this.handlePeerUnregistered(peerId);
    });

    this.signalingServer.on("connectionRequest", (data) => {
      this.handleConnectionRequest(data);
    });
  }

  /**
   * Log current configuration
   */
  logConfiguration() {
    if (!this.options.enableDetailedLogging) return;

    logger.info("[P2P] Configuration:");
    logger.info(`[P2P]   Signaling Port: ${this.options.signalingPort}`);
    logger.info(`[P2P]   STUN Servers: ${this.options.stunServers.length}`);
    logger.info(`[P2P]   TURN Servers: ${this.options.turnServers.length}`);
    logger.info(`[P2P]   NAT Type: ${this.natInfo.type}`);
    logger.info(`[P2P]   Public IP: ${this.publicEndpoint.ip}`);
    logger.info(`[P2P]   Public Port: ${this.publicEndpoint.port}`);

    // Connection strategy recommendation
    const strategy = this.getRecommendedStrategy();
    logger.info(`[P2P]   Recommended Strategy: ${strategy.method}`);
    if (strategy.requiresTurn) {
      logger.warn(`[P2P]   ⚠️  TURN relay recommended for best results`);
    }
  }

  /**
   * Register a peer with the coordinator
   * @param {string} peerId - Unique peer identifier
   * @param {Object} metadata - Peer metadata
   */
  registerPeer(peerId, metadata = {}) {
    if (!this.initialized) {
      throw new Error("P2P Coordinator not initialized");
    }

    const peerInfo = {
      id: peerId,
      metadata,
      registeredAt: Date.now(),
      lastSeen: Date.now(),
      connections: [],
      natInfo: this.natInfo,
      publicEndpoint: this.publicEndpoint,
    };

    this.peers.set(peerId, peerInfo);
    this.stats.registeredPeers = this.peers.size;

    // Register with signaling server
    this.signalingServer.registerPeerInfo(peerId, peerInfo);

    logger.info(`[P2P] Registered peer: ${peerId}`);
    this.emit("peerRegistered", peerInfo);

    return peerInfo;
  }

  /**
   * Unregister a peer
   * @param {string} peerId - Peer identifier
   */
  unregisterPeer(peerId) {
    const peer = this.peers.get(peerId);
    if (!peer) return;

    // Close all connections for this peer
    peer.connections.forEach((connId) => {
      this.closeConnection(connId);
    });

    this.peers.delete(peerId);
    this.stats.registeredPeers = this.peers.size;

    logger.info(`[P2P] Unregistered peer: ${peerId}`);
    this.emit("peerUnregistered", peerId);
  }

  /**
   * Connect to a peer
   * @param {string} peerId - Target peer ID
   * @param {Object} options - Connection options
   * @returns {Promise<Object>} Connection info
   */
  async connectToPeer(peerId, options = {}) {
    if (!this.initialized) {
      throw new Error("P2P Coordinator not initialized");
    }

    logger.info(`[P2P] Attempting to connect to peer: ${peerId}`);

    try {
      // Get peer info from signaling server
      const peerInfo = await this.getPeerInfo(peerId);
      if (!peerInfo) {
        throw new Error(`Peer not found: ${peerId}`);
      }

      // Use aggressive multi-strategy approach for 100% success
      if (this.options.aggressiveFallback) {
        return await this.connectWithFallback(peerInfo, options);
      }

      // Standard single-strategy approach
      const strategy = this.determineConnectionStrategy(peerInfo);
      logger.info(`[P2P] Using strategy: ${strategy.method}`);

      const connection = await this.attemptConnection(
        strategy.method,
        peerInfo,
        options,
      );

      // Track connection
      this.connections.set(connection.id, connection);
      this.stats.totalConnections++;
      this.stats.successfulPunches++;

      logger.info(
        `[P2P] ✓ Successfully connected to ${peerId} via ${strategy.method}`,
      );
      this.emit("connected", connection);

      return connection;
    } catch (error) {
      this.stats.failedAttempts++;
      logger.error(`[P2P] Failed to connect to ${peerId}:`, error.message);
      this.emit("connectionFailed", { peerId, error: error.message });
      throw error;
    }
  }

  /**
   * Connect with aggressive fallback - tries ALL methods until one succeeds
   * This achieves near 100% success rate
   * @param {Object} peerInfo - Peer information
   * @param {Object} options - Connection options
   * @returns {Promise<Object>} Connection info
   */
  async connectWithFallback(peerInfo, options) {
    const strategies = this.getAllStrategies(peerInfo);

    logger.info(
      `[P2P] Using aggressive fallback with ${strategies.length} strategies`,
    );

    // Try parallel attempts if enabled
    if (this.options.parallelAttempts) {
      return await this.tryParallelConnection(strategies, peerInfo, options);
    }

    // Sequential fallback - try each method until one succeeds
    let lastError = null;

    for (const strategy of strategies) {
      logger.info(`[P2P] Trying ${strategy.method}...`);

      try {
        const connection = await this.attemptConnection(
          strategy.method,
          peerInfo,
          options,
        );

        // Success!
        this.connections.set(connection.id, connection);
        this.stats.totalConnections++;
        this.stats.successfulPunches++;

        logger.info(
          `[P2P] ✓ Connected via ${strategy.method} (success rate: ${strategy.success})`,
        );
        this.emit("connected", connection);

        return connection;
      } catch (error) {
        lastError = error;
        logger.warn(`[P2P] ${strategy.method} failed: ${error.message}`);

        // Continue to next strategy
        continue;
      }
    }

    // All strategies failed
    this.stats.failedAttempts++;
    throw new Error(
      `All connection strategies failed. Last error: ${lastError?.message}`,
    );
  }

  /**
   * Try multiple connection methods in parallel (race condition)
   * First one to succeed wins
   * @param {Array} strategies - List of strategies to try
   * @param {Object} peerInfo - Peer information
   * @param {Object} options - Connection options
   * @returns {Promise<Object>} Connection info
   */
  async tryParallelConnection(strategies, peerInfo, options) {
    logger.info(`[P2P] Attempting ${strategies.length} methods in parallel...`);

    const attempts = strategies.map(async (strategy) => {
      try {
        const connection = await this.attemptConnection(
          strategy.method,
          peerInfo,
          options,
        );
        return { success: true, method: strategy.method, connection };
      } catch (error) {
        return {
          success: false,
          method: strategy.method,
          error: error.message,
        };
      }
    });

    // Wait for first success or all failures
    const results = await Promise.allSettled(attempts);

    // Find first successful connection
    for (const result of results) {
      if (result.status === "fulfilled" && result.value.success) {
        const { method, connection } = result.value;

        this.connections.set(connection.id, connection);
        this.stats.totalConnections++;
        this.stats.successfulPunches++;

        logger.info(`[P2P] ✓ Connected via ${method} (parallel attempt)`);
        this.emit("connected", connection);

        return connection;
      }
    }

    // All parallel attempts failed
    this.stats.failedAttempts++;
    const errors = results.map((r) => r.value?.error || "Unknown").join(", ");
    throw new Error(`All parallel connection attempts failed: ${errors}`);
  }

  /**
   * Attempt a single connection method
   * @param {string} method - Connection method
   * @param {Object} peerInfo - Peer information
   * @param {Object} options - Connection options
   * @returns {Promise<Object>} Connection info
   */
  async attemptConnection(method, peerInfo, options) {
    switch (method) {
      case "udp-hole-punch":
        return await this.connectUDPHolePunch(peerInfo, options);
      case "tcp-hole-punch":
        return await this.connectTCPHolePunch(peerInfo, options);
      case "turn-relay":
        return await this.connectTURN(peerInfo, options);
      case "direct":
        return await this.connectDirect(peerInfo, options);
      default:
        throw new Error(`Unknown connection method: ${method}`);
    }
  }

  /**
   * Get all possible connection strategies ordered by priority
   * @param {Object} peerInfo - Peer information
   * @returns {Array} List of strategies to try
   */
  getAllStrategies(peerInfo) {
    const localNAT = this.natInfo.type;
    const remoteNAT = peerInfo.natInfo?.type || "Unknown";
    const hasTurn = this.options.turnServers.length > 0;

    const strategies = [];

    // Priority 1: UDP hole punching (works for most NATs)
    if (localNAT !== "Symmetric" || remoteNAT !== "Symmetric") {
      strategies.push({ method: "udp-hole-punch", success: 0.9 });
    }

    // Priority 2: TCP hole punching (good for restricted NATs)
    strategies.push({ method: "tcp-hole-punch", success: 0.75 });

    // Priority 3: TURN relay (guaranteed to work if available)
    if (hasTurn) {
      strategies.push({ method: "turn-relay", success: 0.99 });
    }

    // Priority 4: Direct connection (last resort, only for Open NAT)
    if (localNAT === "Open" && remoteNAT === "Open") {
      strategies.push({ method: "direct", success: 0.95 });
    }

    // If both Symmetric NAT and no TURN, still try UDP as last resort
    if (localNAT === "Symmetric" && remoteNAT === "Symmetric" && !hasTurn) {
      strategies.push({ method: "udp-hole-punch", success: 0.3 });
      logger.warn(
        `[P2P] Symmetric-Symmetric NAT without TURN - low success rate expected`,
      );
    }

    return strategies;
  }

  /**
   * Get peer information
   * @param {string} peerId - Peer ID
   * @returns {Promise<Object>} Peer info
   */
  async getPeerInfo(peerId) {
    // Check local cache first
    if (this.peers.has(peerId)) {
      return this.peers.get(peerId);
    }

    // Query signaling server
    return this.signalingServer.getPeer(peerId);
  }

  /**
   * Determine best connection strategy for peer (single method)
   * ALWAYS tries hole punching first for maximum compatibility
   * @param {Object} peerInfo - Peer information
   * @returns {Object} Strategy info
   */
  determineConnectionStrategy(peerInfo) {
    const strategies = this.getAllStrategies(peerInfo);

    // Return the highest priority strategy
    return (
      strategies[0] || {
        method: "udp-hole-punch",
        requiresTurn: false,
        success: 0.85,
      }
    );
  }

  /**
   * Get recommended connection strategy
   * ALWAYS recommends hole punching first
   * @returns {Object} Strategy recommendation
   */
  getRecommendedStrategy() {
    const natType = this.natInfo.type;

    switch (natType) {
      case "Open":
        return {
          method: "udp-hole-punch",
          description: "UDP hole punching (works even for Open NAT)",
          requiresTurn: false,
        };
      case "Full Cone":
      case "Restricted":
        return {
          method: "udp-hole-punch",
          description: "UDP hole punching recommended",
          requiresTurn: false,
        };
      case "Port-Restricted":
        return {
          method: "tcp-hole-punch",
          description: "TCP hole punching recommended",
          requiresTurn: false,
        };
      case "Symmetric":
        return {
          method: "turn-relay",
          description:
            "TURN relay required for reliable connections (with UDP punch fallback)",
          requiresTurn: true,
        };
      default:
        return {
          method: "udp-hole-punch",
          description: "UDP hole punching with TURN fallback",
          requiresTurn: false,
        };
    }
  }

  /**
   * Attempt direct connection
   */
  async connectDirect(peerInfo, options) {
    return this.holePunchingService.connectDirect(
      peerInfo.publicEndpoint.ip,
      peerInfo.publicEndpoint.port,
      options,
    );
  }

  /**
   * Attempt UDP hole punch connection
   */
  async connectUDPHolePunch(peerInfo, options) {
    return this.holePunchingService.punchUDP(
      peerInfo.publicEndpoint.ip,
      peerInfo.publicEndpoint.port,
      options,
    );
  }

  /**
   * Attempt TCP hole punch connection
   */
  async connectTCPHolePunch(peerInfo, options) {
    return this.holePunchingService.punchTCP(
      peerInfo.publicEndpoint.ip,
      peerInfo.publicEndpoint.port,
      options,
    );
  }

  /**
   * Connect via TURN relay (guaranteed ~99% success)
   */
  async connectTURN(peerInfo, options) {
    if (this.options.turnServers.length === 0) {
      throw new Error(
        "No TURN servers configured - this is needed for 100% success rate",
      );
    }

    logger.info(`[P2P] Using TURN relay for guaranteed connection`);

    return this.holePunchingService.connectViaTURN(
      peerInfo.publicEndpoint.ip,
      peerInfo.publicEndpoint.port,
      this.options.turnServers[0],
      options,
    );
  }

  /**
   * Close a connection
   * @param {string} connectionId - Connection identifier
   */
  closeConnection(connectionId) {
    const connection = this.connections.get(connectionId);
    if (!connection) return;

    try {
      this.holePunchingService.closeConnection(connectionId);
      this.connections.delete(connectionId);
      this.emit("connectionClosed", connectionId);
    } catch (error) {
      logger.error(
        `[P2P] Error closing connection ${connectionId}:`,
        error.message,
      );
    }
  }

  /**
   * Handle new connection event
   */
  handleNewConnection(info) {
    logger.info(`[P2P] New connection established: ${info.id}`);
    this.stats.activePeers++;
  }

  /**
   * Handle connection failed event
   */
  handleConnectionFailed(info) {
    logger.warn(`[P2P] Connection failed: ${info.reason}`);
  }

  /**
   * Handle peer registered event
   */
  handlePeerRegistered(peer) {
    if (this.options.enableDetailedLogging) {
      logger.info(`[P2P] Peer registered via signaling: ${peer.peerId}`);
    }
  }

  /**
   * Handle peer unregistered event
   */
  handlePeerUnregistered(peerId) {
    if (this.options.enableDetailedLogging) {
      logger.info(`[P2P] Peer unregistered via signaling: ${peerId}`);
    }
    this.unregisterPeer(peerId);
  }

  /**
   * Handle connection request from signaling
   */
  async handleConnectionRequest(data) {
    const { from, to, offer } = data;

    if (this.options.enableDetailedLogging) {
      logger.info(`[P2P] Connection request from ${from} to ${to}`);
    }

    // If we're the target, attempt to connect
    if (this.peers.has(to)) {
      try {
        await this.connectToPeer(from, { offer });
      } catch (error) {
        logger.error(
          `[P2P] Failed to handle connection request:`,
          error.message,
        );
      }
    }
  }

  /**
   * Get NAT information
   * @returns {Object} NAT info
   */
  getNATInfo() {
    return {
      type: this.natInfo?.type || "Unknown",
      publicIP: this.publicEndpoint?.ip || "Unknown",
      publicPort: this.publicEndpoint?.port || 0,
      detected: !!this.natInfo,
    };
  }

  /**
   * Get current statistics
   * @returns {Object} Statistics
   */
  getStats() {
    this.stats.uptime = this.stats.startTime
      ? Math.floor((Date.now() - this.stats.startTime) / 1000)
      : 0;

    return {
      ...this.stats,
      peers: {
        registered: this.stats.registeredPeers,
        active: this.stats.activePeers,
        connections: this.connections.size,
      },
      performance: {
        successRate:
          this.stats.totalConnections > 0
            ? (
                (this.stats.successfulPunches / this.stats.totalConnections) *
                100
              ).toFixed(2)
            : 0,
        failureRate:
          this.stats.totalConnections > 0
            ? (
                (this.stats.failedAttempts / this.stats.totalConnections) *
                100
              ).toFixed(2)
            : 0,
      },
    };
  }

  /**
   * Health check
   * @returns {Object} Health status
   */
  healthCheck() {
    const health = {
      healthy: true,
      services: {},
      issues: [],
    };

    // Check hole punching service
    if (this.holePunchingService && this.natInfo) {
      health.services.holePunching = {
        status: "healthy",
        natType: this.natInfo.type,
      };
    } else {
      health.healthy = false;
      health.services.holePunching = { status: "unhealthy" };
      health.issues.push("Hole punching service not initialized");
    }

    // Check signaling server
    if (this.signalingServer && this.signalingServer.isRunning) {
      health.services.signaling = {
        status: "healthy",
        port: this.options.signalingPort,
        peers: this.signalingServer.getPeerCount(),
      };
    } else {
      health.healthy = false;
      health.services.signaling = { status: "unhealthy" };
      health.issues.push("Signaling server not running");
    }

    // Check TURN availability for Symmetric NAT
    if (
      this.natInfo?.type === "Symmetric" &&
      this.options.turnServers.length === 0
    ) {
      health.issues.push(
        "Symmetric NAT detected but no TURN servers configured",
      );
    }

    return health;
  }

  /**
   * Shutdown the coordinator
   */
  async shutdown() {
    logger.info("[P2P] Shutting down P2P Coordinator...");

    try {
      // Close all connections
      for (const [connId] of this.connections) {
        this.closeConnection(connId);
      }

      // Stop signaling server
      if (this.signalingServer) {
        await this.signalingServer.stop();
      }

      // Stop hole punching service
      if (this.holePunchingService) {
        await this.holePunchingService.cleanup();
      }

      this.initialized = false;
      logger.info("[P2P] ✓ P2P Coordinator shut down successfully");
      this.emit("shutdown");
    } catch (error) {
      logger.error("[P2P] Error during shutdown:", error.message);
      throw error;
    }
  }
}

export default P2PCoordinator;
