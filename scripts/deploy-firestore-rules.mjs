// Deploys Vexel's Firestore rules (chat, coins and themes, website editor) to the
// gplaza-feedback project without touching GamePlaza's rules in the same project.
//   npx -y firebase-tools@14.27.0 login          (once; opens a Google sign-in)
//   node scripts/deploy-firestore-rules.mjs [--dry-run]
// It downloads the live rules, swaps in firestore.vexel.rules between its
// "---- Vexel" markers (or adds it), saves the result as firestore.rules, and
// uploads it with the Firebase CLI, which validates the rules first.
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { homedir } from "node:os";
import { execFileSync } from "node:child_process";
import { resolve } from "node:path";

const PROJECT = "gplaza-feedback";
const CLI = ["-y", "firebase-tools@14.27.0"];
const root = resolve(import.meta.dirname, "..");
const vexel = readFileSync(resolve(root, "firestore.vexel.rules"), "utf8").trimEnd();
const dryRun = process.argv.includes("--dry-run");

// Use the sign-in saved by `firebase login` (firebase-tools' public OAuth client).
const store = resolve(homedir(), ".config/configstore/firebase-tools.json");
if (!existsSync(store)) throw Error("Run `npx -y firebase-tools@14.27.0 login` first.");
const refresh = JSON.parse(readFileSync(store, "utf8")).tokens?.refresh_token;
if (!refresh) throw Error("No saved Firebase sign-in. Run `npx -y firebase-tools@14.27.0 login`.");
const token = await fetch("https://oauth2.googleapis.com/token", {
  method: "POST",
  body: new URLSearchParams({
    grant_type: "refresh_token",
    refresh_token: refresh,
    client_id: "563584335869-fgrhgmd47bqnekij5i8b5pr03ho849e6.apps.googleusercontent.com",
    client_secret: "j9iVZfS8kkCEFUPaAeJV0sAi",
  }),
}).then((r) => r.json());
if (!token.access_token) throw Error("Firebase sign-in expired. Run the login command again.");
const rules = (path) =>
  fetch("https://firebaserules.googleapis.com/v1/" + path, { headers: { authorization: "Bearer " + token.access_token } }).then(async (r) => {
    if (!r.ok) throw Error(`Rules API ${r.status}: ${await r.text()}`);
    return r.json();
  });

const release = await rules(`projects/${PROJECT}/releases/cloud.firestore`);
const ruleset = await rules(release.rulesetName);
let live = ruleset.source.files.map((f) => f.content).join("\n");
writeFileSync(resolve(root, "firestore.rules.backup"), live);

live = live.replace(/\n?[ \t]*\/\/ ---- Vexel[\s\S]*?\/\/ ---- end Vexel ----[^\n]*/, "");
const block = /match\s+\/databases\/\{database\}\/documents\s*\{/.exec(live);
if (!block) throw Error("Could not find the documents block in the live rules.");
let depth = 0, close = -1;
for (let i = block.index + block[0].length - 1; i < live.length; i++) {
  if (live.startsWith("//", i)) { i = live.indexOf("\n", i); if (i < 0) break; continue; }
  if (live[i] === "{") depth++;
  if (live[i] === "}" && --depth === 0) { close = i; break; }
}
if (close < 0) throw Error("Unbalanced braces in the live rules.");
const merged = live.slice(0, close).trimEnd() + "\n\n" + vexel + "\n  " + live.slice(close);
writeFileSync(resolve(root, "firestore.rules"), merged);
writeFileSync(resolve(root, "firebase.json"), JSON.stringify({ firestore: { rules: "firestore.rules" } }, null, 2) + "\n");
console.log(`Merged rules written to firestore.rules (live copy saved as firestore.rules.backup).`);
if (dryRun) process.exit(0);
execFileSync("npx", [...CLI, "deploy", "--only", "firestore:rules", "--project", PROJECT, "--non-interactive"], { cwd: root, stdio: "inherit" });
