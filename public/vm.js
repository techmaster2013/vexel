import {asset} from "./runtime.js";
export async function mountVM(main, { api, toast, download }) {
  const $ = (s) => main.querySelector(s);
  let emulator = null,
    disposed = false,
    paused = false,
    booting = false;
  main.innerHTML = `<div class="page-title"><div><span class="eyebrow">EXPERIMENTAL</span><h1>Alpine Linux</h1><p>An x86 virtual machine running in your browser with WebAssembly.</p></div></div><div class="panel"><div class="vm-config"><div><label for="vm-memory">Memory</label><select id="vm-memory"><option value="128">128 MB</option><option value="256">256 MB</option></select></div><div><label for="vm-iso">Boot image</label><select id="vm-iso"><option>Alpine Linux 3.24.3 · x86</option></select></div></div><p class="vm-notice">The VM loads a 49 MB boot image. It uses extra CPU and memory; it starts only when you press Start. Networking is disabled. Log in as root with no password.</p><div class="vm-controls"><button class="primary" id="vm-start" disabled>Checking files…</button><button id="vm-pause" disabled>Pause</button><button id="vm-restart" disabled>Restart</button><button id="vm-save" disabled>Export state</button><button id="vm-load" disabled>Import state</button><input type="file" id="vm-state" accept=".bin" hidden></div><p id="vm-status" class="status" role="status"></p><div id="vm-screen" class="vm-screen" tabindex="0" aria-label="Virtual machine screen. Click to send keyboard input."><div></div><canvas style="display:none"></canvas></div><p class="vm-notice">Click the screen to use your keyboard. Click outside it to release the keyboard. For mobile, send a line below.</p><form id="vm-command" class="vm-send"><input id="vm-text" placeholder="Text to send to the VM" aria-label="Text to send to the VM" autocomplete="off"><button disabled id="vm-send">Send Enter</button></form><p class="catalog-note">Powered by v86 (BSD-2-Clause), SeaBIOS firmware, and Alpine Linux. The guest system runs locally in your browser. Export/import requires the same emulator version, memory setting and boot image.</p></div>`;
  const config = await api("vm-config").catch(() => ({ ready: false }));
  if (disposed) return () => {};
  $("#vm-start").disabled = !config.ready;
  $("#vm-start").textContent = config.ready
    ? "Start VM"
    : "Image not installed";
  if (!config.ready)
    $("#vm-status").textContent =
      "The owner needs to prepare the Alpine boot image before this VM can start.";
  const setStatus = (s) => {
    if (!disposed && $("#vm-status")) $("#vm-status").textContent = s;
  };
  $("#vm-start").onclick = async () => {
    if (booting || emulator) return;
    booting = true;
    $("#vm-start").disabled = true;
    $("#vm-memory").disabled = true;
    setStatus("Loading emulator and boot image…");
    try {
      const { V86 } = await import(asset("vendor/v86/libv86.mjs"));
      if (disposed) return;
      emulator = new V86({
        wasm_path: asset("vendor/v86/v86.wasm"),
        memory_size: Number($("#vm-memory").value) * 1024 * 1024,
        vga_memory_size: 8 * 1024 * 1024,
        screen_container: $("#vm-screen"),
        bios: { url: asset("vendor/v86/seabios.bin") },
        vga_bios: { url: asset("vendor/v86/vgabios.bin") },
        cdrom: { url: asset("vendor/v86/alpine.iso"), async: false },
        autostart: true,
        disable_mouse: true,
        disable_keyboard: false,
        acpi: false,
        boot_order: 0x132,
      });
      emulator.keyboard_set_enabled(false);
      emulator.add_listener("emulator-ready", () => {
        if (disposed) return;
        setStatus("VM running. Wait for Alpine to boot, then log in as root.");
        for (const id of [
          "vm-pause",
          "vm-restart",
          "vm-save",
          "vm-load",
          "vm-send",
        ])
          $("#" + id).disabled = false;
      });
      emulator.add_listener("download-progress", (e) => {
        if (e.total)
          setStatus(
            "Loading VM files: " + Math.round((e.loaded / e.total) * 100) + "%",
          );
      });
      $("#vm-screen").onfocus = () => emulator?.keyboard_set_enabled(true);
      $("#vm-screen").onblur = () => emulator?.keyboard_set_enabled(false);
      $("#vm-screen").onclick = () => $("#vm-screen").focus();
    } catch (e) {
      setStatus("VM could not start: " + e.message);
      $("#vm-start").disabled = false;
      $("#vm-memory").disabled = false;
      await emulator?.destroy();
      emulator = null;
    } finally {
      booting = false;
    }
  };
  $("#vm-pause").onclick = async () => {
    if (!emulator) return;
    paused = !paused;
    await (paused ? emulator.stop() : emulator.run());
    $("#vm-pause").textContent = paused ? "Resume" : "Pause";
    setStatus(paused ? "VM paused." : "VM running.");
  };
  $("#vm-restart").onclick = () => {
    emulator?.restart();
    setStatus("Rebooting Alpine…");
  };
  $("#vm-command").onsubmit = (e) => {
    e.preventDefault();
    if (!emulator) return;
    emulator.keyboard_send_text($("#vm-text").value);
    emulator.keyboard_send_scancodes([0x1c, 0x9c]);
    $("#vm-text").value = "";
  };
  $("#vm-save").onclick = async () => {
    if (!emulator) return;
    try {
      setStatus("Saving VM state…");
      const state = await emulator.save_state();
      download(
        "vexel-alpine-" + $("#vm-memory").value + "mb.bin",
        state,
        "application/octet-stream",
      );
      setStatus("VM state exported.");
    } catch (e) {
      toast(e.message);
    }
  };
  $("#vm-load").onclick = () => $("#vm-state").click();
  $("#vm-state").onchange = async (e) => {
    const file = e.target.files[0];
    if (!file || !emulator) return;
    if (file.size > 400 * 1024 * 1024) return toast("State file is too large.");
    try {
      await emulator.stop();
      await emulator.restore_state(await file.arrayBuffer());
      await emulator.run();
      paused = false;
      $("#vm-pause").textContent = "Pause";
      setStatus("State restored.");
    } catch (e) {
      setStatus("State could not be restored: " + e.message);
    }
  };
  return () => {
    disposed = true;
    if (emulator) {
      emulator.keyboard_set_enabled(false);
      emulator.destroy().catch(() => {});
    }
    emulator = null;
  };
}
