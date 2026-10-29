// Turns the single-file EaglercraftX build (mc.html, ~75 MB of base64) into a folder of
// cacheable files with a fast loading screen:
//   node scripts/pack-minecraft.mjs ~/Downloads/mc.html games/minecraft-26-2
// The Wasm files stay Brotli-compressed (half the size of gzip; the full client is over
// GitHub's 100 MB file limit uncompressed) and are decompressed while they download,
// straight into WebAssembly.compileStreaming. Nothing is base64-decoded any more.
import { readFileSync, writeFileSync, mkdirSync, rmSync } from "node:fs";
import { createHash } from "node:crypto";
import { join } from "node:path";
import vm from "node:vm";

const [input, outDir] = process.argv.slice(2);
if (!input || !outDir) throw Error("usage: node scripts/pack-minecraft.mjs mc.html OUTPUT_DIR");
let html = readFileSync(input, "utf8");
rmSync(outDir, { recursive: true, force: true });
mkdirSync(outDir, { recursive: true });

const files = {
  "eag-inline-decoder": "brotli-decoder.wasm",
  "eag-inline-wasm-br": "classes.wasm.br",
  "eag-inline-mesh-wasm-br": "mesh-worker.wasm.br",
  "eag-inline-server-wasm-br": "server-worker.wasm.br",
  "eag-inline-assets": "assets.epk",
  "eag-inline-sounds": "sounds.epk",
};
const sizes = {};
html = html.replace(/<script type="application\/octet-stream" id="([^"]+)" data-size="(\d+)">([\s\S]*?)<\/script>\n?/g, (_, id, size, body) => {
  const bytes = Buffer.from(body.replace(/\s+/g, ""), "base64");
  if (!files[id] || bytes.length !== Number(size)) throw Error("unexpected payload " + id);
  writeFileSync(join(outDir, files[id]), bytes);
  sizes[files[id]] = bytes.length;
  return "";
});
const version = createHash("sha256").update(Object.values(sizes).join(",")).digest("hex").slice(0, 12);

// The inline shim: replaced by the loader below.
const shimStart = html.indexOf('<script type="text/javascript">\n(function () {\n  "use strict";\n  var originalFetch = window.fetch.bind(window);');
const shimEnd = html.indexOf("</script>", shimStart) + "</script>".length;
if (shimStart < 0) throw Error("inline payload shim not found");
const shim = html.slice(shimStart, shimEnd);
// Its worker runtime (TeaVM + bootstrap) becomes worker-bootstrap.js, which the page
// already falls back to when no inline worker blob is provided.
const workerParts = shim.match(/__eaglerInlineWorkerBlobURL = URL\.createObjectURL\(new Blob\(\[\n([\s\S]*?)\n  \], \{ type: "text\/javascript" \}\)\);/);
if (!workerParts) throw Error("worker runtime not found");
writeFileSync(join(outDir, "worker-bootstrap.js"), vm.runInNewContext("[" + workerParts[1] + "].join('')", Object.create(null)));

