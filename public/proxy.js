import {api,asset} from "./runtime.js";
let controller, frame, starting;
const load = (src) =>
  new Promise((ok, no) => {
    const s = document.createElement("script");
    s.src = src;
    s.onload = ok;
    s.onerror = () =>
      no(Error("Caver assets could not load. Please reload or contact the site owner."));
    document.head.append(s);
  });
export function normalize(value) {
  const s = value.trim();
  if (!s) throw Error("Enter a website or search.");
  if (/^[a-z][a-z0-9+.-]*:/i.test(s) && !/^https?:/i.test(s))
    throw Error("Use an HTTP or HTTPS address.");
  const url = new URL(
    /^https?:\/\//i.test(s)
      ? s
      : /^[\w.-]+\.[a-z]{2,}(?:[/:]|$)/i.test(s)
        ? "https://" + s
        : "https://www.bing.com/search?q=" + encodeURIComponent(s),
  );
  return url.href;
}
async function start() {
  if (controller) return controller;
  if (starting) return starting;
  starting = (async () => {
    const config = await api("proxy-config");
    if (!config.wisp)
      throw Error(
        "The proxy needs a Wisp server configured by the site owner.",
      );
    await load(asset("vendor/scramjet/scramjet.js"));
    await load(asset("vendor/controller/controller.api.js"));
    const reg = await navigator.serviceWorker.register(asset("sw.js"), {
      scope: new URL(".",import.meta.url).pathname,
    });
    await navigator.serviceWorker.ready;
    if (!navigator.serviceWorker.controller)
      await Promise.race([
        new Promise((r) =>
          navigator.serviceWorker.addEventListener("controllerchange", r, {
            once: true,
          }),
        ),
        new Promise((_, reject) =>
          setTimeout(
            () =>
              reject(Error("Proxy worker did not start. Reload and retry.")),
            10000,
          ),
        ),
      ]);
    const { default: Client } = await import(asset("vendor/libcurl/index.mjs"));
    const transport = new Client({ wisp: config.wisp });
    await transport.init?.();
    const c = new $scramjetController.Controller({
      serviceworker: navigator.serviceWorker.controller || reg.active,
      transport,
      config: {
        prefix: new URL("~/sj/",import.meta.url).pathname,
        scramjetPath: asset("vendor/scramjet/scramjet.js"),
        injectPath: asset("vendor/controller/controller.inject.js"),
        wasmPath: asset("vendor/scramjet/scramjet.wasm"),
      },
      scramjetConfig: $scramjet.defaultConfigDev || {},
    });
    await c.wait();
    controller = c;
    return c;
  })().catch((e) => {
    starting = null;
    throw e;
  });
  return starting;
}
export async function navigate(value, view) {
  const url = normalize(value),
    c = await start();
  frame?.element.remove();
  frame = c.createFrame();
  frame.element.className = "player-frame";
  frame.element.title = "Vexel browser";
  view.replaceChildren(frame.element);
  frame.go(url);
  return url;
}
export function control(action) {
  frame?.[action]?.();
}
export function destroy() {
  frame?.element.remove();
  frame = null;
}
