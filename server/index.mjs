import {probeExternalGame} from "./block-probe.mjs";
import { attachProxyTransport } from "./proxy-transport.mjs";
import { cleanPreferences } from "./preferences.mjs";
import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { resolve, extname, sep } from "node:path";
import { randomUUID } from "node:crypto";
import { createAuth, providerConfig } from "./auth.mjs";
import {
  openStore,
  random,
  digest,
  hashPassword,
  checkPassword,
  publicUser,
  shop,
  transaction,
  award,
} from "./store.mjs";
const root = resolve(import.meta.dirname, ".."),
  env = process.env;
const origin = env.PUBLIC_ORIGIN || "http://localhost:3000",
  secure = origin.startsWith("https:");
const builtinWisp = env.BUILTIN_WISP !== "false";
const wispUrl =
  env.WISP_URL || (builtinWisp ? origin.replace(/^http/, "ws") + "/wisp/" : "");
const games = resolve(root, env.GAME_CONTENT_DIR || "../vex-games");
const db = openStore(resolve(root, env.DATABASE_PATH || "data/vexel.sqlite"));
const admins = (env.ADMIN_USERNAMES || "")
  .toLowerCase()
  .split(",")
  .map((x) => x.trim());
const limits = new Map();
const providers = providerConfig(env);
const providerAuth = createAuth({providers,origin});
const cookie = (req, name) => {
  const entry = (req.headers.cookie || "")
    .split(";")
    .map((x) => x.trim())
    .find((x) => x.startsWith(name + "="));
  return entry?.slice(name.length + 1);
};
function fail(status, message) {
  throw Object.assign(new Error(message), { status });
}
function rate(req, bucket, n, period = 60000) {
  const key = (req.socket.remoteAddress || "") + bucket,
    now = Date.now();
  let v = limits.get(key);
  if (!v || now > v.until) {
    v = { count: 0, until: now + period };
    limits.set(key, v);
  }
  if (++v.count > n) fail(429, "Too many attempts. Please wait a minute.");
}
setInterval(() => {
  const now = Date.now();
  for (const [k, v] of limits) if (v.until < now) limits.delete(k);
  db.prepare("DELETE FROM sessions WHERE expires<?").run(now);
}, 60000).unref();
async function body(req) {
  let raw = "";
  for await (const chunk of req) {
    raw += chunk;
    if (raw.length > 65536) fail(413, "Request too large.");
  }
  try {
    return JSON.parse(raw || "{}");
  } catch {
    fail(400, "Invalid request.");
  }
}
function user(req) {
  return db
    .prepare(
      "SELECT u.* FROM sessions s JOIN users u ON s.user_id=u.id WHERE s.token=? AND s.expires>?",
    )
    .get(digest(cookie(req, "vexel_session") || ""), Date.now());
}
function auth(req) {
  const u = user(req);
  if (!u) fail(401, "Sign in to continue.");
  return u;
}
function session(res, id) {
  const token = random();
  db.prepare("INSERT INTO sessions VALUES(?,?,?)").run(
    digest(token),
    id,
    Date.now() + 30 * 86400000,
  );
  res.setHeader(
    "Set-Cookie",
    `vexel_session=${token}; HttpOnly; SameSite=Lax; Path=/; Max-Age=2592000${secure ? "; Secure" : ""}`,
  );
}
function json(res, value, status = 200) {
  res.writeHead(status, {
    "Content-Type": "application/json",
    "Cache-Control": "no-store",
  });
  res.end(JSON.stringify(value));
}
function text(v, max, min = 1) {
  if (typeof v !== "string" || v.trim().length < min || v.length > max)
    fail(400, `Enter between ${min} and ${max} characters.`);
  return v.trim();
}
const me = (u) => publicUser(db, u, admins);
async function catalog() {
  try {
    return JSON.parse(await readFile(resolve(games, "manifest.json"), "utf8"));
  } catch {
    return [];
  }
}
const mime = {
  ".html": "text/html",
  ".js": "text/javascript",
  ".mjs": "text/javascript",
  ".json": "application/json",
  ".css": "text/css",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".wasm": "application/wasm",
  ".ico": "image/x-icon",
  ".mp4": "video/mp4",
  ".jpg": "image/jpeg",
  ".ttf": "font/ttf",
  ".woff2": "font/woff2",
  ".txt": "text/plain",
};
async function file(res, base, path) {
  const target = resolve(base, "." + path);
  if (!target.startsWith(base + sep)) fail(403, "Forbidden");
  let info;
  try {
    info = await stat(target);
  } catch {
    fail(404, "File not found.");
  }
  if (!info.isFile()) fail(404, "File not found.");
  res.writeHead(200, {
    "Content-Type": mime[extname(target)] || "application/octet-stream",
    "Cache-Control": "no-cache",
    "Access-Control-Allow-Origin": "*",
  });
  res.end(await readFile(target));
}
export const server = createServer(async (req, res) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  res.setHeader("X-Frame-Options", "SAMEORIGIN");
  try {
    const url = new URL(req.url, origin),
      path = url.pathname;
    if (req.method === "POST") {
      if (req.headers.origin !== origin) fail(403, "Origin rejected.");
      if (!String(req.headers["content-type"]).startsWith("application/json"))
        fail(415, "JSON required.");
    }
    if (path === "/api/config")
      return json(res, {
        version: "0.5.0",
        providers: Object.fromEntries(
          Object.entries(providers).map(([k, p]) => [
            k,
            Boolean(p.id && p.secret),
          ]),
        ),
        proxyReady: Boolean(wispUrl),
        gameOrigin: env.GAME_CONTENT_ORIGIN || "",
        shop,
      });
    if (path === "/api/vm-config") {
      let ready = false;
      try {
        await stat(resolve(root, "public/vendor/v86/alpine.iso"));
        ready = true;
      } catch {}
      return json(res, {
        ready,
        version: "3.24.3",
        size: 51380224,
        memory: 128,
      });
    }
    if(path==='/api/game-probe'){
      rate(req,'game-probe',20);
      const entry=(await catalog()).find(g=>g.id===url.searchParams.get('id'));
      if(!entry)fail(404,'Game not found.');
      const target=entry.remoteUrl||entry.launchUrl||(env.GAME_CONTENT_ORIGIN&&entry.path?env.GAME_CONTENT_ORIGIN+entry.path:null);
      if(!target)fail(400,'This game is hosted locally.');
      return json(res,await probeExternalGame(target));
    }
    if (path === "/api/catalog") return json(res, await catalog());
    if (path === "/api/me") return json(res, { user: me(user(req)) });
    if (path.startsWith("/auth/")) {
      rate(req, "oauth", 20);
      const [, , name, callback] = path.split("/"),
        p = providers[name];
      if (!p?.id || !p.secret)
        fail(503, "This sign-in provider needs deployment credentials.");
      if (req.method !== "GET" || (callback && callback !== "callback")) fail(404,"Unknown sign-in route.");
      res.setHeader("Cache-Control","no-store");
      res.setHeader("Referrer-Policy","no-referrer");
      if (!callback) {
        const flow=await providerAuth.start(name);
        res.setHeader("Set-Cookie",`vexel_oauth=${flow.binding}; HttpOnly; SameSite=Lax; Path=/auth/; Max-Age=600${secure ? "; Secure" : ""}`);
        res.writeHead(302,{Location:flow.url}); return res.end();
      }
      let identity;
      try { identity=await providerAuth.complete(name,url,cookie(req,"vexel_oauth")); }
      catch { res.setHeader("Set-Cookie",`vexel_oauth=; HttpOnly; SameSite=Lax; Path=/auth/; Max-Age=0${secure ? "; Secure" : ""}`);res.writeHead(302,{Location:"/?auth_error=signin_failed#account"});return res.end(); }
      res.setHeader("Set-Cookie",`vexel_oauth=; HttpOnly; SameSite=Lax; Path=/auth/; Max-Age=0${secure ? "; Secure" : ""}`);
      let u = db
        .prepare("SELECT * FROM users WHERE provider=? AND subject=?")
        .get(name, identity.subject);
      if (!u) {
        const id = randomUUID(),
          username = "vex_" + randomBytesShort();
        db.prepare(
          "INSERT INTO users(id,username,provider,subject,last_reward) VALUES(?,?,?,?,?)",
        ).run(id, username, name, identity.subject, Date.now());
        u = db.prepare("SELECT * FROM users WHERE id=?").get(id);
      }
      const clearedFlowCookie=res.getHeader("Set-Cookie");
      session(res, u.id);
      res.setHeader("Set-Cookie",[clearedFlowCookie,res.getHeader("Set-Cookie")]);
      res.writeHead(302, { Location: "/#account" });
      return res.end();
    }
    if (req.method === "POST") {
      const b = await body(req);
      if (path === "/api/register") {
        rate(req, "register", 5);
        const username = text(b.username, 20, 3).toLowerCase();
        if (!/^[a-z0-9_]+$/.test(username))
          fail(400, "Use letters, numbers and underscores for your username.");
        const password = text(b.password, 128, 10),
          email = b.email ? text(b.email, 254).toLowerCase() : null;
        if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
          fail(400, "Enter a valid email.");
        const id = randomUUID();
        try {
          db.prepare(
            "INSERT INTO users(id,username,email,password,last_reward) VALUES(?,?,?,?,?)",
          ).run(id, username, email, hashPassword(password), Date.now());
        } catch {
          fail(409, "Username or email unavailable.");
        }
        session(res, id);
        return json(res, {
          user: me(db.prepare("SELECT * FROM users WHERE id=?").get(id)),
        });
      }
      if (path === "/api/login") {
        rate(req, "login", 10);
        const identifier = text(b.identifier, 254).toLowerCase(),
          pw = text(b.password, 128);
        const u = db
          .prepare("SELECT * FROM users WHERE username=? OR email=?")
          .get(identifier, identifier);
        if (
          !checkPassword(pw, u?.password || hashPassword(random())) ||
          !u?.password
        )
          fail(401, "Incorrect sign-in details.");
        session(res, u.id);
        return json(res, { user: me(u) });
      }
      if (path === "/api/logout") {
        db.prepare("DELETE FROM sessions WHERE token=?").run(
          digest(cookie(req, "vexel_session") || ""),
        );
        res.setHeader(
          "Set-Cookie",
          "vexel_session=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0",
        );
        return json(res, { ok: true });
      }
      if (path === "/api/feedback") {
        rate(req, "feedback", 3);
        const category = text(b.category, 30),
          message = text(b.message, 2000, 5),
          game = typeof b.game === "string" ? b.game.slice(0, 200) : "";
        if (
          !["game request", "bug report", "suggestion", "other"].includes(
            category,
          )
        )
          fail(400, "Unknown feedback category.");
        const fields = Object.fromEntries(
          Object.entries({
            category,
            message,
            game,
            source: "Vexel",
            status: "unresolved",
          }).map(([k, v]) => [k, { stringValue: v }]),
        );
        fields.createdAt = { timestampValue: new Date().toISOString() };
        try {
          if (env.FEEDBACK_DRAFT_ONLY === "true") throw Error("Draft mode");
          const endpoint = `https://firestore.googleapis.com/v1/projects/${env.FEEDBACK_PROJECT || "gplaza-feedback"}/databases/(default)/documents/feedback`;
          const r = await fetch(
            endpoint +
              (env.FEEDBACK_API_KEY
                ? "?key=" + encodeURIComponent(env.FEEDBACK_API_KEY)
                : ""),
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ fields }),
              signal: AbortSignal.timeout(8000),
            },
          );
          if (!r.ok) throw Error("Rejected");
          return json(res, { sent: true });
        } catch {
          const id = randomUUID();
          db.prepare("INSERT INTO drafts VALUES(?,?,?,?,?,?)").run(
            id,
            user(req)?.id || null,
            category,
            game,
            message,
            Date.now(),
          );
          return json(
            res,
            {
              sent: false,
              draftId: id,
              message:
                "Saved on this Vexel server. GamePlaza could not accept it; it has not been delivered to that board.",
            },
            202,
          );
        }
      }
      const u = auth(req);
      if (path === "/api/preferences") {
        let clean;
        try {
          clean = cleanPreferences(
            b.preferences,
            db
              .prepare("SELECT item FROM owned WHERE user_id=?")
              .all(u.id)
              .map((x) => x.item),
          );
        } catch (e) {
          fail(e.message === "Unlock that theme first." ? 403 : 400, e.message);
        }
        db.prepare("UPDATE users SET preferences=? WHERE id=?").run(
          JSON.stringify(clean),
          u.id,
        );
        return json(res, {
          user: me(db.prepare("SELECT * FROM users WHERE id=?").get(u.id)),
        });
      }
      if (path === "/api/activity") {
        const now = Date.now();
        if (b.kind && !["browse", "play"].includes(b.kind))
          fail(400, "Invalid activity.");
        if (u.unlimited_coins) return json(res, { earned: 0, user: me(u) });
        const amount = b.kind === "play" ? 3 : 1;
        if (now - u.last_reward < 60000)
          return json(res, { earned: 0, user: me(u) });
        transaction(db, () => {
          award(db, u.id, amount, b.kind || "browse");
          db.prepare("UPDATE users SET last_reward=? WHERE id=?").run(
            now,
            u.id,
          );
        });
        return json(res, {
          earned: amount,
          user: me(db.prepare("SELECT * FROM users WHERE id=?").get(u.id)),
        });
      }
      if (path === "/api/shop/buy") {
        const item = shop.find((x) => x.id === b.item);
        if (!item) fail(400, "Unknown item.");
        transaction(db, () => {
          if (
            db
              .prepare("SELECT 1 FROM owned WHERE user_id=? AND item=?")
              .get(u.id, item.id)
          )
            fail(409, "Already owned.");
          if (!u.unlimited_coins && u.coins < item.price)
            fail(409, "Earn more coins to unlock this.");
          if (!u.unlimited_coins) award(db, u.id, -item.price, "shop:" + item.id);
          db.prepare("INSERT INTO owned VALUES(?,?)").run(u.id, item.id);
        });
        return json(res, {
          user: me(db.prepare("SELECT * FROM users WHERE id=?").get(u.id)),
        });
      }
      if (path === "/api/admin/grant") {
        if (!me(u).admin)
          fail(403, "Admin access required.");
        if (!Number.isInteger(b.amount) || b.amount < 1 || b.amount > 10000)
          fail(400, "Grant 1–10,000 coins.");
        const target = db
          .prepare("SELECT id FROM users WHERE username=?")
          .get(text(b.username, 20));
        if (!target) fail(404, "User not found.");
        transaction(db, () => award(db, target.id, b.amount, "admin:" + u.id));
        return json(res, { ok: true });
      }
      if (path === "/api/chat") {
        rate(req, "chat", 15);
        const room = text(b.room, 20),
          message = text(b.text, 1000);
        if (!["general", "games", "creative"].includes(room))
          fail(400, "Unknown room.");
        db.prepare(
          "INSERT INTO messages(user_id,room,text,created) VALUES(?,?,?,?)",
        ).run(u.id, room, message, Date.now());
        return json(res, { ok: true });
      }
      if (path === "/api/chat/delete") {
        const m = db.prepare("SELECT * FROM messages WHERE id=?").get(b.id);
        if (!m) fail(404, "Message not found.");
        if (m.user_id !== u.id && !me(u).admin)
          fail(403, "Cannot delete this message.");
        db.prepare("DELETE FROM messages WHERE id=?").run(b.id);
        return json(res, { ok: true });
      }
      fail(404, "Unknown action.");
    }
    if (path === "/api/chat") {
      auth(req);
      const room = url.searchParams.get("room") || "general";
      return json(
        res,
        db
          .prepare(
            "SELECT m.id,m.text,m.created,u.username FROM messages m JOIN users u ON u.id=m.user_id WHERE room=? ORDER BY m.id DESC LIMIT 100",
          )
          .all(room)
          .reverse(),
      );
    }
    if (path === "/api/feedback/drafts") {
      const u = auth(req);
      if (!me(u).admin)
        fail(403, "Admin access required.");
      return json(
        res,
        db
          .prepare(
            "SELECT id,category,game,message,created FROM drafts ORDER BY created DESC LIMIT 100",
          )
          .all(),
      );
    }
    if (path === "/api/proxy-config") return json(res, { wisp: wispUrl });
    if (path.startsWith("/content/"))
      return await file(res, games, decodeURIComponent(path.slice(8)));
    if (path === "/LICENSE") return await file(res, root, "/LICENSE");
    if (path === "/")
      return await file(res, resolve(root, "public"), "/index.html");
    await file(res, resolve(root, "public"), decodeURIComponent(path));
  } catch (e) {
    if (!res.headersSent)
      json(
        res,
        {
          error: e.status
            ? e.message
            : "The server could not complete that request.",
        },
        e.status || 500,
      );
    else res.end();
    if (!e.status) console.error(e);
  }
});
function randomBytesShort() {
  return random().slice(0, 10).toLowerCase().replace(/-/g, "_");
}
attachProxyTransport(server, { origin, enabled: builtinWisp });
server.listen(Number(env.PORT || 3000), "0.0.0.0", () =>
  console.log(`Vexel: ${origin}`),
);
