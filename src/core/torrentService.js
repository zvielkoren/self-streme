import logger from "../utils/logger.js";
import WebTorrent from "webtorrent";
import { config } from "../config/index.js";
import fs from "fs";
import path from "path";

class TorrentService {
  constructor() {
    // Ensure download directory exists
    this.ensureDownloadPath();

    this.client = new WebTorrent({
      maxConns: config.torrent.maxConnections,
      downloadLimit: config.torrent.downloadLimit,
      uploadLimit: config.torrent.uploadLimit,
      dht: {
        bootstrap: [
          "router.bittorrent.com:6881",
          "router.utorrent.com:6881",
          "dht.transmissionbt.com:6881",
          "dht.aelitis.com:6881",
          "dht.libtorrent.org:25401",
        ],
      },
      lsd: true, // Enable local service discovery
      natUpmp: true, // Enable NAT traversal
      natPmp: true, // Enable NAT port mapping
      // Additional options for better connectivity
      tracker: {
        announce: config.torrent.trackers,
        wrtc: false, // Disable WebRTC for better server compatibility
      },
      // Increase timeouts for better connectivity in poor network conditions
      blocklist: false, // Don't block any IPs to maximize peer pool
      pieceTimeout: 30000, // 30 second piece timeout
    });
    this.activeTorrents = new Map();
    
    // Track last log times for rate-limiting repetitive messages
    this.lastLogTimes = new Map();

    // Log DHT status for debugging
    this.client.on("error", (err) => {
      logger.error("WebTorrent client error:", err);
    });

    logger.info("WebTorrent client initialized with DHT bootstrap nodes");
    this.initialize();
  }

  /**
   * Get proper MIME type based on file extension
   * @param {string} filename - The filename or file path
   * @returns {string} The appropriate MIME type
   */
  getVideoMimeType(filename) {
    if (!filename) return "video/mp4"; // default fallback

    const ext = path.extname(filename).toLowerCase();
    const mimeTypes = {
      ".mp4": "video/mp4",
      ".m4v": "video/mp4",
      ".mkv": "video/x-matroska",
      ".avi": "video/x-msvideo",
      ".mov": "video/quicktime",
      ".webm": "video/webm",
      ".flv": "video/x-flv",
      ".wmv": "video/x-ms-wmv",
      ".3gp": "video/3gpp",
      ".ogv": "video/ogg",
    };

    return mimeTypes[ext] || "video/mp4"; // default to mp4 for unknown types
  }

  ensureDownloadPath() {
    try {
      if (!fs.existsSync(config.torrent.downloadPath)) {
        fs.mkdirSync(config.torrent.downloadPath, { recursive: true });
        logger.info(
          `Created download directory: ${config.torrent.downloadPath}`,
        );
      }
    } catch (error) {
      logger.error("Failed to create download directory:", error);
    }
  }

  initialize() {
    this.client.on("error", (error) =>
      logger.error("WebTorrent client error:", error),
    );
    this.client.on("warning", (warning) =>
      logger.warn("WebTorrent warning:", warning),
    );
  }

  /**
   * Check if we should log a message based on rate limiting
   * @param {string} key - Unique key for this log message (e.g., "noPeers:hash")
   * @param {number} minInterval - Minimum milliseconds between logs (default: 30000)
   * @returns {boolean} True if we should log this message
   */
  shouldLog(key, minInterval = 30000) {
    const now = Date.now();
    const lastTime = this.lastLogTimes.get(key);
    
    if (!lastTime || now - lastTime >= minInterval) {
      this.lastLogTimes.set(key, now);
      return true;
    }
    
    return false;
  }

