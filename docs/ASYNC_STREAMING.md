# Async Stream Preparation API

Complete guide to using the async streaming API to avoid Cloudflare tunnel timeouts and provide instant playback.

---

## The Problem

When using Cloudflare Tunnel or similar proxies, direct streaming can timeout because:

1. **P2P takes 60 seconds** to find peers
2. **HTTP fallback takes 30-120 seconds** to download
3. **Cloudflare tunnel timeout** is typically 100 seconds
4. **Client sees timeout error** before stream is ready

**Error you see:**
```
[TUNNEL] Request failed error="Incoming request ended abruptly: context canceled"
```

---

## The Solution: Async Stream Preparation

Instead of waiting for the stream to be ready, we:

1. **Start preparation in background** (returns immediately)
2. **Poll for status** (check progress)
3. **Stream when ready** (instant playback)

**Benefits:**
- ✅ No tunnel timeout (returns in <1 second)
- ✅ Progress updates while preparing
- ✅ Instant playback when ready
- ✅ Better user experience
- ✅ Works with all proxies/tunnels

---

## API Overview

### Three Endpoints

1. **POST `/stream/prepare/:infoHash`** - Start preparation (returns immediately)
2. **GET `/stream/status/:jobId`** - Check progress
3. **GET `/stream/ready/:jobId`** - Stream when ready

---

## Quick Start

### Step 1: Prepare Stream

```bash
# Start preparation
curl -X POST "https://your-domain.com/stream/prepare/310110041b9909f5442ac4d012f75a602cd3ac2b"

# Response (immediate):
{
  "success": true,
  "jobId": "310110041b9909f5442ac4d012f75a602cd3ac2b:0:1700512345678",
  "infoHash": "310110041b9909f5442ac4d012f75a602cd3ac2b",
  "fileIndex": 0,
  "statusUrl": "/stream/status/310110041b9909f5442ac4d012f75a602cd3ac2b:0:1700512345678",
  "streamUrl": "/stream/ready/310110041b9909f5442ac4d012f75a602cd3ac2b:0:1700512345678",
  "estimatedTime": "30-90 seconds",
  "message": "Stream preparation started. Poll statusUrl for progress."
}
```

### Step 2: Poll Status

```bash
# Check progress every 2-5 seconds
curl "https://your-domain.com/stream/status/310110041b9909f5442ac4d012f75a602cd3ac2b:0:1700512345678"

# Response (while preparing):
{
  "success": true,
  "jobId": "310110041b9909f5442ac4d012f75a602cd3ac2b:0:1700512345678",
  "status": "connecting",
  "progress": 10,
  "message": "Trying P2P connections..."
}

# Response (when ready):
{
  "success": true,
  "jobId": "310110041b9909f5442ac4d012f75a602cd3ac2b:0:1700512345678",
  "status": "ready",
  "progress": 100,
  "message": "Stream ready via Real-Debrid",
  "streamUrl": "/stream/ready/310110041b9909f5442ac4d012f75a602cd3ac2b:0:1700512345678",
  "method": "http-download",
  "fileName": "video.mkv",
  "fileSize": 11943936000,
  "expiresAt": 1700512645678
}
```

### Step 3: Stream

```bash
# Once status is "ready", stream immediately
curl "https://your-domain.com/stream/ready/310110041b9909f5442ac4d012f75a602cd3ac2b:0:1700512345678"

# Or open in video player:
# https://your-domain.com/stream/ready/310110041b9909f5442ac4d012f75a602cd3ac2b:0:1700512345678
```

---

## Complete Examples

### JavaScript/Node.js

