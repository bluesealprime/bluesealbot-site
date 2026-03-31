export async function onRequest(context) {
    const { env } = context;
    const CLIENT_ID = "1477618724533043293";
    const REDIRECT_URI = env.REDIRECT_URI || "https://blueseal-site.pages.dev/callback";
    const url = `https://discord.com/oauth2/authorize?client_id=${CLIENT_ID}&response_type=code&redirect_uri=${encodeURIComponent(REDIRECT_URI)}&scope=identify+guilds`;
    return Response.redirect(url, 302);
}