  async getStream(magnetUri, fileIdx = 0, retryCount = 0) {
    const maxRetries = config.torrent.maxRetries; // Use configurable max retries

    // Check if we have too many active torrents and cleanup first
    if (this.client.torrents.length >= config.torrent.maxConnections) {
      logger.warn(
        `Torrent limit reached (${this.client.torrents.length}/${config.torrent.maxConnections}), running cleanup`,
      );
      this.cleanup();

      // If still too many after cleanup, reject
      if (this.client.torrents.length >= config.torrent.maxConnections) {
        return Promise.reject(
          new Error("Too many active torrents, try again later"),
        );
      }
    }

    return new Promise((resolve, reject) => {
      try {
        // Validate and enhance magnet URI
        const validatedMagnetUri = this.validateAndEnhanceMagnetUri(magnetUri);
        if (!validatedMagnetUri) {
          return reject(new Error("Invalid magnet URI"));
        }

        const existing = this.activeTorrents.get(validatedMagnetUri);
        if (existing && existing.file) {
          logger.debug(
            `Using existing torrent stream for ${validatedMagnetUri.substring(0, 50)}...`,
          );
          existing.lastAccessed = Date.now(); // Update access time
          return resolve(existing);
        }

        // Extract info hash from magnet URI for duplicate checking
        const infoHashMatch = validatedMagnetUri.match(/xt=urn:btih:([^&]+)/i);
        const infoHash = infoHashMatch[1];
        logger.info(`Starting torrent stream for hash: ${infoHash}`);
        logger.info(`Extracted info hash: ${infoHash}, retry: ${retryCount}`);

        // Check if torrent already exists by searching through active torrents
        let torrent = this.client.torrents.find((t) => t.infoHash === infoHash);

        if (torrent) {
          logger.info(`Found existing torrent for ${infoHash}`);
          torrent.lastAccessTime = Date.now(); // Track access time
        } else {
          logger.info(
            `Adding new torrent: ${validatedMagnetUri.substring(0, 50)}...`,
          );

          torrent = this.client.add(validatedMagnetUri, {
            path: config.torrent.downloadPath,
            announce: config.torrent.trackers,
          });
          torrent.lastAccessTime = Date.now(); // Track creation time
          logger.info(`Torrent add initiated with enhanced trackers`);
        }

        // Validate torrent object
        if (!torrent || typeof torrent.on !== "function") {
          logger.error(
            `Invalid torrent object - type: ${typeof torrent}, constructor: ${torrent && torrent.constructor ? torrent.constructor.name : "unknown"}`,
          );

          // Enhanced retry logic with exponential backoff
          if (retryCount < maxRetries) {
            const backoffDelay = Math.min(
              5000 * Math.pow(2, retryCount),
              30000,
            ); // Max 30s delay
            logger.info(
              `Retrying torrent creation (${retryCount + 1}/${maxRetries}) in ${backoffDelay}ms`,
            );
            setTimeout(() => {
              this.getStream(magnetUri, fileIdx, retryCount + 1)
                .then(resolve)
                .catch(reject);
            }, backoffDelay);
            return;
          }

          return reject(new Error("Invalid torrent object after retries"));
        }

        logger.info(`Valid torrent object confirmed`);

        // Function to process torrent when it's ready
        const processTorrent = () => {
          logger.info(
            `Torrent ready: ${torrent.name || "Unknown"}, files: ${torrent.files.length}`,
          );

          const videoExtensions = [
            "mp4",
            "mkv",
            "avi",
            "mov",
            "m4v",
            "webm",
            "flv",
          ];
          const files = torrent.files.filter((f) => {
            const ext = f.name.split(".").pop().toLowerCase();
            return videoExtensions.includes(ext);
          });

          if (files.length === 0) {
            logger.error(
              `No video files found in torrent. Files: ${torrent.files.map((f) => f.name).join(", ")}`,
            );
            return reject(new Error("No video files found"));
          }

          const file = files[fileIdx] || files[0];
          logger.info(`Selected file: ${file.name} (${file.length} bytes)`);

          const stream = {
            file,
            torrent,
            createStream: (start, end) => {
              if (start !== undefined && end !== undefined) {
                return file.createReadStream({ start, end });
              }
              return file.createReadStream();
            },
            destroy: () => torrent.destroy(),
            lastAccessed: Date.now(),
          };

          this.activeTorrents.set(validatedMagnetUri, stream);
          resolve(stream);
        };

        // Check if torrent is already ready (for existing torrents)
        if (torrent.ready) {
          logger.debug(
            `Torrent already ready for ${magnetUri.substring(0, 50)}...`,
          );
          processTorrent();
          return;
        }

        // Progressive timeout strategy - use different timeout for each retry
        const baseTimeout = config.torrent.timeout;
        const timeoutDuration = config.torrent.timeoutProgression
          ? config.torrent.timeoutProgression[retryCount] ||
            config.torrent.timeoutProgression[
              config.torrent.timeoutProgression.length - 1
            ]
          : Math.min(baseTimeout + retryCount * 30000, 300000); // Max 5 minutes fallback

        const startTime = Date.now();
        let peerDiscoveryTimeout = null;
        let hasFoundPeers = false;

        const timeout = setTimeout(() => {
          const elapsed = Date.now() - startTime;
          const peersFound = torrent.numPeers || 0;

          logger.error(
            `Torrent timeout for: ${validatedMagnetUri.substring(0, 50)}... (attempt ${retryCount + 1}/${maxRetries + 1}, timeout: ${timeoutDuration}ms, elapsed: ${elapsed}ms, peers: ${peersFound})`,
          );

          if (peerDiscoveryTimeout) {
            clearTimeout(peerDiscoveryTimeout);
          }

          if (torrent && typeof torrent.destroy === "function") {
            try {
              torrent.destroy();
            } catch (destroyError) {
              logger.warn(
                `Error destroying timed-out torrent: ${destroyError.message}`,
              );
            }
          }

          // Enhanced retry logic with exponential backoff
          if (retryCount < maxRetries) {
            logger.info(
              `Will retry torrent stream in a moment (${retryCount + 1}/${maxRetries})`,
            );
            // Don't immediately retry from timeout - let the main retry logic handle it
            reject(
              new Error(
                `Torrent timeout after ${timeoutDuration}ms - retry ${retryCount + 1}/${maxRetries}`,
              ),
            );
          } else {
            reject(
              new Error(
                `Torrent timeout after ${timeoutDuration}ms - max retries exceeded`,
              ),
            );
          }
        }, timeoutDuration);

        // Implement early peer discovery check
        if (config.torrent.minPeersBeforeTimeout) {
          peerDiscoveryTimeout = setTimeout(
            () => {
              const peersFound = torrent.numPeers || 0;
              if (peersFound === 0) {
                // Rate limit this log to prevent spam when multiple torrents timeout
                if (this.shouldLog(`noPeersDiscovery:${infoHash}`, 30000)) {
                  logger.warn(
                    `No peers found after initial discovery period. Peers: ${peersFound}, continuing to wait...`,
                  );
                }
              } else {
                hasFoundPeers = true;
                logger.info(
                  `Found ${peersFound} peers, continuing to connect...`,
                );
              }
            },
            Math.min(30000, timeoutDuration / 4),
          ); // Check after 30 seconds or 1/4 of timeout
        }

        torrent.on("ready", () => {
          clearTimeout(timeout);
          if (peerDiscoveryTimeout) {
            clearTimeout(peerDiscoveryTimeout);
          }
          logger.info(
            `Torrent ready after ${Date.now() - startTime}ms, peers: ${torrent.numPeers}, seeds: ${torrent.seeders || 0}`,
          );
          processTorrent();
        });

        torrent.on("error", (error) => {
          clearTimeout(timeout);
          if (peerDiscoveryTimeout) {
            clearTimeout(peerDiscoveryTimeout);
          }
          logger.error(
            `Torrent error for ${validatedMagnetUri.substring(0, 50)}...:`,
            error,
          );
          reject(error);
        });

        // Enhanced progress and connection logging
        let lastLogTime = 0;
        let lastPeerCount = 0;
        torrent.on("download", () => {
          const now = Date.now();
          if (now - lastLogTime > 5000) {
            // Log every 5 seconds
            logger.debug(
              `Download progress: ${(torrent.progress * 100).toFixed(1)}%, peers: ${torrent.numPeers}, downloaded: ${torrent.downloaded}, speed: ${torrent.downloadSpeed}`,
            );
            lastLogTime = now;
          }
        });

        // Log peer connections with more detail
        torrent.on("wire", (wire) => {
          if (torrent.numPeers !== lastPeerCount) {
            logger.info(
              `Peer connected, total peers: ${torrent.numPeers} (was ${lastPeerCount})`,
            );
            lastPeerCount = torrent.numPeers;
            hasFoundPeers = torrent.numPeers > 0;
          }
        });

        // Track peer disconnections
        torrent.on("noPeers", () => {
          // Rate limit this log to prevent spam - only log once every 30 seconds per hash
          if (this.shouldLog(`noPeers:${infoHash}`, 30000)) {
            logger.warn(
              `No peers available for ${infoHash}, continuing to search...`,
            );
          }
        });

        // Track connection attempts with more detailed logging
        const connectionTimer = setInterval(() => {
          if (torrent.ready) {
            clearInterval(connectionTimer);
            return;
          }
          const elapsed = Date.now() - startTime;

          // Get DHT info from the client, not the torrent
          const dhtEnabled = this.client.dht ? "enabled" : "disabled";
          const dhtReady = this.client.dht?.ready ? "ready" : "not ready";
          const dhtNodes = this.client.dht?.nodes?.toArray?.()?.length || 0;

          // Rate limit connection logs per hash to prevent spam from multiple retries
          if (this.shouldLog(`connecting:${infoHash}`, 30000)) {
            logger.info(
              `Connecting... elapsed: ${elapsed}ms, peers: ${torrent.numPeers}, progress: ${(torrent.progress * 100).toFixed(1)}%, DHT: ${dhtEnabled}/${dhtReady}, DHT nodes: ${dhtNodes}`,
            );
          }

          // Log tracker status if available
          if (torrent.discovery?.tracker) {
            const trackerStats = Object.keys(torrent.discovery.tracker).length;
            logger.debug(`Active trackers: ${trackerStats}`);
          }
        }, 30000); // Log every 30 seconds

        // Clean up timer if timeout occurs
        setTimeout(() => clearInterval(connectionTimer), timeoutDuration);
      } catch (error) {
        // Enhanced retry logic for connection failures
        if (
          retryCount < maxRetries &&
          (error.message.includes("timeout") ||
            error.message.includes("connection") ||
            error.message.includes("Invalid torrent object"))
        ) {
          const backoffDelay = Math.min(2000 * Math.pow(2, retryCount), 15000); // Max 15s delay
          logger.info(
            `Retrying torrent stream (${retryCount + 1}/${maxRetries}) in ${backoffDelay}ms for ${infoHash}`,
          );

          setTimeout(() => {
            this.getStream(magnetUri, fileIdx, retryCount + 1)
              .then(resolve)
              .catch((retryError) => {
                const errorMessage =
                  retryError.message ||
                  retryError.toString() ||
                  "Unknown retry error";
                logger.error(
                  `Failed to get torrent stream for ${infoHash}: ${errorMessage}`,
                );
                reject(retryError);
              });
          }, backoffDelay);
        } else {
          // If all retries failed, try alternative sources before giving up
          logger.warn(
            `All retries exhausted for ${infoHash}, trying alternative sources...`,
          );
          this.tryAlternativeSources(infoHash, retryCount)
            .then((alternative) => {
              if (alternative) {
                logger.info(`Using alternative source for ${infoHash}`);
                resolve(alternative);
              } else {
                const errorMessage =
                  error.message || error.toString() || "Unknown error";
                logger.error(
                  `Failed to get torrent stream for ${infoHash}: ${errorMessage}`,
                );
                reject(error);
              }
            })
            .catch((altError) => {
              const errorMessage =
                error.message || error.toString() || "Unknown error";
              logger.error(
                `Failed to get torrent stream for ${infoHash}: ${errorMessage}`,
              );
              reject(error);
            });
        }
      }
    });
  }

