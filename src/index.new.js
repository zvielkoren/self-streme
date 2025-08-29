import express from "express";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";
import addonSdk from "stremio-addon-sdk";
import builder from "./addon.new.js";
import streamService from "./core/streamService.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// --- Streaming Server ---
const streamApp = express();
streamApp.use(cors());

// Serve installation page
streamApp.get("/", (req, res) => {
    res.sendFile(path.join(__dirname, "install.html"));
});

// Streaming endpoint
streamApp.get("/stream/:type/:imdbId", async (req, res) => {
    try {
        const { type, imdbId } = req.params;
        const streams = await streamService.getStreams(type, imdbId);
        res.json({ streams });
    } catch (error) {
        console.error('Stream request error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});
streamApp.get("/status", async (req, res) => {
    try {
        // 1️⃣ בדיקה לפי streamService
        if (streamService.isActive && await streamService.isActive()) {
            return res.json({ status: "Active" });
        }

        // 2️⃣ בדיקה לפי פורט Addon
        const portCheck = await new Promise((resolve) => {
            const client = new net.Socket();
            client.setTimeout(1000);
            client.connect(3001, '127.0.0.1', () => { resolve(true); client.destroy(); });
            client.on('error', () => resolve(false));
            client.on('timeout', () => resolve(false));
        });
        if (portCheck) {
            return res.json({ status: "Active" });
        }

        // 3️⃣ בדיקה לפי manifest.json
        try {
            const response = await fetch('http://127.0.0.1:3001/manifest.json');
            if (response.ok) return res.json({ status: "Active" });
        } catch (e) {
            // תמשיך לבדיקה הבאה
        }

        // אם כל הבדיקות נכשלו
        return res.json({ status: "Offline" });

    } catch (error) {
        return res.json({ status: "Offline" });
    }
});
// Start Streaming Server on port 3000
streamApp.listen(3000, () => {
    console.log("Streaming server running on port 3000");
    console.log("Open http://localhost:3000/ to see installation page");
});

// --- Addon Server ---
const addonApp = express();
addonApp.use(cors());

const addonInterface = builder.getInterface();
addonApp.use(addonSdk.getRouter(addonInterface));

// Start Addon Server on port 3001
addonApp.listen(3001, () => {
    console.log("Stremio addon server running on port 3001");
    console.log("Add to Stremio: stremio://127.0.0.1:3001/manifest.json");
});

// Clean up on process termination
process.on('SIGINT', () => {
    console.log('Shutting down...');
    streamService.destroy();
    process.exit(0);
});
process.on('SIGTERM', () => {
    console.log('Shutting down...');
    streamService.destroy();
    process.exit(0);
});
