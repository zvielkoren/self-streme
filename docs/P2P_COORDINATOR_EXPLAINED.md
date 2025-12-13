# P2P Coordinator Explained

## What is `p2pCoordinator.js`?

The **P2P Coordinator** is the main integration file that brings together all P2P functionality in your Self-Streme addon. Think of it as the "brain" that manages peer-to-peer connections.

## What It Does

### 1. **Integrates Two Services**

```
┌─────────────────────────────────────────┐
│         P2P Coordinator                 │
│         (p2pCoordinator.js)             │
│                                         │
│  ┌───────────────────────────────────┐ │
│  │  Hole Punching Service            │ │
│  │  • Detects NAT type               │ │
│  │  • Punches through firewalls      │ │
│  │  • Creates direct connections     │ │
│  └───────────────────────────────────┘ │
│                                         │
│  ┌───────────────────────────────────┐ │
│  │  Signaling Server                 │ │
│  │  • Peer discovery (WebSocket)     │ │
│  │  • Coordinates connections        │ │
│  │  • Exchanges connection info      │ │
│  └───────────────────────────────────┘ │
└─────────────────────────────────────────┘
```

### 2. **Works Automatically**

Once initialized, it handles:
- ✅ Detecting your network type (Open, Symmetric NAT, etc.)
- ✅ Finding other peers
- ✅ Choosing best connection method
- ✅ Creating direct P2P connections
- ✅ Maintaining connections with keep-alive
- ✅ Falling back to relay if needed

## Key Features

### NAT Type Detection
Automatically detects how your firewall/router works:
- **Open NAT** → Easy direct connections
- **Full Cone NAT** → UDP hole punching works great
- **Restricted NAT** → UDP hole punching works
- **Port-Restricted NAT** → TCP hole punching needed
- **Symmetric NAT** → TURN relay needed

### Intelligent Connection Strategy
Automatically chooses the best method:

```javascript
// Open NAT + Open NAT
→ Direct connection (95% success)

// Most NAT types
→ UDP hole punching (85% success)

// Restricted NATs
→ TCP hole punching (70% success)

// Symmetric + Symmetric NAT
→ TURN relay (99% success)
```

### Statistics Tracking
Keeps track of:
- Number of registered peers
- Active connections
- Successful/failed connection attempts
- Success rate
- Uptime

## How to Use It

### Basic Usage

```javascript
import P2PCoordinator from './services/p2pCoordinator.js';

// 1. Create coordinator
const p2p = new P2PCoordinator({
    signalingPort: 8080,
    stunServers: ['stun:stun.l.google.com:19302'],
    turnServers: [/* optional */]
});

// 2. Initialize (detects NAT, starts services)
await p2p.initialize();

// 3. Register yourself as a peer
p2p.registerPeer('my-peer-id', { client: 'my-app' });

// 4. Connect to another peer
const connection = await p2p.connectToPeer('other-peer-id');

// 5. Get stats
const stats = p2p.getStats();
console.log(`Success rate: ${stats.performance.successRate}%`);

// 6. Check health
const health = p2p.healthCheck();
console.log(`Healthy: ${health.healthy}`);
```

### Integration with Self-Streme

In your `src/index.js`:

```javascript
// At the top
import P2PCoordinator from './services/p2pCoordinator.js';

let p2pCoordinator = null;

// During startup
async function initializeP2P() {
    try {
        p2pCoordinator = new P2PCoordinator({
            signalingPort: 8080,
            stunServers: [
                'stun:stun.l.google.com:19302',
                'stun:stun1.l.google.com:19302'
            ],
            enableDetailedLogging: process.env.NODE_ENV === 'development'
        });

        await p2pCoordinator.initialize();
        
        const natInfo = p2pCoordinator.getNATInfo();
        console.log(`✓ P2P initialized - NAT Type: ${natInfo.type}`);
        
    } catch (error) {
        console.error('P2P failed:', error.message);
        console.log('Continuing without P2P...');
    }
}

// In your startServer() function
async function startServer() {
    await initializeP2P(); // Add this line
    
    // ... rest of your server code
}

// During shutdown
process.on('SIGTERM', async () => {
    if (p2pCoordinator) {
        await p2pCoordinator.shutdown();
    }
    // ... rest of cleanup
});
```