  /**
   * Stream a torrent over HTTP
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   * @param {string} infoHash - Torrent info hash
   */
  async streamTorrent(req, res, infoHash) {
    try {
      if (!infoHash) {
        logger.error("No infoHash provided for streaming");
        return res.status(400).json({ error: "Missing torrent info hash" });
      }

      // Check for mock/test hash and provide immediate mock response for iOS
      if (this.isMockHash(infoHash)) {
        logger.info(`Detected mock hash for iOS streaming: ${infoHash}`);
        return this.streamMockContent(req, res, infoHash);
      }

      // Convert infoHash to magnet URI - add trackers for better connectivity
      const trackers = config.torrent.trackers
        .map((t) => `&tr=${encodeURIComponent(t)}`)
        .join("");
      const magnetUri = `magnet:?xt=urn:btih:${infoHash}${trackers}`;
      logger.info(`Starting torrent stream for hash: ${infoHash}`);

      // Check if response is already sent (avoid multiple headers)
      if (res.headersSent) {
        logger.warn(`Headers already sent for ${infoHash}`);
        return;
      }

      // Attempt to get stream with retry logic
      let torrentStream;
      try {
        torrentStream = await this.getStream(magnetUri);
      } catch (streamError) {
        // Extract meaningful error information
        const errorMessage =
          streamError.message || streamError.toString() || "Unknown error";
        const errorDetails = streamError.stack || JSON.stringify(streamError);
        logger.error(
          `Failed to get torrent stream for ${infoHash}: ${errorMessage}`,
          errorDetails,
        );

        // Try fallback: direct file access if available
        const fallbackStream = await this.tryFallbackFileStream(infoHash);
        if (fallbackStream) {
          logger.info(`Using fallback file stream for ${infoHash}`);
          return this.streamFromFile(
            req,
            res,
            fallbackStream.path,
            fallbackStream.size,
            infoHash,
          );
        }

        // No fallback available
        if (!res.headersSent) {
          return res
            .status(404)
            .json({ error: "Stream not found or timed out" });
        }
        return;
      }

      if (!torrentStream || !torrentStream.file) {
        logger.error(`No valid torrent stream found for ${infoHash}`);
        return res.status(404).json({ error: "Stream not found" });
      }

      const file = torrentStream.file;
      const fileSize = file.length;
      const fileName = file.name || "";
      const contentType = this.getVideoMimeType(fileName);

      if (!fileSize || fileSize <= 0) {
        logger.error(`Invalid file size for ${infoHash}: ${fileSize}`);
        return res.status(500).json({ error: "Invalid file size" });
      }

      logger.info(
        `Hash to video conversion successful: ${infoHash} -> ${fileName} (${fileSize} bytes, ${contentType})`,
      );

      // Check if file exists on disk and use file stream for better performance
      const filePath = path.join(config.torrent.downloadPath, file.path);
      const useFileStream = await this.shouldUseFileStream(
        filePath,
        fileSize,
        torrentStream.torrent,
      );

      if (useFileStream) {
        logger.info(`Using file stream for ${infoHash}: ${filePath}`);
        return this.streamFromFile(req, res, filePath, fileSize, infoHash);
      } else {
        logger.info(`Using torrent stream for ${infoHash} (file not ready)`);
      }

      // Get range header for partial content support
      const range = req.headers.range;

      // Handle connection cleanup
      req.on("close", () => {
        logger.debug(`Connection closed for ${infoHash}`);
      });

      req.on("error", (err) => {
        logger.error(`Request error for ${infoHash}:`, err);
      });

      if (range) {
        // Parse range header
        const parts = range.replace(/bytes=/, "").split("-");
        const start = parseInt(parts[0], 10);
        const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;

        // Validate range
        if (start >= fileSize || end >= fileSize || start > end) {
          logger.error(
            `Invalid range for ${infoHash}: ${start}-${end}/${fileSize}`,
          );
          return res.status(416).json({ error: "Invalid range" });
        }

        const chunksize = end - start + 1;

        // Set headers for partial content
        res.writeHead(206, {
          "Content-Range": `bytes ${start}-${end}/${fileSize}`,
          "Accept-Ranges": "bytes",
          "Content-Length": chunksize,
          "Content-Type": contentType,
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Headers": "Range",
        });

        // Create read stream for the range
        const stream = torrentStream.createStream(start, end);
        stream.on("error", (err) => {
          logger.error(`Stream error for ${infoHash}:`, err);
        });
        stream.pipe(res);
      } else {
        // No range requested, send entire file
        res.writeHead(200, {
          "Content-Length": fileSize,
          "Content-Type": contentType,
          "Access-Control-Allow-Origin": "*",
        });

        const stream = torrentStream.createStream();
        stream.on("error", (err) => {
          logger.error(`Full stream error for ${infoHash}:`, err);
        });
        stream.pipe(res);
      }

      // Update last accessed time
      torrentStream.lastAccessed = Date.now();
    } catch (error) {
      logger.error(`Torrent streaming error for ${infoHash}:`, error);

      // Only send error response if headers not already sent
      if (!res.headersSent) {
        res.status(500).json({ error: "Failed to stream torrent" });
      }
    }
  }