const download = (name, wasm) => ({ url: `${name}?v=${version}`, size: sizes[name], wasm });
const manifest = {
  "classes.wasm": download("classes.wasm.br", true),
  "mesh-worker.wasm": download("mesh-worker.wasm.br", true),
  "server-worker.wasm": download("server-worker.wasm.br", true),
  "assets.epk": download("assets.epk", false),
  "sounds.epk": download("sounds.epk", false),
};
const loader = `<script type="text/javascript">
// Vexel loader. Every game file downloads in parallel as soon as the page opens. Wasm is
// Brotli-decompressed while it streams and handed to WebAssembly.compileStreaming; the
// asset packs are kept in memory until the game asks for them. The browser caches all of
// it, so later launches skip the download.
(function () {
  "use strict";
  var FILES = ${JSON.stringify(manifest)};
  var DECODER = "brotli-decoder.wasm?v=${version}";
  var originalFetch = window.fetch.bind(window);
  var total = 0, received = Object.create(null), shown = 0, failed = false;
  for (var name in FILES) total += FILES[name].size;
  function sum() { var n = 0; for (var k in received) n += received[k]; return n; }
  function paint(pct, text) {
    shown = Math.max(shown, pct);
    var bar = document.getElementById("mc_bar"), status = document.getElementById("boot_status");
    if (bar) bar.style.width = shown + "%";
    if (status && text) status.textContent = text;
  }
  function progress() {
    if (failed) return;
    var got = sum(), mb = 1048576;
    paint(Math.floor(60 * got / total), got >= total ? "Preparing the game\\u2026"
      : "Downloading Minecraft\\u2026 " + (got / mb).toFixed(1) + " / " + (total / mb).toFixed(1) + " MB");
  }
  window.__mcProgress = function (pct) { if (typeof pct === "number") paint(Math.min(100, pct)); };
  function fail(what, error) {
    failed = true;
    paint(shown, "Couldn\\u2019t load " + what + ". Check your connection, then reload.");
    var screen = document.getElementById("loading_screen");
    if (screen) screen.classList.add("mc-failed");
    console.error("[vexel] " + what + ": " + error);
  }
  function stream(name) {
    var file = FILES[name];
    return originalFetch(file.url).then(function (response) {
      if (!response.ok || !response.body) throw Error("HTTP " + response.status);
      var reader = response.body.getReader(), got = 0;
      return new ReadableStream({
        pull: function (controller) {
          return reader.read().then(function (part) {
            if (part.done) { received[name] = file.size; progress(); controller.close(); return; }
            got += part.value.byteLength; received[name] = got; progress();
            controller.enqueue(part.value);
          });
        },
        cancel: function (reason) { return reader.cancel(reason); }
      });
    });
  }
  var decoder = WebAssembly.compileStreaming(originalFetch(DECODER)).catch(function () {
    return originalFetch(DECODER).then(function (r) { return r.arrayBuffer(); }).then(function (b) { return WebAssembly.compile(b); });
  }).then(function (module) { window.__eagBrotli.initSync({ module: module }); });
  function unbrotli(input) {
    var codes = { success: 1, needsInput: 2, needsOutput: 3 };
    var dec = new window.__eagBrotli.DecompressStream();
    return input.pipeThrough(new TransformStream({
      transform: function (chunk, controller) {
        var offset = 0, code;
        do {
          var result = dec.decompress(chunk.subarray(offset), 1 << 20), out = result.buf;
          if (out.length) controller.enqueue(out);
          offset += result.input_offset;
          code = result.code;
          result.free();
        } while (code === codes.needsOutput);
        if (code !== codes.needsInput && code !== codes.success) throw Error("Brotli error " + code);
      },
      flush: function () { dec.free(); }
    }));
  }
  function wasm(name) {
    return Promise.all([stream(name), decoder]).then(function (ready) {
      return new Response(unbrotli(ready[0]), { status: 200, headers: { "Content-Type": "application/wasm" } });
    });
  }
  function pack(name) {
    return stream(name).then(function (s) { return new Response(s).arrayBuffer(); });
  }
  // Start everything now; the game's own fetch() calls pick these up.
  var early = Object.create(null);
  for (var key in FILES) {
    early[key] = (FILES[key].wasm ? wasm : pack)(key);
    early[key].catch(fail.bind(null, key));
  }
  window.fetch = function (input, init) {
    var url = typeof input === "string" ? input : (input && input.url) || String(input);
    var name = url.split(/[?#]/)[0].split("/").pop();
    if (!FILES[name]) return originalFetch(input, init);
    var pending = early[name];
    delete early[name];
    if (!pending) return FILES[name].wasm ? wasm(name) : pack(name).then(function (b) { return new Response(b); });
    return pending.then(function (result) { return result instanceof Response ? result : new Response(result, { status: 200 }); });
  };
  // Hooks the boot script calls. Asset URLs become absolute so the server worker, which
  // runs from worker-bootstrap.js, reads the same cached files.
  window.__eagPrepareInlineAssets = function () {
    var entries = window.eaglercraftXOpts && window.eaglercraftXOpts.assetsURI;
    if (!Array.isArray(entries)) return;
    for (var i = 0; i < entries.length; ++i) {
      var file = String(entries[i].url || "").split(/[?#]/)[0];
      if (FILES[file]) entries[i].url = new URL(FILES[file].url, location.href).href;
    }
  };
  window.__eagReleaseInlineWasm = function () {};
  window.__eaglerInlinePayloadCacheBytes = 0;
})();
</script>`;
html = html.slice(0, shimStart) + loader + html.slice(shimEnd);

