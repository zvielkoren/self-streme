# Test Files Directory

This directory contains test files and utilities for Self-Streme development and testing.

## Files Overview

### `testServer.js`
Standalone test server for quick testing and debugging.

**Purpose:**
- Quick local testing without full setup
- Debug specific features
- Isolated component testing

**Usage:**
```bash
node test/testServer.js
```

**Features:**
- Minimal configuration
- Fast startup
- Direct API access
- Console output logging

**Example:**
```bash
# Start test server
node test/testServer.js

# Test in another terminal
curl http://localhost:3000/health
```

### `start-torrent-server.js`
Dedicated torrent service test server.

**Purpose:**
- Test torrent functionality independently
- Debug P2P connections
- Validate WebTorrent integration
- Test dynamic sources

**Usage:**
```bash
node test/start-torrent-server.js
```

**Features:**
- Torrent-specific testing
- P2P diagnostics
- Source availability testing
- DHT connection validation

**Testing Scenarios:**
```bash
# Test magnet link
curl -X POST http://localhost:3000/api/torrents \
  -H "Content-Type: application/json" \
  -d '{"magnetUri": "magnet:?xt=urn:btih:..."}'

# Test dynamic sources
curl http://localhost:3000/api/sources/stats

# Test specific source
curl http://localhost:3000/api/sources/test/INFOHASH/file.mp4
```

## Running Tests

### Quick Test Suite
```bash
# Run all tests
npm test

# Run specific test file
npm test -- test/testServer.js

# Watch mode
npm test -- --watch
```

### Manual Testing

#### 1. Basic Functionality
```bash
# Start test server
node test/testServer.js

# Test health endpoint
curl http://localhost:3000/health

# Expected: {"status": "ok", "uptime": ...}
```

#### 2. Torrent Streaming
```bash
# Start torrent server
node test/start-torrent-server.js

# Add torrent
curl -X POST http://localhost:3000/api/torrents \
  -H "Content-Type: application/json" \
  -d '{"magnetUri": "magnet:?xt=urn:btih:DD8255ECDC7CA55FB0BBF81323D87062DB1F6D1C"}'

# Check streaming
curl http://localhost:3000/stream/proxy/DD8255ECDC7CA55FB0BBF81323D87062DB1F6D1C
```

#### 3. Dynamic Sources
```bash
# View available sources
curl http://localhost:3000/api/sources/stats | jq

# Test source availability
curl http://localhost:3000/api/sources/test/ABC123/test.mp4 | jq
```

#### 4. Cache System
```bash
# Check cache stats
curl http://localhost:3000/api/cache-stats | jq

# View cache config
curl http://localhost:3000/api/cache-config | jq
```

## Test Scenarios

### Scenario 1: P2P Streaming
```bash
# 1. Start server
node test/start-torrent-server.js

# 2. Add popular torrent (Big Buck Bunny)
curl -X POST http://localhost:3000/api/torrents \
  -H "Content-Type: application/json" \
  -d '{"magnetUri": "magnet:?xt=urn:btih:dd8255ecdc7ca55fb0bbf81323d87062db1f6d1c&dn=Big+Buck+Bunny"}'

# 3. Wait for peers (check logs)
# Expected: "Peer connected, total peers: X"

# 4. Stream video
curl -I http://localhost:3000/stream/proxy/dd8255ecdc7ca55fb0bbf81323d87062db1f6d1c
```

### Scenario 2: HTTP Fallback
```bash
# 1. Start server
node test/start-torrent-server.js

# 2. Add rare/dead torrent (no peers)
curl -X POST http://localhost:3000/api/torrents \
  -H "Content-Type: application/json" \
  -d '{"magnetUri": "magnet:?xt=urn:btih:DEADBEEF..."}'

# 3. Watch logs for fallback
# Expected: "P2P timeout" → "Falling back to HTTP download"
# Expected: "Trying Instant.io..." → "Trying TorrentDrive..."

# 4. Verify stream works via HTTP
curl -I http://localhost:3000/stream/proxy/DEADBEEF
```

### Scenario 3: Source Selection
```bash
# 1. Test each source
for source in Instant.io TorrentDrive BTCache; do
  echo "Testing $source..."
  curl -s http://localhost:3000/api/sources/test/DD8255ECDC7CA55FB0BBF81323D87062DB1F6D1C/test.mp4 | jq
done

# 2. View source statistics
curl http://localhost:3000/api/sources/stats | jq '.sources[] | {name, priority, note}'
```

### Scenario 4: Cache Behavior
```bash
# 1. First request (cold cache)
time curl -o /dev/null http://localhost:3000/stream/proxy/INFOHASH

# 2. Second request (warm cache)
time curl -o /dev/null http://localhost:3000/stream/proxy/INFOHASH

# 3. Expected: Second request much faster
```

## Development Testing

### Integration Tests
```bash
# Test full stack
npm run test:integration

# Test specific component
npm run test:torrent
npm run test:sources
npm run test:cache
```

### Unit Tests
```bash
# Test individual functions
npm run test:unit

# With coverage
npm run test:coverage
```

