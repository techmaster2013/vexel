import {api,asset,gameAsset,staticMode,providerSignIn} from "./runtime.js";
import { applets, toys, movies } from "./catalog.js";
import * as proxy from "./proxy.js";
import {watchExternalGame} from "./blocked-games.js";
import { mountVM } from "./vm.js";
const $ = (s) => document.querySelector(s),
  main = $("#main"),
  dialog = $("#modal");
const esc = (s) =>
  String(s ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
let config = {},
  user = null,
  games = [],
  route = "home",
  chatRoom = "general",
  playing = false,
  cleanup = () => {},
  syncTimer,
  libraryFilter = "All",
  libraryQuery = "",
  pendingProxy = "",
  pageAnimation = null;
let prefs;
try {
  prefs = JSON.parse(localStorage.getItem("vexel.preferences") || "{}");
} catch {
  prefs = {};
}
const nav = [
  [
    "EXPLORE",
    [
      ["home", "⌂", "Home"],
      ["games", "◇", "Games"],
      ["apps", "▦", "Caver & apps"],
      ["media", "▷", "Movies & shows"],
      ["manga", "▤", "Manga reader"],
    ],
  ],
  [
    "COMMUNITY",
    [
      ["social", "◉", "Chatroom"],
      ["tools", "⚒", "Tools & toys"],
      ["vm", "▣", "Linux VM"],
      ["shop", "◈", "Customization shop"],
    ],
  ],
  [
    "SETTINGS",
    [
      ["request", "↗", "Requests"],
      ["settings", "⚙", "Settings"],
      ["account", "☺", "Account"],
    ],
  ],
];
$("#nav").innerHTML = nav
  .map(
    ([label, links]) =>
      `<div class="nav-label">${label}</div>${links.map(([id, g, t]) => `<a href="#${id}" data-route="${id}"><span class="glyph">${g}</span>${t}</a>`).join("")}`,
  )
  .join("");
function toast(message) {
  $("#toast").textContent = message;
  $("#toast").classList.add("show");
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => $("#toast").classList.remove("show"), 5000);
}
function save() {
  if (!["navy", ...(user?.owned || [])].includes(prefs.theme || "navy"))
    prefs.theme = "navy";
  localStorage.setItem("vexel.preferences", JSON.stringify(prefs));
  apply();
  if (user) {
    clearTimeout(syncTimer);
    syncTimer = setTimeout(
      () =>
        api("preferences", { preferences: prefs }).catch((e) =>
          toast(e.message),
        ),
      500,
    );
  }
}
function liteMode(){
 if(typeof prefs.lite==='boolean')return prefs.lite;
 return Boolean((navigator.deviceMemory&&navigator.deviceMemory<=2)||(navigator.hardwareConcurrency&&navigator.hardwareConcurrency<=2));
}
function apply() {
  document.body.style.setProperty(
    "--glass-blur",
    8 +
      Math.min(100, Math.max(0, Number(prefs.glass ?? 60) || 0)) * 0.32 +
      "px",
  );
  document.body.style.setProperty(
    "--glass-fill",
    String(
      0.04 +
        Math.min(100, Math.max(0, Number(prefs.glass ?? 60) || 0)) * 0.0015,
    ),
  );
  document.body.style.setProperty(
    "--card-radius",
    Math.min(24, Math.max(0, Number(prefs.roundness ?? 13) || 0)) + "px",
  );
  document.body.dataset.theme = prefs.theme || "navy";
  document.body.dataset.wallpaper = prefs.wallpaper || "still";
  document.body.classList.toggle("compact", Boolean(prefs.compact));
  document.body.classList.toggle("lite", liteMode());
  document.body.classList.toggle("reduce", prefs.motion === false);
  document.title =
    typeof prefs.title === "string" && prefs.title.trim()
      ? prefs.title
      : "Vexel";
}
function identity() {
  $("#identity").innerHTML = user
    ? `${esc(user.username)}<small>Signed in · no ads</small>`
    : (staticMode ? "Guest<small>Account options</small>" : "Guest<small>Sign in to sync your data</small>");
  $("#avatar").textContent = user?.username[0].toUpperCase() || "V";
  $("#balance").textContent = "◈ " + (user?.unlimitedCoins ? "∞" : (user?.coins || 0));
}
function title(kicker, name, desc, action = "") {
  return `<div class="page-title"><div><span class="eyebrow">${kicker}</span><h1>${name}</h1><p>${desc}</p></div>${action}</div>`;
}
function section(name, sub, action = "") {
  return `<div class="section-head"><div><h2>${name}</h2>${sub ? `<p>${sub}</p>` : ""}</div>${action}</div>`;
}
function canLaunch(g) {
  return Boolean(g.path || g.remoteUrl || g.launchUrl);
}
function card(g) {
  return `<button class="game-card" data-game="${esc(g.id)}" aria-label="Preview ${esc(g.title)}"><div class="cover" style="--cover:${esc(g.color || "#12264a")}">${g.cover ? `<img src="${esc(gameAsset(g.cover))}" alt="" loading="lazy">` : `<div class="cover-pattern" data-kind="${esc(g.category)}"><span>${esc(g.title)}</span></div>`}<span class="tag">${esc(g.category)}</span><span class="play-indicator">${canLaunch(g) ? "▷" : "+"}</span></div><div class="card-meta"><strong>${esc(g.title)}</strong><div class="card-details"><span>${esc(g.status || "Installed")}</span><span class="favorite-indicator">${prefs.favorites?.includes(g.id) ? "♥" : "♡"}</span></div></div></button>`;
}
function grid(items) {
  return items.length
    ? `<div class="grid">${items.map(card).join("")}</div>`
    : '<div class="empty">No matching games.</div>';
}
function ad() {
  return user
    ? ""
    : `<div class="ad"><div>Guest ad placement. Signed-in accounts do not see ads.</div><span>AD SPACE · NOT CONNECTED</span></div>`;
}
function open(html) {
  $("#modal-body").innerHTML = html;
  if (!dialog.open) dialog.showModal();
}
$(".close").onclick = () => dialog.close();
dialog.addEventListener("click", (e) => {
  if (e.target === dialog) dialog.close();
});
$(".skip").onclick = (e) => {
  e.preventDefault();
  main.focus();
};
$("#menu").onclick = () => document.body.classList.toggle("menu-open");
$("#updates").onclick = updates;
function updates() {
  open(
    `<span class="eyebrow">VERSION 0.5</span><h2>Changelog</h2><ul class="change-list"><li>GitHub Pages support, expanded game catalog, MMG and licensed game imports.</li><li>Your logo, Silkscreen, and a dedicated home screen.</li><li>Lightweight page transitions and Caver block-page recovery.</li><li>Navy and black interface with translucent panels.</li><li>Game library, category sidebar, search and sorting.</li><li>GamePlaza catalog and requested titles.</li><li>Game previews, favorites, accounts and chat.</li><li>Built-in browser transport and an Alpine VM launcher.</li></ul><p class="catalog-note">Unavailable titles are labeled. Google, Microsoft, and Discord sign-in require deployment credentials. Remote games are served by their source hosts.</p><button class="primary" id="enter">Close</button>`,
  );
  $("#enter").onclick = () => dialog.close();
}
$("#credits").onclick = () =>
  open(
    `<h2>Credits</h2><p>Vexel combines the game library, browser, tools, and community features developed across GamePlaza, coreHZ, GPT Corner, nexSite, nexite, and StreamPlaza. Layout inspired by Barnical.</p><p>Proxy: <a href="https://github.com/MercuryWorkshop/scramjet" target="_blank" rel="noopener">MercuryWorkshop Scramjet 2 (AGPL-3.0)</a> and <a href="https://github.com/MercuryWorkshop/CurlTransport" target="_blank" rel="noopener">libcurl transport (AGPL-3.0)</a>. Unmodified runtime packages are installed from the pinned dependency lockfile. Open movie credits and licenses appear beside each player. Font: Silkscreen, bundled under the SIL Open Font License. Alpine VM: v86 (BSD-2-Clause), SeaBIOS, and Alpine Linux. Built-in transport: wisp-js (LGPL-3.0-or-later).</p><p>Logo: supplied by Vexel’s owner. Original game payloads live in vex-games.</p><p>Vexel is GPL-3.0, with no warranty. Third-party components retain their licenses.</p><a class="pill" href="https://github.com/techmaster2013/vexel" target="_blank" rel="noopener">Source & research notes ↗</a>`,
  );