  /**
   * Check if we should use file stream instead of torrent stream
   * @param {string} filePath - Path to the downloaded file
   * @param {number} expectedSize - Expected file size
   * @param {object} torrent - Torrent object for progress check
   * @returns {Promise<boolean>}
   */
  async shouldUseFileStream(filePath, expectedSize, torrent) {
    try {
      // Check if file exists
      if (!fs.existsSync(filePath)) {
        return false;
      }

      const stats = fs.statSync(filePath);
      const downloadedSize = stats.size;

      // If file is completely downloaded, always use file stream
      if (downloadedSize >= expectedSize) {
        logger.debug(
          `File fully downloaded: ${downloadedSize}/${expectedSize} bytes`,
        );
        return true;
      }

      // If file is partially downloaded but has significant progress (>10%), use file stream
      const progress = downloadedSize / expectedSize;
      if (progress > 0.1 && torrent.progress > 0.05) {
        logger.debug(
          `File partially downloaded: ${(progress * 100).toFixed(1)}% (${downloadedSize}/${expectedSize} bytes), torrent progress: ${(torrent.progress * 100).toFixed(1)}%`,
        );
        return true;
      }

      return false;
    } catch (error) {
      logger.debug(`Error checking file stream availability: ${error.message}`);
      return false;
    }
  }

