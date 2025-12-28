import winston from "winston";
import fs from "fs";
import path from "path";
import { config } from "../config/index.js";

// Ensure logs directory exists
const logDir = config.paths.logs;
let fileLoggingEnabled = true;

try {
  if (!fs.existsSync(logDir)) {
    fs.mkdirSync(logDir, { recursive: true });
  }
} catch (error) {
  console.warn(`[Logger] Could not create logs directory: ${error.message}. File logging will be disabled.`);
  fileLoggingEnabled = false;
}

const transports = [
  new winston.transports.Console({
    format: winston.format.combine(
      winston.format.colorize(),
      winston.format.simple()
    ),
  }),
];

if (fileLoggingEnabled) {
  transports.push(
    new winston.transports.File({
      filename: path.join(logDir, "error.log"),
      level: "error",
      options: { flags: "w" },
    }),
    new winston.transports.File({
      filename: path.join(logDir, "combined.log"),
      options: { flags: "w" },
    })
  );
}

const logger = winston.createLogger({
  level: config.logging.level,
  format: winston.format.combine(
    winston.format.combine(
      winston.format.timestamp(),
      winston.format.printf(({ level, message, timestamp }) => {
        return `${timestamp} ${level}: ${message}`;
      })
    )
  ),
  transports: transports,
});

export default logger;