function bindCards() {
  main
    .querySelectorAll("[data-game]")
    .forEach((b) => (b.onclick = () => preview(b.dataset.game)));
}
function preview(id) {
 const g=games.find(x=>x.id===id);if(!g)return;
 const favorite=prefs.favorites?.includes(id),source=g.remoteUrl||g.launchUrl;
 const playControl=g.openExternally&&source?`<a class="pill primary" id="play" href="${esc(source)}" target="_blank" rel="noopener">Play on creator site ↗</a>`:g.path||source?'<button class="primary" id="play">Play</button>':'<span class="muted">Not available yet</span>';
 open(`<div class="cover preview-cover" style="--cover:${esc(g.color||'#12264a')}">${g.cover?`<img src="${esc(gameAsset(g.cover))}" alt="">`:`<div class="cover-pattern"><span>${esc(g.title)}</span></div>`}</div><div class="detail"><span class="badge">${esc(g.category)} · ${esc(g.status||'Installed')}</span><h2>${esc(g.title)}</h2><p>${esc(g.description||'')}</p>${g.controls?`<p><small>${esc(g.controls)}</small></p>`:''}<div class="actions">${playControl}<button id="favorite">${favorite?'♥ Saved':'♡ Favorite'}</button>${source?`<a class="pill" href="${esc(source)}" target="_blank" rel="noopener">Open source ↗</a>`:''}</div>${!canLaunch(g)?`<p class="catalog-note">${esc(g.unavailableReason||'A working game source has not been connected.')}</p>`:''}</div>`);
 $('#favorite').onclick=()=>{prefs.favorites=favorite?(prefs.favorites||[]).filter(x=>x!==id):[...(prefs.favorites||[]),id];save();preview(id);};
 if(g.openExternally&&source)$('#play').onclick=()=>{prefs.recent=[g.id,...(prefs.recent||[]).filter(x=>x!==g.id)].slice(0,12);save();dialog.close();};
 else if(g.path||source)$('#play').onclick=()=>{dialog.close();play(g);};
}
function openInCaver(originalUrl){pendingProxy=originalUrl;if(location.hash==='#apps')render();else location.hash='apps';}
function play(g){
 const externalSource=g.remoteUrl||g.launchUrl;
 if(externalSource){const target=new URL(externalSource);if(target.protocol!=='https:'||target.origin===location.origin)return toast('Remote games require a separate HTTPS origin.');}
 if(g.openExternally&&externalSource){window.open(externalSource,'_blank','noopener');return;}
 cleanup();playing=true;
 prefs.recent=[g.id,...(prefs.recent||[]).filter(x=>x!==g.id)].slice(0,12);save();
 const originalUrl=externalSource||(config.gameOrigin||asset('content'))+g.path;
 const external=new URL(originalUrl,location.href).origin!==location.origin;
 main.innerHTML=`<div class="player-toolbar"><div><span class="eyebrow">NOW PLAYING</span><h2>${esc(g.title)}</h2></div><div class="actions"><button id="back-games">← Games</button>${external?'<button id="caver-game">Caver ↗</button>':''}<button id="full">⛶ Fullscreen</button></div></div><div id="game-view"><iframe id="game-frame" class="player-frame" sandbox="allow-scripts allow-pointer-lock" allow="fullscreen; gamepad" title="${esc(g.title)}"></iframe></div><p class="player-status">${esc(g.controls||'')}${g.license?' · '+esc(g.license):''}</p>`;
 const frame=$('#game-frame');let stopWatching=()=>{};
 if(external){frame.setAttribute('sandbox','allow-scripts allow-same-origin allow-pointer-lock allow-downloads');stopWatching=watchExternalGame({frame,container:$('#game-view'),originalUrl,gameId:g.id,onOpenCaver:openInCaver});$('#caver-game').onclick=()=>openInCaver(originalUrl);}
 frame.src=originalUrl;
 $('#back-games').onclick=()=>render();$('#full').onclick=()=>$('#game-view').requestFullscreen?.().catch(()=>toast('Fullscreen unavailable.'));
 cleanup=()=>{playing=false;stopWatching();};animatePage();
}
function home() {
  const installed = games.filter((g) => g.path),
    recent = (prefs.recent || [])
      .map((id) => games.find((g) => g.id === id))
      .filter(Boolean)
      .slice(0, 4),
    favorites = (prefs.favorites || [])
      .map((id) => games.find((g) => g.id === id))
      .filter(Boolean)
      .slice(0, 4);
  main.innerHTML =
    `<section class="home-hero panel"><div class="home-heading"><div><span class="eyebrow">HOME</span><h1><img class="home-logo" src="./vexel-logo.png" alt="Vexel" width="470" height="175"></h1><p>Games. Apps. Media. Tools.</p></div><span class="home-version">0.5</span></div><form id="home-search" class="home-search"><input id="home-query" type="search" placeholder="Search games or enter a URL" aria-label="Search games or enter a URL"><button class="primary" type="submit">Search →</button></form><div class="home-actions"><a href="#games" class="pill">Browse games ↗</a><a href="#apps" class="pill">Open Caver ↗</a><button id="home-random">Random game</button></div><div class="home-stats"><span>${installed.length} installed games</span><span>${games.length} catalog entries</span><span>${user ? "Signed in · no ads" : "Guest session"}</span></div></section><section class="home-apps">${applets
      .slice(0, 6)
      .map(
        ([name, mark, url]) =>
          `<button data-home-app="${url}" class="app-shortcut"><span>${mark}</span>${name}</button>`,
      )
      .join("")}</section>` +
    `<div class="home-shortcuts"><a class="quick" href="#media"><span class="quick-icon">▷</span><span><strong>Movies & shows</strong><small>Catalog and local video</small></span><span class="arrow">↗</span></a><a class="quick" href="#social"><span class="quick-icon">◉</span><span><strong>Chatroom</strong><small>General, games, creative</small></span><span class="arrow">↗</span></a><a class="quick" href="#tools"><span class="quick-icon">♫</span><span><strong>Tools & music</strong><small>Soundboard, player, notes</small></span><span class="arrow">↗</span></a><a class="quick" href="#vm"><span class="quick-icon">▣</span><span><strong>Linux VM</strong><small>Alpine in WebAssembly</small></span><span class="arrow">↗</span></a></div>` +
    (recent.length && prefs.homeRecent !== false
      ? section(
          "Recently played",
          "",
          '<a class="link" href="#games">Games →</a>',
        ) + `<div class="recent-grid">${recent.map(card).join("")}</div>`
      : "") +
    section(
      "Installed games",
      "",
      '<a class="link" href="#games">View library →</a>',
    ) +
    grid(installed.slice(0, 6)) +
    (favorites.length && prefs.homeFavorites !== false
      ? section("Favorites", "") +
        `<div class="recent-grid">${favorites.map(card).join("")}</div>`
      : "") +
    `<div class="two-col home-lower"><div class="panel"><span class="eyebrow">UPDATE 0.5</span><h2>Changelog</h2><p>Your logo, page transitions, Caver recovery, and an Alpine VM launcher.</p><button id="home-updates">Read changelog</button></div><div class="panel"><span class="eyebrow">CUSTOMIZATION</span><h2>${user ? "◈ " + (user.unlimitedCoins ? "∞" : user.coins) + " coins" : "Theme shop"}</h2><p>${staticMode?"Browse themes. Coin rewards and purchases need a shared backend.":"Earn coins while using Vexel or playing installed games. Unlock account themes in the shop."}</p><a href="#shop" class="pill">Open shop →</a></div></div>` +
    ad();
  bindCards();
  $("#home-updates").onclick = updates;
  $("#home-random").onclick = () => {
    if (installed.length)
      preview(installed[Math.floor(Math.random() * installed.length)].id);
  };
  main.querySelectorAll("[data-home-app]").forEach(
    (b) =>
      (b.onclick = () => {
        pendingProxy = b.dataset.homeApp;
        location.hash = "apps";
      }),
  );
  $("#home-search").onsubmit = (e) => {
    e.preventDefault();
    const value = $("#home-query").value.trim();
    if (!value) return;
    if (
      /^https?:\/\//i.test(value) ||
      /^[\w.-]+\.[a-z]{2,}(?:[/:]|$)/i.test(value)
    ) {
      pendingProxy = value;
      location.hash = "apps";
    } else {
      libraryQuery = value;
      libraryFilter = "All";
      location.hash = "games";
    }
  };
}
function librarySidebar() {
  $("#library-nav")?.remove();
  const box = document.createElement("div");
  box.id = "library-nav";
  const categories = ["All", ...new Set(games.map((g) => g.category))].sort(
    (a, b) => (a === "All" ? -1 : b === "All" ? 1 : a.localeCompare(b)),
  );
  box.innerHTML =
    '<div class="nav-label">GAME CATEGORIES</div>' +
    categories
      .map(
        (c) =>
          `<button class="category-link ${libraryFilter === c ? "selected" : ""}" data-category="${esc(c)}"><span>${esc(c)}</span><small>${c === "All" ? games.length : games.filter((g) => g.category === c).length}</small></button>`,
      )
      .join("");
  $("#nav").insertBefore(box, $("#nav").firstChild);
  box.querySelectorAll("button").forEach(
    (b) =>
      (b.onclick = () => {
        libraryFilter = b.dataset.category;
        gamePage();
        document.body.classList.remove("menu-open");
      }),
  );
}
function gamePage() {
  librarySidebar();
  const available = games.filter(canLaunch).length;
  main.innerHTML =
    title(
      "LIBRARY",
      libraryFilter === "All" ? "All games" : esc(libraryFilter),
      `${games.length} games · ${available} connected · ${games.length - available} awaiting sources`,
      '<button id="random">Surprise me</button>',
    ) +
    `<div class="library-toolbar"><div class="sort-tabs" role="group" aria-label="Sort games"><button data-sort="az" class="selected">Alphabetical</button><button data-sort="recent">Recently played</button><button data-sort="favorites">Favorites</button></div><div class="search-row"><input id="search" type="search" placeholder="Search games…" aria-label="Search games"><select id="availability" aria-label="Game availability"><option value="all">All titles</option><option value="available">Connected sources</option><option value="pending">Awaiting source</option></select></div></div><div id="recent-shelf"></div><div id="game-grid"></div>`;
  let sort = "az", page = 0;
  function refresh(reset = true) {
    if(reset) page=0;
    const q = $("#search").value.toLowerCase(),
      availability = $("#availability").value;
    let list = games.filter(
      (g) =>
        g.title.toLowerCase().includes(q) &&
        (libraryFilter === "All" || g.category === libraryFilter) &&
        (availability === "all" ||
          (availability === "available" ? canLaunch(g) : !canLaunch(g))) &&
        (sort !== "favorites" || prefs.favorites?.includes(g.id)),
    );
    list.sort((a, b) => a.title.localeCompare(b.title));
    if (sort === "recent")
      list.sort((a, b) => {
        const i = (prefs.recent || []).indexOf(a.id),
          j = (prefs.recent || []).indexOf(b.id);
        return (i < 0 ? 999 : i) - (j < 0 ? 999 : j);
      });
    $("#recent-shelf").hidden =
      Boolean(q) || libraryFilter !== "All" || sort === "favorites";
    const size=48,pages=Math.max(1,Math.ceil(list.length/size));page=Math.min(page,pages-1);
    $("#game-grid").innerHTML = grid(list.slice(page*size,(page+1)*size))+`<div class="actions library-pagination"><button id="games-prev" ${page===0?'disabled':''}>← Previous</button><span>${list.length} matches · Page ${page+1} of ${pages}</span><button id="games-next" ${page>=pages-1?'disabled':''}>Next →</button></div>`;
    $("#games-prev").onclick=()=>{page--;refresh(false);};$("#games-next").onclick=()=>{page++;refresh(false);};
    bindCards();
  }
  const recent = (prefs.recent || [])
    .map((id) => games.find((g) => g.id === id))
    .filter(Boolean)
    .slice(0, 4);
  if (recent.length)
    $("#recent-shelf").innerHTML =
      section("Recently played", "") +
      `<div class="recent-grid">${recent.map(card).join("")}</div>`;
  $("#search").value = libraryQuery;
  libraryQuery = "";
  $("#search").oninput = refresh;
  $("#availability").onchange = refresh;
  main.querySelectorAll("[data-sort]").forEach(
    (b) =>
      (b.onclick = () => {
        sort = b.dataset.sort;
        main
          .querySelector(".sort-tabs .selected")
          ?.classList.remove("selected");
        b.classList.add("selected");
        refresh();
      }),
  );
  $("#random").onclick = () => {
    const ready = games.filter(canLaunch);
    if (ready.length)
      preview(ready[Math.floor(Math.random() * ready.length)].id);
  };
  refresh();
}
function appPage() {
  main.innerHTML =
    title("BROWSER", "Caver", "Search the web or open an app through Caver.") +
    `<form id="browser-form" class="search-row"><input id="address" placeholder="Search or enter a website" aria-label="Website address"><button class="primary">Go ↗</button></form><div class="actions"><button data-control="back">← Back</button><button data-control="forward">Forward →</button><button data-control="reload">↻ Reload</button></div><p id="proxy-status" class="status">${config.proxyReady ? "Scramjet 2 · ready to start" : "Proxy setup needed · the owner must configure a Wisp endpoint."}</p><div id="proxy-view" hidden></div>` +
    section("Apps", "Preset applets open through Caver.") +
    `<div class="grid">${applets.map(([n, m, u, c]) => `<button class="game-card" data-app="${u}"><div class="cover" style="--cover:${c}"><span class="cover-mark">${m}</span></div><div class="card-meta"><strong>${n}</strong><span>↗</span></div></button>`).join("")}</div><p class="catalog-note">External apps may require login and may refuse proxy access. Their availability is controlled by the provider.</p>`;
  let busy = false;
  async function go(value) {
    if (busy) return;
    busy = true;
    $("#proxy-status").textContent = "Starting Caver…";
    try {
      const address = proxy.normalize(value);
      $("#address").value = address;
      $("#proxy-view").hidden = false;
      await proxy.navigate(address, $("#proxy-view"));
      if ($("#proxy-status"))
        $("#proxy-status").textContent = "Caver · " + address;
    } catch (e) {
      if ($("#proxy-status")) $("#proxy-status").textContent = e.message;
    } finally {
      busy = false;
    }
  }
  $("#browser-form").onsubmit = (e) => {
    e.preventDefault();
    go($("#address").value);
  };
  main
    .querySelectorAll("[data-app]")
    .forEach((b) => (b.onclick = () => go(b.dataset.app)));
  main
    .querySelectorAll("[data-control]")
    .forEach((b) => (b.onclick = () => proxy.control(b.dataset.control)));
  cleanup = () => proxy.destroy();
  if (pendingProxy) {
    const target = pendingProxy;
    pendingProxy = "";
    go(target);
  }
}
function mediaPage() {
  main.innerHTML =
    title(
      "MEDIA",
      "Movies & shows",
      "Browse the catalog or open a local video.",
    ) +
    `<div class="search-row"><input id="movie-search" type="search" aria-label="Search movies" placeholder="Find a movie…"><select id="movie-filter" aria-label="Movie filter"><option>All films</option><option>My watchlist</option></select><button id="local-video">＋ Open local video</button><input id="video-file" type="file" accept="video/*" hidden></div><div id="movie-grid" class="grid"></div><p class="catalog-note">Thirteen films in the starter catalog. Five open films have connected streams; other records remain previews until their streams are verified. Streams load only when selected. More films can be added as licensed sources become available.</p><div id="video-area"></div>`;
  function refresh() {
    const q = $("#movie-search").value.toLowerCase(),
      list = movies.filter(
        (m) =>
          m.title.toLowerCase().includes(q) &&
          ($("#movie-filter").value !== "My watchlist" ||
            prefs.watchlist?.includes(m.id)),
      );
    $("#movie-grid").innerHTML =
      list
        .map(
          (m) =>
            `<button class="game-card" data-movie="${m.id}"><div class="cover" style="--cover:${m.color};height:230px"><span class="tag">${m.stream ? "OPEN MOVIE" : "CATALOG PREVIEW"}</span><span class="cover-mark">${m.title
              .split(" ")
              .map((x) => x[0])
              .join(
                "",
              )}</span></div><div class="card-meta"><div><strong>${m.title}</strong><small>${m.year} · ${m.category}</small></div><span>▷</span></div></button>`,
        )
        .join("") || '<p class="empty">No movies match.</p>';
    main
      .querySelectorAll("[data-movie]")
      .forEach(
        (b) =>
          (b.onclick = () =>
            moviePreview(movies.find((m) => m.id === b.dataset.movie))),
      );
  }
  $("#movie-search").oninput = refresh;
  $("#movie-filter").onchange = refresh;
  $("#local-video").onclick = () => $("#video-file").click();
  let objectURL;
  $("#video-file").onchange = (e) => {
    const f = e.target.files[0];
    if (!f) return;
    if (objectURL) URL.revokeObjectURL(objectURL);
    objectURL = URL.createObjectURL(f);
    videoPlayer({
      id: "local:" + f.name + f.size,
      title: f.name,
      stream: objectURL,
      license: "Your local file · stays on this device.",
    });
  };
  cleanup = () => {
    if (objectURL) URL.revokeObjectURL(objectURL);
    main.querySelector("video")?.pause();
  };
  refresh();
}
function moviePreview(m) {
  const saved = prefs.watchlist?.includes(m.id);
  open(
    `<span class="eyebrow">OPEN CINEMA · ${m.year}</span><h1>${m.title}</h1><p>${m.description}</p><p class="catalog-note">${m.license}<br><a href="${m.source}" target="_blank" rel="noopener">Official project & attribution ↗</a></p><div class="actions">${m.stream ? '<button class="primary" id="watch">Watch now ▷</button>' : '<span class="muted">Catalog preview · no stream connected</span>'}<button id="watchlist">${saved ? "✓ In watchlist" : "＋ Watchlist"}</button></div>`,
  );
  if ($("#watch"))
    $("#watch").onclick = () => {
      dialog.close();
      videoPlayer(m);
    };
  $("#watchlist").onclick = () => {
    prefs.watchlist = saved
      ? (prefs.watchlist || []).filter((x) => x !== m.id)
      : [...(prefs.watchlist || []), m.id];
    save();
    moviePreview(m);
  };
}
function videoPlayer(m) {
  const area = $("#video-area");
  area.innerHTML = `<div class="panel"><h2>${esc(m.title)}</h2><p class="catalog-note">${esc(m.license)}</p><video controls preload="metadata" playsinline></video><p class="status" id="video-status"></p></div>`;
  const v = area.querySelector("video");
  v.src = m.stream;
  v.onloadedmetadata = () => {
    const t = Number(localStorage.getItem("vexel.progress." + m.id) || 0);
    if (t > 0 && t < v.duration - 5) v.currentTime = t;
  };
  let last = 0;
  v.ontimeupdate = () => {
    if (Date.now() - last > 5000) {
      last = Date.now();
      localStorage.setItem("vexel.progress." + m.id, String(v.currentTime));
    }
  };
  v.onerror = () =>
    ($("#video-status").textContent =
      "This stream is unavailable. Try again later or open a local video.");
  area.scrollIntoView({ behavior: "smooth" });
}
function mangaPage() {
  main.innerHTML =
    title("READER", "Manga reader", "Open page images from your device.") +
    `<div class="panel"><div class="search-row"><button class="primary" id="open-pages">＋ Open page images</button><select id="reading-mode" aria-label="Reader layout"><option value="scroll">Vertical scroll</option><option value="paged">Paged horizontal</option></select><select id="direction" aria-label="Reading direction"><option value="ltr">Left to right</option><option value="rtl">Right to left</option></select></div><input id="pages" type="file" accept="image/*" multiple hidden><p id="page-status">Select page images in reading order. Files sort by name.</p><p class="catalog-note">Reader concept only: no manga chapters are bundled. ZIP/CBZ extraction and publisher catalog integrations remain future work.</p></div><div id="reader" class="reader"></div>`;
  let urls = [];
  $("#open-pages").onclick = () => $("#pages").click();
  $("#pages").onchange = (e) => {
    urls.forEach(URL.revokeObjectURL);
    const files = [...e.target.files]
      .filter((f) => f.type.startsWith("image/"))
      .sort((a, b) =>
        a.name.localeCompare(b.name, undefined, { numeric: true }),
      );
    urls = files.map((f) => URL.createObjectURL(f));
    $("#reader").innerHTML = files
      .map(
        (f, i) => `<img src="${urls[i]}" loading="lazy" alt="${esc(f.name)}">`,
      )
      .join("");
    $("#page-status").textContent = files.length + " pages · " + files[0]?.name;
  };
  function mode() {
    $("#reader").className =
      "reader " + $("#reading-mode").value + " " + $("#direction").value;
  }
  $("#reading-mode").onchange = mode;
  $("#direction").onchange = mode;
  cleanup = () => urls.forEach(URL.revokeObjectURL);
}
function requestPage() {
  main.innerHTML =
    title(
      "FEEDBACK",
      "Requests",
      "Request a game, suggest a feature, or report a bug.",
    ) +
    `<form id="feedback" class="panel form-panel"><span class="badge">GAMEPLAZA REQUEST PLATFORM</span><label for="category">What’s on your mind?</label><select id="category"><option value="game request">Game request</option><option value="suggestion">Suggestion</option><option value="bug report">Bug report</option><option value="other">Something else</option></select><label for="requested-game">Game or feature</label><input id="requested-game" maxlength="200" placeholder="Give it a name"><label for="feedback-message">The details</label><textarea id="feedback-message" minlength="5" maxlength="2000" required placeholder="Tell us what you have in mind…"></textarea><div class="actions"><button class="primary">Send request ↗</button></div><p id="feedback-status" class="status" role="status"></p><p class="catalog-note">Delivered to GamePlaza’s existing Firestore feedback collection, marked as Vexel. If that service is unavailable, we’ll tell you and save a server draft.</p></form>`;
  $("#feedback").onsubmit = async (e) => {
    e.preventDefault();
    const button = e.target.querySelector("button");
    button.disabled = true;
    $("#feedback-status").textContent = "Sending…";
    try {
      const r = await api("feedback", {
        category: $("#category").value,
        game: $("#requested-game").value,
        message: $("#feedback-message").value,
      });
      $("#feedback-status").textContent = r.sent
        ? "Request delivered. Thanks for helping Vexel grow."
        : r.message;
      if (r.sent) e.target.reset();
    } catch (e) {
      $("#feedback-status").textContent = e.message;
    } finally {
      button.disabled = false;
    }
  };
}
function settingsPage() {
  main.innerHTML =
    title(
      "PREFERENCES",
      "Settings",
      "Appearance, performance, and saved data.",
    ) +
    `<div class="form-grid"><div class="panel"><h2>Look & feel</h2><label for="theme">Your theme</label><select id="theme">${["navy", ...(user?.owned || [])].map((t) => `<option value="${esc(t)}" ${prefs.theme === t ? "selected" : ""}>${t === "navy" ? "Midnight navy" : config.shop.find((s) => s.id === t)?.name || t}</option>`).join("")}</select><label for="wallpaper">Wallpaper</label><select id="wallpaper"><option value="still">Still midnight</option><option value="reactive" ${prefs.wallpaper === "reactive" ? "selected" : ""}>Follow my cursor</option><option value="grid" ${prefs.wallpaper === "grid" ? "selected" : ""}>Navy grid</option><option value="black" ${prefs.wallpaper === "black" ? "selected" : ""}>Black</option></select>${[
      ["compact", "Compact cards"],
      ["lite", "Lightweight mode"],
      ["motion", "Allow motion"],
    ]
      .map(
        ([id, label]) =>
          `<div class="toggle-row"><label for="${id}">${label}</label><input type="checkbox" id="${id}" ${(id === "motion" ? prefs.motion !== false : id === "lite" ? liteMode() : prefs[id]) ? "checked" : ""}></div>`,
      )
      .join(
        "",
      )}<p class="catalog-note">Lightweight mode removes blur and background effects. Reduced-motion preferences are also respected.</p></div><div class="panel"><h2>Browser settings</h2><label for="tab-title">Tab title</label><input id="tab-title" maxlength="80" value="${esc(prefs.title || "Vexel")}"><div class="actions"><button id="export">Export preferences</button><button id="import">Import preferences</button><input id="import-file" type="file" accept="application/json" hidden></div><p class="catalog-note">Favorites, notes, and appearance sync when signed in. Export excludes credentials and balances. Local movie progress stays on this device.</p><button id="reset">Reset appearance</button></div></div>`;
  main.insertAdjacentHTML(
    "beforeend",
    `<div class="form-grid" style="margin-top:20px"><div class="panel"><h2>Glass & shape</h2><label for="glass">Glass intensity · <output id="glass-value">${prefs.glass ?? 60}</output>%</label><input id="glass" type="range" min="0" max="100" value="${Number(prefs.glass ?? 60)}"><label for="roundness">Corner radius · <output id="roundness-value">${prefs.roundness ?? 13}</output>px</label><input id="roundness" type="range" min="0" max="24" value="${Number(prefs.roundness ?? 13)}"><p class="catalog-note">Lightweight mode disables blur regardless of this setting.</p></div><div class="panel"><h2>Home screen</h2>${[
      ["homeRecent", "Show recently played"],
      ["homeFavorites", "Show favorites"],
    ]
      .map(
        ([key, label]) =>
          `<div class="toggle-row"><label for="${key}">${label}</label><input id="${key}" type="checkbox" ${prefs[key] !== false ? "checked" : ""}></div>`,
      )
      .join("")}</div></div>`,
  );
  for (const key of ["glass", "roundness"])
    $("#" + key).oninput = (e) => {
      prefs[key] = Number(e.target.value);
      $("#" + key + "-value").textContent = e.target.value;
      save();
    };
  for (const key of ["homeRecent", "homeFavorites"])
    $("#" + key).onchange = (e) => {
      prefs[key] = e.target.checked;
      save();
    };
  for (const id of ["theme", "wallpaper", "compact", "lite", "motion"])
    $("#" + id).onchange = (e) => {
      prefs[id] =
        e.target.type === "checkbox" ? e.target.checked : e.target.value;
      save();
    };
  $("#tab-title").oninput = (e) => {
    prefs.title = e.target.value;
    save();
  };
  $("#reset").onclick = () => {
    prefs = {
      ...prefs,
      theme: "navy",
      wallpaper: "still",
      compact: false,
      lite: false,
      motion: true,
      title: "Vexel",
      glass: 60,
      roundness: 13,
      homeRecent: true,
      homeFavorites: true,
    };
    save();
    settingsPage();
  };
  $("#export").onclick = () =>
    download(
      "vexel-preferences.json",
      JSON.stringify(prefs, null, 2),
      "application/json",
    );
  $("#import").onclick = () => $("#import-file").click();
  $("#import-file").onchange = async (e) => {
    try {
      const file = e.target.files[0];
      if (!file || file.size > 20000)
        throw Error("Choose a preferences file under 20 KB.");
      const p = JSON.parse(await file.text());
      const next = {};
      for (const k of [
        "theme",
        "wallpaper",
        "compact",
        "lite",
        "motion",
        "title",
        "favorites",
        "recent",
        "notes",
        "watchlist",
        "glass",
        "roundness",
        "homeRecent",
        "homeFavorites",
      ])
        if (k in p) next[k] = p[k];
      if (!["navy", ...(user?.owned || [])].includes(next.theme))
        next.theme = "navy";
      for (const k of ["favorites", "recent", "watchlist"])
        if (next[k] && !Array.isArray(next[k]))
          throw Error("Invalid preferences.");
      prefs = next;
      save();
      settingsPage();
      toast("Preferences imported.");
    } catch (e) {
      toast(e.message);
    }
  };
}
function download(name, data, type) {
  const url = URL.createObjectURL(new Blob([data], { type })),
    a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}