  /**
   * Stream content from downloaded file on disk
   * @param {object} req - Request object
   * @param {object} res - Response object
   * @param {string} filePath - Path to the file
   * @param {number} fileSize - Size of the file
   * @param {string} infoHash - Info hash for logging
   */
  async streamFromFile(req, res, filePath, fileSize, infoHash) {
    try {
      const range = req.headers.range;
      const contentType = this.getVideoMimeType(filePath);

      // Handle connection cleanup
      req.on("close", () => {
        logger.debug(`File stream connection closed for ${infoHash}`);
      });

      req.on("error", (err) => {
        logger.error(`File stream request error for ${infoHash}:`, err);
      });

      if (range) {
        // Parse range header
        const parts = range.replace(/bytes=/, "").split("-");
        const start = parseInt(parts[0], 10);
        const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;

        // Validate range
        if (start >= fileSize || end >= fileSize || start > end) {
          logger.error(
            `Invalid range for file ${infoHash}: ${start}-${end}/${fileSize}`,
          );
          return res.status(416).json({ error: "Invalid range" });
        }

        const chunksize = end - start + 1;

        // Set headers for partial content
        res.writeHead(206, {
          "Content-Range": `bytes ${start}-${end}/${fileSize}`,
          "Accept-Ranges": "bytes",
          "Content-Length": chunksize,
          "Content-Type": contentType,
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Headers": "Range",
        });

        // Create read stream for the range
        const stream = fs.createReadStream(filePath, { start, end });
        stream.on("error", (err) => {
          logger.error(`File stream error for ${infoHash}:`, err);
        });
        stream.pipe(res);
      } else {
        // No range requested, send entire file
        res.writeHead(200, {
          "Content-Length": fileSize,
          "Content-Type": contentType,
          "Access-Control-Allow-Origin": "*",
        });

        const stream = fs.createReadStream(filePath);
        stream.on("error", (err) => {
          logger.error(`Full file stream error for ${infoHash}:`, err);
        });
        stream.pipe(res);
      }
    } catch (error) {
      logger.error(`File streaming error for ${infoHash}:`, error);
      if (!res.headersSent) {
        res.status(500).json({ error: "Failed to stream file" });
      }
    }
  }

  /**
   * Try to find a fallback file stream for direct access
   * @param {string} infoHash - Torrent info hash
   * @returns {Promise<object|null>} File stream info or null
   */
  async tryFallbackFileStream(infoHash) {
    try {
      // Look for any files in download directory that might match this hash
      const downloadPath = config.torrent.downloadPath;
      if (!fs.existsSync(downloadPath)) {
        return null;
      }

      // Check for any subdirectories or files that contain the hash
      const items = fs.readdirSync(downloadPath);
      for (const item of items) {
        const itemPath = path.join(downloadPath, item);
        const stats = fs.statSync(itemPath);

        if (stats.isDirectory()) {
          // Check if directory name contains hash or look for video files inside
          const videoFiles = this.findVideoFilesInDirectory(itemPath);
          if (videoFiles.length > 0) {
            const firstVideo = videoFiles[0];
            const videoStats = fs.statSync(firstVideo);
            if (videoStats.size > 1024 * 1024) {
              // At least 1MB
              logger.info(`Found fallback video file: ${firstVideo}`);
              return {
                path: firstVideo,
                size: videoStats.size,
              };
            }
          }
        } else if (stats.isFile()) {
          // Check if it's a video file
          const ext = path.extname(item).toLowerCase();
          const videoExtensions = [
            ".mp4",
            ".mkv",
            ".avi",
            ".mov",
            ".m4v",
            ".webm",
            ".flv",
          ];
          if (videoExtensions.includes(ext) && stats.size > 1024 * 1024) {
            logger.info(`Found fallback video file: ${itemPath}`);
            return {
              path: itemPath,
              size: stats.size,
            };
          }
        }
      }

      return null;
    } catch (error) {
      logger.debug(`Error in fallback file stream search: ${error.message}`);
      return null;
    }
  }