```javascript
async function prepareAndStream(infoHash, fileIndex = 0) {
  const baseUrl = 'https://stream.your-domain.com';
  
  // Step 1: Start preparation
  console.log('Starting stream preparation...');
  const prepareRes = await fetch(`${baseUrl}/stream/prepare/${infoHash}?fileIndex=${fileIndex}`, {
    method: 'POST'
  });
  const prepareData = await prepareRes.json();
  
  if (!prepareData.success) {
    throw new Error('Failed to start preparation');
  }
  
  console.log(`Job ID: ${prepareData.jobId}`);
  console.log(`Estimated time: ${prepareData.estimatedTime}`);
  
  // Step 2: Poll status
  const statusUrl = `${baseUrl}${prepareData.statusUrl}`;
  let status = 'preparing';
  
  while (status !== 'ready' && status !== 'failed') {
    await new Promise(resolve => setTimeout(resolve, 3000)); // Wait 3 seconds
    
    const statusRes = await fetch(statusUrl);
    const statusData = await statusRes.json();
    
    status = statusData.status;
    console.log(`Progress: ${statusData.progress}% - ${statusData.message}`);
    
    if (status === 'failed') {
      throw new Error(`Preparation failed: ${statusData.error}`);
    }
  }
  
  // Step 3: Get stream URL
  const streamUrl = `${baseUrl}${prepareData.streamUrl}`;
  console.log(`Stream ready: ${streamUrl}`);
  
  return streamUrl;
}

// Usage
prepareAndStream('310110041b9909f5442ac4d012f75a602cd3ac2b')
  .then(streamUrl => {
    console.log('Play:', streamUrl);
    // videoPlayer.src = streamUrl;
  })
  .catch(error => {
    console.error('Error:', error);
  });
```

### React Component

```jsx
import React, { useState, useEffect } from 'react';

function AsyncStreamPlayer({ infoHash, fileIndex = 0 }) {
  const [status, setStatus] = useState('idle');
  const [progress, setProgress] = useState(0);
  const [message, setMessage] = useState('');
  const [streamUrl, setStreamUrl] = useState(null);
  const [error, setError] = useState(null);
  
  const baseUrl = 'https://stream.your-domain.com';
  
  useEffect(() => {
    prepareStream();
  }, [infoHash, fileIndex]);
  
  async function prepareStream() {
    try {
      setStatus('starting');
      setMessage('Starting stream preparation...');
      
      // Start preparation
      const prepareRes = await fetch(
        `${baseUrl}/stream/prepare/${infoHash}?fileIndex=${fileIndex}`,
        { method: 'POST' }
      );
      const prepareData = await prepareRes.json();
      
      if (!prepareData.success) {
        throw new Error('Failed to start preparation');
      }
      
      const statusUrl = `${baseUrl}${prepareData.statusUrl}`;
      const readyUrl = `${baseUrl}${prepareData.streamUrl}`;
      
      // Poll status
      setStatus('preparing');
      const pollInterval = setInterval(async () => {
        try {
          const statusRes = await fetch(statusUrl);
          const statusData = await statusRes.json();
          
          setProgress(statusData.progress);
          setMessage(statusData.message);
          
          if (statusData.status === 'ready') {
            clearInterval(pollInterval);
            setStatus('ready');
            setStreamUrl(readyUrl);
            setMessage('Stream ready!');
          } else if (statusData.status === 'failed') {
            clearInterval(pollInterval);
            setStatus('failed');
            setError(statusData.error);
          }
        } catch (err) {
          clearInterval(pollInterval);
          setStatus('failed');
          setError(err.message);
        }
      }, 3000); // Poll every 3 seconds
      
      // Cleanup on unmount
      return () => clearInterval(pollInterval);
      
    } catch (err) {
      setStatus('failed');
      setError(err.message);
    }
  }
  
  return (
    <div className="stream-player">
      {status === 'starting' && (
        <div className="status">
          <p>{message}</p>
        </div>
      )}
      
      {status === 'preparing' && (
        <div className="status">
          <div className="progress-bar">
            <div className="progress" style={{ width: `${progress}%` }} />
          </div>
          <p>{message} ({progress}%)</p>
        </div>
      )}
      
      {status === 'ready' && streamUrl && (
        <video 
          controls 
          autoPlay 
          src={streamUrl}
          style={{ width: '100%', height: 'auto' }}
        />
      )}
      
      {status === 'failed' && (
        <div className="error">
          <p>Failed to prepare stream: {error}</p>
          <button onClick={prepareStream}>Retry</button>
        </div>
      )}
    </div>
  );
}

export default AsyncStreamPlayer;
```

### Python

