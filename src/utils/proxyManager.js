import axios from "axios";
import logger from "./logger.js";
import { config } from "../config/index.js";

let proxyList = [];
let currentProxyIndex = 0;
let lastProxyCheck = 0;
const PROXY_CHECK_INTERVAL = 5 * 60 * 1000; // 5 minutes

async function initialize() {
  try {
    await loadProxies();
    setupProxyRotation();
    logger.info("ProxyManager initialized successfully");
  } catch (error) {
    logger.error("Failed to initialize ProxyManager:", error);
    throw error;
  }
}

async function loadProxies() {
  try {
    // Load proxies from config or environment
    proxyList = config.proxies || [];

    if (proxyList.length === 0) {
      logger.warn("No proxies configured. Using direct connection.");
    } else {
      logger.info(`Loaded ${proxyList.length} proxies`);
    }
  } catch (error) {
    logger.error("Error loading proxies:", error);
    proxyList = [];
  }
}

function setupProxyRotation() {
  setInterval(async () => {
    const now = Date.now();
    if (now - lastProxyCheck >= PROXY_CHECK_INTERVAL) {
      await checkProxies();
      lastProxyCheck = now;
    }
  }, PROXY_CHECK_INTERVAL);
}

async function checkProxies() {
  if (proxyList.length === 0) return;

  const workingProxies = [];
  for (const proxy of proxyList) {
    try {
      const response = await axios.get("https://api.ipify.org?format=json", {
        proxy: {
          host: proxy.host,
          port: proxy.port,
          auth: proxy.auth,
        },
        timeout: 5000,
      });

      if (response.status === 200) {
        workingProxies.push(proxy);
        logger.debug(`Proxy ${proxy.host}:${proxy.port} is working`);
      }
    } catch (error) {
      logger.warn(
        `Proxy ${proxy.host}:${proxy.port} is not working: ${error.message}`
      );
    }
  }

  proxyList = workingProxies;
  if (proxyList.length === 0) {
    logger.warn("No working proxies found");
  }
}

function getNextProxy() {
  if (proxyList.length === 0) return null;

  const proxy = proxyList[currentProxyIndex];
  currentProxyIndex = (currentProxyIndex + 1) % proxyList.length;
  return proxy;
}

function getProxyConfig() {
  const proxy = getNextProxy();
  if (!proxy) return null;

  return {
    host: proxy.host,
    port: proxy.port,
    auth: proxy.auth,
  };
}

const proxyManager = {
  initialize,
  getProxyConfig,
  getNextProxy,
  checkProxies,
};

export default proxyManager;  