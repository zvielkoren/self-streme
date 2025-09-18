import express from "express";
import cors from "cors";
import addonSdk from "stremio-addon-sdk";
import manifest from "./manifest.js";
import streamService from "./core/streamService.js";
import logger from "./utils/logger.js";

const { addonBuilder } = addonSdk;
const builder = new addonBuilder(manifest);

// Define required meta handler
builder.defineMetaHandler(async ({ type, id }) => {
    if (!id?.startsWith('tt')) {
        return { meta: null };
    }

    try {
        // Import metadataService directly since streamService doesn't have getMetadata
        const metadataService = (await import('./core/metadataService.js')).default;
        const meta = await metadataService.getMetadata(id, type);
        return { meta };
    } catch (error) {
        logger.error('Meta handler error:', error.message);
        return { meta: null };
    }
});

builder.defineStreamHandler(async ({ type, id }) => {
    try {
        if (!id.startsWith('tt')) {
            logger.warn(`Invalid IMDb ID format: ${id}`);
            return { streams: [] };
        }

        logger.info(`Stream request: ${type}:${id}`);
        // Note: We can't access req object in the SDK handler, so iOS detection will be done elsewhere
        const streams = await streamService.getStreams(type, id, undefined, undefined, undefined);
        
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

// Create and start the addon interface on its own port
const addonApp = builder.getInterface();

export default builder;
export { addonApp };
