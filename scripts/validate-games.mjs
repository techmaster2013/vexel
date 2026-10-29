import { readFile, stat } from "node:fs/promises";
import { resolve } from "node:path";
// Catalog paths such as /games/snake.html and /games/covers/x.svg are relative to the repo root.
const root = resolve(import.meta.dirname, ".."),
  manifest = JSON.parse(await readFile(resolve(root, "games/manifest.json"), "utf8"));
const ids = new Set();
const https = (value, id) => {
  if (new URL(value).protocol !== "https:") throw Error("HTTPS required: " + id);
};
for (const g of manifest) {
  if (!g.id || ids.has(g.id)) throw Error("Missing or duplicate ID: " + g.id);
  ids.add(g.id);
  if (typeof g.title !== "string" || typeof g.category !== "string")
    throw Error("Missing metadata: " + g.id);
  // One schema: every way to play a game lives in `sources` (see scripts/import-games.py).
  for (const key of ["path", "launchUrl", "remoteUrl", "proxyTarget", "launchViaCaver", "openExternally"])
    if (key in g) throw Error(`Legacy field ${key} on ${g.id}; use sources instead.`);
  if (!Array.isArray(g.sources)) throw Error("Missing sources list: " + g.id);
  if (!g.sources.length) throw Error("No way to play this game; remove it: " + g.id);
  for (const source of g.sources) {
    if (source.startsWith("/")) {
      const file = resolve(root, "." + source);
      if (!file.startsWith(root + "/games/") || !(await stat(file)).isFile())
        throw Error("Invalid payload path: " + g.id);
      if (!g.license) throw Error("License required: " + g.id);
    } else if (source.startsWith("gh:")) {
      if (!/^gh:[\w.-]+\/(?!.*(?:^|\/)\.\.?(?:\/|$))[^?#]+(?:\?own)?$/.test(source))
        throw Error("Invalid mirror source: " + g.id);
    } else https(source.replace(/^caver:/, ""), g.id);
  }
  if (g.cover) {
    const file = resolve(root, "." + g.cover);
    if (!file.startsWith(root + "/games/covers/") || !(await stat(file)).isFile())
      throw Error("Invalid cover: " + g.id);
  }
}
console.log(`${manifest.length} games validated.`);
