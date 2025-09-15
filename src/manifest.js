// Get the base URL from environment or default to render URL
const baseUrl = process.env.BASE_URL || 'self-streme.onrender.com';
const manifestUrl = `${baseUrl.replace(/^https?:\/\//, '')}`;

const manifest = {
  id: "org.selfstreme",
  version: "1.0.0",
  name: "Self-Streme",
  description: "Stream movies and series from multiple sources including local files and torrents",
  url: manifestUrl,
  types: ["movie", "series"],
  resources: ["stream", "meta"],
  catalogs: [],
  idPrefixes: ["tt"],
  behaviorHints: {
    p2p: true,
    adult: false
  },
  logo: `https://${baseUrl}/logo.png`,
  contactEmail: "self-streme@zvicraft.com"
};

export default manifest;