function accountPage() {
  if (user) {
    main.innerHTML =
      title("ACCOUNT", esc(user.username), "Manage your account.") +
      `<div class="form-grid"><div class="panel"><span class="badge">SIGNED IN · AD FREE</span><h2 style="margin-top:20px">Your account</h2><p>◈ ${user.unlimitedCoins ? "∞" : user.coins} coins · ${user.owned.length} unlocked themes</p><p class="catalog-note">${staticMode?"Cloud coins and purchases are not connected on this deployment.":"Earn 1 coin per active minute, or 3 while playing. One reward per minute, across your account. Coins have no cash value."}</p><div class="actions"><a href="#shop" class="pill primary">Visit the shop</a><button id="logout">Sign out</button></div><p class="catalog-note">Email/password accounts support email or username login. Email verification and password recovery are not configured in this first version.</p></div>${user.admin ? `<form id="grant" class="panel"><h2>Admin coin grant</h2><label for="grant-user">Username</label><input id="grant-user" required><label for="grant-amount">Coins</label><input id="grant-amount" type="number" min="1" max="10000" required><div class="actions"><button>Grant coins</button></div><p id="grant-status" class="status"></p></form>` : `<div class="panel"><h2>Saved data</h2><p>${staticMode?"Favorites, recent games, notes, and preferences stay on this device.":"Favorites, recent games, notes, and preferences sync with your account."}</p><a href="#settings" class="link">Settings →</a></div>`}</div>`;
    $("#logout").onclick = async () => {
      try {
        await api("logout", {});
        user = null;
        prefs = {};
        save();
        identity();
        render();
      } catch (e) {
        toast(e.message);
      }
    };
    if (user.admin)
      $("#grant").onsubmit = async (e) => {
        e.preventDefault();
        try {
          await api("admin/grant", {
            username: $("#grant-user").value,
            amount: Number($("#grant-amount").value),
          });
          $("#grant-status").textContent = "Coins granted and recorded.";
        } catch (e) {
          $("#grant-status").textContent = e.message;
        }
      };
    return;
  }
  main.innerHTML =
    title("ACCOUNT", "Account", "Sign in or create an account.") +
    `<div class="form-grid"><form id="login" class="panel"><h2>Sign in</h2><label for="login-id">Email or username</label><input id="login-id" autocomplete="username" required><label for="login-password">Password</label><input id="login-password" type="password" autocomplete="current-password" required><div class="actions"><button class="primary">Sign in →</button></div><p class="status" role="status"></p><div class="stack">${["google", "microsoft", "discord"].map((p) => `<a class="pill" ${config.providers[p] ? `href="${staticMode?"#account":asset("auth/"+p)}" data-provider="${p}"` : 'aria-disabled="true"'}>${({google:"Google",microsoft:"Microsoft",discord:"Discord"})[p]} ${config.providers[p] ? "↗" : "· setup needed"}</a>`).join("")}</div></form><form id="register" class="panel"><h2>Create account</h2><label for="username">Username</label><input id="username" pattern="[a-zA-Z0-9_]{3,20}" minlength="3" maxlength="20" autocomplete="username" required><label for="email">Email (optional)</label><input id="email" type="email" autocomplete="email"><label for="new-password">Password · at least 10 characters</label><input id="new-password" type="password" minlength="10" maxlength="128" autocomplete="new-password" required><div class="actions"><button class="primary">Create account →</button></div><p class="status" role="status"></p><small>Choose a username-only account or add an email for email login.</small></form></div>`;
  if(staticMode){
    const note=document.createElement('p');note.className='catalog-note';note.textContent='GitHub Pages mode: Firebase handles sign-in when configured. Shared chat, cloud preferences and coins need a trusted backend. Discord needs an OAuth callback backend. Username-only accounts have unique handles. Email and social accounts use their email or provider.';main.prepend(note);
    main.querySelectorAll('[data-provider]').forEach(b=>b.onclick=async e=>{e.preventDefault();try{user=await providerSignIn(b.dataset.provider);identity();render();}catch(e){toast(e.message);}});
    $('#login-id').type='text';$('#login-id').previousElementSibling.textContent='Email or username';
    $('#email').required=false;$('#email').previousElementSibling.textContent='Email (optional)';
    $('#register small').textContent='Leave email blank to create a username-only account. With an email, use that email to sign in.';
  }
  for (const mode of ["login", "register"])
    $("#" + mode).onsubmit = async (e) => {
      e.preventDefault();
      const f = e.target,
        button = f.querySelector("button");
      button.disabled = true;
      try {
        const data =
          mode === "login"
            ? {
                identifier: $("#login-id").value,
                password: $("#login-password").value,
              }
            : {
                username: $("#username").value,
                email: $("#email").value,
                password: $("#new-password").value,
              };
        const r = await api(mode, data);
        user = r.user;
        prefs = { ...prefs, ...user.preferences };
        if (!["navy", ...user.owned].includes(prefs.theme))
          prefs.theme = "navy";
        save();
        identity();
        render();
        toast("Signed in.");
      } catch (e) {
        f.querySelector(".status").textContent = e.message;
      } finally {
        button.disabled = false;
      }
    };
}
function shopPage() {
  main.innerHTML =
    title(
      "CUSTOMIZATION",
      "Theme shop",
      "Unlock themes with earned coins.",
      `<span class="badge">◈ ${user?.unlimitedCoins ? "∞" : (user?.coins || 0)} COINS</span>`,
    ) +
    `<div class="grid">${config.shop.map((s) => `<article class="panel shop-card"><div class="swatch" style="background:${s.color}">vexel.</div><h3 style="margin-top:20px">${s.name}</h3><p>Account theme</p><div class="actions"><small>◈ ${s.price}</small><button data-buy="${s.id}" ${user?.owned.includes(s.id) ? "disabled" : ""}>${user?.owned.includes(s.id) ? "Owned ✓" : "Unlock"}</button></div></article>`).join("")}</div><p class="catalog-note">${staticMode ? "Coin rewards and theme purchases need a shared backend." : user ? "Stay active to earn 1 coin per minute, or 3 while a game is open. Rewards share a server cooldown." : "Sign in to earn coins and unlock themes."} No purchases or real money.</p>`;
  main.querySelectorAll("[data-buy]").forEach(
    (b) =>
      (b.onclick = async () => {
        if (!user) {
          location.hash = "account";
          return;
        }
        b.disabled = true;
        try {
          const r = await api("shop/buy", { item: b.dataset.buy });
          user = r.user;
          identity();
          shopPage();
          toast("Unlocked. Find it in Settings.");
        } catch (e) {
          toast(e.message);
          b.disabled = false;
        }
      }),
  );
}
function socialPage() {
  main.innerHTML =
    title("COMMUNITY", "Chatroom", "Shared rooms for Vexel accounts.") +
    (!user
      ? `<div class="empty">Sign in to join the conversation.<div class="actions" style="justify-content:center"><a href="#account" class="pill primary">Join Vexel →</a></div></div>`
      : `<div class="panel chat-layout"><div class="rooms">${["general", "games", "creative"].map((r) => `<button data-room="${r}" class="${r === chatRoom ? "primary" : ""}"># ${r}</button>`).join("")}</div><div><h3 id="room-title"># ${chatRoom}</h3><div id="messages" class="messages" aria-live="polite"></div><form id="chat-form" class="inline-form"><input id="message" maxlength="1000" required autocomplete="off" placeholder="Say something…" aria-label="Chat message"><button class="primary">Send</button></form><p id="chat-status" class="status"></p></div></div><p class="catalog-note">Shared rooms, stored on the Vexel server. Keep personal information private. Delete your own messages; admins can moderate any message. Nexite friends, DMs, attachments, and presence remain on the roadmap.</p>`);
  if (!user) return;
  let stopped = false,
    last = "";
  async function refresh() {
    try {
      const items = await api("chat?room=" + chatRoom);
      if (stopped || !$("#messages")) return;
      const next = JSON.stringify(items);
      if (next === last) return;
      last = next;
      const el = $("#messages"),
        bottom = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
      el.innerHTML =
        items
          .map(
            (m) =>
              `<article class="message"><strong>${esc(m.username)}</strong><time>${new Date(m.created).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}</time>${m.username === user.username || user.admin ? `<button data-delete="${m.id}" aria-label="Delete message">×</button>` : ""}<p>${esc(m.text)}</p></article>`,
          )
          .join("") || '<p class="muted">No messages yet.</p>';
      if (bottom) el.scrollTop = el.scrollHeight;
      el.querySelectorAll("[data-delete]").forEach(
        (b) =>
          (b.onclick = async () => {
            try {
              await api("chat/delete", { id: Number(b.dataset.delete) });
              refresh();
            } catch (e) {
              toast(e.message);
            }
          }),
      );
    } catch (e) {
      if (!stopped && $("#chat-status"))
        $("#chat-status").textContent = e.message;
    }
  }
  $("#chat-form").onsubmit = async (e) => {
    e.preventDefault();
    const input = $("#message");
    try {
      await api("chat", { room: chatRoom, text: input.value });
      input.value = "";
      await refresh();
    } catch (e) {
      $("#chat-status").textContent = e.message;
    }
  };
  main.querySelectorAll("[data-room]").forEach(
    (b) =>
      (b.onclick = () => {
        chatRoom = b.dataset.room;
        render();
      }),
  );
  refresh();
  const timer = setInterval(()=>{if(!document.hidden)refresh();}, 3000);
  cleanup = () => {
    stopped = true;
    clearInterval(timer);
  };
}
let audioContext;
function tone(freq, type = "sine", duration = 0.3) {
  audioContext ||= new AudioContext();
  audioContext.resume();
  const osc = audioContext.createOscillator(),
    gain = audioContext.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  gain.gain.setValueAtTime(0.14, audioContext.currentTime);
  gain.gain.exponentialRampToValueAtTime(
    0.001,
    audioContext.currentTime + duration,
  );
  osc.connect(gain).connect(audioContext.destination);
  osc.start();
  osc.stop(audioContext.currentTime + duration);
}
function toolsPage() {
  main.innerHTML =
    title("UTILITIES", "Tools", "Soundboard, notes, music, and drawing.") +
    `<div class="tool-grid"><div class="panel"><span class="eyebrow">POCKETLAB</span><h2 style="margin:12px 0">Random tools</h2><input id="choices" placeholder="Pizza, noodles, tacos" aria-label="Choices separated by commas"><div class="actions"><button id="choose">Pick one</button><button id="coin">Flip a coin</button><button id="password">Password</button></div><p id="choice-result" class="status"></p></div><div class="panel"><span class="eyebrow">YOUR NOTES</span><h2 style="margin:12px 0">Notes</h2><textarea id="notes" maxlength="10000" placeholder="Write a note…" aria-label="Personal notes">${esc(prefs.notes || "")}</textarea><small>Saved ${user ? "to your account" : "on this browser"}. Don’t store secrets here.</small></div><div class="panel"><span class="eyebrow">MUSIC CORNER</span><h2 style="margin:12px 0">Music player</h2><p>Play local audio in a persistent mini player. Add an LRC file for timed lyrics.</p><input id="audio-files" type="file" accept="audio/*" multiple aria-label="Choose music files"><label for="lrc">Timed lyrics (optional .lrc)</label><input id="lrc" type="file" accept=".lrc,text/plain"><p class="catalog-note">An original browser music-player concept. No streaming-service extraction or copied desktop code.</p></div></div>` +
    section(
      "Soundboard",
      "Eight original synthesized pads. Click or use A S D F G H J K.",
    ) +
    `<div class="grid" id="pads">${["Bloop", "Pop", "Signal", "Ping", "Level up", "Wobble", "Spark", "Low key"].map((n, i) => `<button class="sound-pad" data-tone="${i}">${n}<small style="display:block;font:11px DM Sans;margin-top:8px">${"ASDFGHJK"[i]}</small></button>`).join("")}</div>` +
    section("Pixel editor", "A 16 × 16 canvas for very small masterpieces.") +
    `<div class="form-grid"><div class="panel"><div class="search-row"><input id="ink" type="color" value="#8eafff" aria-label="Pixel color"><button id="clear-pixels">Clear</button><button id="save-pixels">Export PNG</button></div><div id="pixels" class="pixel-grid">${Array.from({ length: 256 }, (_, i) => `<button data-pixel="${i}" aria-label="Pixel ${i + 1}"></button>`).join("")}</div></div><div class="panel"><span class="eyebrow">WEB TOYS</span>${toys.map(([n, m, url, desc]) => `<div class="toggle-row"><div><h3>${m} ${n}</h3><small>${desc}</small></div><a class="pill" href="${url}" target="_blank" rel="noopener">Open ↗</a></div>`).join("")}<h3 style="margin-top:25px">Alpine Linux VM</h3><p>Run Alpine Linux in the WebAssembly VM. Starts only when you choose to boot.</p><a class="pill" href="#vm">Open VM →</a></div></div>`;
  $("#notes").oninput = (e) => {
    prefs.notes = e.target.value;
    save();
  };
  $("#choose").onclick = () => {
    const choices = $("#choices")
      .value.split(",")
      .map((x) => x.trim())
      .filter(Boolean);
    $("#choice-result").textContent = choices.length
      ? choices[crypto.getRandomValues(new Uint32Array(1))[0] % choices.length]
      : "Add a few choices first.";
  };
  $("#coin").onclick = () =>
    ($("#choice-result").textContent =
      crypto.getRandomValues(new Uint8Array(1))[0] % 2 ? "Heads." : "Tails.");
  $("#password").onclick = () => {
    const bytes = crypto.getRandomValues(new Uint8Array(20)),
      alphabet =
        "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%";
    $("#choice-result").textContent = Array.from(
      bytes,
      (b) => alphabet[b % alphabet.length],
    ).join("");
  };
  const frequencies = [130.81, 164.81, 196, 261.63, 329.63, 392, 523.25, 65.41];
  function pad(i) {
    tone(frequencies[i], ["sine", "triangle", "square"][i % 3], 0.4);
    const b = main.querySelector(`[data-tone="${i}"]`);
    if (b) {
      b.style.background = "#8eafff44";
      setTimeout(() => (b.style.background = ""), 150);
    }
  }
  main
    .querySelectorAll("[data-tone]")
    .forEach((b) => (b.onclick = () => pad(Number(b.dataset.tone))));
  const key = (e) => {
    if (
      /INPUT|TEXTAREA|SELECT/.test(e.target.tagName) ||
      e.repeat ||
      dialog.open
    )
      return;
    const i = "asdfghjk".indexOf(e.key.toLowerCase());
    if (i >= 0) pad(i);
  };
  window.addEventListener("keydown", key);
  const pixels = Array(256).fill("#111c30");
  let painting = false;
  function paint(e) {
    const b = e.target.closest("[data-pixel]");
    if (!b) return;
    pixels[Number(b.dataset.pixel)] = $("#ink").value;
    b.style.background = $("#ink").value;
  }
  $("#pixels").onpointerdown = (e) => {
    e.preventDefault();
    painting = true;
    paint(e);
  };
  $("#pixels").onpointerover = (e) => {
    if (painting) paint(e);
  };
  const stop = () => (painting = false);
  window.addEventListener("pointerup", stop);
  $("#clear-pixels").onclick = () => {
    pixels.fill("#111c30");
    main
      .querySelectorAll("[data-pixel]")
      .forEach((b) => (b.style.background = ""));
  };
  $("#save-pixels").onclick = () => {
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = 256;
    const ctx = canvas.getContext("2d");
    pixels.forEach((c, i) => {
      ctx.fillStyle = c;
      ctx.fillRect((i % 16) * 16, Math.floor(i / 16) * 16, 16, 16);
    });
    const a = document.createElement("a");
    a.download = "vexel-pixel.png";
    a.href = canvas.toDataURL();
    a.click();
  };
  $("#audio-files").onchange = (e) => music([...e.target.files]);
  $("#lrc").onchange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > 100000) return toast("Lyrics file is too large.");
    const raw = await file.text();
    lyrics = raw
      .split("\n")
      .flatMap((line) => {
        const match = line.match(/^\[(\d+):(\d+(?:\.\d+)?)\](.*)$/);
        return match
          ? [{ at: Number(match[1]) * 60 + Number(match[2]), text: match[3] }]
          : [];
      })
      .sort((a, b) => a.at - b.at);
    toast(lyrics.length ? "Timed lyrics loaded." : "No LRC timestamps found.");
  };
  cleanup = () => {
    window.removeEventListener("keydown", key);
    window.removeEventListener("pointerup", stop);
  };
}
let tracks = [],
  trackIndex = 0,
  lyrics = [];
