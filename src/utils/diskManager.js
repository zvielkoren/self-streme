import { exec } from "child_process";
import { promisify } from "util";
import fs from "fs";
import os from "os";
import logger from "./logger.js";

const execAsync = promisify(exec);

/**
 * Disk Manager Utility
 * Handles cross-platform disk optimizations like hole punching.
 * Supports Linux (fallocate) and Windows (fsutil/sparse files).
 */
class DiskManager {
  /**
   * Reclaim disk space by punching a hole in a file.
   * This deallocates blocks while keeping the file size and structure.
   * 
   * @param {string} filePath - Absolute path to the file
   * @param {number} offset - Start offset in bytes
   * @param {number} length - Length of the hole in bytes
   * @returns {Promise<boolean>} - Success status
   */
  async punchHole(filePath, offset, length) {
    if (!fs.existsSync(filePath)) {
      logger.warn(`File not found for hole punching: ${filePath}`);
      return false;
    }

    const platform = os.platform();

    try {
      if (platform === "linux") {
        return await this.punchHoleLinux(filePath, offset, length);
      } else if (platform === "win32") {
        return await this.punchHoleWindows(filePath, offset, length);
      } else {
        logger.debug(`Hole punching not fully supported on ${platform}, falling back to zero-fill.`);
        return await this.zeroFill(filePath, offset, length);
      }
    } catch (error) {
      logger.error(`Failed to punch hole in ${filePath}: ${error.message}`);
      return false;
    }
  }

  /**
   * Linux implementation using fallocate
   */
  async punchHoleLinux(filePath, offset, length) {
    // Command: fallocate --punch-hole --offset <offset> --length <length> <file>
    const command = `fallocate --punch-hole --offset ${offset} --length ${length} "${filePath}"`;
    logger.info(`[Linux] Punching hole in ${filePath}: offset=${offset}, length=${length}`);
    await execAsync(command);
    return true;
  }

  /**
   * Windows implementation using fsutil
   * Requires the file to be marked as sparse first.
   */
  async punchHoleWindows(filePath, offset, length) {
    try {
      logger.info(`[Windows] Attempting sparse hole punch for ${filePath}`);

      // 1. Mark file as sparse
      await execAsync(`fsutil sparse setflag "${filePath}"`);

      // 2. Zero the range (on sparse files, this deallocates space)
      // fsutil sparse setrange <filename> <beginning offset> <length>
      // Note: fsutil requires administrative privileges for some operations, 
      // but 'sparse setrange' often works if the user owns the file.
      // Alternatively, we can use PowerShell to write zeros which NTFS sparse logic handles.
      
      const command = `fsutil sparse setrange "${filePath}" ${offset} ${length}`;
      await execAsync(command);
      
      return true;
    } catch (error) {
      logger.warn(`[Windows] fsutil failed: ${error.message}. Falling back to PowerShell zero-fill method.`);
      // Fallback: Use PowerShell to open file, seek, and write zeros. 
      // Since we marked it sparse above, writing zeros *should* deallocate.
      return await this.zeroFill(filePath, offset, length);
    }
  }

  /**
   * Universal Fallback: Write zeros to the file.
   * On sparse-supported filesystems (like NTFS with sparse flag set), this can reclaim space.
   * On others, it just overwrites data (privacy/security) but keeps disk usage.
   */
  async zeroFill(filePath, offset, length) {
    const fd = await fs.promises.open(filePath, 'r+');
    try {
      // Create a buffer of zeros (chunked to avoid memory issues)
      const chunkSize = 10 * 1024 * 1024; // 10MB chunks
      const emptyBuffer = Buffer.alloc(Math.min(length, chunkSize));
      
      let remaining = length;
      let currentOffset = offset;

      while (remaining > 0) {
        const writeSize = Math.min(remaining, chunkSize);
        const buf = (writeSize === chunkSize) ? emptyBuffer : Buffer.alloc(writeSize);
        
        await fd.write(buf, 0, writeSize, currentOffset);
        
        currentOffset += writeSize;
        remaining -= writeSize;
      }
      logger.info(`[Fallback] Zero-filled ${length} bytes at offset ${offset}`);
      return true;
    } finally {
      await fd.close();
    }
  }

  /**
   * Optimized "Body Cleanup" for video files.
   * Keeps the "Head" (first segment) and punches a hole in the rest.
   * 
   * @param {string} filePath - Path to the file
   * @param {number} headSize - Size of the head to protect (default 20MB)
   */
  async cleanupBody(filePath, headSize = 20 * 1024 * 1024) {
    try {
      if (!fs.existsSync(filePath)) return false;

      const stats = fs.statSync(filePath);
      const totalSize = stats.size;

      if (totalSize <= headSize) {
        logger.debug(`File too small to cleanup: ${filePath} (${totalSize} bytes)`);
        return false;
      }

      const holeLength = totalSize - headSize;
      return await this.punchHole(filePath, headSize, holeLength);
    } catch (error) {
      logger.error(`Cleanup body failed for ${filePath}: ${error.message}`);
      return false;
    }
  }
}

export default new DiskManager();
