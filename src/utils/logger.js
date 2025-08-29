import winston from "winston";
import { config } from "../config/index.js";

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
      filename: "error.log",
      level: "error",
      options: { flags: "w" },
    }),
    new winston.transports.File({
      filename: "combined.log",
      options: { flags: "w" },
    }),
  ],
});

export default logger;