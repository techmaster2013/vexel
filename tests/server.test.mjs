import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtempSync, rmSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
const tmp = mkdtempSync(join(tmpdir(), "vexel-test-")),
  database = join(tmp, "db.sqlite"),
  origin = "http://localhost:3217";
let processHandle, cookie;
async function request(path, data, session = cookie, headers = {}) {
  const r = await fetch(origin + path, {
    method: data ? "POST" : "GET",
    headers: {
      ...(data ? { "Content-Type": "application/json", Origin: origin } : {}),
      ...(session ? { Cookie: session } : {}),
      ...headers,
    },
    body: data ? JSON.stringify(data) : undefined,
  });
  const b = await r.json();
  return { r, b };
}
before(async () => {
  const content = join(tmp, "content");
  mkdirSync(join(content, "games"), { recursive: true });
  writeFileSync(
    join(content, "manifest.json"),
    JSON.stringify(
      Array.from({ length: 4 }, (_, i) => ({
        id: "fixture-" + i,
        path: "/games/fixture.html",
      })),
    ),
  );
  writeFileSync(
    join(content, "games/fixture.html"),
    "<html><script>/* original test fixture */</script></html>",
  );
  processHandle = spawn(process.execPath, ["server/index.mjs"], {
    env: {
      ...process.env,
      PORT: "3217",
      PUBLIC_ORIGIN: origin,
      DATABASE_PATH: database,
      GAME_CONTENT_DIR: join(tmp, "content"),
      ADMIN_USERNAMES: "qa_admin",
      FEEDBACK_DRAFT_ONLY: "true",
    },
    stdio: "pipe",
  });
  await new Promise((resolve, reject) => {
    processHandle.stdout.once("data", resolve);
    processHandle.once("exit", (code) =>
      reject(Error("Server exited " + code)),
    );
    setTimeout(() => reject(Error("Startup timeout")), 5000).unref();
  });
});
after(() => {
  processHandle.kill();
  rmSync(tmp, { recursive: true, force: true });
});
test("catalog serves the configured separate content directory and JSON MIME", async () => {
  const { r, b } = await request("/api/catalog");
  assert.equal(r.status, 200);
  assert.equal(b.length, 4);
  for (const game of b) {
    const response = await fetch(origin + "/content" + game.path);
    assert.equal(response.status, 200);
    assert.match(await response.text(), /<script>/);
  }
});
test("account, preferences, economy, authorization, and session lifecycle", async () => {
  let x = await request("/api/register", {
    username: "qa_admin",
    email: "qa@example.test",
    password: "strong-test-password",
  });
  assert.equal(x.r.status, 200);
  assert.equal(x.b.user.admin, true);
  cookie = x.r.headers.get("set-cookie").split(";")[0];
  assert.match(x.r.headers.get("set-cookie"), /HttpOnly/);
  const id = x.b.user.id;
  x = await request("/api/preferences", {
    preferences: {
      notes: "<script>not markup</script>",
        glass:67,roundness:8,homeRecent:false,wallpaper:"grid",
      favorites: ["pulse"],
      coins: 10000,
    },
  });
  assert.equal(x.b.user.preferences.notes, "<script>not markup</script>");
  assert.equal(x.b.user.coins, 0);
  assert.equal(x.b.user.preferences.glass,67);
  assert.equal(x.b.user.preferences.homeRecent,false);
  const badStyle=await request("/api/preferences",{preferences:{glass:1000}});assert.equal(badStyle.r.status,400);
  assert.equal(x.b.user.preferences.coins, undefined);
  x = await request("/api/preferences", { preferences: { theme: "aurora" } });
  assert.equal(x.r.status, 403);
  x = await request("/api/shop/buy", { item: "aurora" });
  assert.equal(x.r.status, 409);
  const rewardDb = new DatabaseSync(database);
  rewardDb.prepare("UPDATE users SET last_reward=0 WHERE id=?").run(id);
  rewardDb.close();
  x = await request("/api/activity", { kind: "play" });
  assert.equal(x.b.earned, 3);
  x = await request("/api/activity", { kind: "play" });
  assert.equal(x.b.earned, 0);
  x = await request("/api/admin/grant", { username: "qa_admin", amount: 50 });
  assert.equal(x.r.status, 200);
  x = await request("/api/shop/buy", { item: "aurora" });
  assert.equal(x.b.user.coins, 13);
  assert.deepEqual(x.b.user.owned, ["aurora"]);
  x = await request("/api/shop/buy", { item: "aurora" });
  assert.equal(x.r.status, 409);
  x = await request("/api/chat", { room: "general", text: "QA local chat" });
  assert.equal(x.r.status, 200);
  x = await request("/api/chat?room=general");
  assert.equal(x.b[0].text, "QA local chat");
  const messageId = x.b[0].id;
  const db = new DatabaseSync(database);
  assert.equal(
    db.prepare("SELECT COUNT(*) n FROM ledger WHERE user_id=?").get(id).n,
    3,
  );
  db.close();
  x = await request("/api/feedback", {
    category: "suggestion",
    message: "Local QA draft only",
  });
  assert.equal(x.r.status, 202);
  assert.equal(x.b.sent, false);
  assert.ok(x.b.draftId);
  x = await request("/api/feedback/drafts");
  assert.equal(x.b[0].message, "Local QA draft only");
  x = await request("/api/chat/delete", { id: messageId });
  assert.equal(x.r.status, 200);
  x = await request("/api/logout", {});
  assert.equal(x.r.status, 200);
  x = await request("/api/me");
  assert.equal(x.b.user, null);
  x = await request(
    "/api/login",
    { identifier: "qa@example.test", password: "strong-test-password" },
    null,
  );
  assert.equal(x.r.status, 200);
  cookie = x.r.headers.get("set-cookie").split(";")[0];
  assert.equal(x.b.user.coins, 13);
  assert.ok(x.b.user.owned.includes("aurora"));
  assert.equal(x.b.user.preferences.notes, "<script>not markup</script>");
});
test("anonymous, invalid origin, invalid input, and non-admin operations are rejected", async () => {
  let x = await request(
    "/api/chat",
    { room: "general", text: "blocked" },
    null,
  );
  assert.equal(x.r.status, 401);
  x = await request(
    "/api/login",
    { identifier: "qa_admin", password: "wrong-password" },
    null,
  );
  assert.equal(x.r.status, 401);
  x = await request(
    "/api/login",
    { identifier: "qa_admin", password: "strong-test-password" },
    null,
    { Origin: "https://attacker.test" },
  );
  assert.equal(x.r.status, 403);
  x = await request("/api/feedback", {
    category: "wrong",
    message: "test message",
  });
  assert.equal(x.r.status, 400);
  x = await request(
    "/api/register",
    { username: "qa_other", password: "strong-test-password" },
    null,
  );
  const other = x.r.headers.get("set-cookie").split(";")[0];
  x = await request(
    "/api/admin/grant",
    { username: "qa_other", amount: 100 },
    other,
  );
  assert.equal(x.r.status, 403);
  x = await request("/api/chat", { room: "unknown", text: "test" }, other);
  assert.equal(x.r.status, 400);
});

