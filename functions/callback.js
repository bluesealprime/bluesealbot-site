export async function onRequest(context) {
    const { env, request } = context;
    const url = new URL(request.url);
    const code = url.searchParams.get("code");
    if (!code) return new Response("No code provided", { status: 400 });

    const CLIENT_ID = "1477618724533043293";
    const CLIENT_SECRET = env.CLIENT_SECRET;
    const REDIRECT_URI = env.REDIRECT_URI || "https://blueseal-site.pages.dev/callback";
    const BOT_OWNER_ID = "783953632974471178";

    try {
        const params = new URLSearchParams({
            client_id: CLIENT_ID,
            client_secret: CLIENT_SECRET,
            grant_type: "authorization_code",
            code: code,
            redirect_uri: REDIRECT_URI
        });
        const tokenRes = await fetch("https://discord.com/api/oauth2/token", {
            method: "POST",
            body: params.toString(),
            headers: { "Content-Type": "application/x-www-form-urlencoded" }
        });
        const tokenData = await tokenRes.json();
        const accessToken = tokenData.access_token;

        if (!accessToken) {
            return new Response("Failed to obtain access token: " + JSON.stringify(tokenData), { status: 500 });
        }

        const userRes = await fetch("https://discord.com/api/users/@me", {
            headers: { Authorization: `Bearer ${accessToken}` }
        });
        const userData = await userRes.json();
        const isOwner = userData.id === BOT_OWNER_ID;

        const origin = new URL(request.url).origin;
        return Response.redirect(`${origin}/dashboard?token=${accessToken}&role=${isOwner ? 'owner' : 'user'}`, 302);
    } catch (err) {
        return new Response("Login failed: " + err.message, { status: 500 });
    }
}