## API Reference

### Constructor Options

```javascript
new P2PCoordinator({
    signalingPort: 8080,              // WebSocket signaling port
    stunServers: [...],               // STUN servers for NAT detection
    turnServers: [...],               // TURN servers for relay (optional)
    localPort: 0,                     // Local port (0 = random)
    keepAliveInterval: 25000,         // Keep connections alive (ms)
    connectionTimeout: 30000,         // Connection timeout (ms)
    maxRetries: 3,                    // Max connection retry attempts
    enableDetailedLogging: false      // Verbose logging
})
```

### Methods

#### `await initialize()`
Initializes P2P services and detects NAT type.

#### `registerPeer(peerId, metadata)`
Register a peer with the coordinator.
```javascript
p2p.registerPeer('peer-123', { 
    client: 'my-app',
    version: '1.0.0'
});
```

#### `unregisterPeer(peerId)`
Unregister a peer and close its connections.

#### `await connectToPeer(peerId, options)`
Connect to another peer. Automatically chooses best strategy.
```javascript
const connection = await p2p.connectToPeer('peer-456');
```

#### `getNATInfo()`
Get detected NAT information.
```javascript
const nat = p2p.getNATInfo();
// { type: 'Full Cone', publicIP: '1.2.3.4', publicPort: 8080 }
```

#### `getStats()`
Get current statistics.
```javascript
const stats = p2p.getStats();
// {
//   registeredPeers: 5,
//   activePeers: 3,
//   totalConnections: 12,
//   successfulPunches: 10,
//   failedAttempts: 2,
//   uptime: 3600,
//   performance: { successRate: '83.33', failureRate: '16.67' }
// }
```

#### `getRecommendedStrategy()`
Get recommended connection strategy for your NAT type.
```javascript
const strategy = p2p.getRecommendedStrategy();
// {
//   method: 'udp-hole-punch',
//   description: 'UDP hole punching recommended',
//   requiresTurn: false
// }
```

#### `healthCheck()`
Check health of P2P services.
```javascript
const health = p2p.healthCheck();
// {
//   healthy: true,
//   services: {
//     holePunching: { status: 'healthy', natType: 'Full Cone' },
//     signaling: { status: 'healthy', port: 8080, peers: 5 }
//   },
//   issues: []
// }
```

#### `await shutdown()`
Gracefully shutdown P2P services.

### Events

The coordinator emits events you can listen to:

```javascript
p2p.on('initialized', () => {
    console.log('P2P ready!');
});

p2p.on('peerRegistered', (peerInfo) => {
    console.log(`New peer: ${peerInfo.id}`);
});

p2p.on('connected', (connection) => {
    console.log(`Connected to peer: ${connection.peerId}`);
});

p2p.on('connectionFailed', ({ peerId, error }) => {
    console.error(`Failed to connect to ${peerId}: ${error}`);
});

p2p.on('shutdown', () => {
    console.log('P2P shut down');
});
```

## Connection Strategies

The coordinator automatically chooses the best connection method:

### 1. Direct Connection
**When:** Both peers have Open NAT  
**How:** Direct TCP/UDP connection  
**Success Rate:** ~95%

### 2. UDP Hole Punching
**When:** At least one peer is behind NAT (but not both Symmetric)  
**How:** Coordinated simultaneous packet exchange  
**Success Rate:** ~85%

### 3. TCP Hole Punching
**When:** Port-restricted NATs  
**How:** Simultaneous TCP connection attempts  
**Success Rate:** ~70%

### 4. TURN Relay
**When:** Both peers behind Symmetric NAT  
**How:** Traffic relayed through TURN server  
**Success Rate:** ~99% (if TURN configured)

## Example: Full Integration

