export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === "/" || url.pathname === "/health") {
      return Response.json({
        ok: true,
        service: "oj-website-api",
        r2Bound: Boolean(env.MEDIA),
        d1Bound: Boolean(env.DB),
        timestamp: new Date().toISOString()
      });
    }
    return new Response("Not found", { status: 404 });
  }
};
