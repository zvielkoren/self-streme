import { promises as fs } from 'fs';
import subsrt from 'subsrt';
import logger from '../utils/logger.js';

class SubtitleService {
  async loadSubtitles(subtitlePath) {
    try {
      if (!subtitlePath) return null;

      const content = await fs.readFile(subtitlePath, 'utf-8');
      const format = subsrt.detect(content);
      
      if (!format) {
        throw new Error('Unknown subtitle format');
      }

      // Convert to WebVTT format for browser compatibility
      const vtt = subsrt.convert(content, { format: 'vtt' });
      return vtt;
    } catch (error) {
      logger.error('Error loading subtitles:', error);
      return null;
    }
  }

  async getSubtitles(subtitlePath, format = 'vtt') {
    try {
      const content = await this.loadSubtitles(subtitlePath);
      if (!content) return null;

      // Convert to requested format if different from VTT
      if (format.toLowerCase() !== 'vtt') {
        return subsrt.convert(content, { format });
      }

      return content;
    } catch (error) {
      logger.error('Error getting subtitles:', error);
      return null;
    }
  }

  // Helper method to adjust subtitle timing
  async adjustTiming(subtitlePath, offset) {
    try {
      const content = await this.loadSubtitles(subtitlePath);
      if (!content) return null;

      const captions = subsrt.parse(content);
      captions.forEach(caption => {
        caption.start += offset;
        caption.end += offset;
      });

      return subsrt.build(captions, { format: 'vtt' });
    } catch (error) {
      logger.error('Error adjusting subtitle timing:', error);
      return null;
    }
  }
}

const subtitleService = new SubtitleService();
export default subtitleService; 