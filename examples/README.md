# P2P Hole Punching Examples

This directory contains examples demonstrating how to use the P2P hole punching and NAT traversal features in self-streme.

## Examples

### 1. P2P Integration Example (`p2p-integration.js`)

Shows how to integrate P2P hole punching with the existing WebTorrent service for enhanced peer connectivity.

**Features:**
- Automatic NAT type detection
- Enhanced peer discovery
- Hole punching for difficult NAT scenarios
- Connection fallback strategies
- Real-time statistics monitoring

**Usage:**

```bash
# Run the example
node examples/p2p-integration.js
```

**What it demonstrates:**
1. Initializing P2P services alongside WebTorrent
2. Detecting NAT type and getting connection recommendations
3. Registering peers discovered through DHT
4. Attempting hole-punched connections as fallback
5. Monitoring connection statistics

## Quick Start

### Basic P2P Setup

```javascript
import P2PCoordinator from '../src/services/p2pCoordinator.js';

// Create coordinator
const p2p = new P2PCoordinator({
  signalingPort: 8080,
  enableSignaling: true,
  enableHolePunching: true,
});

// Initialize
await p2p.initialize();

// Check NAT type
const natInfo = p2p.getNATInfo();
console.log('NAT Type:', natInfo.type);
console.log('Public Address:', natInfo.publicAddress);

// Get recommended strategy
const strategy = p2p.getRecommendedStrategy();
console.log('Strategy:', strategy.strategy);
console.log('Methods:', strategy.methods);
```

### Register and Connect to Peers

```javascript
// Register a peer
p2p.registerPeer('peer-123', {
  address: '192.168.1.100',
  port: 6881,
});

// Connect with automatic hole punching
const connection = await p2p.connectToPeer('peer-123');
console.log('Connected via:', connection.method);
// Methods: 'udp', 'tcp', 'birthday', or 'turn-relay'
```

### Using Signaling Server

```javascript
import WebSocket from 'ws';

// Connect to signaling server
const ws = new WebSocket('ws://localhost:8080');

ws.on('open', () => {
  // Register
  ws.send(JSON.stringify({
    type: 'register',
    peerId: 'my-peer-id',
    metadata: { client: 'self-streme' }
  }));

  // Join room
  ws.send(JSON.stringify({
    type: 'join-room',
    peerId: 'my-peer-id',
    roomId: 'torrent-abc123'
  }));
});

ws.on('message', (data) => {
  const message = JSON.parse(data);
  console.log('Received:', message.type);
});
```

## Testing NAT Traversal

### Test Your NAT Type

```javascript
import P2PCoordinator from '../src/services/p2pCoordinator.js';

const p2p = new P2PCoordinator();
await p2p.initialize();

const natInfo = p2p.getNATInfo();
console.log('=== NAT Information ===');
console.log('Type:', natInfo.type);
console.log('Public IP:', natInfo.publicAddress.address);
console.log('Public Port:', natInfo.publicAddress.port);
console.log('Hairpinning:', natInfo.hairpinning ? 'Supported' : 'Not Supported');
console.log('Port Predictable:', natInfo.portPredictable ? 'Yes' : 'No');

const strategy = p2p.getRecommendedStrategy();
console.log('\n=== Recommended Strategy ===');
console.log('Strategy:', strategy.strategy);
console.log('Difficulty:', strategy.difficulty);
console.log('Methods:', strategy.methods.join(', '));
console.log('Recommendation:', strategy.recommendation);
```

### Expected Output:

```
=== NAT Information ===
Type: Port Restricted Cone NAT
Public IP: 203.0.113.45
Public Port: 54321
Hairpinning: Not Supported
Port Predictable: No

=== Recommended Strategy ===
Strategy: standard-hole-punch
Difficulty: medium
Methods: udp-hole-punch, tcp-simultaneous-open
Recommendation: Standard hole punching techniques will work
```

## NAT Type Scenarios

### Scenario 1: Open Internet (No NAT)
```
NAT Type: Open Internet
Success Rate: 100%
Method: Direct connection
Difficulty: Easy
```

### Scenario 2: Full Cone NAT
```
NAT Type: Full Cone NAT
Success Rate: 99%
Method: Simple UDP hole punch
Difficulty: Easy
```

### Scenario 3: Restricted/Port Restricted Cone NAT
```
NAT Type: Port Restricted Cone NAT
Success Rate: 90-95%
Method: Coordinated hole punch
Difficulty: Medium
```

### Scenario 4: Symmetric NAT
```
NAT Type: Symmetric NAT
Success Rate: 60%
Method: Birthday attack + TURN relay
Difficulty: Hard
```

## Configuration Examples

### Minimal Configuration
```javascript
const p2p = new P2PCoordinator({
  signalingPort: 8080,
});
```

### Full Configuration
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
  
  // TURN Servers (for difficult NATs)
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

## Troubleshooting

### Issue: Connection timeout
**Solution:** Check if firewall is blocking UDP/TCP ports
```bash
# Test UDP port
nc -u -v -z <peer_ip> <peer_port>

# Test TCP port
nc -v -z <peer_ip> <peer_port>
```

### Issue: Symmetric NAT on both ends
**Solution:** Use TURN relay server
```javascript
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

### Issue: Peers not appearing in signaling
**Solution:** Verify WebSocket connection
```javascript
ws.on('error', (error) => {
  console.error('WebSocket error:', error);
});

ws.on('close', () => {
  console.log('WebSocket disconnected, reconnecting...');
  // Implement reconnection logic
});
```

## Performance Tips

1. **Reduce connection timeout for faster failure detection:**
   ```javascript
   connectionTimeout: 10000  // 10 seconds instead of 30
   ```

2. **Increase keep-alive interval to reduce traffic:**
   ```javascript
   keepAliveInterval: 60000  // 60 seconds instead of 25
   ```

3. **Limit retry attempts:**
   ```javascript
   maxRetries: 2  // Fail faster
   ```

4. **Use room-based peer discovery:**
   ```javascript
   // Group peers by torrent infohash
   const roomId = `torrent-${infoHash}`;
   ```

## Best Practices

1. ✅ Always initialize P2P services before adding torrents
2. ✅ Handle connection failures gracefully with fallbacks
3. ✅ Monitor NAT type and adjust strategy accordingly
4. ✅ Implement proper shutdown handling
5. ✅ Use keep-alive to maintain NAT mappings
6. ✅ Log connection attempts for debugging
7. ✅ Implement reconnection logic for signaling
8. ✅ Clean up resources on disconnect

## Additional Resources

- [P2P Hole Punching Documentation](../docs/P2P_HOLE_PUNCHING.md)
- [STUN RFC 5389](https://tools.ietf.org/html/rfc5389)
- [ICE RFC 5245](https://tools.ietf.org/html/rfc5245)
- [NAT Traversal Techniques](https://en.wikipedia.org/wiki/NAT_traversal)

## License

Part of the self-streme project. See main project LICENSE.