import { DatabaseSync } from "node:sqlite";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import {
  randomBytes,
  scryptSync,
  timingSafeEqual,
  createHash,
} from "node:crypto";
export const shop = [
  { id: "aurora", name: "Deep navy", price: 40, color: "#203a68" },
  { id: "ember", name: "Slate", price: 60, color: "#596c8b" },
  { id: "rose", name: "Midnight", price: 80, color: "#101b30" },
];
export function openStore(path) {
  mkdirSync(dirname(path), { recursive: true });
  const db = new DatabaseSync(path);
  db.exec(`PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON;
 CREATE TABLE IF NOT EXISTS users(id TEXT PRIMARY KEY,username TEXT UNIQUE COLLATE NOCASE,email TEXT UNIQUE COLLATE NOCASE,password TEXT,provider TEXT,subject TEXT,coins INTEGER DEFAULT 0,last_reward INTEGER DEFAULT 0,preferences TEXT DEFAULT '{}',UNIQUE(provider,subject));
 CREATE TABLE IF NOT EXISTS sessions(token TEXT PRIMARY KEY,user_id TEXT REFERENCES users(id) ON DELETE CASCADE,expires INTEGER);
 CREATE TABLE IF NOT EXISTS owned(user_id TEXT REFERENCES users(id),item TEXT,PRIMARY KEY(user_id,item));
 CREATE TABLE IF NOT EXISTS messages(id INTEGER PRIMARY KEY AUTOINCREMENT,user_id TEXT REFERENCES users(id),room TEXT,text TEXT,created INTEGER);
 CREATE TABLE IF NOT EXISTS ledger(id INTEGER PRIMARY KEY,user_id TEXT REFERENCES users(id),amount INTEGER,reason TEXT,created INTEGER);
 CREATE TABLE IF NOT EXISTS drafts(id TEXT PRIMARY KEY,user_id TEXT,category TEXT,game TEXT,message TEXT,created INTEGER);
 `);
  const columns = new Set(db.prepare("PRAGMA table_info(users)").all().map(c => c.name));
  for (const column of ["is_admin", "unlimited_coins"]) {
    if (!columns.has(column)) db.exec(`ALTER TABLE users ADD COLUMN ${column} INTEGER NOT NULL DEFAULT 0`);
  }
  return db;
}
export const random = () => randomBytes(32).toString("base64url");
export const digest = (s) => createHash("sha256").update(s).digest("hex");
export function hashPassword(password) {
  const salt = randomBytes(16).toString("hex");
  return salt + ":" + scryptSync(password, salt, 64).toString("hex");
}
export function checkPassword(password, hash) {
  if (!hash) return false;
  const [salt, value] = hash.split(":");
  const b = scryptSync(password, salt, 64);
  return timingSafeEqual(b, Buffer.from(value, "hex"));
}
export function publicUser(db, u, admins = []) {
  if (!u) return null;
  return {
    id: u.id,
    username: u.username,
    email: u.email,
    coins: u.coins,
    unlimitedCoins: !!u.unlimited_coins,
    preferences: JSON.parse(u.preferences),
    owned: db
      .prepare("SELECT item FROM owned WHERE user_id=?")
      .all(u.id)
      .map((x) => x.item),
    admin: !!u.is_admin || admins.includes(u.username.toLowerCase()),
  };
}
export function transaction(db, fn) {
  db.exec("BEGIN IMMEDIATE");
  try {
    const result = fn();
    db.exec("COMMIT");
    return result;
  } catch (e) {
    db.exec("ROLLBACK");
    throw e;
  }
}
export function award(db, id, amount, reason) {
  db.prepare("UPDATE users SET coins=coins+? WHERE id=?").run(amount, id);
  db.prepare(
    "INSERT INTO ledger(user_id,amount,reason,created) VALUES(?,?,?,?)",
  ).run(id, amount, reason, Date.now());
}
