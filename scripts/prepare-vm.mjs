import { readFile, writeFile, mkdir } from "node:fs/promises";
import { createHash } from "node:crypto";
const sources = JSON.parse(
  await readFile(new URL("./vm-sources.json", import.meta.url), "utf8"),
);
const dir = new URL("../public/vendor/v86/", import.meta.url);
await mkdir(dir, { recursive: true });
for (const item of [...sources.firmware, sources.image]) {
  const target = new URL(item.file, dir),
    hash = (b) => createHash("sha256").update(b).digest("hex");
  let existing;
  try {
    existing = await readFile(target);
  } catch {}
  if (existing && hash(existing) === item.sha256) {
    console.log(item.file + " verified");
    continue;
  }
  console.log("Downloading " + item.file + " from its pinned official source");
  const response = await fetch(item.url, {
    signal: AbortSignal.timeout(120000),
  });
  if (!response.ok) throw Error(item.file + ": HTTP " + response.status);
  const bytes = Buffer.from(await response.arrayBuffer());
  if (hash(bytes) !== item.sha256)
    throw Error("Checksum mismatch: " + item.file);
  await writeFile(target, bytes);
  console.log(item.file + " verified and saved");
}