```python
import requests
import time

def prepare_and_stream(info_hash, file_index=0, base_url='https://stream.your-domain.com'):
    """Prepare stream and return URL when ready"""
    
    # Step 1: Start preparation
    print('Starting stream preparation...')
    prepare_url = f'{base_url}/stream/prepare/{info_hash}?fileIndex={file_index}'
    prepare_res = requests.post(prepare_url)
    prepare_data = prepare_res.json()
    
    if not prepare_data.get('success'):
        raise Exception('Failed to start preparation')
    
    job_id = prepare_data['jobId']
    status_url = f"{base_url}{prepare_data['statusUrl']}"
    stream_url = f"{base_url}{prepare_data['streamUrl']}"
    
    print(f"Job ID: {job_id}")
    print(f"Estimated time: {prepare_data['estimatedTime']}")
    
    # Step 2: Poll status
    status = 'preparing'
    while status not in ['ready', 'failed']:
        time.sleep(3)  # Wait 3 seconds
        
        status_res = requests.get(status_url)
        status_data = status_res.json()
        
        status = status_data['status']
        progress = status_data['progress']
        message = status_data['message']
        
        print(f"Progress: {progress}% - {message}")
        
        if status == 'failed':
            raise Exception(f"Preparation failed: {status_data.get('error')}")
    
    # Step 3: Return stream URL
    print(f"Stream ready: {stream_url}")
    return stream_url

# Usage
try:
    stream_url = prepare_and_stream('310110041b9909f5442ac4d012f75a602cd3ac2b')
    print(f"Play: {stream_url}")
    # os.system(f'vlc "{stream_url}"')  # Open in VLC
except Exception as e:
    print(f"Error: {e}")
```

### cURL/Bash Script

```bash
#!/bin/bash
# prepare-stream.sh

INFO_HASH="$1"
FILE_INDEX="${2:-0}"
BASE_URL="https://stream.your-domain.com"

if [ -z "$INFO_HASH" ]; then
    echo "Usage: $0 <info_hash> [file_index]"
    exit 1
fi

# Step 1: Start preparation
echo "Starting stream preparation..."
PREPARE_RESPONSE=$(curl -s -X POST "$BASE_URL/stream/prepare/$INFO_HASH?fileIndex=$FILE_INDEX")

JOB_ID=$(echo "$PREPARE_RESPONSE" | jq -r '.jobId')
STATUS_URL=$(echo "$PREPARE_RESPONSE" | jq -r '.statusUrl')
STREAM_URL=$(echo "$PREPARE_RESPONSE" | jq -r '.streamUrl')

echo "Job ID: $JOB_ID"
echo "Status URL: $BASE_URL$STATUS_URL"

# Step 2: Poll status
STATUS="preparing"
while [ "$STATUS" != "ready" ] && [ "$STATUS" != "failed" ]; do
    sleep 3
    
    STATUS_RESPONSE=$(curl -s "$BASE_URL$STATUS_URL")
    STATUS=$(echo "$STATUS_RESPONSE" | jq -r '.status')
    PROGRESS=$(echo "$STATUS_RESPONSE" | jq -r '.progress')
    MESSAGE=$(echo "$STATUS_RESPONSE" | jq -r '.message')
    
    echo "Progress: $PROGRESS% - $MESSAGE"
    
    if [ "$STATUS" = "failed" ]; then
        ERROR=$(echo "$STATUS_RESPONSE" | jq -r '.error')
        echo "Failed: $ERROR"
        exit 1
    fi
done

# Step 3: Stream URL ready
echo ""
echo "Stream ready!"
echo "URL: $BASE_URL$STREAM_URL"
echo ""
echo "Play with VLC:"
echo "  vlc \"$BASE_URL$STREAM_URL\""
echo ""
echo "Or open in browser:"
echo "  xdg-open \"$BASE_URL$STREAM_URL\""
```

---

## Status Types

### Status: `preparing`
- **Progress:** 0-10%
- **Message:** "Starting stream preparation..."
- **Action:** Keep polling

### Status: `connecting`
- **Progress:** 10-50%
- **Message:** "Trying P2P connections..."
- **Action:** Keep polling (P2P attempt in progress)

