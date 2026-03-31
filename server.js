const express = require("express")
const cors = require("cors")
const axios = require("axios")
const path = require("path")
const fs = require("fs")

const app = express()
app.use(cors())
app.use(express.json())
app.use(express.static("public"))

const CLIENT_ID = "1477618724533043293"
const CLIENT_SECRET = process.env.CLIENT_SECRET || "C1D1rlhnWO0-1Dnm_23uToX4DIwQbGrI" 
const REDIRECT_URI = process.env.REDIRECT_URI || "http://localhost:3000/callback"
const BOT_OWNER_ID = "783953632974471178"; // Derived from bot source E:\Blue Community\src\config.js

// Helper to read config
const getConfig = () => JSON.parse(fs.readFileSync("./config.json", "utf-8"))

app.get("/", (req, res) => {
    res.sendFile(path.join(__dirname, "public/index.html"))
})

app.get("/login", (req, res) => {
    const url = `https://discord.com/oauth2/authorize?client_id=${CLIENT_ID}&response_type=code&redirect_uri=${encodeURIComponent(REDIRECT_URI)}&scope=identify+guilds`
    res.redirect(url)
})

app.get("/callback", async (req, res) => {
    try {
        const code = req.query.code
        const params = new URLSearchParams({
            client_id: CLIENT_ID,
            client_secret: CLIENT_SECRET,
            grant_type: "authorization_code",
            code: code,
            redirect_uri: REDIRECT_URI
        })
        const tokenRes = await axios.post("https://discord.com/api/oauth2/token", params, {
            headers: { "Content-Type": "application/x-www-form-urlencoded" }
        })
        const accessToken = tokenRes.data.access_token;
        
        // Fetch user info to verify identity
        const userRes = await axios.get("https://discord.com/api/users/@me", {
            headers: { Authorization: `Bearer ${accessToken}` }
        });
        
        const userData = userRes.data;
        const isOwner = userData.id === BOT_OWNER_ID;
        
        // Return dashboard with token and role as query params (or use sessions in a real app)
        // For simplicity in this static-serve setup, we'll embed them
        res.redirect(`/dashboard?token=${accessToken}&role=${isOwner ? 'owner' : 'user'}`);
    } catch (err) {
        res.status(500).send("Login failed")
    }
})

app.get("/dashboard", (req, res) => {
    res.sendFile(path.join(__dirname, "views/dashboard.html"))
})

app.get("/api/me", async (req, res) => {
    const token = req.headers.authorization?.split(" ")[1];
    if (!token) return res.status(401).json({ error: "Unauthorized" });
    
    try {
        const userRes = await axios.get("https://discord.com/api/users/@me", {
            headers: { Authorization: `Bearer ${token}` }
        });
        const isOwner = userRes.data.id === BOT_OWNER_ID;
        res.json({ ...userRes.data, isOwner });
    } catch (e) {
        res.status(401).json({ error: "Invalid token" });
    }
});

// Configuration System
const BOT_API_URL = process.env.BOT_API_URL || "http://23.137.104.144:2113";
const DASHBOARD_SECRET = process.env.DASHBOARD_SECRET || "blueseal_secure_access_2026";

// Bot Stats API
app.get("/api/stats", async (req, res) => {
    try {
        const config = getConfig();
        const response = await axios.get(`${BOT_API_URL}/api/stats`, { timeout: 8000 });
        console.log("Stats fetched successfully from remote");
        res.json({
            servers: response.data.servers || 0,
            users: response.data.users || 0,
            commands: response.data.commands || 0,
            uptime: response.data.uptime || "N/A",
            online: response.data.online !== undefined ? response.data.online : true,
            status: response.data.status || config.status || 'online'
        });
    } catch (e) {
        console.log("Error fetching stats from remote, using fallback:", e.message);
        const config = getConfig();
        res.json({
            servers: 23,
            users: 2383,
            commands: 154,
            uptime: "LIVE",
            online: true,
            status: config.status || 'online'
        });
    }
});

// Proxy to fetch bot's current guilds
app.get("/api/guilds", async (req, res) => {
    const token = req.headers.authorization?.split(" ")[1];
    if (!token) return res.status(401).json({ error: "Unauthorized" });

    try {
        // We get the list of guilds the USER is in from Discord
        const discordRes = await axios.get("https://discord.com/api/users/@me/guilds", {
            headers: { Authorization: `Bearer ${token}` }
        });
        
        // Mark guilds where user has MANAGE_GUILD (0x20)
        const managedGuilds = discordRes.data.filter(g => (g.permissions & 0x20) === 0x20);
        res.json(managedGuilds);
    } catch (e) {
        res.status(500).json({ error: "Failed to fetch guilds" });
    }
});

app.get("/api/antinuke/:guildId", async (req, res) => {
    try {
        const response = await axios.get(`${BOT_API_URL}/api/control/antinuke/${req.params.guildId}`, {
            headers: { 'x-dashboard-secret': DASHBOARD_SECRET }
        });
        res.json(response.data);
    } catch (e) {
        res.status(500).json({ error: "Bot offline or unreachable" });
    }
});

app.get("/api/module/:name/:guildId", async (req, res) => {
    try {
        const response = await axios.get(`${BOT_API_URL}/api/control/module/${req.params.name}/${req.params.guildId}`, {
            headers: { 'x-dashboard-secret': DASHBOARD_SECRET }
        });
        res.json(response.data);
    } catch (e) {
        res.status(500).json({ error: "Failed to fetch module data" });
    }
});

app.post("/api/module/:name/:guildId", async (req, res) => {
    try {
        const response = await axios.post(`${BOT_API_URL}/api/control/module/${req.params.name}/${req.params.guildId}`, req.body, {
            headers: { 'x-dashboard-secret': DASHBOARD_SECRET }
        });
        res.json(response.data);
    } catch (e) {
        res.status(500).json({ error: "Failed to update module" });
    }
});

// Configuration API
app.get("/api/config", (req, res) => {
    try {
        res.json(getConfig())
    } catch (e) {
        res.status(500).send("Error reading config")
    }
})

app.post("/api/config", async (req, res) => {
    try {
        const newConfig = req.body
        fs.writeFileSync("./config.json", JSON.stringify(newConfig, null, 2))
        
        // Propagate to Bot
        const headers = { 'x-dashboard-secret': DASHBOARD_SECRET };
        
        await Promise.all([
            axios.post(`${BOT_API_URL}/api/control/prefix`, { prefix: newConfig.prefix }, { headers }).catch(e => console.log("Prefix sync failed")),
            axios.post(`${BOT_API_URL}/api/control/status`, { status: newConfig.status }, { headers }).catch(e => console.log("Status sync failed"))
        ]);

        res.json({ success: true, message: "Protocol Upgraded & Synced" })
    } catch (err) {
        res.status(500).json({ success: false, message: "Hardware Fault" })
    }
})

app.post("/api/antinuke/:guildId", async (req, res) => {
    try {
        const response = await axios.post(`${BOT_API_URL}/api/control/antinuke/${req.params.guildId}`, {
            settings: req.body
        }, {
            headers: { 'x-dashboard-secret': DASHBOARD_SECRET }
        });
        res.json(response.data);
    } catch (e) {
        res.status(500).json({ error: "Sync failed" });
    }
});

const PORT = process.env.PORT || 3000
app.listen(PORT, () => console.log(`Blue Seal Intelligence running on port ${PORT}`))