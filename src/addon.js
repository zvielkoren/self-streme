import express from "express";
import cors from "cors";
import addonSdk from "stremio-addon-sdk";
import manifest from "./manifest.js";
import streamService from "./core/streamService.js";
import logger from "./utils/logger.js";

const { addonBuilder } = addonSdk;
const builder = new addonBuilder(manifest);

// Define required meta handler (even if empty)
builder.defineMetaHandler(() => {
    return Promise.resolve({ meta: [] });
});

builder.defineStreamHandler(async ({ type, id }) => {
    try {
        if (!id.startsWith('tt')) {
            logger.warn(`Invalid IMDb ID format: ${id}`);
            return { streams: [] };
        }

        logger.info(`Stream request: ${type}:${id}`);
        const streams = await streamService.getStreams(type, id);
        
        if (streams.length > 0) {
            logger.info(`Found ${streams.length} streams for ${id}`);
            streams.forEach((stream, index) => {
                logger.debug(`Stream ${index + 1}: ${stream.title} [${stream.source || 'unknown'}]`);
            });
        } else {
            logger.warn(`No streams found for ${id}`);
        }

        return { streams };
    } catch (error) {
        logger.error('Stream handler error:', error.message);
        return { streams: [] };
    }
});

// Create the addon interface router
const addonInterface = builder.getInterface();

const app = express();
app.use(cors());
app.use("/", addonInterface);

export { app, builder };
