import dgram from "dgram";
import net from "net";
import { EventEmitter } from "events";
import logger from "../utils/logger.js";

/**
 * Hole Punching Service for P2P NAT Traversal
 *
 * Features:
 * - STUN (Session Traversal Utilities for NAT) support
 * - UDP hole punching
 * - TCP hole punching with simultaneous open
 * - Multiple NAT type detection (Full Cone, Restricted, Port Restricted, Symmetric)
 * - Port prediction for sequential port allocation
 * - Peer coordination and signaling
 * - Connection keep-alive mechanisms
 * - Multiple NAT traversal strategies
 */
class HolePunchingService extends EventEmitter {
  constructor(options = {}) {
    super();

    this.stunServers = options.stunServers || [
      { host: "stun.l.google.com", port: 19302 },
      { host: "stun1.l.google.com", port: 19302 },
      { host: "stun2.l.google.com", port: 19302 },
      { host: "stun3.l.google.com", port: 19302 },
      { host: "stun4.l.google.com", port: 19302 },
      { host: "stun.stunprotocol.org", port: 3478 },
      { host: "stun.voip.blackberry.com", port: 3478 },
      { host: "stun.cloudflare.com", port: 3478 },
      { host: "stun.nextcloud.com", port: 3478 },
    ];

    this.turnServers = options.turnServers || [];
    this.localPort = options.localPort || 0; // 0 = random
    this.keepAliveInterval = options.keepAliveInterval || 25000; // 25 seconds
    this.connectionTimeout = options.connectionTimeout || 30000; // 30 seconds

    // Connection tracking
    this.peers = new Map(); // peerId -> peer info
    this.activeSockets = new Map(); // socketId -> socket
    this.keepAliveTimers = new Map(); // socketId -> interval
    this.pendingConnections = new Map(); // connectionId -> connection attempt
    this.maxRetries = options.maxRetries || 3;

    this.natInfo = null;
    this.publicAddress = null;
    this.initialized = false;

    logger.info("HolePunchingService initialized", {
      stunServers: this.stunServers.length,
      turnServers: this.turnServers.length,
    });
  }

  /**
   * Initialize the service and detect NAT type
   */
  async initialize() {
    try {
      logger.info("Detecting NAT type and public address...");
      this.natInfo = await this.detectNATType();
      this.publicAddress = this.natInfo.publicAddress;

      logger.info("NAT detection complete", {
        type: this.natInfo.type,
        publicIP: this.publicAddress.address,
        publicPort: this.publicAddress.port,
        hairpinning: this.natInfo.hairpinning,
      });

      this.initialized = true;
      this.emit("initialized", this.natInfo);
      return this.natInfo;
    } catch (error) {
      logger.error("Failed to initialize hole punching service:", error);
      throw error;
    }
  }

  /**
   * Detect NAT type using STUN
   * Returns: Open Internet, Full Cone, Restricted Cone, Port Restricted Cone, or Symmetric
   */
  async detectNATType() {
    const socket = dgram.createSocket("udp4");

    try {
      await this.bindSocket(socket);
      const localPort = socket.address().port;

      // Test 1: Get mapped address from primary STUN server
      const stun1 = this.stunServers[0];
      const mappedAddr1 = await this.stunRequest(
        socket,
        stun1.host,
        stun1.port,
      );

      if (!mappedAddr1) {
        throw new Error("Failed to get mapped address from STUN server");
      }

      // Test 2: Request from same server, different port (if server supports it)
      const mappedAddr2 = await this.stunRequest(
        socket,
        stun1.host,
        stun1.port,
      );

      // Test 3: Request from different server
      const stun2 = this.stunServers[1] || stun1;
      const mappedAddr3 = await this.stunRequest(
        socket,
        stun2.host,
        stun2.port,
      );

      // Analyze results to determine NAT type
      const natType = this.analyzeNATType(
        mappedAddr1,
        mappedAddr2,
        mappedAddr3,
        localPort,
      );

      // Test for hairpinning (NAT loopback)
      const hairpinning = await this.testHairpinning(socket, mappedAddr1);

      socket.close();

      return {
        type: natType,
        publicAddress: mappedAddr1,
        localPort,
        hairpinning,
        portPredictable: this.isPortPredictable(
          mappedAddr1,
          mappedAddr2,
          mappedAddr3,
        ),
      };
    } catch (error) {
      socket.close();
      throw error;
    }
  }

