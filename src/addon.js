import express from "express";
import cors from "cors";
import addonSdk from "stremio-addon-sdk";
import manifest from "./manifest.js";
import secureStreamService from "./core/secureStreamService.js";
import logger from "./utils/logger.js";

const { addonBuilder } = addonSdk;
const builder = new addonBuilder(manifest);

// Define required meta handler
builder.defineMetaHandler(async ({ type, id }) => {
    if (!id?.startsWith('tt')) {
        return { meta: null };
    }

    try {
        const meta = await secureStreamService.getMetadata(type, id);
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
        const streams = await secureStreamService.getStreams(type, id);
        
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

// Create express router for the addon
const addonRouter = express.Router();

// Mount the addon interface on the router
addonRouter.get("/:path(*)", (req, res) => {
    const path = req.params.path || "";
    const handler = addonInterface[path];
    
    if (typeof handler !== 'function') {
        res.status(404).json({ error: 'Not found' });
        return;
    }

    Promise.resolve()
        .then(() => handler(req, res))
        .catch(error => {
            console.error('Addon error:', error);
            res.status(500).json({ error: 'Internal server error' });
        });
});

export default builder;
export { addonRouter };
