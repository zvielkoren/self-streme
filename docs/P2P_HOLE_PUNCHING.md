# P2P Hole Punching and NAT Traversal

Complete P2P connectivity solution for peer-to-peer torrent streaming with automatic NAT traversal.

## Table of Contents

- [Overview](#overview)
- [Features](#features)
- [Architecture](#architecture)
- [Quick Start](#quick-start)
- [Configuration](#configuration)
- [API Reference](#api-reference)
- [NAT Types](#nat-types)
- [Troubleshooting](#troubleshooting)
- [Examples](#examples)

## Overview

The P2P Hole Punching system enables direct peer-to-peer connections between torrent clients behind NAT (Network Address Translation) routers. This is essential for improving torrent swarm connectivity and download speeds.

### Key Components

1. **Hole Punching Service** - Handles UDP/TCP NAT traversal
2. **Signaling Server** - WebSocket-based peer coordination
3. **P2P Coordinator** - Integrates all services and provides unified API

## Features

### NAT Traversal Techniques

- ✅ **STUN Protocol** - RFC 5389 compliant NAT type detection
- ✅ **UDP Hole Punching** - Works with most NAT configurations
- ✅ **TCP Hole Punching** - Simultaneous open for TCP connections
- ✅ **Port Prediction** - For sequential port allocation NATs
- ✅ **Birthday Attack** - Advanced technique for symmetric NATs
- ✅ **Keep-Alive Mechanism** - Maintains open NAT mappings

### Signaling Features

- 🔄 **WebSocket Communication** - Low-latency peer coordination
- 🏠 **Room-Based Grouping** - Organize peers into logical groups
- 📡 **ICE Candidate Exchange** - WebRTC-compatible signaling
- 🔍 **Peer Discovery** - Find and connect to available peers
- 📊 **Connection State Tracking** - Monitor peer connectivity
- 🧹 **Automatic Cleanup** - Remove inactive peers

### Supported NAT Types

| NAT Type | Difficulty | Success Rate | Method |
|----------|-----------|--------------|---------|
| Open Internet | ✅ Easy | 100% | Direct connection |
| Full Cone NAT | ✅ Easy | 99% | Simple UDP hole punch |
| Restricted Cone | ⚠️ Medium | 95% | Standard hole punch |
| Port Restricted | ⚠️ Medium | 90% | Standard hole punch |
| Symmetric NAT | ❌ Hard | 60% | Advanced techniques + TURN |

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     P2P Coordinator                          │
│  ┌─────────────────────┐      ┌──────────────────────┐     │
│  │  Signaling Server   │      │ Hole Punching Service │     │
│  │  (WebSocket)        │      │ (UDP/TCP)             │     │
│  │                     │      │                       │     │
│  │ • Peer Discovery    │      │ • STUN Client         │     │
│  │ • Room Management   │      │ • NAT Detection       │     │
│  │ • ICE Exchange      │      │ • UDP Hole Punch      │     │
│  │ • State Tracking    │      │ • TCP Hole Punch      │     │
│  └─────────────────────┘      └──────────────────────┘     │
└─────────────────────────────────────────────────────────────┘
                            ▲
                            │
                            ▼
┌──────────────────────────────────────────────────────────────┐
│                    WebTorrent Integration                     │
│  • Enhanced peer connectivity                                 │
│  • Automatic NAT traversal for incoming connections          │
│  • Improved swarm participation                              │
└──────────────────────────────────────────────────────────────┘
```

## Quick Start

### 1. Basic Setup

```javascript
import P2PCoordinator from './services/p2pCoordinator.js';

// Create coordinator instance
const p2p = new P2PCoordinator({
  signalingPort: 8080,
  enableSignaling: true,
  enableHolePunching: true,
});

// Initialize services
await p2p.initialize();

console.log('NAT Type:', p2p.getNATInfo().type);
console.log('Public Address:', p2p.getNATInfo().publicAddress);
```

### 2. Register and Connect to Peers

```javascript
// Register a peer
p2p.registerPeer('peer-123', {
  address: '192.168.1.100',
  port: 6881,
  metadata: { client: 'self-streme' }
});

// Connect to peer
const connection = await p2p.connectToPeer('peer-123');
console.log('Connected via:', connection.method);
```

### 3. Using Signaling Server (WebSocket)

```javascript
const WebSocket = require('ws');

// Connect to signaling server
const ws = new WebSocket('ws://localhost:8080');

ws.on('open', () => {
  // Register with signaling server
  ws.send(JSON.stringify({
    type: 'register',
    peerId: 'my-peer-id',
    metadata: { client: 'self-streme', version: '1.0.0' }
  }));

  // Join a room
  ws.send(JSON.stringify({
    type: 'join-room',
    peerId: 'my-peer-id',
    roomId: 'torrent-abc123'
  }));
});

ws.on('message', (data) => {
  const message = JSON.parse(data.toString());
  
  switch (message.type) {
    case 'peer-joined':
      console.log('New peer joined:', message.peerId);
      break;
    case 'offer':
      // Handle WebRTC offer
      handleOffer(message.from, message.offer);
      break;
    case 'ice-candidate':
      // Handle ICE candidate
      handleIceCandidate(message.from, message.candidate);
      break;
  }
});
```

## Configuration

### Environment Variables

```bash
# Signaling Server
P2P_SIGNALING_PORT=8080
P2P_SIGNALING_ENABLED=true

# Hole Punching
P2P_HOLE_PUNCHING_ENABLED=true
P2P_HOLE_PUNCHING_PORT=0  # 0 = random port

# STUN Servers
P2P_STUN_SERVERS=stun.l.google.com:19302,stun.cloudflare.com:3478

# TURN Servers (optional, for symmetric NAT fallback)
P2P_TURN_SERVERS=turn:turn.example.com:3478
P2P_TURN_USERNAME=username
P2P_TURN_PASSWORD=password

# Timeouts
P2P_CONNECTION_TIMEOUT=30000
P2P_KEEP_ALIVE_INTERVAL=25000
P2P_PEER_TIMEOUT=300000
```

### Programmatic Configuration

```javascript
const p2p = new P2PCoordinator({
  // Signaling
  signalingPort: 8080,
  enableSignaling: true,
  cleanupInterval: 60000,
  peerTimeout: 300000,
  
  // Hole Punching
  enableHolePunching: true,
  holePunchingPort: 0,
  
  // STUN Servers
  stunServers: [
    { host: 'stun.l.google.com', port: 19302 },
    { host: 'stun.cloudflare.com', port: 3478 },
  ],
  
  // TURN Servers (optional)
  turnServers: [
    {
      urls: 'turn:turn.example.com:3478',
      username: 'user',
      credential: 'pass',
    },
  ],
  
  // Timeouts
  connectionTimeout: 30000,
  keepAliveInterval: 25000,
  maxRetries: 3,
});
```

## API Reference

### P2PCoordinator

#### Methods

##### `initialize()`
Initialize all P2P services.

```javascript
await p2p.initialize();
```

##### `registerPeer(peerId, peerInfo)`
Register a peer for connections.

```javascript
p2p.registerPeer('peer-123', {
  address: '192.168.1.100',
  port: 6881,
  metadata: { client: 'self-streme' }
});
```

##### `connectToPeer(peerId)`
Establish P2P connection to a peer.

```javascript
const connection = await p2p.connectToPeer('peer-123');
// Returns: { socketId, socket, localPort, remoteAddress, remotePort }
```

##### `getNATInfo()`
Get detected NAT information.

```javascript
const natInfo = p2p.getNATInfo();
// Returns: { type, publicAddress, localPort, hairpinning, portPredictable }
```

##### `getRecommendedStrategy()`
Get recommended connection strategy based on NAT type.

```javascript
const strategy = p2p.getRecommendedStrategy();
// Returns: { strategy, recommendation, methods, difficulty, natType, ... }
```

##### `getStats()`
Get comprehensive statistics.

```javascript
const stats = p2p.getStats();
// Returns: { initialized, natInfo, activeConnections, signaling, holePunching }
```

##### `healthCheck()`
Perform health check.

```javascript
const health = await p2p.healthCheck();
// Returns: { status, initialized, timestamp, services }
```

##### `shutdown()`
Shutdown all services.

```javascript
await p2p.shutdown();
```

#### Events

```javascript
p2p.on('initialized', ({ signaling, holePunching, natInfo }) => {
  console.log('P2P services initialized');
});

p2p.on('peer-registered', ({ peerId, metadata }) => {
  console.log('Peer registered:', peerId);
});

p2p.on('peer-connected', ({ peerId, connection, method }) => {
  console.log('Peer connected via', method);
});

p2p.on('peer-disconnected', ({ peerId }) => {
  console.log('Peer disconnected');
});

p2p.on('hole-punching-ready', (natInfo) => {
  console.log('NAT type detected:', natInfo.type);
});
```

### Signaling Server WebSocket Protocol

#### Client -> Server Messages

##### Register
```json
{
  "type": "register",
  "peerId": "peer-123",
  "metadata": { "client": "self-streme" }
}
```

##### Join Room
```json
{
  "type": "join-room",
  "peerId": "peer-123",
  "roomId": "room-abc"
}
```

##### Send Offer
```json
{
  "type": "offer",
  "from": "peer-123",
  "to": "peer-456",
  "offer": { "sdp": "...", "type": "offer" }
}
```

##### Send Answer
```json
{
  "type": "answer",
  "from": "peer-456",
  "to": "peer-123",
  "answer": { "sdp": "...", "type": "answer" }
}
```

##### ICE Candidate
```json
{
  "type": "ice-candidate",
  "from": "peer-123",
  "to": "peer-456",
  "candidate": { "candidate": "...", "sdpMid": "0" }
}
```

#### Server -> Client Messages

##### Welcome
```json
{
  "type": "welcome",
  "message": "Connected to signaling server",
  "timestamp": 1234567890
}
```

##### Registered
```json
{
  "type": "registered",
  "peerId": "peer-123",
  "timestamp": 1234567890
}
```

##### Room Joined
```json
{
  "type": "room-joined",
  "roomId": "room-abc",
  "peers": [
    { "peerId": "peer-456", "metadata": {} }
  ]
}
```

##### Peer Joined
```json
{
  "type": "peer-joined",
  "peerId": "peer-789",
  "metadata": {},
  "timestamp": 1234567890
}
```

## NAT Types

### 1. Open Internet (No NAT)
Direct connections work without any special handling.

**Detection**: Public IP equals local IP
**Success Rate**: 100%
**Recommended**: Direct TCP/UDP connections

### 2. Full Cone NAT
Any external host can send packets to the internal host by sending to the mapped address.

**Detection**: Consistent port mapping across all STUN servers
**Success Rate**: 99%
**Recommended**: Simple UDP hole punching

### 3. Restricted Cone NAT
External host can send packets only if internal host has previously sent to that external host.

**Detection**: Port mapping consistent, but requires prior contact
**Success Rate**: 95%
**Recommended**: Standard UDP hole punching with coordination

### 4. Port Restricted Cone NAT
Similar to Restricted Cone, but external host must also use the same port.

**Detection**: Port mapping consistent, strict port requirements
**Success Rate**: 90%
**Recommended**: Coordinated hole punching with simultaneous sends

### 5. Symmetric NAT
Each new destination gets a different port mapping.

**Detection**: Different ports for different STUN servers
**Success Rate**: 60%
**Recommended**: Birthday attack, port prediction, or TURN relay

## Troubleshooting

### Connection Failures

#### Symptom: "UDP hole punching timeout"

**Possible Causes:**
- Firewall blocking UDP traffic
- Symmetric NAT on both ends
- Incorrect peer address/port

**Solutions:**
1. Check firewall rules
2. Try TCP hole punching
3. Enable TURN relay
4. Verify peer information is correct

```javascript
// Enable verbose logging
process.env.LOG_LEVEL = 'debug';

// Check NAT type
const natInfo = p2p.getNATInfo();
console.log('NAT Type:', natInfo.type);
console.log('Recommended Strategy:', p2p.getRecommendedStrategy());
```

#### Symptom: "Peer not found in signaling server"

**Possible Causes:**
- Peer hasn't registered
- Peer disconnected
- Network connectivity issues

**Solutions:**
1. Ensure peer is connected to signaling server
2. Check signaling server logs
3. Verify peer IDs match

```javascript
// Check peer list
const stats = p2p.getStats();
console.log('Connected peers:', stats.signaling.peers);
```

### Performance Issues

#### Slow Connection Establishment

**Optimization:**
```javascript
// Reduce timeouts for faster failure detection
const p2p = new P2PCoordinator({
  connectionTimeout: 10000,  // 10 seconds instead of 30
  maxRetries: 2,              // Fewer retries
});
```

#### Too Many Keep-Alive Messages

**Optimization:**
```javascript
// Increase keep-alive interval
const p2p = new P2PCoordinator({
  keepAliveInterval: 60000,  // 60 seconds instead of 25
});
```

## Examples

### Example 1: Enhanced WebTorrent with Hole Punching

```javascript
import WebTorrent from 'webtorrent';
import P2PCoordinator from './services/p2pCoordinator.js';

// Initialize P2P coordinator
const p2p = new P2PCoordinator({
  signalingPort: 8080,
  enableHolePunching: true,
});

await p2p.initialize();

// Create WebTorrent client
const client = new WebTorrent({
  maxConnections: 100,
});

// Register WebTorrent DHT peers with hole punching
client.on('peer', (peer) => {
  const peerId = peer.id || peer.addr;
  
  p2p.registerPeer(peerId, {
    address: peer.addr.split(':')[0],
    port: parseInt(peer.addr.split(':')[1]),
    metadata: { source: 'webtorrent-dht' },
  });
});

// Enhance peer connections with hole punching
client.on('wire', async (wire, addr) => {
  console.log('Wire connection from:', addr);
  
  // If connection fails, try hole punching
  wire.on('close', async () => {
    try {
      const peerId = addr.replace(/[:.]/g, '-');
      const connection = await p2p.connectToPeer(peerId);
      console.log('Established hole-punched connection:', connection);
    } catch (error) {
      console.log('Hole punching also failed:', error.message);
    }
  });
});
```

### Example 2: Room-Based Torrent Swarms

```javascript
import P2PCoordinator from './services/p2pCoordinator.js';

const p2p = new P2PCoordinator({
  signalingPort: 8080,
});

await p2p.initialize();

// Create room for specific torrent
const infoHash = 'abc123...';
const roomId = `torrent-${infoHash}`;

// Listen for peers joining the swarm
p2p.on('peer-joined-room', async ({ peerId, roomId }) => {
  console.log(`Peer ${peerId} joined swarm ${roomId}`);
  
  // Get peer info from signaling
  const peers = await p2p.getRoomPeers(roomId);
  
  // Attempt to connect to new peer
  for (const peer of peers) {
    if (peer.peerId !== myPeerId) {
      try {
        await p2p.connectToPeer(peer.peerId);
      } catch (error) {
        console.log(`Failed to connect to ${peer.peerId}:`, error.message);
      }
    }
  }
});
```

### Example 3: Monitor and Stats

```javascript
// Health monitoring endpoint
app.get('/p2p/health', async (req, res) => {
  const health = await p2p.healthCheck();
  res.json(health);
});

// Statistics endpoint
app.get('/p2p/stats', (req, res) => {
  const stats = p2p.getStats();
  res.json(stats);
});

// NAT info endpoint
app.get('/p2p/nat', (req, res) => {
  const natInfo = p2p.getNATInfo();
  const strategy = p2p.getRecommendedStrategy();
  
  res.json({
    natInfo,
    strategy,
  });
});
```

### Example 4: Fallback to TURN Relay

```javascript
const p2p = new P2PCoordinator({
  enableHolePunching: true,
  
  // Configure TURN servers for difficult NAT scenarios
  turnServers: [
    {
      urls: 'turn:turn.example.com:3478',
      username: process.env.TURN_USERNAME,
      credential: process.env.TURN_PASSWORD,
    },
    {
      urls: 'turn:turn.example.com:3478?transport=tcp',
      username: process.env.TURN_USERNAME,
      credential: process.env.TURN_PASSWORD,
    },
  ],
});

await p2p.initialize();

// Attempt connection with automatic fallback
try {
  const connection = await p2p.connectToPeer('peer-123');
  console.log('Connection method:', connection.method);
  
  if (connection.method === 'turn-relay') {
    console.log('Using TURN relay due to difficult NAT configuration');
  }
} catch (error) {
  console.error('All connection methods failed:', error);
}
```

## Best Practices

### 1. Always Detect NAT Type First
```javascript
await p2p.initialize();
const strategy = p2p.getRecommendedStrategy();
console.log('Use these methods:', strategy.methods);
```

### 2. Implement Timeout Handling
```javascript
const timeout = setTimeout(() => {
  console.log('Connection taking too long, trying alternative method');
}, 15000);

try {
  await p2p.connectToPeer(peerId);
  clearTimeout(timeout);
} catch (error) {
  clearTimeout(timeout);
  // Try TURN relay
}
```

### 3. Clean Up Resources
```javascript
process.on('SIGINT', async () => {
  console.log('Shutting down...');
  await p2p.shutdown();
  process.exit(0);
});
```

### 4. Monitor Connection Health
```javascript
setInterval(async () => {
  const stats = p2p.getStats();
  
  if (stats.activeConnections === 0) {
    console.warn('No active P2P connections');
  }
  
  console.log(`Active connections: ${stats.activeConnections}`);
}, 30000);
```

## Performance Tuning

### For High-Traffic Scenarios
```javascript
const p2p = new P2PCoordinator({
  connectionTimeout: 20000,     // Faster failure detection
  keepAliveInterval: 45000,     // Less frequent keep-alives
  maxRetries: 2,                // Fewer retry attempts
  cleanupInterval: 120000,      // Less frequent cleanup
  peerTimeout: 600000,          // 10 min peer timeout
});
```

### For Reliable Networks
```javascript
const p2p = new P2PCoordinator({
  connectionTimeout: 60000,     // More patient connections
  keepAliveInterval: 25000,     // Standard keep-alive
  maxRetries: 5,                // More retry attempts
  peerTimeout: 900000,          // 15 min peer timeout
});
```

## Security Considerations

1. **Validate Peer Information** - Always validate peer addresses before connecting
2. **Rate Limiting** - Implement rate limiting on signaling server
3. **Authentication** - Add authentication to signaling WebSocket connections
4. **Encryption** - Use TLS for signaling (wss://) in production
5. **Resource Limits** - Set limits on concurrent connections

## License

This P2P hole punching implementation is part of the self-streme project.
See the main project LICENSE file for details.

## Contributing

Contributions are welcome! Please see CONTRIBUTING.md for guidelines.

## Support

For issues and questions:
- GitHub Issues: https://github.com/yourusername/self-streme/issues
- Documentation: https://github.com/yourusername/self-streme/wiki

---

**Note**: P2P hole punching success rates vary depending on network configurations. Always implement fallback mechanisms (like TURN relays) for production use.