  /**
   * Analyze NAT type based on STUN responses
   */
  analyzeNATType(addr1, addr2, addr3, localPort) {
    // If mapped address equals local address, no NAT
    if (addr1.port === localPort) {
      return "Open Internet";
    }

    // If all mapped addresses are the same
    if (addr1.port === addr2.port && addr1.port === addr3.port) {
      return "Full Cone NAT";
    }

    // If addresses from same server are same, but different server differs
    if (addr1.port === addr2.port && addr1.port !== addr3.port) {
      return "Symmetric NAT";
    }

    // Check if it's port restricted or address restricted
    // This would require more sophisticated STUN requests
    // For now, assume Port Restricted Cone NAT
    return "Port Restricted Cone NAT";
  }

  /**
   * Test if NAT supports hairpinning
   */
  async testHairpinning(socket, publicAddr) {
    return new Promise((resolve) => {
      const timeout = setTimeout(() => {
        socket.removeAllListeners("message");
        resolve(false);
      }, 5000);

      socket.once("message", (msg) => {
        clearTimeout(timeout);
        resolve(true);
      });

      // Try to send to our own public address
      const testMsg = Buffer.from("hairpin-test");
      socket.send(testMsg, publicAddr.port, publicAddr.address);
    });
  }

  /**
   * Check if port allocation is predictable
   */
  isPortPredictable(addr1, addr2, addr3) {
    if (!addr2 || !addr3) return false;

    const diff1 = Math.abs(addr2.port - addr1.port);
    const diff2 = Math.abs(addr3.port - addr2.port);

    // If port increments are small and consistent, it's predictable
    return diff1 === diff2 && diff1 < 10;
  }