const edits = [
  // Expose the decoder's streaming API.
  ["window.__eagBrotli={initSync:h,decompress:decompress};", "window.__eagBrotli={initSync:h,decompress:decompress,DecompressStream:DecompressStream};"],
  ["<title>zzCraft (26.2) by h_z13</title>", "<title>Minecraft 26.2</title>"],
  ["zzCraft requires landscape mode (horizontal).", "Minecraft needs landscape mode (horizontal)."],
  // The EPKs come from the loader's buffers, so the game's own "download" is unpacking.
  ['window.__eaglerBoot(pct, "Downloading assets… "', 'window.__eaglerBoot(pct, "Unpacking assets… "'],
  ["if (st && text) { st.textContent = text; }", "if (st && text) { st.textContent = text; }\n\t\t\t\tif (window.__mcProgress) window.__mcProgress(pct);"],
  ["\t\t#boot_image {", `\t\t#loading_screen { background: radial-gradient(ellipse at 50% 30%, #2b3a1f 0%, #141a10 55%, #0b0d09 100%) !important; color: #e8e8e8; }
		.mc-card { display: flex; flex-direction: column; align-items: center; gap: 14px; width: min(86vw, 460px); text-align: center; }
		.mc-title { font: 900 clamp(34px, 8vw, 58px)/1 ui-monospace, "Cascadia Mono", "DejaVu Sans Mono", monospace; letter-spacing: .12em; color: #d9d9d9; text-shadow: 4px 4px 0 #3c3c3c; }
		.mc-version { margin-top: -6px; font: 700 13px/1 ui-monospace, monospace; letter-spacing: .3em; color: #ffd84a; text-shadow: 2px 2px 0 #3f3300; }
		.mc-track { width: 100%; height: 18px; margin-top: 18px; box-sizing: border-box; border: 2px solid #000; background: #3b3b3b; box-shadow: inset 0 0 0 2px #6b6b6b; }
		#mc_bar { width: 0; height: 100%; background: linear-gradient(#7fd14a 0 45%, #5aa02c 45% 100%); transition: width 200ms linear; }
		#loading_screen #boot_status { position: static; color: #cfcfcf; min-height: 2.7em; }
		.mc-hint { font: 12px/1.5 ui-monospace, monospace; color: #8b937f; }
		#loading_screen.mc-failed #mc_bar { background: #c33; }
		#loading_screen.minecraft-stage .mc-card > :not(#mojang_stage) { display: none; }
		#boot_image {`],
];
for (const [from, to] of edits) {
  if (html.split(from).length !== 2) throw Error("expected exactly one: " + from.slice(0, 50));
  html = html.replace(from, () => to);
}
const screen = html.match(/<div id="loading_screen" style="[^"]*">[\s\S]*?<div id="boot_status">[^<]*<\/div>\n\t\t\t<\/div>\n\t\t<\/div>/);
if (!screen) throw Error("loading screen not found");
html = html.replace(screen[0], () => `<div id="loading_screen" style="margin:0px;position:fixed;top:0;left:0;right:0;bottom:0;z-index:2147483646;display:flex;align-items:center;justify-content:center;user-select:none;-webkit-user-select:none;">
		<div class="mc-card" role="status" aria-live="polite">
			<div class="mc-title">MINECRAFT</div>
			<div class="mc-version">26.2</div>
			<div class="mc-track" aria-hidden="true"><div id="mc_bar"></div></div>
			<div id="boot_status">Starting…</div>
			<div class="mc-hint">The first launch downloads about ${Math.round(Object.values(sizes).reduce((a, b) => a + b, 0) / 1048576)} MB. After that, Minecraft opens from your browser’s cache.</div>
			<div id="mojang_stage" aria-hidden="true"><span class="half left"></span><span class="half right"></span></div>
		</div>
	</div>`);
writeFileSync(join(outDir, "index.html"), html);
for (const [name, size] of Object.entries(sizes)) console.log(name.padEnd(24), (size / 1048576).toFixed(1), "MB");
console.log("index.html".padEnd(24), (Buffer.byteLength(html) / 1048576).toFixed(2), "MB");
