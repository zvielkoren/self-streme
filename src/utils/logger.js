import winston from "winston";
import fs from "fs";
import path from "path";
import { config } from "../config/index.js";

// Ensure logs directory exists
const logDir = "logs";
if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir);
}

const logger = winston.createLogger({
  level: config.logging.level,
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.printf(({ level, message, timestamp }) => {
      return `${timestamp} ${level}: ${message}`;
    })
  ),
  transports: [
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      ),
    }),
    new winston.transports.File({
      filename: path.join(logDir, "error.log"),
      level: "error",
      options: { flags: "w" },
    }),
    new winston.transports.File({
      filename: path.join(logDir, "combined.log"),
      options: { flags: "w" },
    }),
  ],
});

export default logger;