### E2E Tests
```bash
# End-to-end testing
npm run test:e2e

# Specific user flow
npm run test:e2e -- --grep "streaming workflow"
```

## Performance Testing

### Load Testing
```bash
# Install load testing tool
npm install -g artillery

# Run load test
artillery quick --count 10 --num 100 http://localhost:3000/health

# Custom scenario
artillery run test/load-test.yml
```

### Stress Testing
```bash
# Test concurrent streams
for i in {1..10}; do
  curl http://localhost:3000/stream/proxy/INFOHASH &
done
wait
```

### Memory Profiling
```bash
# Start with profiling
node --inspect test/testServer.js

# Connect Chrome DevTools to chrome://inspect
# Take heap snapshots
```

## Debugging

### Enable Debug Mode
```bash
# Full debug output
DEBUG=* node test/testServer.js

# Specific namespace
DEBUG=torrent:* node test/start-torrent-server.js
DEBUG=hybrid:* node test/testServer.js
```

### Verbose Logging
```bash
# Set log level
LOG_LEVEL=debug node test/testServer.js

# Or via environment
export LOG_LEVEL=silly
node test/testServer.js
```

### Interactive Debugging
```bash
# Node inspector
node --inspect-brk test/testServer.js

# VS Code: Add breakpoints and run debug configuration
```

## Common Test Commands

```bash
# Quick test
npm run test:quick

# Full test suite
npm test

# Watch mode
npm run test:watch

# Coverage report
npm run test:coverage

# Lint and test
npm run test:all

# CI/CD tests
npm run test:ci
```

## Test Data

### Sample Magnet Links

**Big Buck Bunny (Always works - for testing P2P):**
```
magnet:?xt=urn:btih:dd8255ecdc7ca55fb0bbf81323d87062db1f6d1c&dn=Big+Buck+Bunny
```

**Sintel (Another test torrent):**
```
magnet:?xt=urn:btih:08ada5a7a6183aae1e09d831df6748d566095a10&dn=Sintel
```

### Test API Calls
```bash
# Health check
curl http://localhost:3000/health

# Source stats
curl http://localhost:3000/api/sources/stats

# Cache stats
curl http://localhost:3000/api/cache-stats

# Base URL info
curl http://localhost:3000/api/base-url
```

## Writing New Tests

### Test File Template
```javascript
// test/myFeature.test.js
import { expect } from 'chai';
import { describe, it } from 'mocha';

describe('My Feature', () => {
  it('should do something', () => {
    expect(true).to.be.true;
  });

  it('should handle errors', async () => {
    // Test error cases
  });
});
```

### Integration Test Template
```javascript
// test/integration/streaming.test.js
import request from 'supertest';
import app from '../../src/index.js';

describe('Streaming Integration', () => {
  it('should stream torrent', async () => {
    const response = await request(app)
      .get('/stream/proxy/INFOHASH')
      .expect(200);
    
    expect(response.headers['content-type']).to.include('video');
  });
});
```

## CI/CD Integration

### GitHub Actions
```yaml
# .github/workflows/test.yml
name: Tests
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - uses: actions/setup-node@v2
      - run: npm install
      - run: npm test
```

### Pre-commit Hook
```bash
# .git/hooks/pre-commit
#!/bin/bash
npm test
if [ $? -ne 0 ]; then
  echo "Tests failed, commit aborted"
  exit 1
fi
```

## Troubleshooting Tests

### Tests Failing
```bash
# Clean install
rm -rf node_modules package-lock.json
npm install

# Clear cache
npm cache clean --force

# Run single test
npm test -- --grep "specific test name"
```

### Port Already in Use
```bash
# Kill process on port
lsof -ti:3000 | xargs kill -9

# Use different port
PORT=3001 node test/testServer.js
```

### Timeout Issues
```bash
# Increase timeout
TIMEOUT=60000 npm test

# Or in test file
it('slow test', async function() {
  this.timeout(60000);
  // test code
});
```

## Best Practices

1. **Isolate Tests**
   - Each test should be independent
   - Clean up after tests
   - Don't rely on test order

2. **Mock External Services**
   - Mock HTTP requests
   - Mock P2P connections for unit tests
   - Use test fixtures

3. **Test Edge Cases**
   - Empty inputs
   - Invalid data
   - Network failures
   - Resource exhaustion

4. **Document Tests**
   - Clear test names
   - Comment complex logic
   - Update this README

5. **Keep Tests Fast**
   - Use mocks for slow operations
   - Parallel test execution
   - Skip integration tests in watch mode

## Resources

- [Mocha Documentation](https://mochajs.org/)
- [Chai Assertion Library](https://www.chaijs.com/)
- [Supertest HTTP Testing](https://github.com/visionmedia/supertest)
- [Main Project README](../README.md)

## Contributing

When adding new test files:
1. Place in appropriate subdirectory
2. Follow naming convention: `*.test.js`
3. Add test scenario to this README
4. Ensure tests pass before committing

---

**Last Updated:** 2024
**Maintained by:** Development Team