// Enhanced torrent tracker configuration
// This file contains a curated list of reliable public torrent trackers

export const publicTrackers = [
  // Tier 1 - Most reliable trackers
  'udp://tracker.opentrackr.org:1337/announce',
  'udp://open.stealth.si:80/announce',
  'udp://tracker.openbittorrent.com:6969/announce',
  'udp://exodus.desync.com:6969/announce',

  // Tier 2 - Very reliable
  'udp://tracker.torrent.eu.org:451/announce',
  'udp://tracker.moeking.me:6969/announce',
  'udp://explodie.org:6969/announce',
  'udp://tracker1.bt.moack.co.kr:80/announce',
  'udp://tracker.tiny-vps.com:6969/announce',

  // Tier 3 - Good trackers
  'udp://open.demonii.com:1337/announce',
  'udp://tracker.pomf.se:80/announce',
  'udp://tracker.cyberia.is:6969/announce',
  'udp://ipv4.tracker.harry.lu:80/announce',
  'udp://tracker.ds.is:6969/announce',

  // HTTP/HTTPS fallbacks
  'https://tracker.nanoha.org:443/announce',
  'https://tracker.lilithraws.org:443/announce',
  'http://tracker.openbittorrent.com:80/announce',

  // Additional reliable trackers
  'udp://tracker.opentrackr.org:1337',
  'udp://tracker.coppersurfer.tk:6969/announce',
  'udp://tracker.leechers-paradise.org:6969/announce',
  'udp://9.rarbg.to:2710/announce',
  'udp://9.rarbg.me:2710/announce',
  'udp://tracker.internetwarriors.net:1337/announce',
  'udp://tracker.cyberia.is:6969/announce',
  'udp://bt1.archive.org:6969/announce',
  'udp://bt2.archive.org:6969/announce',

  // WebTorrent trackers (for hybrid support)
  'wss://tracker.btorrent.xyz',
  'wss://tracker.openwebtorrent.com',
  'wss://tracker.fastcast.nz',
];

// DHT bootstrap nodes for better peer discovery
export const dhtBootstrap = [
  'router.bittorrent.com:6881',
  'router.utorrent.com:6881',
  'dht.transmissionbt.com:6881',
  'dht.aelitis.com:6881',
  'dht.libtorrent.org:25401',
  'router.silotis.us:6881',
  'dht.anacrolix.link:42069',
];

// Get all trackers as an array
export function getAllTrackers() {
  return [...publicTrackers];
}

// Get trackers by protocol
export function getTrackersByProtocol(protocol) {
  const protocolPrefix = protocol.toLowerCase() + '://';
  return publicTrackers.filter(tracker =>
    tracker.toLowerCase().startsWith(protocolPrefix)
  );
}

// Add trackers to a magnet URI
export function addTrackersToMagnet(magnetUri) {
  if (!magnetUri || typeof magnetUri !== 'string') {
    return magnetUri;
  }

  // Check if magnet already has trackers
  const hasTrackers = magnetUri.includes('&tr=');

  if (hasTrackers) {
    // Already has some trackers, just return as is
    return magnetUri;
  }

  // Add our reliable trackers
  const trackerParams = publicTrackers
    .map(tracker => `&tr=${encodeURIComponent(tracker)}`)
    .join('');

  return magnetUri + trackerParams;
}

// Create magnet URI from info hash
export function createMagnetUri(infoHash, name = null) {
  if (!infoHash) {
    throw new Error('Info hash is required');
  }

  // Clean info hash (remove any spaces or special chars)
  const cleanHash = infoHash.toLowerCase().replace(/[^a-f0-9]/g, '');

  if (cleanHash.length !== 40) {
    throw new Error('Invalid info hash length (must be 40 characters)');
  }

  let magnet = `magnet:?xt=urn:btih:${cleanHash}`;

  if (name) {
    magnet += `&dn=${encodeURIComponent(name)}`;
  }

  // Add all trackers
  const trackerParams = publicTrackers
    .map(tracker => `&tr=${encodeURIComponent(tracker)}`)
    .join('');

  magnet += trackerParams;

  return magnet;
}

// Validate tracker URL
export function isValidTracker(trackerUrl) {
  if (!trackerUrl || typeof trackerUrl !== 'string') {
    return false;
  }

  const validProtocols = ['udp://', 'http://', 'https://', 'wss://'];
  return validProtocols.some(protocol =>
    trackerUrl.toLowerCase().startsWith(protocol)
  );
}

// Get tracker statistics (for monitoring)
export function getTrackerStats() {
  const stats = {
    total: publicTrackers.length,
    byProtocol: {
      udp: getTrackersByProtocol('udp').length,
      http: getTrackersByProtocol('http').length,
      https: getTrackersByProtocol('https').length,
      wss: getTrackersByProtocol('wss').length,
    },
    dhtNodes: dhtBootstrap.length,
  };

  return stats;
}

export default {
  publicTrackers,
  dhtBootstrap,
  getAllTrackers,
  getTrackersByProtocol,
  addTrackersToMagnet,
  createMagnetUri,
  isValidTracker,
  getTrackerStats,
};