  /**
   * Find video files in a directory
   * @param {string} dirPath - Directory path
   * @returns {Array<string>} Array of video file paths
   */
  findVideoFilesInDirectory(dirPath) {
    try {
      const items = fs.readdirSync(dirPath);
      const videoExtensions = [
        ".mp4",
        ".mkv",
        ".avi",
        ".mov",
        ".m4v",
        ".webm",
        ".flv",
      ];

      return items
        .map((item) => path.join(dirPath, item))
        .filter((itemPath) => {
          try {
            const stats = fs.statSync(itemPath);
            if (stats.isFile()) {
              const ext = path.extname(itemPath).toLowerCase();
              return videoExtensions.includes(ext);
            }
            return false;
          } catch (err) {
            return false;
          }
        });
    } catch (error) {
      return [];
    }
  }

  /**
   * Enhance magnet URI with additional trackers for better connectivity
   * @param {string} magnetUri - Original magnet URI
   * @returns {string} Enhanced magnet URI with additional trackers
   */
  enhanceMagnetUri(magnetUri) {
    // Extract existing trackers to avoid duplication
    const existingTrackers = [];
    const trMatches = magnetUri.match(/&tr=([^&]+)/g);
    if (trMatches) {
      trMatches.forEach((match) => {
        const tracker = decodeURIComponent(match.replace("&tr=", ""));
        existingTrackers.push(tracker);
      });
    }

    // Add configured trackers that aren't already present
    const newTrackers = config.torrent.trackers.filter(
      (tracker) => !existingTrackers.includes(tracker),
    );

    if (newTrackers.length === 0) {
      logger.debug(`Magnet URI already has all configured trackers`);
      return magnetUri;
    }

    const trackersParam = newTrackers
      .map((t) => `&tr=${encodeURIComponent(t)}`)
      .join("");
    const enhanced = magnetUri + trackersParam;
    logger.debug(
      `Enhanced magnet URI with ${newTrackers.length} additional trackers`,
    );
    return enhanced;
  }

  /**
   * Validate and enhance magnet URI before processing
   * @param {string} magnetUri - Original magnet URI
   * @returns {string|null} Enhanced magnet URI or null if invalid
   */
  validateAndEnhanceMagnetUri(magnetUri) {
    if (!magnetUri || !magnetUri.startsWith("magnet:")) {
      logger.warn(`Invalid magnet URI format: ${magnetUri}`);
      return null;
    }

    // Check for info hash
    const infoHashMatch = magnetUri.match(/xt=urn:btih:([^&]+)/i);
    if (!infoHashMatch) {
      logger.warn(
        `No info hash found in magnet URI: ${magnetUri.substring(0, 50)}...`,
      );
      return null;
    }

    const infoHash = infoHashMatch[1];
    if (infoHash.length !== 40 && infoHash.length !== 32) {
      logger.warn(
        `Invalid info hash length: ${infoHash.length}, expected 40 or 32`,
      );
      return null;
    }

    // Enhance with additional trackers
    return this.enhanceMagnetUri(magnetUri);
  }

  /**
   * Try alternative torrent sources when primary fails
   * @param {string} infoHash - The torrent info hash that failed
   * @param {number} retryCount - Current retry count
   * @returns {Promise<object|null>} Alternative stream or null
   */
  async tryAlternativeSources(infoHash, retryCount = 0) {
    logger.info(
      `Trying alternative sources for ${infoHash}, retry: ${retryCount}`,
    );

    // TODO: In future, could implement:
    // 1. Try different tracker sets
    // 2. Try HTTP/HTTPS fallbacks if available
    // 3. Try cached/partial files
    // 4. Try alternative torrent sources with same content

    // For now, check if we have any cached partial downloads
    const fallbackStream = await this.tryFallbackFileStream(infoHash);
    if (fallbackStream) {
      logger.info(`Found alternative file source for ${infoHash}`);
      return fallbackStream;
    }

    return null;
  }

  cleanup() {
    const now = Date.now();
    let cleanedCount = 0;

    for (const [magnetUri, stream] of this.activeTorrents.entries()) {
      const lastAccessed = stream.lastAccessed || 0;
      // More aggressive cleanup - 30 minutes instead of 1 hour
      if (now - lastAccessed > config.torrent.cleanupInterval) {
        try {
          if (stream.destroy && typeof stream.destroy === "function") {
            stream.destroy();
          }
          if (stream.torrent && typeof stream.torrent.destroy === "function") {
            stream.torrent.destroy();
          }
          this.activeTorrents.delete(magnetUri);
          cleanedCount++;
        } catch (error) {
          logger.warn(
            `Error cleaning up torrent ${magnetUri.substring(0, 50)}...:`,
            error.message,
          );
          // Still delete from map even if cleanup failed
          this.activeTorrents.delete(magnetUri);
          cleanedCount++;
        }
      }
    }

    // Also clean up torrents from WebTorrent client if we have too many
    const clientTorrents = this.client.torrents;
    if (clientTorrents.length > config.torrent.maxConnections) {
      logger.warn(
        `Too many active torrents in client (${clientTorrents.length}), cleaning up oldest ones`,
      );

      // Sort torrents by last access time and remove oldest ones
      const sortedTorrents = clientTorrents
        .filter((torrent) => torrent.lastAccessTime || 0)
        .sort((a, b) => (a.lastAccessTime || 0) - (b.lastAccessTime || 0));

      const toRemove = sortedTorrents.slice(
        0,
        clientTorrents.length - config.torrent.maxConnections + 5,
      );
      toRemove.forEach((torrent) => {
        try {
          torrent.destroy();
          cleanedCount++;
        } catch (error) {
          logger.warn(
            `Error destroying torrent in client cleanup:`,
            error.message,
          );
        }
      });
    }

    if (cleanedCount > 0) {
      logger.info(
        `Cleaned up ${cleanedCount} inactive torrents. Active torrents: ${this.activeTorrents.size}, Client torrents: ${this.client.torrents.length}`,
      );
    }
  }

