import fs from "fs/promises";
import path from "path";
import { config } from "../config/index.js";
import logger from "../utils/logger.js";
import { createReadStream } from "fs";

class MediaService {
  constructor() {
    this.mediaPath = config.media.libraryPath;
    this.supportedFormats = [".mp4", ".mkv", ".avi"];
    this.qualityPaths = {
      "1080p": path.join(this.mediaPath, "1080p"),
      "720p": path.join(this.mediaPath, "720p"),
      "480p": path.join(this.mediaPath, "480p"),
      "xvid": path.join(this.mediaPath, "xvid"),
    };
  }

  async scanDirectory() {
    try {
      const files = await fs.readdir(this.mediaPath);
      const mediaFiles = [];

      for (const file of files) {
        const filePath = path.join(this.mediaPath, file);
        const stats = await fs.stat(filePath);
        
        if (stats.isFile() && this.supportedFormats.includes(path.extname(file))) {
          mediaFiles.push({
            id: Buffer.from(file).toString("base64url"),
            name: path.parse(file).name,
            path: filePath,
            size: stats.size,
            modified: stats.mtime,
          });
        }
      }

      return mediaFiles;
    } catch (error) {
      logger.error("Error scanning directory:", error);
      return [];
    }
  }

  async searchMedia(query) {
    try {
      const mediaFiles = await this.scanDirectory();
      const searchTerms = query.toLowerCase().split(" ");
      
      return mediaFiles.filter(file => {
        const fileName = file.name.toLowerCase();
        return searchTerms.every(term => fileName.includes(term));
      });
    } catch (error) {
      logger.error("Error searching media:", error);
      return [];
    }
  }

  async getMediaInfo(mediaId) {
    try {
      const mediaFiles = await this.scanDirectory();
      return mediaFiles.find(file => file.id === mediaId);
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

  async createReadStream(filePath, start, end) {
    try {
      return fs.createReadStream(filePath, { start, end });
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
      const subtitlePath = path.join(dir, `${name}.vtt`);

      try {
        return await fs.readFile(subtitlePath, "utf8");
      } catch {
        return null;
      }
    } catch (error) {
      logger.error("Error getting subtitles:", error);
      return null;
    }
  }

  isSupportedFormat(filename) {
    const supportedFormats = [".mp4", ".mkv", ".avi"];
    return supportedFormats.includes(path.extname(filename).toLowerCase());
  }

  generateId(filename) {
    return Buffer.from(filename).toString("base64url");
  }
}

export default new MediaService();
