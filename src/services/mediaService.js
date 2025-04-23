import fs from "fs/promises";
import path from "path";
import { config } from "../config/index.js";
import logger from "../utils/logger.js";
import { createReadStream } from "fs";

class MediaService {
  constructor() {
    this.mediaPath = config.media.libraryPath;
    this.supportedFormats = config.media.supportedVideoFormats;
  }

  async scanDirectory(dir = this.mediaPath) {
    try {
      logger.debug(`Scanning directory: ${dir}`);
      const entries = await fs.readdir(dir, { withFileTypes: true });
      const mediaFiles = [];

      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);

        if (entry.isDirectory()) {
          // If it's a directory, scan it recursively
          const subDirFiles = await this.scanDirectory(fullPath);
          mediaFiles.push(...subDirFiles);
        } else if (entry.isFile() && this.isSupportedFormat(entry.name)) {
          const stats = await fs.stat(fullPath);
          const relativePath = path.relative(this.mediaPath, fullPath);
          const type = this.getMediaType(relativePath);

          mediaFiles.push({
            id: this.generateId(relativePath),
            name: this.getDisplayName(relativePath),
            path: fullPath,
            type,
            size: stats.size,
            modified: stats.mtime,
          });
        }
      }

      logger.debug(`Found ${mediaFiles.length} media files in ${dir}`);
      return mediaFiles;
    } catch (error) {
      logger.error("Error scanning directory:", error);
      return [];
    }
  }

  getMediaType(relativePath) {
    const parts = relativePath.split(path.sep);
    if (parts.length >= 2 && parts[1].toLowerCase().startsWith("season")) {
      return "series";
    } else if (parts.length === 2) {
      return "movie";
    }
    return "other";
  }

  getDisplayName(relativePath) {
    const parts = relativePath.split(path.sep);
    if (parts.length === 0) return "";

    // For series, use the series name
    if (this.getMediaType(relativePath) === "series") {
      return parts[0];
    }

    // For movies and others, use the directory name or file name without extension
    return parts.length > 1 ? parts[0] : path.parse(parts[0]).name;
  }

  async searchMedia(query) {
    try {
      const mediaFiles = await this.scanDirectory();
      const searchTerms = query.toLowerCase().split(" ");

      return mediaFiles.filter((file) => {
        const fileName = file.name.toLowerCase();
        return searchTerms.every((term) => fileName.includes(term));
      });
    } catch (error) {
      logger.error("Error searching media:", error);
      return [];
    }
  }

  async getMediaInfo(mediaId) {
    try {
      const mediaFiles = await this.scanDirectory();
      return mediaFiles.find((file) => file.id === mediaId);
    } catch (error) {
      logger.error("Error getting media info:", error);
      return null;
    }
  }

  async getQualityPath(mediaId, quality) {
    try {
      const mediaInfo = await this.getMediaInfo(mediaId);
      if (!mediaInfo) return null;

      const dir = path.dirname(mediaInfo.path);
      const name = path.parse(mediaInfo.path).name;
      const qualityPath = path.join(dir, `${name}_${quality}.mp4`);

      try {
        await fs.access(qualityPath);
        return qualityPath;
      } catch {
        return null;
      }
    } catch (error) {
      logger.error("Error getting quality path:", error);
      return null;
    }
  }

  async getFileSize(filePath) {
    try {
      const stats = await fs.stat(filePath);
      return stats.size;
    } catch (error) {
      logger.error("Error getting file size:", error);
      throw error;
    }
  }

  createReadStream(filePath, start, end) {
    try {
      return createReadStream(filePath, { start, end });
    } catch (error) {
      logger.error("Error creating read stream:", error);
      throw error;
    }
  }

  async getSubtitles(mediaId) {
    try {
      const mediaInfo = await this.getMediaInfo(mediaId);
      if (!mediaInfo) return null;

      const dir = path.dirname(mediaInfo.path);
      const name = path.parse(mediaInfo.path).name;

      // Try all supported subtitle formats
      for (const format of config.media.supportedSubtitleFormats) {
        const subtitlePath = path.join(dir, `${name}${format}`);
        try {
          return await fs.readFile(subtitlePath, "utf8");
        } catch {
          continue;
        }
      }

      return null;
    } catch (error) {
      logger.error("Error getting subtitles:", error);
      return null;
    }
  }

  isSupportedFormat(filename) {
    return this.supportedFormats.includes(path.extname(filename).toLowerCase());
  }

  generateId(filename) {
    return Buffer.from(filename).toString("base64url");
  }
}

export default new MediaService();