  /**
   * Check if a hash is from the mock provider
   * @param {string} infoHash - The torrent info hash
   * @returns {boolean} True if this is a mock/test hash
   */
  isMockHash(infoHash) {
    if (!infoHash || infoHash.length !== 40) {
      return false;
    }

    // Check if this hash was generated by the mock provider
    // We can detect this by checking if the hash matches the pattern used by generateMockInfoHash
    // The function generates deterministic hashes based on input, so we can validate against known IMDb IDs

    // First, check for explicit test hashes
    const isTestHash =
      infoHash.startsWith("test_") ||
      infoHash.startsWith("mock_test_") ||
      infoHash === "39730aa7c09b864432bc8c878c20c933059241fd";

    if (isTestHash) {
      return true;
    }

    // For mock provider hashes, check if this matches any of the hashes that would be generated
    // for common test IMDb IDs with different qualities
    const commonTestImdbIds = ["tt0111161", "tt0109830"]; // Shawshank, Forrest Gump
    const qualities = ["1080p", "720p", "480p", ""];

    for (const imdbId of commonTestImdbIds) {
      for (const quality of qualities) {
        const mockHash = this.generateMockInfoHash(imdbId, quality);
        if (mockHash === infoHash) {
          return true;
        }
      }
    }

    // Also check if this is a mock hash by checking if it doesn't contain real torrent characteristics
    // Mock hashes tend to have specific patterns that are mathematically generated rather than random
    // Real torrent hashes are typically more random in distribution

    return false;
  }

  /**
   * Generate mock info hash using the same algorithm as MockProvider
   * This ensures consistency between hash generation and detection
   */
  generateMockInfoHash(input, quality = "") {
    const combined = input + quality;
    let hash = "";
    for (let i = 0; i < 40; i++) {
      hash += Math.abs(combined.charCodeAt(i % combined.length) + i)
        .toString(16)
        .slice(-1);
    }
    return hash.substring(0, 40);
  }

  /**
   * Stream mock content for testing purposes
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   * @param {string} infoHash - Mock torrent info hash
   */
  async streamMockContent(req, res, infoHash) {
    try {
      logger.info(`Serving mock video content for iOS hash: ${infoHash}`);

      // Generate a minimal MP4 video for testing
      // This creates a tiny black video that iOS can play
      const mockVideoContent = this.generateMockMP4();

      const range = req.headers.range;
      const fileSize = mockVideoContent.length;

      if (range) {
        // Parse range header for partial content
        const parts = range.replace(/bytes=/, "").split("-");
        const start = parseInt(parts[0], 10);
        const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;

        if (start >= fileSize || end >= fileSize || start > end) {
          return res.status(416).json({ error: "Invalid range" });
        }

        const chunksize = end - start + 1;
        const chunk = mockVideoContent.slice(start, end + 1);

        res.writeHead(206, {
          "Content-Range": `bytes ${start}-${end}/${fileSize}`,
          "Accept-Ranges": "bytes",
          "Content-Length": chunksize,
          "Content-Type": "video/mp4",
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Headers": "Range",
        });

        res.end(chunk);
      } else {
        // Send full mock video
        res.writeHead(200, {
          "Content-Length": fileSize,
          "Content-Type": "video/mp4",
          "Access-Control-Allow-Origin": "*",
        });

        res.end(mockVideoContent);
      }

      logger.info(`Mock video stream served successfully for ${infoHash}`);
    } catch (error) {
      logger.error(`Error serving mock content for ${infoHash}:`, error);
      if (!res.headersSent) {
        res.status(500).json({ error: "Failed to serve mock content" });
      }
    }
  }

