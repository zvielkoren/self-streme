import { EventEmitter } from 'events';
import express from 'express';
import { createServer } from 'http';
import { WebSocketServer } from 'ws';
import logger from '../utils/logger.js';

/**
 * Signaling Server for P2P Coordination
 *
 * Features:
 * - WebSocket-based peer signaling
 * - Peer registration and discovery
 * - ICE candidate exchange
 * - SDP offer/answer exchange
 * - Room-based peer grouping
 * - Connection state tracking
 * - Automatic cleanup of inactive peers
 */
class SignalingServer extends EventEmitter {
  constructor(options = {}) {
    super();

    this.port = options.port || 8080;
    this.cleanupInterval = options.cleanupInterval || 60000; // 1 minute
    this.peerTimeout = options.peerTimeout || 300000; // 5 minutes

    // Data structures
    this.peers = new Map(); // peerId -> peer info
    this.rooms = new Map(); // roomId -> Set of peerIds
    this.connections = new Map(); // ws -> peerId

    // Express app for HTTP endpoints
    this.app = express();
    this.server = null;
    this.wss = null;
    this.cleanupTimer = null;

    this.setupMiddleware();
    this.setupRoutes();
  }

  /**
   * Setup Express middleware
   */
  setupMiddleware() {
    this.app.use(express.json());

    // CORS
    this.app.use((req, res, next) => {
      res.header('Access-Control-Allow-Origin', '*');
      res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
      res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');

      if (req.method === 'OPTIONS') {
        return res.sendStatus(200);
      }

      next();
    });

    // Request logging
    this.app.use((req, res, next) => {
      logger.debug(`${req.method} ${req.path}`, {
        ip: req.ip,
        query: req.query,
      });
      next();
    });
  }

  /**
   * Setup HTTP routes
   */
  setupRoutes() {
    // Health check
    this.app.get('/health', (req, res) => {
      res.json({
        status: 'ok',
        peers: this.peers.size,
        rooms: this.rooms.size,
        uptime: process.uptime(),
      });
    });

    // Get peers in a room
    this.app.get('/rooms/:roomId/peers', (req, res) => {
      const { roomId } = req.params;
      const room = this.rooms.get(roomId);

      if (!room) {
        return res.json({ peers: [] });
      }

      const peers = Array.from(room).map(peerId => {
        const peer = this.peers.get(peerId);
        return {
          peerId: peer.peerId,
          metadata: peer.metadata,
          joinedAt: peer.joinedAt,
        };
      });

      res.json({ peers });
    });

    // Get all rooms
    this.app.get('/rooms', (req, res) => {
      const rooms = Array.from(this.rooms.entries()).map(([roomId, peerSet]) => ({
        roomId,
        peerCount: peerSet.size,
        peers: Array.from(peerSet),
      }));

      res.json({ rooms });
    });

    // Get statistics
    this.app.get('/stats', (req, res) => {
      const stats = {
        totalPeers: this.peers.size,
        totalRooms: this.rooms.size,
        activeConnections: this.connections.size,
        roomStats: Array.from(this.rooms.entries()).map(([roomId, peerSet]) => ({
          roomId,
          peerCount: peerSet.size,
        })),
      };

      res.json(stats);
    });
  }

