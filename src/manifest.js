// Get the base URL from environment or default to render URL
// Note: The actual URL will be dynamically determined in the manifest endpoint
// based on proxy headers and request information
const baseUrl = process.env.BASE_URL || 'https://self-streme.onrender.com';

// Extract just the hostname part for the manifest URL (removing protocol)
const manifestUrl = baseUrl.replace(/^https?:\/\//, '');

const manifest = {
  id: "com.zvicraft.selfstreme",
  version: "1.0.0",
  name: "Self-Streme",
  description: "Stream movies and series from multiple sources including local files and torrents",
  url: manifestUrl, // This will be overridden in the manifest endpoint
  types: ["movie", "series"],
  resources: ["stream", "meta"],
  catalogs: [],
  idPrefixes: ["tt"],
  behaviorHints: {
    p2p: true,
    adult: false
  },
  logo: `${baseUrl}/logo.png`, // This will be overridden in the manifest endpoint
  contactEmail: "self-streme@zvicraft.com"
};

export default manifest;