```javascript
import P2PCoordinator from './services/p2pCoordinator.js';
import express from 'express';

const app = express();
let p2p = null;

// Initialize P2P
async function setupP2P() {
    p2p = new P2PCoordinator({
        signalingPort: 8080,
        stunServers: [
            'stun:stun.l.google.com:19302',
            'stun:stun1.l.google.com:19302'
        ],
        turnServers: process.env.TURN_SERVER ? [{
            urls: process.env.TURN_SERVER,
            username: process.env.TURN_USERNAME,
            credential: process.env.TURN_PASSWORD
        }] : [],
        enableDetailedLogging: true
    });

    await p2p.initialize();

    // Log NAT info
    const nat = p2p.getNATInfo();
    console.log(`NAT Type: ${nat.type}`);
    console.log(`Public IP: ${nat.publicIP}:${nat.publicPort}`);

    // Log recommended strategy
    const strategy = p2p.getRecommendedStrategy();
    console.log(`Strategy: ${strategy.method}`);
    if (strategy.requiresTurn) {
        console.warn('⚠️  TURN relay recommended');
    }

    // Register self
    p2p.registerPeer('my-server', {
        name: 'Self-Streme Server',
        version: '1.0.0'
    });

    // Listen for events
    p2p.on('connected', (conn) => {
        console.log(`✓ Connected to peer: ${conn.peerId}`);
    });

    p2p.on('connectionFailed', ({ peerId, error }) => {
        console.error(`✗ Failed to connect to ${peerId}: ${error}`);
    });
}

// Add Express routes
app.get('/p2p/status', (req, res) => {
    if (!p2p) {
        return res.json({ enabled: false });
    }

    res.json({
        enabled: true,
        nat: p2p.getNATInfo(),
        stats: p2p.getStats(),
        health: p2p.healthCheck(),
        strategy: p2p.getRecommendedStrategy()
    });
});

app.get('/p2p/connect/:peerId', async (req, res) => {
    try {
        const connection = await p2p.connectToPeer(req.params.peerId);
        res.json({ success: true, connection });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Start server
async function start() {
    await setupP2P();
    
    app.listen(3000, () => {
        console.log('Server running on port 3000');
    });
}

// Graceful shutdown
process.on('SIGTERM', async () => {
    console.log('Shutting down...');
    if (p2p) {
        await p2p.shutdown();
    }
    process.exit(0);
});

start();
```

## Troubleshooting

### "P2P initialization failed"
- Check STUN servers are accessible
- Verify firewall allows UDP traffic
- Check logs for specific error

### "Symmetric NAT detected but no TURN servers configured"
- This is informational, not an error
- Add TURN server to `.env` for better connectivity:
  ```env
  TURN_SERVER=turn:turn.example.com:3478
  TURN_USERNAME=user
  TURN_PASSWORD=pass
  ```

### "Peer not found"
- Peer hasn't registered with signaling server
- Check signaling server is running (port 8080)
- Verify peer is online

### "Connection timeout"
- Normal for unreachable peers
- Check both peers have open firewall ports
- Verify NAT types are compatible

### "Port 8080 already in use"
- Change `signalingPort` in options
- Or stop the process using port 8080

## Performance Tips

1. **Use STUN servers close to your location** for faster NAT detection
2. **Configure TURN relay** if you expect many Symmetric NAT users
3. **Enable detailed logging** only in development (impacts performance)
4. **Monitor stats regularly** to track success rates
5. **Implement connection pooling** for frequently connected peers

## Security Considerations

1. **Signaling server has no authentication** by default - add auth for production
2. **TURN credentials** should be kept secure (use environment variables)
3. **Peer IDs should be unique** and not easily guessable
4. **Connection data is not encrypted** by default - add TLS for sensitive data
5. **Rate limiting** should be implemented on signaling server

## Summary

The P2P Coordinator:
- ✅ **Integrates** hole punching and signaling
- ✅ **Automatically** detects NAT and chooses best strategy
- ✅ **Manages** all P2P connections
- ✅ **Tracks** statistics and health
- ✅ **Handles** errors and fallbacks gracefully

You just need to:
1. Initialize it once
2. Register your peer
3. Connect to other peers when needed

Everything else happens automatically! 🚀

## Related Files

- `holePunchingService.js` - NAT traversal implementation
- `signalingServer.js` - WebSocket peer coordination
- `examples/p2p-integration.js` - Working example
- `docs/P2P_HOLE_PUNCHING.md` - Detailed documentation
- `SIMPLE_P2P_INTEGRATION.js` - Quick integration guide

---

**Need Help?**

- Check logs: `tail -f logs/app.log`
- Test P2P: `node test-p2p.js`
- View status: `curl http://localhost:3000/p2p/status`
- See examples: `examples/p2p-integration.js`
