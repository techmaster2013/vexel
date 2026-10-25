import { mkdir, cp, readFile, writeFile } from "node:fs/promises";
const output = new URL("../public/vendor/", import.meta.url);
await mkdir(output, { recursive: true });
for (const [pkg, dir] of [
  ["scramjet", "scramjet"],
  ["scramjet-controller", "controller"],
  ["libcurl-transport", "libcurl"],
]) {
  const root = new URL(
    `../node_modules/@mercuryworkshop/${pkg}/`,
    import.meta.url,
  );
  const data = JSON.parse(await readFile(new URL("package.json", root)));
  console.log(`Preparing ${pkg} ${data.version}`);
  // Preserve sibling files used by dynamic imports / wasm loaders.
  await cp(new URL("dist/", root), new URL(dir + "/", output), {
    recursive: true,
  });
}
const sw = await readFile(
  new URL("controller/controller.sw.js", output),
  "utf8",
);
await writeFile(
  new URL("../public/sw.js", import.meta.url),
  sw +
    `\nself.addEventListener('install',()=>self.skipWaiting());\nself.addEventListener('activate',e=>e.waitUntil(clients.claim()));\nself.addEventListener('fetch',e=>{if($scramjetController.shouldRoute(e))e.respondWith($scramjetController.route(e));});\n`,
);
await cp(
  new URL(
    "../node_modules/@mercuryworkshop/libcurl-transport/LICENSE",
    import.meta.url,
  ),
  new URL("AGPL-LICENSE.txt", output),
);
console.log("Vexel is ready. Run npm start.");
const v86Root = new URL("../node_modules/v86/", import.meta.url);
await mkdir(new URL("v86/", output), { recursive: true });
for (const file of ["libv86.mjs", "v86.wasm", "v86-fallback.wasm"])
  await cp(new URL("build/" + file, v86Root), new URL("v86/" + file, output));
await cp(new URL("LICENSE", v86Root), new URL("v86/LICENSE.txt", output));
