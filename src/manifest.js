// Static manifest configuration
// Note: The base URL and dynamic fields (url, logo) are set dynamically
// in the manifest endpoint (index.js) based on actual request information
// and proxy headers (X-Forwarded-Host, X-Forwarded-Proto, etc.)

const manifest = {
  id: "com.zvicraft.selfstreme",
  version: "1.0.0",
  name: "Self-Streme",
  description:
    "Stream movies and series from multiple sources including local files and torrents",
  url: "", // Dynamically set in the manifest endpoint
  types: ["movie", "series"],
  resources: ["stream", "meta"],
  catalogs: [],
  idPrefixes: ["tt"],
  behaviorHints: {
    p2p: true,
    adult: false,
  },
  logo: "", // Dynamically set in the manifest endpoint
  contactEmail: "self-streme@zvicraft.com",
};

export default manifest;
