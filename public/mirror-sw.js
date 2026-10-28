// Game mirror for the service worker. Serves files from the owner's public GitHub
// repositories under <scope>gh/<repo>/<path>, so large ports (game-hub, T9, Unity
// builds) play inside Vexel without copying gigabytes into the Pages site.
// Only the owner's repositories are reachable; everything here already ships on
// this github.io origin, so the mirror grants no content a new origin.
var vexelMirror = (() => {
  const OWNER = "techmaster2013";
  const RAW = "https://raw.githubusercontent.com/" + OWNER + "/";
  const TYPES = {
    html: "text/html", htm: "text/html", js: "text/javascript", mjs: "text/javascript", css: "text/css",
    json: "application/json", wasm: "application/wasm", xml: "application/xml", txt: "text/plain", svg: "image/svg+xml",
    png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", gif: "image/gif", webp: "image/webp", ico: "image/x-icon", bmp: "image/bmp",
    mp3: "audio/mpeg", ogg: "audio/ogg", wav: "audio/wav", m4a: "audio/mp4", mp4: "video/mp4", webm: "video/webm",
    ttf: "font/ttf", otf: "font/otf", woff: "font/woff", woff2: "font/woff2", swf: "application/x-shockwave-flash",
    gz: "application/gzip", zip: "application/zip",
  };
  // Popunder ads and trackers that the original pages carry. Game SDKs (GameMonetize,
  // CrazyGames) stay, because games call into them.
  const ADS = /spitefuldecision|al5sm\.com|vayfuzsu|bacusmoa|googletagmanager|googlesyndication|google-analytics|adsbygoogle|cloudflareinsights|highperformanceformat|effectivegatecpm|profitableratecpm/i;
  // Ports often point <base> (or a "https://cdn…/folder/" string) at a CDN copy that has since
  // vanished. When the catalog marks a page "?own" (the repository holds every file it
  // needs), the mirror serves those files instead.
  const CDN_BASE = /<base\b[^>]*href\s*=\s*["']https?:\/\/(?:cdn\.jsdelivr\.net\/gh|(?:raw|rawcdn)\.githack\.com|cdn\.statically\.io\/gh|raw\.githubusercontent\.com)\/[^>]*>/gi;
  const CDN_FOLDER = /(["'])https?:\/\/(?:cdn\.jsdelivr\.net\/gh|(?:raw|rawcdn)\.githack\.com|cdn\.statically\.io\/gh)\/[^"'\s<>]*\/\1/g;
  const ROOT_RELATIVE = /(\s(?:src|href|action|poster|data)\s*=\s*["'])\/(?!\/)/gi;
  const SCRIPT = /<script\b[^>]*>[\s\S]*?<\/script\s*>/gi;
  const MAX_REWRITE = 4 << 20;

  function target(url, scope) {
    const prefix = new URL("gh/", scope).href;
    if (!url.startsWith(prefix)) return null;
    const own = /[?&]own(?:[=&#]|$)/.test(url.split("#")[0]);
    let rest = url.slice(prefix.length).split(/[?#]/)[0];
    const repo = rest.split("/")[0];
    if (!/^[\w.-]+$/.test(repo) || repo === "." || repo === "..") return null;
    if (rest === repo || rest.endsWith("/")) rest += rest === repo ? "/index.html" : "index.html";
    if (rest.split("/").some((part) => part === ".." || part === ".")) return null;
    return { repo, own, path: rest.slice(repo.length + 1), raw: RAW + repo + "/HEAD/" + rest.slice(repo.length + 1), base: prefix + repo + "/" };
  }
  function contentType(path) {
    const ext = decodeURIComponent(path).split("/").pop().split(".").pop().toLowerCase();
    return TYPES[ext] || "application/octet-stream";
  }
  function cleanHtml(html, base, own = false) {
    if (own) html = html.replace(CDN_BASE, "").replace(CDN_FOLDER, "$1./$1");
    return html
      // Large inline scripts are game code that may merely mention an ad network.
      .replace(SCRIPT, (tag) => (tag.length < 65536 && ADS.test(tag) ? "" : tag))
      .replace(/<(?:link|img|iframe)\b[^>]*>/gi, (tag) => (ADS.test(tag) ? "" : tag))
      .replace(ROOT_RELATIVE, "$1" + new URL(base).pathname);
  }
  async function respond(found) {
    // Range requests are not forwarded: GitHub's Content-Range header is not readable across
    // origins, and audio/video elements reject a 206 without it. A full 200 always plays.
    const upstream = await fetch(found.raw, { credentials: "omit", mode: "cors" });
    if (upstream.status === 404 && !/\.[^/]+$/.test(found.path))
      return Response.redirect(found.base + found.path + "/", 302);
    if (!upstream.ok)
      return new Response("This game file is missing from " + found.repo + ".", { status: upstream.status, headers: { "content-type": "text/plain" } });
    const type = contentType(found.path);
    // No content-length: GitHub gzips text, so its length would not match the decoded body.
    const out = new Headers({ "content-type": type });
    if (upstream.headers.has("last-modified")) out.set("last-modified", upstream.headers.get("last-modified"));
    if (type === "text/html" && Number(upstream.headers.get("content-length") || 0) < MAX_REWRITE) {
      out.set("content-type", "text/html; charset=utf-8");
      return new Response(cleanHtml(await upstream.text(), found.base, found.own), { status: upstream.status, headers: out });
    }
    return new Response(upstream.body, { status: upstream.status, headers: out });
  }
  function handle(event, scope) {
    if (event.request.method !== "GET") return null;
    const found = target(event.request.url, scope);
    return found && respond(found).catch(() => new Response("Vexel could not reach GitHub for this game. Check your connection and reload.", { status: 502, headers: { "content-type": "text/plain" } }));
  }
  return { target, contentType, cleanHtml, handle };
})();