  /**
   * Perform UDP hole punching
   */
  async punchUDPHole(peerInfo) {
    const { peerId, address, port } = peerInfo;

    logger.info(
      `Attempting UDP hole punch to peer ${peerId} at ${address}:${port}`,
    );

    const socket = dgram.createSocket("udp4");
    await this.bindSocket(socket);

    const localPort = socket.address().port;
    const socketId = `udp-${peerId}-${Date.now()}`;

    this.activeSockets.set(socketId, socket);

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        socket.close();
        this.activeSockets.delete(socketId);
        reject(new Error("UDP hole punching timeout"));
      }, this.connectionTimeout);

      // Send punch packets
      const punchInterval = setInterval(() => {
        const punchMsg = Buffer.from(
          JSON.stringify({
            type: "punch",
            peerId: peerId,
            timestamp: Date.now(),
          }),
        );

        socket.send(punchMsg, port, address, (err) => {
          if (err) {
            logger.error("Error sending punch packet:", err);
          }
        });
      }, 500); // Send every 500ms

      // Listen for response
      socket.on("message", (msg, rinfo) => {
        try {
          const data = JSON.parse(msg.toString());

          if (data.type === "punch-ack" || data.type === "punch") {
            clearTimeout(timeout);
            clearInterval(punchInterval);

            logger.info(`UDP hole successfully punched to ${address}:${port}`);

            // Setup keep-alive
            this.setupKeepAlive(socketId, socket, address, port);

            resolve({
              socketId,
              socket,
              localPort,
              remoteAddress: rinfo.address,
              remotePort: rinfo.port,
            });
          }
        } catch (error) {
          // Ignore malformed messages
        }
      });

      socket.on("error", (err) => {
        clearTimeout(timeout);
        clearInterval(punchInterval);
        socket.close();
        this.activeSockets.delete(socketId);
        reject(err);
      });
    });
  }

  /**
   * Perform TCP hole punching with simultaneous open
   */
  async punchTCPHole(peerInfo) {
    const { peerId, address, port } = peerInfo;

    logger.info(
      `Attempting TCP hole punch to peer ${peerId} at ${address}:${port}`,
    );

    return new Promise((resolve, reject) => {
      const socket = new net.Socket();
      const socketId = `tcp-${peerId}-${Date.now()}`;

      // Bind to specific local port if needed
      if (this.localPort > 0) {
        socket.bind(this.localPort);
      }

      const timeout = setTimeout(() => {
        socket.destroy();
        reject(new Error("TCP hole punching timeout"));
      }, this.connectionTimeout);

      // Attempt simultaneous open
      socket.connect({
        port,
        host: address,
        localPort: this.localPort > 0 ? this.localPort : undefined,
      });

      socket.on("connect", () => {
        clearTimeout(timeout);

        logger.info(`TCP hole successfully punched to ${address}:${port}`);

        this.activeSockets.set(socketId, socket);

        // Setup keep-alive
        socket.setKeepAlive(true, this.keepAliveInterval);

        resolve({
          socketId,
          socket,
          localPort: socket.localPort,
          remoteAddress: socket.remoteAddress,
          remotePort: socket.remotePort,
        });
      });

      socket.on("error", (err) => {
        clearTimeout(timeout);

        // Simultaneous open failed, try passive approach
        if (err.code === "ECONNREFUSED" || err.code === "ETIMEDOUT") {
          logger.warn(
            `TCP simultaneous open failed, attempting passive connection`,
          );
          this.attemptPassiveTCP(peerInfo, socketId)
            .then(resolve)
            .catch(reject);
        } else {
          reject(err);
        }
      });
    });
  }

  /**
   * Attempt passive TCP connection (for fallback)
   */
  async attemptPassiveTCP(peerInfo, socketId) {
    const { address, port } = peerInfo;

    return new Promise((resolve, reject) => {
      const socket = new net.Socket();

      const timeout = setTimeout(() => {
        socket.destroy();
        reject(new Error("Passive TCP connection timeout"));
      }, this.connectionTimeout);

      socket.connect(port, address);

      socket.on("connect", () => {
        clearTimeout(timeout);
        this.activeSockets.set(socketId, socket);
        socket.setKeepAlive(true, this.keepAliveInterval);

        resolve({
          socketId,
          socket,
          localPort: socket.localPort,
          remoteAddress: socket.remoteAddress,
          remotePort: socket.remotePort,
        });
      });

      socket.on("error", (err) => {
        clearTimeout(timeout);
        reject(err);
      });
    });
  }

  /**
   * Predict next port for symmetric NAT
   */
  predictNextPort(currentPort, increment = 1) {
    // Most NATs use sequential or random port allocation
    // This attempts to predict the next port
    const predictions = [
      currentPort + increment,
      currentPort + increment * 2,
      currentPort - increment,
      currentPort + 10,
      currentPort + 100,
    ];

    return predictions;
  }

  /**
   * Perform birthday attack for symmetric NAT
   * Try multiple predicted ports simultaneously
   */
  async birthdayAttack(peerInfo) {
    const { peerId, address, port } = peerInfo;

    logger.info(`Attempting birthday attack for symmetric NAT peer ${peerId}`);

    const predictedPorts = this.predictNextPort(port);
    const attempts = [];

    // Try all predicted ports simultaneously
    for (const predictedPort of predictedPorts) {
      attempts.push(
        this.punchUDPHole({
          ...peerInfo,
          port: predictedPort,
        }).catch(() => null), // Ignore individual failures
      );
    }

    // Return first successful connection
    const results = await Promise.all(attempts);

    const successful = results.find((r) => r !== null);

    if (successful) {
      logger.info(
        `Birthday attack successful on port ${successful.remotePort}`,
      );
      return successful;
    }

    throw new Error(
      "Birthday attack failed - could not punch through symmetric NAT",
    );
  }

  /**
   * Setup keep-alive mechanism for UDP connection
   */
  setupKeepAlive(socketId, socket, address, port) {
    const timer = setInterval(() => {
      const keepAliveMsg = Buffer.from(
        JSON.stringify({
          type: "keep-alive",
          timestamp: Date.now(),
        }),
      );

      socket.send(keepAliveMsg, port, address, (err) => {
        if (err) {
          logger.error(`Keep-alive failed for ${socketId}:`, err);
          this.closeConnection(socketId);
        }
      });
    }, this.keepAliveInterval);

    this.keepAliveTimers.set(socketId, timer);
  }

  /**
   * Perform STUN request
   */
  async stunRequest(socket, stunHost, stunPort) {
    return new Promise((resolve, reject) => {
      // STUN Binding Request (RFC 5389)
      const transactionId = Buffer.allocUnsafe(12);
      for (let i = 0; i < 12; i++) {
        transactionId[i] = Math.floor(Math.random() * 256);
      }

      // STUN message format:
      // 0-1: Message Type (0x0001 = Binding Request)
      // 2-3: Message Length
      // 4-7: Magic Cookie (0x2112A442)
      // 8-19: Transaction ID
      const request = Buffer.allocUnsafe(20);
      request.writeUInt16BE(0x0001, 0); // Binding Request
      request.writeUInt16BE(0x0000, 2); // Length (no attributes)
      request.writeUInt32BE(0x2112a442, 4); // Magic Cookie
      transactionId.copy(request, 8);

      const timeout = setTimeout(() => {
        socket.removeAllListeners("message");
        reject(new Error("STUN request timeout"));
      }, 5000);

      const messageHandler = (msg, rinfo) => {
        try {
          // Verify this is a STUN response for our request
          if (msg.length < 20) return;

          const msgType = msg.readUInt16BE(0);
          const msgTransactionId = msg.slice(8, 20);

          // 0x0101 = Binding Response
          if (msgType === 0x0101 && msgTransactionId.equals(transactionId)) {
            clearTimeout(timeout);
            socket.removeListener("message", messageHandler);

            // Parse XOR-MAPPED-ADDRESS attribute
            const mappedAddress = this.parseSTUNResponse(msg);
            resolve(mappedAddress);
          }
        } catch (error) {
          // Continue listening for valid response
        }
      };

      socket.on("message", messageHandler);

      socket.send(request, stunPort, stunHost, (err) => {
        if (err) {
          clearTimeout(timeout);
          socket.removeListener("message", messageHandler);
          reject(err);
        }
      });
    });
  }

  /**
   * Parse STUN response to extract mapped address
   */
  parseSTUNResponse(msg) {
    const magicCookie = 0x2112a442;
    let offset = 20; // Skip header

    while (offset < msg.length) {
      if (offset + 4 > msg.length) break;

      const attrType = msg.readUInt16BE(offset);
      const attrLength = msg.readUInt16BE(offset + 2);
      offset += 4;

      if (offset + attrLength > msg.length) break;

      // 0x0020 = XOR-MAPPED-ADDRESS (preferred)
      // 0x0001 = MAPPED-ADDRESS (fallback)
      if (attrType === 0x0020 || attrType === 0x0001) {
        const family = msg.readUInt8(offset + 1);
        const port = msg.readUInt16BE(offset + 2);

        let address;

        if (family === 0x01) {
          // IPv4
          const ip = msg.slice(offset + 4, offset + 8);

          if (attrType === 0x0020) {
            // XOR-MAPPED-ADDRESS: XOR with magic cookie
            const xorPort = port ^ (magicCookie >> 16);
            const xorIP = Buffer.allocUnsafe(4);
            for (let i = 0; i < 4; i++) {
              xorIP[i] = ip[i] ^ ((magicCookie >> (24 - i * 8)) & 0xff);
            }
            address = {
              address: `${xorIP[0]}.${xorIP[1]}.${xorIP[2]}.${xorIP[3]}`,
              port: xorPort,
            };
          } else {
            // MAPPED-ADDRESS: no XOR
            address = {
              address: `${ip[0]}.${ip[1]}.${ip[2]}.${ip[3]}`,
              port,
            };
          }

          return address;
        }
      }

      offset += attrLength;
      // Attributes are padded to 4-byte boundary
      offset = Math.ceil(offset / 4) * 4;
    }

    return null;
  }

  /**
   * Bind socket to local port
   */
  async bindSocket(socket) {
    return new Promise((resolve, reject) => {
      socket.once("error", reject);
      socket.bind(this.localPort, () => {
        socket.removeListener("error", reject);
        resolve();
      });
    });
  }

  /**
   * Register a peer for connection
   */
  registerPeer(peerId, peerInfo) {
    this.peers.set(peerId, {
      ...peerInfo,
      registeredAt: Date.now(),
    });

    logger.info(`Peer registered: ${peerId}`, peerInfo);
  }

  /**
   * Connect to a peer using best available method
   */
  async connectToPeer(peerId) {
    const peerInfo = this.peers.get(peerId);

    if (!peerInfo) {
      throw new Error(`Peer ${peerId} not registered`);
    }

    logger.info(`Connecting to peer ${peerId}...`);

    // Try UDP hole punching first (most compatible)
    try {
      const connection = await this.punchUDPHole(peerInfo);
      this.emit("connected", { peerId, connection, method: "udp" });
      return connection;
    } catch (error) {
      logger.warn(`UDP hole punching failed for ${peerId}:`, error.message);
    }

    // Try TCP hole punching
    try {
      const connection = await this.punchTCPHole(peerInfo);
      this.emit("connected", { peerId, connection, method: "tcp" });
      return connection;
    } catch (error) {
      logger.warn(`TCP hole punching failed for ${peerId}:`, error.message);
    }

    // For symmetric NAT, try birthday attack
    if (this.natInfo?.type === "Symmetric NAT") {
      try {
        const connection = await this.birthdayAttack(peerInfo);
        this.emit("connected", { peerId, connection, method: "birthday" });
        return connection;
      } catch (error) {
        logger.warn(`Birthday attack failed for ${peerId}:`, error.message);
      }
    }

    // If all else fails, suggest TURN relay
    throw new Error(
      `Unable to establish P2P connection to ${peerId}. TURN relay required.`,
    );
  }

  /**
   * Close a connection
   */
  closeConnection(socketId) {
    const socket = this.activeSockets.get(socketId);

    if (socket) {
      try {
        socket.close ? socket.close() : socket.destroy();
      } catch (error) {
        logger.error(`Error closing socket ${socketId}:`, error);
      }

      this.activeSockets.delete(socketId);
    }

    const timer = this.keepAliveTimers.get(socketId);
    if (timer) {
      clearInterval(timer);
      this.keepAliveTimers.delete(socketId);
    }

    logger.info(`Connection closed: ${socketId}`);
  }

  /**
   * Get service statistics
   */
  getStats() {
    return {
      natType: this.natInfo?.type || "Unknown",
      publicAddress: this.publicAddress,
      activePeers: this.peers.size,
      activeConnections: this.activeSockets.size,
      stunServers: this.stunServers.length,
      turnServers: this.turnServers.length,
    };
  }

  /**
   * Shutdown the service
   */
  async shutdown() {
    logger.info("Shutting down HolePunchingService...");

    // Close all active connections
    for (const socketId of this.activeSockets.keys()) {
      this.closeConnection(socketId);
    }

    // Clear all timers
    for (const timer of this.keepAliveTimers.values()) {
      clearInterval(timer);
    }

    this.peers.clear();
    this.activeSockets.clear();
    this.keepAliveTimers.clear();
    this.pendingConnections.clear();

    this.emit("shutdown");
    logger.info("HolePunchingService shutdown complete");
  }
}

export default HolePunchingService;