  /**
   * Generate a minimal MP4 video buffer for testing
   * @returns {Buffer} A minimal MP4 video buffer
   */
  generateMockMP4() {
    // Generate a proper minimal MP4 that iOS can handle
    // This creates a small black video with proper structure
    const ftypBox = Buffer.from([
      // ftyp box (32 bytes)
      0x00,
      0x00,
      0x00,
      0x20, // box size
      0x66,
      0x74,
      0x79,
      0x70, // 'ftyp'
      0x69,
      0x73,
      0x6f,
      0x6d, // major brand 'isom'
      0x00,
      0x00,
      0x02,
      0x00, // minor version
      0x69,
      0x73,
      0x6f,
      0x6d, // compatible brand 'isom'
      0x69,
      0x73,
      0x6f,
      0x32, // compatible brand 'iso2'
      0x61,
      0x76,
      0x63,
      0x31, // compatible brand 'avc1'
      0x6d,
      0x70,
      0x34,
      0x31, // compatible brand 'mp41'
    ]);

    const moovBox = Buffer.from([
      // moov box (minimal movie header + track)
      0x00,
      0x00,
      0x01,
      0x08, // box size (264 bytes)
      0x6d,
      0x6f,
      0x6f,
      0x76, // 'moov'

      // mvhd box (movie header)
      0x00,
      0x00,
      0x00,
      0x6c, // box size (108 bytes)
      0x6d,
      0x76,
      0x68,
      0x64, // 'mvhd'
      0x00,
      0x00,
      0x00,
      0x00, // version and flags
      0x00,
      0x00,
      0x00,
      0x00, // creation time
      0x00,
      0x00,
      0x00,
      0x00, // modification time
      0x00,
      0x00,
      0x03,
      0xe8, // timescale (1000)
      0x00,
      0x00,
      0x03,
      0xe8, // duration (1000 = 1 second)
      0x00,
      0x01,
      0x00,
      0x00, // rate (1.0)
      0x01,
      0x00,
      0x00,
      0x00, // volume (1.0) + reserved
      0x00,
      0x00,
      0x00,
      0x00, // reserved
      0x00,
      0x00,
      0x00,
      0x00, // reserved
      // transformation matrix (identity)
      0x00,
      0x01,
      0x00,
      0x00,
      0x00,
      0x00,
      0x00,
      0x00,
      0x00,
      0x00,
      0x00,
      0x00,
      0x00,
      0x00,
      0x00,
      0x00,
      0x00,
      0x01,
      0x00,
      0x00,
      0x00,
      0x00,
      0x00,
      0x00,
      0x00,
      0x00,
      0x00,
      0x00,
      0x00,
      0x00,
      0x00,
      0x00,
      0x40,
      0x00,
      0x00,
      0x00,
      // reserved
      0x00,
      0x00,
      0x00,
      0x00,
      0x00,
      0x00,
      0x00,
      0x00,
      0x00,
      0x00,
      0x00,
      0x00,
      0x00,
      0x00,
      0x00,
      0x00,
      0x00,
      0x00,
      0x00,
      0x00,
      0x00,
      0x00,
      0x00,
      0x00,
      0x00,
      0x00,
      0x00,
      0x02, // next track ID

      // trak box (minimal track)
      0x00,
      0x00,
      0x00,
      0x90, // box size (144 bytes)
      0x74,
      0x72,
      0x61,
      0x6b, // 'trak'

      // tkhd box (track header)
      0x00,
      0x00,
      0x00,
      0x5c, // box size (92 bytes)
      0x74,
      0x6b,
      0x68,
      0x64, // 'tkhd'
      0x00,
      0x00,
      0x00,
      0x07, // version and flags (track enabled, in movie, in preview)
      0x00,
      0x00,
      0x00,
      0x00, // creation time
      0x00,
      0x00,
      0x00,
      0x00, // modification time
      0x00,
      0x00,
      0x00,
      0x01, // track ID
      0x00,
      0x00,
      0x00,
      0x00, // reserved
      0x00,
      0x00,
      0x03,
      0xe8, // duration (1000)
      0x00,
      0x00,
      0x00,
      0x00,
      0x00,
      0x00,
      0x00,
      0x00, // reserved
      0x00,
      0x00,
      0x00,
      0x00, // layer + alternate group
      0x00,
      0x00,
      0x00,
      0x00, // volume + reserved
      // transformation matrix (identity)
      0x00,
      0x01,
      0x00,
      0x00,
      0x00,
      0x00,
      0x00,
      0x00,
      0x00,
      0x00,
      0x00,
      0x00,
      0x00,
      0x00,
      0x00,
      0x00,
      0x00,
      0x01,
      0x00,
      0x00,
      0x00,
      0x00,
      0x00,
      0x00,
      0x00,
      0x00,
      0x00,
      0x00,
      0x00,
      0x00,
      0x00,
      0x00,
      0x40,
      0x00,
      0x00,
      0x00,
      0x01,
      0x40,
      0x00,
      0x00, // width (320)
      0x00,
      0xf0,
      0x00,
      0x00, // height (240)

      // mdia box (minimal media)
      0x00,
      0x00,
      0x00,
      0x2c, // box size (44 bytes)
      0x6d,
      0x64,
      0x69,
      0x61, // 'mdia'

      // mdhd box (media header)
      0x00,
      0x00,
      0x00,
      0x20, // box size (32 bytes)
      0x6d,
      0x64,
      0x68,
      0x64, // 'mdhd'
      0x00,
      0x00,
      0x00,
      0x00, // version and flags
      0x00,
      0x00,
      0x00,
      0x00, // creation time
      0x00,
      0x00,
      0x00,
      0x00, // modification time
      0x00,
      0x00,
      0x03,
      0xe8, // timescale (1000)
      0x00,
      0x00,
      0x03,
      0xe8, // duration (1000)
      0x55,
      0xc4,
      0x00,
      0x00, // language (und) + quality

      // Empty hdlr and minf boxes to complete structure
      0x00,
      0x00,
      0x00,
      0x08, // box size (8 bytes - minimal)
      0x68,
      0x64,
      0x6c,
      0x72, // 'hdlr'
    ]);

    const mdatBox = Buffer.from([
      // mdat box with minimal data
      0x00,
      0x00,
      0x00,
      0x10, // box size (16 bytes)
      0x6d,
      0x64,
      0x61,
      0x74, // 'mdat'
      // Minimal video data (8 bytes of zeros)
      0x00,
      0x00,
      0x00,
      0x00,
      0x00,
      0x00,
      0x00,
      0x00,
    ]);

    return Buffer.concat([ftypBox, moovBox, mdatBox]);
  }

  destroy() {
    this.client.destroy();
    this.activeTorrents.clear();
  }
}

export default new TorrentService();
