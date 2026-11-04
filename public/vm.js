import {asset,visitorWisp,DEFAULT_WISP} from "./runtime.js";
export async function mountVM(main, { api, toast, download }) {
  const $ = (s) => main.querySelector(s);
  let emulator = null,
    disposed = false,
    paused = false,
    booting = false;
  main.innerHTML = `<div class="page-title"><div><span class="eyebrow">EXPERIMENTAL</span><h1>Linux VM</h1><p>An x86 virtual machine running in your browser with WebAssembly.</p></div></div><div class="panel"><div class="vm-config"><div><label for="vm-memory">Memory</label><select id="vm-memory"><option value="64">64 MB</option><option value="128" selected>128 MB</option><option value="256">256 MB</option><option value="512">512 MB</option><option value="1024">1 GB</option><option value="2048">2 GB</option></select></div><div><label for="vm-network">Network</label><select id="vm-network"><option value="on">On (internet through Wisp)</option><option value="off">Off</option></select></div><div><label for="vm-iso">Boot image</label><select id="vm-iso"><option value="alpine">Alpine Linux 3.24.3 · x86 (text only)</option><option value="debian" disabled>Debian 12 + LXDE desktop (checking…)</option><option value="custom">Add your own ISO…</option></select><input type="file" id="vm-iso-file" accept=".iso,.img" hidden></div></div><p class="vm-notice"><span id="vm-hint"></span> The VM uses extra CPU and memory and starts only when you press Start. Bigger memory sizes need a computer with that much RAM to spare.</p><div class="vm-controls"><button class="primary" id="vm-start" disabled>Checking files…</button><button id="vm-pause" disabled>Pause</button><button id="vm-restart" disabled>Restart</button><button id="vm-net" disabled>Connect network</button><button id="vm-save" disabled>Export state</button><button id="vm-load" disabled>Import state</button><input type="file" id="vm-state" accept=".bin" hidden></div><p id="vm-status" class="status" role="status"></p><div id="vm-screen" class="vm-screen" tabindex="0" aria-label="Virtual machine screen. Click to send keyboard input."><div></div><canvas style="display:none"></canvas></div><p class="vm-notice">Click the screen to use your keyboard (and mouse, on desktops). Press Esc or click outside it to release them. For mobile, send a line below.</p><form id="vm-command" class="vm-send"><input id="vm-text" placeholder="Text to send to the VM" aria-label="Text to send to the VM" autocomplete="off"><button disabled id="vm-send">Send Enter</button></form><p class="catalog-note">Powered by v86 (BSD-2-Clause), SeaBIOS firmware, Alpine Linux and Debian. The guest system runs locally in your browser. Export/import requires the same emulator version, memory setting and boot image.</p></div>`;
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
  // Boot images. Debian is built by .github/workflows/debian-image.yml and published
  // as 2 MB chunks that v86 fetches only as the guest reads them (info.json has the size).
  let customFile = null,
    debian = null;
  const hints = {
    alpine: "Loads a 49 MB text-only system. Log in as root with no password, then press Connect network (or run <code>udhcpc -i eth0</code>) to get online.",
    debian: "Boots straight into an LXDE desktop and gets online by itself when Network is on. Loads only the parts it uses, but needs at least 1 GB of memory and takes a few minutes to start. The password is <code>live</code>.",
    custom: "Boots a 32-bit x86 ISO from your computer. It never leaves your browser.",
  };
  const showHint = () => {
    const id = $("#vm-iso").value;
    $("#vm-hint").innerHTML = id === "custom" && customFile ? "Boots <b>" + customFile.name.replace(/[&<>"']/g, "") + "</b> from your computer. It never leaves your browser." : hints[id];
  };
  showHint();
  let lastImage = "alpine";
  $("#vm-iso").onchange = () => {
    const id = $("#vm-iso").value;
    if (id === "custom" && !customFile) return $("#vm-iso-file").click();
    lastImage = id;
    // A desktop is unusable with less than 1 GB.
    if (id === "debian" && Number($("#vm-memory").value) < 1024) $("#vm-memory").value = "1024";
    showHint();
  };
  $("#vm-iso-file").onchange = (e) => {
    const file = e.target.files[0];
    if (!file) {
      $("#vm-iso").value = lastImage;
      return showHint();
    }
    customFile = file;
    lastImage = "custom";
    $("#vm-iso").querySelector('[value="custom"]').textContent = "Your ISO: " + file.name + " (change…)";
    $("#vm-iso").value = "custom";
    if (Number($("#vm-memory").value) < 512) $("#vm-memory").value = "512";
    showHint();
  };
  // Picking "Your ISO" again lets you choose a different file.
  $("#vm-iso").onclick = (e) => {
    if (e.detail === 0 && $("#vm-iso").value === "custom" && customFile) $("#vm-iso-file").click();
  };
  fetch(asset("vendor/v86/debian/info.json"), { cache: "no-cache" })
    .then((r) => (r.ok ? r.json() : null))
    .catch(() => null)
    .then((info) => {
      if (disposed) return;
      const option = $("#vm-iso").querySelector('[value="debian"]');
      debian = info?.size ? info : null;
      option.disabled = !debian;
      option.textContent = "Debian 12 + LXDE desktop" + (debian ? "" : " (not built yet)");
    });
  const bootImage = () => {
    const id = $("#vm-iso").value;
    if (id === "debian")
      return { cdrom: { url: asset("vendor/v86/debian/debian.iso"), size: debian.size, fixed_chunk_size: debian.chunk, use_parts: true, async: true }, desktop: true };
    if (id === "custom") return { cdrom: { buffer: customFile }, desktop: true };
    return { cdrom: { url: asset("vendor/v86/alpine.iso"), async: false }, desktop: false };
  };
  $("#vm-start").onclick = async () => {
    if (booting || emulator) return;
    booting = true;
    $("#vm-start").disabled = true;
    $("#vm-memory").disabled = true;
    $("#vm-network").disabled = true;
    $("#vm-iso").disabled = true;
    const image = bootImage();
    setStatus("Loading emulator and boot image…");
    try {
      const { V86 } = await import(asset("vendor/v86/libv86.mjs"));
      if (disposed) return;
      // v86's Wisp adapter gives the guest DHCP, DNS and TCP through the same Wisp
      // server Caver uses. It wants wisp:// / wisps:// instead of ws:// / wss://.
      let net = {};
      if ($("#vm-network").value === "on") {
        const proxy = await api("proxy-config").catch(() => ({}));
        const wisp = (visitorWisp() || proxy.wisp || DEFAULT_WISP).replace(/^ws(s?):\/\//, "wisp$1://");
        net = { net_device: { type: "virtio", relay_url: wisp } };
      }
      if (disposed) return;
      emulator = new V86({
        ...net,
        wasm_path: asset("vendor/v86/v86.wasm"),
        memory_size: Number($("#vm-memory").value) * 1024 * 1024,
        vga_memory_size: 8 * 1024 * 1024,
        screen_container: $("#vm-screen"),
        bios: { url: asset("vendor/v86/seabios.bin") },
        vga_bios: { url: asset("vendor/v86/vgabios.bin") },
        cdrom: image.cdrom,
        autostart: true,
        disable_mouse: !image.desktop,
        disable_keyboard: false,
        acpi: false,
        boot_order: 0x132,
      });
      emulator.keyboard_set_enabled(false);
      emulator.add_listener("emulator-ready", () => {
        if (disposed) return;
        setStatus(
          $("#vm-iso").value === "alpine"
            ? "VM running. Wait for Alpine to boot, then log in as root."
            : $("#vm-iso").value === "debian"
              ? "VM running. Debian takes a few minutes to reach the desktop."
              : "VM running your ISO.",
        );
        for (const id of [
          "vm-pause",
          "vm-restart",
          "vm-save",
          "vm-load",
          "vm-send",
        ])
          $("#" + id).disabled = false;
        // The button types Alpine's DHCP command; Debian connects by itself.
        $("#vm-net").disabled = !net.net_device || $("#vm-iso").value !== "alpine";
      });
      emulator.add_listener("download-progress", (e) => {
        if (e.total)
          setStatus(
            "Loading VM files: " + Math.round((e.loaded / e.total) * 100) + "%",
          );
      });
      $("#vm-screen").onfocus = () => emulator?.keyboard_set_enabled(true);
      $("#vm-screen").onblur = () => emulator?.keyboard_set_enabled(false);
      $("#vm-screen").onclick = () => {
        $("#vm-screen").focus();
        // Desktops need the mouse: capture it until Esc.
        if (image.desktop) emulator?.lock_mouse();
      };
    } catch (e) {
      // Big memory sizes fail here when the browser can't reserve that much RAM.
      setStatus(
        "VM could not start: " +
          (e instanceof RangeError ? "not enough free memory for " + $("#vm-memory").selectedOptions[0].text + ". Try a smaller size." : e.message),
      );
      $("#vm-start").disabled = false;
      $("#vm-memory").disabled = false;
      $("#vm-network").disabled = false;
      $("#vm-iso").disabled = false;
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
    setStatus("Rebooting…");
  };
  // Alpine's live image doesn't configure the network itself; type the DHCP command.
  $("#vm-net").onclick = () => {
    if (!emulator) return;
    emulator.keyboard_send_text("ip link set eth0 up && udhcpc -i eth0");
    emulator.keyboard_send_scancodes([0x1c, 0x9c]);
    setStatus("Asking for a network address… Try ping -c 3 example.com once it says lease obtained.");
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
        "vexel-" + $("#vm-iso").value + "-" + $("#vm-memory").value + "mb.bin",
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
    // A saved state holds the whole guest RAM, so allow up to the chosen size plus room for the rest.
    if (file.size > (Number($("#vm-memory").value) + 256) * 1024 * 1024) return toast("State file is too large for this memory size.");
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
