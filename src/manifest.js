const manifest = {
  id: "com.zvicraft.selfstreme",
  version: "1.0.0",
  name: "Self-Streme",
  // This will be used if PUBLIC_URL is not set
  url: process.env.PUBLIC_URL || "https://localhost",
  description: "Stream movies and series from multiple sources including local files and torrents",
  types: ["movie", "series"],
  resources: ["stream", "meta"],
  catalogs: [],
  idPrefixes: ["tt"],
  behaviorHints: {
    p2p: true,
    adult: false
  },
  logo: "https://dl.strem.io/addon-logo-self-streme.png",
  contactEmail: "self-streme@zvicraft.com"
};

export default manifest;
