# P2P Hole Punching Setup Guide

Quick guide to enable P2P hole punching and NAT traversal in self-streme.

## 🚀 Quick Start

### 1. Install Dependencies

The WebSocket dependency has already been installed:

```bash
npm install
```

### 2. Basic Integration

```javascript
import P2PCoordinator from './src/services/p2pCoordinator.js';

// Initialize P2P services
const p2p = new P2PCoordinator({
  signalingPort: 8080,
  enableSignaling: true,
  enableHolePunching: true,
});

await p2p.initialize();

// Check your NAT type
const natInfo = p2p.getNATInfo();
console.log('NAT Type:', natInfo.type);
console.log('Public IP:', natInfo.publicAddress.address);
```

### 3. Run the Example

```bash
node examples/p2p-integration.js
```

## 📋 What You Get

### ✅ Services Created

1. **Hole Punching Service** (`src/services/holePunchingService.js`)
   - STUN-based NAT detection
   - UDP hole punching
   - TCP hole punching with simultaneous open
   - Port prediction for symmetric NATs
   - Keep-alive mechanisms

2. **Signaling Server** (`src/services/signalingServer.js`)
   - WebSocket-based peer coordination
   - Room management for organizing peers
   - ICE candidate exchange
   - Peer discovery and state tracking
   - Automatic cleanup of inactive peers

3. **P2P Coordinator** (`src/services/p2pCoordinator.js`)
   - Unified API for all P2P services
   - Automatic service integration
   - Connection management
   - Statistics and monitoring

## 🔧 Configuration

### Environment Variables

Add to your `.env` file:

```bash
# P2P Configuration
P2P_SIGNALING_PORT=8080
P2P_SIGNALING_ENABLED=true
P2P_HOLE_PUNCHING_ENABLED=true

# STUN Servers (comma-separated)
P2P_STUN_SERVERS=stun.l.google.com:19302,stun.cloudflare.com:3478

# TURN Servers (optional, for difficult NATs)
P2P_TURN_SERVER=turn:turn.example.com:3478
P2P_TURN_USERNAME=your-username
P2P_TURN_PASSWORD=your-password

# Timeouts
P2P_CONNECTION_TIMEOUT=30000
P2P_KEEP_ALIVE_INTERVAL=25000
```

### Programmatic Configuration

```javascript
const p2p = new P2PCoordinator({
  // Signaling Server
  signalingPort: 8080,
  enableSignaling: true,
  cleanupInterval: 60000,     // Clean inactive peers every 60s
  peerTimeout: 300000,        // Peer timeout after 5 minutes
  
  // Hole Punching
  enableHolePunching: true,
  holePunchingPort: 0,        // 0 = random port
  
  // STUN Servers
  stunServers: [
    { host: 'stun.l.google.com', port: 19302 },
    { host: 'stun.cloudflare.com', port: 3478 },
  ],
  
  // Timeouts
  connectionTimeout: 30000,
  keepAliveInterval: 25000,
  maxRetries: 3,
});
```

## 🌐 NAT Types Explained

| Type | Success Rate | Method | Notes |
|------|--------------|--------|-------|
| **Open Internet** | 100% | Direct | No NAT, direct connections work |
| **Full Cone NAT** | 99% | Simple UDP | Easy hole punching |
| **Restricted Cone** | 95% | Standard | Requires coordination |
| **Port Restricted** | 90% | Standard | Stricter coordination |
| **Symmetric NAT** | 60% | Advanced | Needs port prediction or TURN |

## 📊 Usage Examples

### Check NAT Type

```javascript
await p2p.initialize();

const natInfo = p2p.getNATInfo();
console.log('NAT Type:', natInfo.type);

const strategy = p2p.getRecommendedStrategy();
console.log('Recommended Methods:', strategy.methods);
console.log('Difficulty:', strategy.difficulty);
```

### Connect to Peer

```javascript
// Register peer
p2p.registerPeer('peer-123', {
  address: '192.168.1.100',
  port: 6881,
  metadata: { client: 'self-streme' }
});

// Connect with automatic hole punching
try {
  const connection = await p2p.connectToPeer('peer-123');
  console.log('Connected via:', connection.method); // 'udp', 'tcp', 'birthday'
} catch (error) {
  console.error('Connection failed:', error.message);
}
```

### Use Signaling Server

```javascript
const WebSocket = require('ws');
const ws = new WebSocket('ws://localhost:8080');

ws.on('open', () => {
  // Register
  ws.send(JSON.stringify({
    type: 'register',
    peerId: 'my-peer-id',
    metadata: { client: 'self-streme', version: '1.0.0' }
  }));
  
  // Join a room (e.g., torrent swarm)
  ws.send(JSON.stringify({
    type: 'join-room',
    peerId: 'my-peer-id',
    roomId: 'torrent-abc123'
  }));
});

ws.on('message', (data) => {
  const message = JSON.parse(data);
  
  if (message.type === 'peer-joined') {
    console.log('New peer:', message.peerId);
    // Attempt connection to new peer
  }
});
```