  /**
   * Start the signaling server
   */
  async start() {
    return new Promise((resolve, reject) => {
      try {
        // Create HTTP server
        this.server = createServer(this.app);

        // Create WebSocket server
        this.wss = new WebSocketServer({ server: this.server });

        // Setup WebSocket handlers
        this.setupWebSocketHandlers();

        // Start listening
        this.server.listen(this.port, () => {
          logger.info(`Signaling server started on port ${this.port}`);

          // Start cleanup interval
          this.startCleanup();

          resolve();
        });

        this.server.on('error', reject);
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Setup WebSocket event handlers
   */
  setupWebSocketHandlers() {
    this.wss.on('connection', (ws, req) => {
      const clientIp = req.socket.remoteAddress;
      logger.info(`New WebSocket connection from ${clientIp}`);

      ws.on('message', (data) => {
        this.handleMessage(ws, data);
      });

      ws.on('close', () => {
        this.handleDisconnect(ws);
      });

      ws.on('error', (error) => {
        logger.error('WebSocket error:', error);
        this.handleDisconnect(ws);
      });

      // Send welcome message
      this.send(ws, {
        type: 'welcome',
        message: 'Connected to signaling server',
        timestamp: Date.now(),
      });
    });
  }

  /**
   * Handle incoming WebSocket messages
   */
  handleMessage(ws, data) {
    try {
      const message = JSON.parse(data.toString());

      logger.debug('Received message:', message.type, {
        from: message.from || 'unknown',
      });

      switch (message.type) {
        case 'register':
          this.handleRegister(ws, message);
          break;

        case 'join-room':
          this.handleJoinRoom(ws, message);
          break;

        case 'leave-room':
          this.handleLeaveRoom(ws, message);
          break;

        case 'offer':
          this.handleOffer(ws, message);
          break;

        case 'answer':
          this.handleAnswer(ws, message);
          break;

        case 'ice-candidate':
          this.handleIceCandidate(ws, message);
          break;

        case 'signal':
          this.handleSignal(ws, message);
          break;

        case 'broadcast':
          this.handleBroadcast(ws, message);
          break;

        case 'ping':
          this.handlePing(ws, message);
          break;

        default:
          logger.warn('Unknown message type:', message.type);
          this.send(ws, {
            type: 'error',
            error: 'Unknown message type',
            originalType: message.type,
          });
      }
    } catch (error) {
      logger.error('Error handling message:', error);
      this.send(ws, {
        type: 'error',
        error: error.message,
      });
    }
  }

  /**
   * Handle peer registration
   */
  handleRegister(ws, message) {
    const { peerId, metadata = {} } = message;

    if (!peerId) {
      return this.send(ws, {
        type: 'error',
        error: 'peerId is required',
      });
    }

    // Check if peer already exists
    if (this.peers.has(peerId)) {
      // Update existing peer
      const peer = this.peers.get(peerId);
      peer.ws = ws;
      peer.lastSeen = Date.now();
      peer.metadata = { ...peer.metadata, ...metadata };
    } else {
      // Register new peer
      this.peers.set(peerId, {
        peerId,
        ws,
        metadata,
        rooms: new Set(),
        joinedAt: Date.now(),
        lastSeen: Date.now(),
      });
    }

    this.connections.set(ws, peerId);

    logger.info(`Peer registered: ${peerId}`, metadata);

    this.send(ws, {
      type: 'registered',
      peerId,
      timestamp: Date.now(),
    });

    this.emit('peer-registered', { peerId, metadata });
  }

  /**
   * Handle peer joining a room
   */
  handleJoinRoom(ws, message) {
    const { peerId, roomId } = message;

    if (!peerId || !roomId) {
      return this.send(ws, {
        type: 'error',
        error: 'peerId and roomId are required',
      });
    }

    const peer = this.peers.get(peerId);
    if (!peer) {
      return this.send(ws, {
        type: 'error',
        error: 'Peer not registered',
      });
    }

    // Create room if it doesn't exist
    if (!this.rooms.has(roomId)) {
      this.rooms.set(roomId, new Set());
    }

    const room = this.rooms.get(roomId);

    // Get existing peers in room before adding new peer
    const existingPeers = Array.from(room).map(id => {
      const p = this.peers.get(id);
      return {
        peerId: p.peerId,
        metadata: p.metadata,
      };
    });

    // Add peer to room
    room.add(peerId);
    peer.rooms.add(roomId);

    logger.info(`Peer ${peerId} joined room ${roomId}`);

    // Notify the joining peer about existing peers
    this.send(ws, {
      type: 'room-joined',
      roomId,
      peers: existingPeers,
      timestamp: Date.now(),
    });

    // Notify other peers in the room
    this.broadcastToRoom(roomId, {
      type: 'peer-joined',
      peerId,
      metadata: peer.metadata,
      timestamp: Date.now(),
    }, peerId);

    this.emit('peer-joined-room', { peerId, roomId });
  }

  /**
   * Handle peer leaving a room
   */
  handleLeaveRoom(ws, message) {
    const { peerId, roomId } = message;

    if (!peerId || !roomId) {
      return this.send(ws, {
        type: 'error',
        error: 'peerId and roomId are required',
      });
    }

    this.removePeerFromRoom(peerId, roomId);

    this.send(ws, {
      type: 'room-left',
      roomId,
      timestamp: Date.now(),
    });
  }

  /**
   * Handle WebRTC offer
   */
  handleOffer(ws, message) {
    const { from, to, offer } = message;

    if (!from || !to || !offer) {
      return this.send(ws, {
        type: 'error',
        error: 'from, to, and offer are required',
      });
    }

    const targetPeer = this.peers.get(to);
    if (!targetPeer) {
      return this.send(ws, {
        type: 'error',
        error: `Peer ${to} not found`,
      });
    }

    logger.debug(`Forwarding offer from ${from} to ${to}`);

    this.send(targetPeer.ws, {
      type: 'offer',
      from,
      offer,
      timestamp: Date.now(),
    });
  }

  /**
   * Handle WebRTC answer
   */
  handleAnswer(ws, message) {
    const { from, to, answer } = message;

    if (!from || !to || !answer) {
      return this.send(ws, {
        type: 'error',
        error: 'from, to, and answer are required',
      });
    }

    const targetPeer = this.peers.get(to);
    if (!targetPeer) {
      return this.send(ws, {
        type: 'error',
        error: `Peer ${to} not found`,
      });
    }

    logger.debug(`Forwarding answer from ${from} to ${to}`);

    this.send(targetPeer.ws, {
      type: 'answer',
      from,
      answer,
      timestamp: Date.now(),
    });
  }

  /**
   * Handle ICE candidate exchange
   */
  handleIceCandidate(ws, message) {
    const { from, to, candidate } = message;

    if (!from || !to || !candidate) {
      return this.send(ws, {
        type: 'error',
        error: 'from, to, and candidate are required',
      });
    }

    const targetPeer = this.peers.get(to);
    if (!targetPeer) {
      return this.send(ws, {
        type: 'error',
        error: `Peer ${to} not found`,
      });
    }

    logger.debug(`Forwarding ICE candidate from ${from} to ${to}`);

    this.send(targetPeer.ws, {
      type: 'ice-candidate',
      from,
      candidate,
      timestamp: Date.now(),
    });
  }

  /**
   * Handle generic signal message
   */
  handleSignal(ws, message) {
    const { from, to, signal } = message;

    if (!from || !to || !signal) {
      return this.send(ws, {
        type: 'error',
        error: 'from, to, and signal are required',
      });
    }

    const targetPeer = this.peers.get(to);
    if (!targetPeer) {
      return this.send(ws, {
        type: 'error',
        error: `Peer ${to} not found`,
      });
    }

    logger.debug(`Forwarding signal from ${from} to ${to}`);

    this.send(targetPeer.ws, {
      type: 'signal',
      from,
      signal,
      timestamp: Date.now(),
    });
  }

  /**
   * Handle broadcast to room
   */
  handleBroadcast(ws, message) {
    const { from, roomId, data } = message;

    if (!from || !roomId || !data) {
      return this.send(ws, {
        type: 'error',
        error: 'from, roomId, and data are required',
      });
    }

    const room = this.rooms.get(roomId);
    if (!room) {
      return this.send(ws, {
        type: 'error',
        error: `Room ${roomId} not found`,
      });
    }

    logger.debug(`Broadcasting from ${from} to room ${roomId}`);

    this.broadcastToRoom(roomId, {
      type: 'broadcast',
      from,
      data,
      timestamp: Date.now(),
    }, from);
  }

  /**
   * Handle ping
   */
  handlePing(ws, message) {
    const { peerId } = message;

    if (peerId) {
      const peer = this.peers.get(peerId);
      if (peer) {
        peer.lastSeen = Date.now();
      }
    }

    this.send(ws, {
      type: 'pong',
      timestamp: Date.now(),
    });
  }

  /**
   * Handle WebSocket disconnection
   */
  handleDisconnect(ws) {
    const peerId = this.connections.get(ws);

    if (!peerId) {
      return;
    }

    logger.info(`Peer disconnected: ${peerId}`);

    const peer = this.peers.get(peerId);
    if (peer) {
      // Remove peer from all rooms
      for (const roomId of peer.rooms) {
        this.removePeerFromRoom(peerId, roomId);
      }

      // Remove peer
      this.peers.delete(peerId);
    }

    this.connections.delete(ws);

    this.emit('peer-disconnected', { peerId });
  }

  /**
   * Remove peer from a room
   */
  removePeerFromRoom(peerId, roomId) {
    const room = this.rooms.get(roomId);
    if (!room) return;

    room.delete(peerId);

    // Notify other peers
    this.broadcastToRoom(roomId, {
      type: 'peer-left',
      peerId,
      timestamp: Date.now(),
    }, peerId);

    // Delete room if empty
    if (room.size === 0) {
      this.rooms.delete(roomId);
      logger.info(`Room ${roomId} deleted (empty)`);
    }

    // Update peer's room list
    const peer = this.peers.get(peerId);
    if (peer) {
      peer.rooms.delete(roomId);
    }

    logger.info(`Peer ${peerId} left room ${roomId}`);
    this.emit('peer-left-room', { peerId, roomId });
  }

  /**
   * Broadcast message to all peers in a room
   */
  broadcastToRoom(roomId, message, excludePeerId = null) {
    const room = this.rooms.get(roomId);
    if (!room) return;

    for (const peerId of room) {
      if (peerId === excludePeerId) continue;

      const peer = this.peers.get(peerId);
      if (peer && peer.ws) {
        this.send(peer.ws, message);
      }
    }
  }

  /**
   * Send message to a WebSocket client
   */
  send(ws, message) {
    if (ws.readyState === ws.OPEN) {
      try {
        ws.send(JSON.stringify(message));
      } catch (error) {
        logger.error('Error sending message:', error);
      }
    }
  }

  /**
   * Start cleanup interval
   */
  startCleanup() {
    this.cleanupTimer = setInterval(() => {
      this.cleanup();
    }, this.cleanupInterval);

    logger.info(`Cleanup interval started: ${this.cleanupInterval}ms`);
  }

  /**
   * Cleanup inactive peers
   */
  cleanup() {
    const now = Date.now();
    const inactivePeers = [];

    for (const [peerId, peer] of this.peers.entries()) {
      const timeSinceLastSeen = now - peer.lastSeen;

      if (timeSinceLastSeen > this.peerTimeout) {
        inactivePeers.push(peerId);
      }
    }

    if (inactivePeers.length > 0) {
      logger.info(`Cleaning up ${inactivePeers.length} inactive peers`);

      for (const peerId of inactivePeers) {
        const peer = this.peers.get(peerId);

        if (peer) {
          // Close WebSocket if still connected
          if (peer.ws) {
            try {
              peer.ws.close();
            } catch (error) {
              logger.error(`Error closing WebSocket for peer ${peerId}:`, error);
            }
          }

          // Remove from rooms
          for (const roomId of peer.rooms) {
            this.removePeerFromRoom(peerId, roomId);
          }

          // Remove peer
          this.peers.delete(peerId);

          if (peer.ws) {
            this.connections.delete(peer.ws);
          }
        }
      }
    }
  }

  /**
   * Get server statistics
   */
  getStats() {
    return {
      peers: this.peers.size,
      rooms: this.rooms.size,
      connections: this.connections.size,
      roomDetails: Array.from(this.rooms.entries()).map(([roomId, peerSet]) => ({
        roomId,
        peerCount: peerSet.size,
      })),
    };
  }

  /**
   * Shutdown the server
   */
  async shutdown() {
    logger.info('Shutting down signaling server...');

    // Stop cleanup interval
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
    }

    // Close all WebSocket connections
    for (const [ws, peerId] of this.connections.entries()) {
      try {
        this.send(ws, {
          type: 'server-shutdown',
          message: 'Server is shutting down',
          timestamp: Date.now(),
        });
        ws.close();
      } catch (error) {
        logger.error(`Error closing WebSocket for peer ${peerId}:`, error);
      }
    }

    // Close WebSocket server
    if (this.wss) {
      await new Promise((resolve) => {
        this.wss.close(() => {
          logger.info('WebSocket server closed');
          resolve();
        });
      });
    }

    // Close HTTP server
    if (this.server) {
      await new Promise((resolve) => {
        this.server.close(() => {
          logger.info('HTTP server closed');
          resolve();
        });
      });
    }

    this.peers.clear();
    this.rooms.clear();
    this.connections.clear();

    this.emit('shutdown');
    logger.info('Signaling server shutdown complete');
  }
}

export default SignalingServer;