### Status: `downloading`
- **Progress:** 50-100%
- **Message:** "Downloading from [Source]..."
- **Action:** Keep polling (HTTP download in progress)

### Status: `ready`
- **Progress:** 100%
- **Message:** "Stream ready via [Method]"
- **Action:** Start streaming from `streamUrl`

### Status: `failed`
- **Progress:** 0%
- **Error:** Error message
- **Action:** Show error, allow retry

---

## Error Handling

### Job Not Found (404)

```json
{
  "success": false,
  "error": "Job not found",
  "message": "Job may have expired or never existed"
}
```

**Cause:** Job expired (5 minutes) or invalid job ID

**Solution:** Start new preparation

### Still Preparing (202)

```json
{
  "success": false,
  "status": "preparing",
  "message": "Trying P2P connections...",
  "progress": 25,
  "statusUrl": "/stream/status/..."
}
```

**Cause:** Stream not ready yet, client tried to stream too early

**Solution:** Continue polling status

### Preparation Failed

```json
{
  "success": true,
  "status": "failed",
  "progress": 0,
  "error": "Download failed from all sources",
  "message": "Failed: Download failed from all sources"
}
```

**Cause:** All sources (P2P + HTTP) failed

**Solution:** 
- Try different torrent
- Add premium service (Real-Debrid)
- Retry after some time

---

## Configuration

### Environment Variables

```bash
# Timeout for async job cache (default: 300000ms = 5 minutes)
LINK_GENERATION_TIMEOUT=300000

# How often to update progress (default: 5000ms = 5 seconds)
PROGRESS_UPDATE_INTERVAL=5000
```

---

## Comparison: Direct vs Async

### Direct Streaming (Old Method)

```
Client Request → Wait (60-120s) → Stream or Timeout
```

**Problems:**
- ❌ Cloudflare tunnel timeout (100s)
- ❌ No progress feedback
- ❌ Poor user experience
- ❌ Retry means waiting again

### Async Streaming (New Method)

```
Client Request → Immediate Response (jobId)
       ↓
Poll Status → Progress Updates → Stream Ready
```

**Benefits:**
- ✅ No timeout (returns instantly)
- ✅ Progress feedback
- ✅ Better UX
- ✅ Can show loading UI
- ✅ Multiple clients can poll same job

---

## Best Practices

### 1. Poll Interval

```javascript
// Good: 3-5 seconds
const POLL_INTERVAL = 3000;

// Bad: Too fast (wastes resources)
const POLL_INTERVAL = 500;

// Bad: Too slow (feels unresponsive)
const POLL_INTERVAL = 30000;
```

### 2. Show Progress

```javascript
// Good: Show meaningful progress
<ProgressBar value={progress} />
<p>{message}</p>

// Bad: No feedback
<Spinner />
```

### 3. Handle Expiration

```javascript
// Check if job expired
if (statusData.status === 'not found') {
  console.log('Job expired, starting new preparation...');
  prepareStream(); // Start over
}
```

### 4. Deduplicate Requests

```javascript
// Good: Reuse job ID if already preparing
const existingJobId = localStorage.getItem(`job_${infoHash}`);
if (existingJobId) {
  // Check if still valid
  const status = await checkStatus(existingJobId);
  if (status === 'ready') {
    return streamUrl;
  }
}

// Start new preparation
const newJobId = await prepareStream(infoHash);
localStorage.setItem(`job_${infoHash}`, newJobId);
```

### 5. Cleanup on Unmount

```javascript
// React example
useEffect(() => {
  const interval = setInterval(pollStatus, 3000);
  
  // Cleanup when component unmounts
  return () => clearInterval(interval);
}, []);
```

---

## Integration with Stremio/Jellyfin/Plex

### Stremio Addon

```javascript
builder.defineStreamHandler(async (args) => {
  const { infoHash } = args;
  
  // Start async preparation
  const prepareRes = await fetch(
    `${baseUrl}/stream/prepare/${infoHash}`,
    { method: 'POST' }
  );
  const prepareData = await prepareRes.json();
  
  // Return stream that will be ready soon
  return {
    streams: [{
      url: `${baseUrl}${prepareData.streamUrl}`,
      title: 'Self-Streme (preparing...)',
      // Stremio will start buffering when URL is accessed
    }]
  };
});
```