### Integrate with WebTorrent

```javascript
import EnhancedTorrentService from './examples/p2p-integration.js';

const service = new EnhancedTorrentService({
  signalingPort: 8080,
});

await service.initialize();

// Add torrent with enhanced P2P
const torrent = await service.addTorrent(magnetUri);

// Monitor stats
setInterval(() => {
  const stats = service.getStats();
  console.log('P2P Connections:', stats.peerConnections.total);
  console.log('NAT Type:', stats.p2p.natType);
}, 10000);
```

## 🔍 Monitoring & Stats

### Get Statistics

```javascript
const stats = p2p.getStats();

console.log('NAT Type:', stats.natType);
console.log('Public Address:', stats.publicAddress);
console.log('Active Connections:', stats.activeConnections);
console.log('Signaling Peers:', stats.signaling?.peers);
console.log('Rooms:', stats.signaling?.rooms);
```

### Health Check

```javascript
const health = await p2p.healthCheck();

console.log('Status:', health.status);
console.log('Signaling:', health.services.signaling.status);
console.log('Hole Punching:', health.services.holePunching.status);
```

### REST API Endpoints

If using with Express:

```javascript
// NAT info
GET /p2p/nat
Response: { natInfo, strategy }

// Statistics
GET /p2p/stats
Response: { initialized, natInfo, activeConnections, ... }

// Health check
GET /p2p/health
Response: { status, services, ... }

// Signaling server stats
GET /stats
Response: { totalPeers, totalRooms, ... }

// Room peers
GET /rooms/:roomId/peers
Response: { peers: [...] }
```

## 🛠️ Troubleshooting

### Issue: "UDP hole punching timeout"

**Causes:**
- Firewall blocking UDP
- Symmetric NAT on both sides
- Incorrect peer information

**Solutions:**
```javascript
// 1. Check NAT type
const natInfo = p2p.getNATInfo();
console.log('NAT Type:', natInfo.type);

// 2. Try TCP instead
// (Automatic fallback in connectToPeer)

// 3. Configure TURN relay for symmetric NAT
const p2p = new P2PCoordinator({
  turnServers: [
    {
      urls: 'turn:turn.example.com:3478',
      username: process.env.TURN_USERNAME,
      credential: process.env.TURN_PASSWORD,
    },
  ],
});
```

### Issue: "Peer not found"

**Solution:**
```javascript
// Check signaling server connection
const ws = new WebSocket('ws://localhost:8080');
ws.on('error', (error) => {
  console.error('Signaling error:', error);
});

// Verify peer is registered
const stats = p2p.getStats();
console.log('Connected peers:', stats.signaling.peers);
```

### Issue: Connection drops frequently

**Solution:**
```javascript
// Increase keep-alive frequency
const p2p = new P2PCoordinator({
  keepAliveInterval: 15000,  // 15 seconds instead of 25
});
```

## 🔒 Security Considerations

1. **Use TLS for signaling in production:**
   ```javascript
   const wss = new WebSocket('wss://your-server.com:8080');
   ```

2. **Implement authentication:**
   ```javascript
   ws.send(JSON.stringify({
     type: 'register',
     peerId: 'peer-123',
     token: 'your-auth-token',  // Add authentication
   }));
   ```

3. **Rate limiting on signaling server**
4. **Validate peer addresses before connecting**
5. **Set connection limits**

## 📚 Documentation

- **Full Documentation:** [docs/P2P_HOLE_PUNCHING.md](docs/P2P_HOLE_PUNCHING.md)
- **Examples:** [examples/](examples/)
- **API Reference:** See documentation for detailed API

## 🎯 Next Steps

1. **Test NAT Detection:**
   ```bash
   node examples/p2p-integration.js
   ```

2. **Set up signaling server** for multi-peer coordination

3. **Configure TURN server** if you have symmetric NAT

4. **Integrate with your torrent service** using the Enhanced Torrent Service example

5. **Monitor connections** and optimize based on your NAT type

## 🤝 Support

For issues and questions:
- Check the full documentation: `docs/P2P_HOLE_PUNCHING.md`
- Run the example: `examples/p2p-integration.js`
- Review NAT type recommendations: Use `getRecommendedStrategy()`

## 📝 Key Features

✅ **Automatic NAT Detection** - Detects your NAT type using STUN  
✅ **Multiple Traversal Methods** - UDP, TCP, Birthday Attack  
✅ **Signaling Server** - WebSocket-based peer coordination  
✅ **Keep-Alive** - Maintains NAT mappings automatically  
✅ **Fallback Support** - TURN relay for difficult NATs  
✅ **WebTorrent Integration** - Enhances peer connectivity  
✅ **Statistics & Monitoring** - Real-time connection stats  
✅ **Room Management** - Organize peers by torrent/purpose  

## 🚦 Status

All services are ready to use:
- ✅ Hole Punching Service
- ✅ Signaling Server  
- ✅ P2P Coordinator
- ✅ Integration Example
- ✅ Documentation

Start with `node examples/p2p-integration.js` to see it in action!