function music(files) {
  if (!files.length) return;
  tracks.forEach((t) => URL.revokeObjectURL(t.url));
  tracks = files.map((f) => ({ name: f.name, url: URL.createObjectURL(f) }));
  trackIndex = 0;
  lyrics = [];
  $(".music-bar")?.remove();
  const el = document.createElement("div");
  el.className = "music-bar";
  el.innerHTML =
    '<button id="stop-music" aria-label="Close music player">×</button><strong id="track-name"></strong><p id="lyric-line" style="font-size:11px;margin:5px 0"></p><audio controls></audio><div class="actions" style="margin:5px 0 0"><button id="previous-track">←</button><button id="next-track">→</button></div>';
  document.body.append(el);
  const audio = el.querySelector("audio");
  function play() {
    audio.src = tracks[trackIndex].url;
    $("#track-name").textContent = tracks[trackIndex].name;
    audio.play().catch(() => {});
  }
  $("#next-track").onclick = () => {
    trackIndex = (trackIndex + 1) % tracks.length;
    lyrics = [];
    play();
  };
  $("#previous-track").onclick = () => {
    trackIndex = (trackIndex + tracks.length - 1) % tracks.length;
    lyrics = [];
    play();
  };
  audio.onended = () => $("#next-track").click();
  audio.ontimeupdate = () => {
    const line = lyrics.findLast((l) => l.at <= audio.currentTime);
    $("#lyric-line").textContent = line?.text || "";
  };
  $("#stop-music").onclick = () => {
    audio.pause();
    tracks.forEach((t) => URL.revokeObjectURL(t.url));
    tracks = [];
    el.remove();
  };
  play();
}
function vmPage() {
  let stale = false,
    stop = () => {};
  cleanup = () => {
    stale = true;
    stop();
  };
  mountVM(main, { api, toast, download })
    .then((fn) => {
      if (stale) fn();
      else stop = fn;
    })
    .catch((e) => {
      if (!stale) toast(e.message);
    });
}
function animatePage(){
 pageAnimation?.cancel();
 if(liteMode()||prefs.motion===false||matchMedia('(prefers-reduced-motion: reduce)').matches||!main.animate)return;
 pageAnimation=main.animate([{opacity:0,transform:'translateY(5px)'},{opacity:1,transform:'translateY(0)'}],{duration:150,easing:'cubic-bezier(.2,.75,.2,1)'});
}
function render() {
  cleanup();
  cleanup = () => {};
  $("#library-nav")?.remove();
  playing = false;
  route = location.hash.slice(1) || "home";
  if (!nav.some(([, links]) => links.some(([id]) => id === route)))
    route = "home";
  document.body.classList.remove("menu-open");
  document
    .querySelectorAll("[data-route]")
    .forEach((a) => a.classList.toggle("active", a.dataset.route === route));
  $('#breadcrumb').innerHTML=`<img class="topbar-logo" src="./vexel-logo.png" alt="Vexel" width="84" height="31"><span>/ ${esc(nav.flatMap(x=>x[1]).find(x=>x[0]===route)[2])}</span>`;
  const pages = {
    home,
    games: gamePage,
    apps: appPage,
    media: mediaPage,
    manga: mangaPage,
    request: requestPage,
    settings: settingsPage,
    account: accountPage,
    shop: shopPage,
    social: socialPage,
    tools: toolsPage,
    vm: vmPage,
  };
  pages[route]();
  animatePage();
  window.scrollTo(0, 0);
}
window.addEventListener("hashchange", render);
let pointerFrame = 0;
window.addEventListener("pointermove", (e) => {
  if (
    prefs.wallpaper !== "reactive" ||
    liteMode() ||
    prefs.motion === false ||
    matchMedia("(prefers-reduced-motion: reduce)").matches ||
    pointerFrame
  )
    return;
  pointerFrame = requestAnimationFrame(() => {
    document.body.style.setProperty(
      "--mx",
      (e.clientX / innerWidth) * 100 + "%",
    );
    document.body.style.setProperty(
      "--my",
      (e.clientY / innerHeight) * 100 + "%",
    );
    pointerFrame = 0;
  });
});
apply();
try {
  [config, { user }, games] = await Promise.all([
    api("config"),
    api("me"),
    api("catalog"),
  ]);
  if (user) {
    prefs = { ...prefs, ...user.preferences };
    apply();
  }
  identity();
  render();
  if(new URLSearchParams(location.search).has("auth_error")){
    toast("Sign-in did not complete. Please try again or use your username and password.");
    history.replaceState(null,"",location.pathname+location.hash);
  }
  updates();
} catch (e) {
  main.innerHTML =
    '<div class="empty">Vexel couldn’t load its files. Check the connection and deployment, then reload.</div>';
  toast(e.message);
}
let activeUntil = Date.now() + 90000;
for (const event of ["pointerdown", "keydown", "scroll"])
  window.addEventListener(event, () => (activeUntil = Date.now() + 90000), {
    passive: true,
  });
setInterval(async () => {
  if (!user || document.hidden || Date.now() > activeUntil) return;
  try {
    const r = await api("activity", { kind: playing ? "play" : "browse" });
    user = r.user;
    identity();
  } catch {}
}, 60000);

window.addEventListener("keydown", (e) => {
  if (dialog.open || /INPUT|TEXTAREA|SELECT/.test(e.target.tagName)) return;
  if (
    ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") ||
    e.key === "/"
  ) {
    e.preventDefault();
    const search = $("#search") || $("#home-query");
    if (search) search.focus();
    else {
      location.hash = "games";
      setTimeout(() => $("#search")?.focus(), 0);
    }
  }
});