test("built-in proxy advertises its own endpoint and rejects foreign-origin upgrades", async () => {
  const x = await request("/api/proxy-config");
  assert.equal(x.b.wisp, "ws://localhost:3217/wisp/");
  const { request: httpRequest } = await import("node:http");
  const status = await new Promise((resolve, reject) => {
    const req = httpRequest(
      origin + "/wisp/",
      {
        headers: {
          Connection: "Upgrade",
          Upgrade: "websocket",
          "Sec-WebSocket-Version": "13",
          "Sec-WebSocket-Key": "dGhlIHNhbXBsZSBub25jZQ==",
          Origin: "https://foreign.example",
        },
      },
      (res) => {
        res.resume();
        resolve(res.statusCode);
      },
    );
    req.on("error", reject);
    req.end();
  });
  assert.equal(status, 403);
  const accepted = await new Promise((resolve, reject) => {
    const req = httpRequest(
      origin + "/wisp/",
      {
        headers: {
          Connection: "Upgrade",
          Upgrade: "websocket",
          "Sec-WebSocket-Version": "13",
          "Sec-WebSocket-Key": "dGhlIHNhbXBsZSBub25jZQ==",
          Origin: origin,
        },
      },
      (res) => {
        res.resume();
        reject(Error("Upgrade rejected: " + res.statusCode));
      },
    );
    req.on("upgrade", (res, socket) => {
      socket.destroy();
      resolve(res.statusCode);
    });
    req.on("error", reject);
    req.end();
  });
  assert.equal(accepted, 101);
});

test('game probe only accepts catalog-approved external sources',async()=>{
 let x=await request('/api/game-probe?id=missing&url=https://127.0.0.1/');assert.equal(x.r.status,404);
 x=await request('/api/game-probe?id=fixture-0');assert.equal(x.r.status,400);
});

 test("persisted account privileges allow unlimited purchases without exposing privilege writes", async () => {
  let x = await request("/api/register", {username:"privilege_test", password:"strong-test-password"}, "");
  const session=x.r.headers.get("set-cookie").split(";")[0], id=x.b.user.id;
  assert.equal(x.b.user.admin,false); assert.equal(x.b.user.unlimitedCoins,false);
  const db=new DatabaseSync(database);
  db.prepare("UPDATE users SET is_admin=1, unlimited_coins=1 WHERE id=?").run(id);
  x=await request("/api/shop/buy",{item:"rose"},session);
  assert.equal(x.r.status,200); assert.equal(x.b.user.coins,0);
  assert.equal(x.b.user.unlimitedCoins,true);assert.equal(x.b.user.admin,true);
  assert.ok(x.b.user.owned.includes("rose"));
  x=await request("/api/activity",{kind:"play"},session);assert.equal(x.b.earned,0);
  x=await request("/api/admin/grant",{username:"privilege_test",amount:1},session);assert.equal(x.r.status,200);
  x=await request("/api/preferences",{preferences:{is_admin:0,unlimited_coins:0,unlimitedCoins:false}},session);
  assert.equal(x.b.user.admin,true);assert.equal(x.b.user.unlimitedCoins,true);
  db.close();
 });
