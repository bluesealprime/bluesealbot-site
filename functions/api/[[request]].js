export async function onRequest({ request, env, params }) {
    const { BOT_API_URL, DASHBOARD_SECRET, BOT_OWNER_ID = "783953632974471178" } = env;
    const url = new URL(request.url);
    const path = url.pathname;
    const method = request.method;

    const botApi = BOT_API_URL || "http://23.137.104.144:2113";
    const secret = DASHBOARD_SECRET || "blueseal_secure_access_2026";

    // Standard headers for proxied request
    const headers = {
        'x-dashboard-secret': secret,
        'Content-Type': 'application/json'
    };

    // Route: /api/me
    if (path === "/api/me") {
        const token = request.headers.get("Authorization")?.split(" ")[1];
        if (!token) return new Response("Unauthorized", { status: 401 });
        const userRes = await fetch("https://discord.com/api/users/@me", {
            headers: { Authorization: `Bearer ${token}` }
        });
        const userData = await userRes.json();
        return new Response(JSON.stringify({
            ...userData,
            isOwner: userData.id === BOT_OWNER_ID
        }), { headers: { 'Content-Type': 'application/json' } });
    }

    // Route: /api/guilds
    if (path === "/api/guilds") {
        const token = request.headers.get("Authorization")?.split(" ")[1];
        if (!token) return new Response("Unauthorized", { status: 401 });
        const guildRes = await fetch("https://discord.com/api/users/@me/guilds", {
            headers: { Authorization: `Bearer ${token}` }
        });
        const guilds = await guildRes.json();
        const managed = guilds.filter(g => (g.permissions & 0x20) === 0x20);
        return new Response(JSON.stringify(managed), { headers: { 'Content-Type': 'application/json' } });
    }

    // Proxied Routes to Bot: /api/antinuke/:guildId, /api/module/:name/:guildId
    // Convert Cloudflare URL to Bot URL
    const targetPath = path.startsWith("/api/control") ? path : path.replace("/api/", "/api/control/");
    const targetUrl = `${botApi}${targetPath}`;

    try {
        const response = await fetch(targetUrl, {
            method: method,
            headers: headers,
            body: method === "POST" ? await request.clone().text() : undefined
        });
        const data = await response.json();
        return new Response(JSON.stringify(data), {
            status: response.status,
            headers: { 'Content-Type': 'application/json' }
        });
    } catch (err) {
        return new Response(JSON.stringify({ error: "Bot unreachable: " + err.message }), { status: 502 });
    }
}
