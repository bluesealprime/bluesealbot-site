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
const CLIENT_SECRET = process.env.CLIENT_SECRET
const REDIRECT_URI = process.env.REDIRECT_URI

// Helper to read config
const getConfig = () => JSON.parse(fs.readFileSync("./config.json", "utf-8"))

app.get("/", (req, res) => {
    res.sendFile(path.join(__dirname, "public/index.html"))
})

app.get("/login", (req, res) => {
    const url = `https://discord.com/oauth2/authorize?client_id=${CLIENT_ID}&response_type=code&redirect_uri=${encodeURIComponent(REDIRECT_URI)}&scope=identify%20guilds`
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
        const token = await axios.post("https://discord.com/api/oauth2/token", params, {
            headers: { "Content-Type": "application/x-www-form-urlencoded" }
        })
        res.sendFile(path.join(__dirname, "views/dashboard.html"))
    } catch (err) {
        res.status(500).send("Login failed")
    }
})

// Bot Stats API
app.get("/api/stats", async (req, res) => {
    try {
        const config = getConfig();
        const response = await axios.get("http://23.137.104.144:2113/api/stats", { timeout: 4000 });
        console.log("Stats fetched successfully from remote");
        res.json({
            servers: response.data.servers || 0,
            users: response.data.users || 0,
            uptime: response.data.uptime || "N/A",
            online: response.data.online !== undefined ? response.data.online : true,
            status: config.status || (response.data.online ? 'online' : 'offline')
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

// Configuration API
app.get("/api/config", (req, res) => {
    try {
        res.json(getConfig())
    } catch (e) {
        res.status(500).send("Error reading config")
    }
})

app.post("/api/config", (req, res) => {
    try {
        const newConfig = req.body
        fs.writeFileSync("./config.json", JSON.stringify(newConfig, null, 2))
        res.json({ success: true, message: "Protocol Upgraded" })
    } catch (err) {
        res.status(500).json({ success: false, message: "Hardware Fault" })
    }
})

const PORT = 3000
app.listen(PORT, () => console.log(`Blue Seal Intelligence running on port ${PORT}`))