### Jellyfin Plugin

```csharp
public async Task<string> GetStreamUrl(string infoHash) 
{
    var baseUrl = "https://stream.your-domain.com";
    
    // Start preparation
    var prepareUrl = $"{baseUrl}/stream/prepare/{infoHash}";
    var prepareRes = await client.PostAsync(prepareUrl);
    var prepareData = await prepareRes.Content.ReadAsAsync<PrepareResponse>();
    
    var statusUrl = $"{baseUrl}{prepareData.StatusUrl}";
    
    // Poll until ready
    while (true) 
    {
        await Task.Delay(3000);
        var statusRes = await client.GetAsync(statusUrl);
        var statusData = await statusRes.Content.ReadAsAsync<StatusResponse>();
        
        if (statusData.Status == "ready") 
        {
            return $"{baseUrl}{prepareData.StreamUrl}";
        }
        
        if (statusData.Status == "failed") 
        {
            throw new Exception($"Stream preparation failed: {statusData.Error}");
        }
    }
}
```

---

## Monitoring

### Check Active Jobs

```bash
# Get all active preparation jobs (admin endpoint)
curl "https://stream.your-domain.com/api/admin/jobs"

# Response:
{
  "activeJobs": 5,
  "jobs": [
    {
      "jobId": "abc123:0:1700512345678",
      "status": "preparing",
      "progress": 35,
      "startedAt": 1700512345678,
      "infoHash": "abc123"
    }
  ]
}
```

### Logs

```bash
# Watch preparation logs
tail -f logs/app.log | grep "Background"

# Output:
# [API] Background: Starting stream preparation for abc123:0:1700512345678
# [API] Background: Stream ready via Real-Debrid for abc123:0:1700512345678
```

---

## FAQ

### Q: How long does preparation take?

**A:** Depends on method:
- P2P (popular torrent): 5-30 seconds
- Premium service: 10-60 seconds
- Free HTTP sources: 30-120 seconds

### Q: Can multiple clients use same job?

**A:** Yes! If you start preparation and share the `jobId`, multiple clients can poll and stream from same job.

### Q: What happens if job expires?

**A:** Jobs expire after 5 minutes of readiness. Client gets 404 and must start new preparation.

### Q: Does this use more server resources?

**A:** No. It's the same backend process, just exposed differently. Actual benefit: less wasted work from timeouts.

### Q: Can I use this without polling?

**A:** Not recommended. Direct streaming (`/stream/proxy/:infoHash`) will timeout on Cloudflare Tunnel. Async API solves this.

### Q: Is job ID reusable?

**A:** Job ID is valid for 5 minutes after stream is ready. After that, start new preparation.

---

## Migration Guide

### From Direct Streaming

**Before:**
```javascript
// Direct streaming (times out on Cloudflare Tunnel)
const streamUrl = `/stream/proxy/${infoHash}`;
videoPlayer.src = streamUrl;
```

**After:**
```javascript
// Async streaming (works with Cloudflare Tunnel)
const prepareRes = await fetch(`/stream/prepare/${infoHash}`, { method: 'POST' });
const { jobId, statusUrl, streamUrl } = await prepareRes.json();

// Poll until ready
let ready = false;
while (!ready) {
  await sleep(3000);
  const status = await fetch(statusUrl).then(r => r.json());
  if (status.status === 'ready') {
    ready = true;
    videoPlayer.src = streamUrl;
  }
}
```

---

## Related Documentation

- **Quick Fix:** `QUICK_FIX.md` - Add premium services
- **Reliability:** `docs/100_PERCENT_RELIABILITY.md` - Maximize success rates
- **Free Sources:** `docs/FREE_SOURCES_OPTIMIZATION.md` - Optimize free sources
- **API Reference:** `docs/API.md` - Complete API documentation

---

**Last Updated:** 2025-11-20  
**Version:** 2.1  
**Solves:** Cloudflare Tunnel timeout errors