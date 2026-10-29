import {loadEdits} from './content-store.js';
import {loginFailure} from "./auth-errors.js";
import {api,asset,gameAsset,siteRoot,staticMode,providerSignIn,worker,mirrorUrl,DEFAULT_WISP,visitorWisp,chatFeed} from "./runtime.js";
import { applets, toys, movies } from "./catalog.js";
import * as proxy from "./proxy.js";
import {watchExternalGame} from "./blocked-games.js";
import { mountVM } from "./vm.js";
const VERSION = "1.0";
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
libraryFilter = prefs.library?.filter || "All";
const rememberLibrary = (changes) => {
  prefs.library = { ...prefs.library, ...changes };
  localStorage.setItem("vexel.preferences", JSON.stringify(prefs));
};
const nav = [
  [
    "EXPLORE",
    [
      ["home", "⌂", "Home"],
      ["games", "◇", "Games"],
      ["apps", "▦", "Caver & apps"],
      ["media", "▷", "Movies & shows"],
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
    ? `${esc(user.username)}<small>Signed in</small>`
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
// Where a game can be played from, best first: "/games/…" in the Vexel game pack,
// "gh:repo/path" mirrored from one of the owner's repositories, a hosted https page,
// or "caver:https://…" for sites that refuse to load in a frame.
function sourcesOf(g) {
  if (g.sources?.length) return g.sources;
  const external = g.proxyTarget || g.remoteUrl || g.launchUrl;
  return [g.path, external && (g.launchViaCaver ? "caver:" + external : external)].filter(Boolean);
}
function canLaunch(g) {
  return sourcesOf(g).length > 0;
}
function sourceKind(source) {
  if (source.startsWith("gh:")) return "mirror";
  if (source.startsWith("caver:")) return "caver";
  if (source.startsWith("/")) return "local";
  return new URL(source).origin === location.origin ? "same" : "frame";
}
function sourceUrl(source) {
  const kind = sourceKind(source);
  return kind === "local" ? (config.gameOrigin || siteRoot) + source : kind === "mirror" ? mirrorUrl(source) : kind === "caver" ? source.slice(6) : source;
}
// Where each game comes from (repo, host, porter) stays in the catalog's `origin`,
// `sources` and `license` fields for the owner; the site itself never shows it.
function card(g, i = 0) {
  return `<button class="game-card" style="--i:${Math.min(i, 12)}" data-game="${esc(g.id)}" aria-label="Preview ${esc(g.title)}"><div class="cover" style="--cover:${esc(g.color || "#12264a")}">${g.cover ? `<img src="${esc(gameAsset(g.cover))}" alt="" loading="lazy">` : `<div class="cover-pattern" data-kind="${esc(g.category)}"><span>${esc(g.title)}</span></div>`}<span class="tag">${esc(g.category)}</span><span class="play-indicator">▷</span></div><div class="card-meta"><strong>${esc(g.title)}</strong><div class="card-details"><span class="favorite-indicator">${prefs.favorites?.includes(g.id) ? "♥" : "♡"}</span></div></div></button>`;
}
function grid(items) {
  return items.length
    ? `<div class="grid">${items.map(card).join("")}</div>`
    : '<div class="empty">No matching games.</div>';
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
const CHANGES = [
  "Added games: 940+ of them, all playable right inside Vexel",
  "Added the website",
  "Added Caver (proxy) to browse the web from inside Vexel",
  "Added Minecraft 26.2",
  "Added cover art for almost every game",
  "Added search, categories, favorites and recently played",
  "Added a share link for every game",
  "Added Movies & shows, plus a player for your own videos",
  "Added Tools & toys: a music player, notes, a soundboard and more",
  "Added a Linux computer that runs in your browser",
  "Added accounts: sign in with Google, Microsoft or a username",
  "Added themes, wallpapers, animations and Lightweight mode for slow Chromebooks",
];
function updates() {
  open(`<span class="eyebrow">VERSION ${VERSION}</span><h2>What's new</h2><ul class="release-note">${CHANGES.map((c) => `<li>${c}</li>`).join("")}</ul><button class="primary" id="enter">Got it</button>`);
  $("#enter").onclick=()=>dialog.close();
}
$("#credits").onclick = () =>
  open(
    `<h2>Credits</h2><p>Vexel combines the game library, browser, tools, and community features developed across GamePlaza, coreHZ, GPT Corner, nexSite, nexite, and StreamPlaza. Layout inspired by Barnical.</p><p>Proxy: <a href="https://github.com/MercuryWorkshop/scramjet" target="_blank" rel="noopener">MercuryWorkshop Scramjet 2 (AGPL-3.0)</a> and <a href="https://github.com/MercuryWorkshop/CurlTransport" target="_blank" rel="noopener">libcurl transport (AGPL-3.0)</a>. Unmodified runtime packages are installed from the pinned dependency lockfile. Open movie credits and licenses appear beside each player. Font: Silkscreen, bundled under the SIL Open Font License. Alpine VM: v86 (BSD-2-Clause), SeaBIOS, and Alpine Linux. Built-in transport: wisp-js (LGPL-3.0-or-later).</p><p>Logo: supplied by Vexel’s owner.</p><p>Vexel is GPL-3.0, with no warranty. Third-party components retain their licenses.</p><a class="pill" href="https://github.com/techmaster2013/vexel" target="_blank" rel="noopener">Source & research notes ↗</a>`,
  );
function bindCards() {
  main
    .querySelectorAll("[data-game]")
    .forEach((b) => (b.onclick = () => preview(b.dataset.game)));
}
function preview(id) {
 const g=games.find(x=>x.id===id);if(!g)return;
 const favorite=prefs.favorites?.includes(id),sources=sourcesOf(g);
 const playControl=sources.length?'<button class="primary" id="play">▷ Play</button>':'<span class="muted">Not available yet</span>';
 open(`<div class="cover preview-cover" style="--cover:${esc(g.color||'#12264a')}">${g.cover?`<img src="${esc(gameAsset(g.cover))}" alt="">`:`<div class="cover-pattern"><span>${esc(g.title)}</span></div>`}</div><div class="detail"><span class="badge">${esc(g.category)}</span><h2>${esc(g.title)}</h2><p>${esc(g.description||'')}</p>${g.controls?`<p><small>${esc(g.controls)}</small></p>`:''}<div class="actions">${playControl}<button id="favorite">${favorite?'♥ Saved':'♡ Favorite'}</button><button id="share">🔗 Copy link</button></div>${sources.length>1?`<p class="catalog-note">If it doesn't load, press ⇄ while playing to switch to another copy.</p>`:''}${!sources.length?`<p class="catalog-note">${esc(g.unavailableReason||'A working game source has not been connected.')}</p>`:''}</div>`);
 $('#share').onclick=()=>{const link=location.href.split('#')[0]+'#games?game='+encodeURIComponent(id);navigator.clipboard?.writeText(link).then(()=>toast('Link copied! Send it to a friend.'),()=>prompt('Copy this link:',link))??prompt('Copy this link:',link);};
 $('#favorite').onclick=()=>{prefs.favorites=favorite?(prefs.favorites||[]).filter(x=>x!==id):[...(prefs.favorites||[]),id];save();preview(id);};
 if(sources.length)$('#play').onclick=()=>{dialog.close();play(g);};
}
function openInCaver(originalUrl){pendingProxy=originalUrl;if(location.hash==='#apps')render();else location.hash='apps';}
// Mirrored and same-site games come from the owner's own repositories and need real
// storage for saves (Unity uses IndexedDB). Vexel-pack games keep an opaque sandbox
// unless the catalog marks them `saves` (an owner-supplied game that stores worlds).
const TRUSTED_SANDBOX='allow-scripts allow-same-origin allow-pointer-lock allow-forms allow-modals allow-downloads';
function play(g,index=0){
 const sources=sourcesOf(g),source=sources[index];if(!source)return;
 const kind=sourceKind(source),url=sourceUrl(source);
 cleanup();playing=true;
 prefs.recent=[g.id,...(prefs.recent||[]).filter(x=>x!==g.id)].slice(0,12);save();
 main.innerHTML=`<div class="player-toolbar"><div><span class="eyebrow">NOW PLAYING</span><h2>${esc(g.title)}</h2></div><div class="actions"><button id="back-games">← Games</button>${sources.length>1?`<button id="next-source" title="Try another copy of this game">⇄ Switch ${index+1}/${sources.length}</button>`:''}${kind==='frame'?'<button id="caver-game" title="Open this page through the Caver proxy">Caver ↗</button>':''}<button id="reload-game" title="Reload game">↻ Reload</button><button id="full" title="Fullscreen (F)">⛶ Fullscreen</button></div></div><div id="game-view">${kind==='caver'?'<p class="player-loading">Starting Caver…</p>':`<iframe id="game-frame" class="player-frame" sandbox="allow-scripts allow-pointer-lock" allow="autoplay; fullscreen; gamepad" title="${esc(g.title)}"></iframe>`}</div><p class="player-status">${esc(g.controls||'')}</p>`;
 const view=$('#game-view'),frame=$('#game-frame');let stopWatching=()=>{};
 const failed=e=>{if(playing&&$('#game-view')===view)view.innerHTML=`<div class="blocked-fallback panel"><h2>This copy didn't load.</h2><p>${esc(e.message)}</p>${sources.length>1?'<button class="primary" id="fallback-next">Try the next source</button>':''}</div>`;$('#fallback-next')?.addEventListener('click',()=>play(g,(index+1)%sources.length));};
 if(kind==='caver'){proxy.navigate(url,view).catch(failed);$('#reload-game').onclick=()=>proxy.control('reload');}
 else{
  if(kind==='mirror'||kind==='same'||kind==='local'&&g.saves)frame.setAttribute('sandbox',TRUSTED_SANDBOX);
  if(kind==='frame'){frame.setAttribute('sandbox','allow-scripts allow-same-origin allow-pointer-lock allow-forms allow-downloads');stopWatching=watchExternalGame({frame,container:view,originalUrl:url,gameId:g.id,onOpenCaver:openInCaver});}
  // A mirrored game is served by the service worker, so it must be running first.
  if(kind==='mirror')worker().then(()=>{if(frame.isConnected)frame.src=url;},failed);else frame.src=url;
  $('#reload-game').onclick=()=>{frame.src='about:blank';setTimeout(()=>{frame.src=url;},50);};
 }
 $('#caver-game')?.addEventListener('click',()=>openInCaver(url));
 $('#next-source')?.addEventListener('click',()=>play(g,(index+1)%sources.length));
 $('#back-games').onclick=()=>render();$('#full').onclick=()=>view.requestFullscreen?.().catch(()=>toast('Fullscreen unavailable.'));
 cleanup=()=>{playing=false;stopWatching();if(kind==='caver')proxy.destroy();};animatePage();
}
function home() {
  const featured = games.filter((g) => g.featured).sort((a, b) => (b.id === "minecraft-26-2") - (a.id === "minecraft-26-2")).concat(games.filter((g) => !g.featured && sourcesOf(g)[0]?.startsWith("/"))),
    recent = (prefs.recent || [])
      .map((id) => games.find((g) => g.id === id))
      .filter(Boolean)
      .slice(0, 4),
    favorites = (prefs.favorites || [])
      .map((id) => games.find((g) => g.id === id))
      .filter(Boolean)
      .slice(0, 4);
  main.innerHTML =
    `<section class="home-hero panel"><div class="home-heading"><div><span class="eyebrow">HOME</span><h1><img class="home-logo" src="./vexel-logo.png" alt="Vexel" width="470" height="175"></h1><p>Games. Apps. Media. Tools.</p></div><span class="home-version">${VERSION}</span></div><form id="home-search" class="home-search"><input id="home-query" type="search" placeholder="Search games or enter a URL" aria-label="Search games or enter a URL"><button class="primary" type="submit">Search →</button></form><div class="home-actions">${games.some((g) => g.id === "minecraft-26-2") ? '<button id="home-minecraft" class="primary">▶ Minecraft 26.2</button>' : ""}<a href="#games" class="pill">Browse games ↗</a><a href="#apps" class="pill">Open Caver ↗</a><button id="home-random">Random game</button></div><div class="home-stats"><span>${games.length} games</span><span>${user ? "Signed in" : "Guest session"}</span></div></section><section class="home-apps">${applets
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
      "Featured games",
      "",
      '<a class="link" href="#games">View library →</a>',
    ) +
    grid(featured.slice(0, 12)) +
    (favorites.length && prefs.homeFavorites !== false
      ? section("Favorites", "") +
        `<div class="recent-grid">${favorites.map(card).join("")}</div>`
      : "") +
    `<div class="two-col home-lower"><div class="panel"><span class="eyebrow">UPDATE ${VERSION}</span><h2>What's new</h2><p>${CHANGES[0]}, and more.</p><button id="home-updates">Read changelog</button></div><div class="panel"><span class="eyebrow">CUSTOMIZATION</span><h2>${user ? "◈ " + (user.unlimitedCoins ? "∞" : user.coins) + " coins" : "Theme shop"}</h2><p>Earn coins while you play and unlock themes in the shop.</p><a href="#shop" class="pill">Open shop →</a></div></div>`;
  bindCards();
  $("#home-updates").onclick = updates;
  $("#home-minecraft")?.addEventListener("click", () => play(games.find((g) => g.id === "minecraft-26-2")));
  $("#home-random").onclick = () => {
    const playable = games.filter(canLaunch);
    if (playable.length)
      preview(playable[Math.floor(Math.random() * playable.length)].id);
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
        rememberLibrary({ filter: libraryFilter });
        gamePage();
        document.body.classList.remove("menu-open");
      }),
  );
}
function gamePage() {
  librarySidebar();
  main.innerHTML =
    title(
      "LIBRARY",
      libraryFilter === "All" ? "All games" : esc(libraryFilter),
      `${games.length} games`,
      '<button id="random">Surprise me</button>',
    ) +
    `<div class="library-toolbar"><div class="sort-tabs" role="group" aria-label="Sort games">${[["az","Alphabetical"],["recent","Recently played"],["favorites","Favorites"]].map(([id,label])=>`<button data-sort="${id}" class="${(prefs.library?.sort||"az")===id?"selected":""}">${label}</button>`).join("")}</div><div class="search-row"><input id="search" type="search" placeholder="Search games or categories…" aria-label="Search games"></div></div><div id="recent-shelf"></div><div id="game-grid"></div>`;
  let sort = prefs.library?.sort || "az", page = 0;
  function refresh(reset = true) {
    if(reset) page=0;
    const q = $("#search").value.toLowerCase();
    let list = games.filter(
      (g) =>
        (g.title.toLowerCase().includes(q) || String(g.category || "").toLowerCase().includes(q)) &&
        (libraryFilter === "All" || g.category === libraryFilter) &&
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
  main.querySelectorAll("[data-sort]").forEach(
    (b) =>
      (b.onclick = () => {
        sort = b.dataset.sort;
        rememberLibrary({ sort });
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
    `<form id="browser-form" class="search-row"><input id="address" placeholder="Search or enter a website" aria-label="Website address"><button class="primary">Go ↗</button></form><div class="actions"><button data-control="back">← Back</button><button data-control="forward">Forward →</button><button data-control="reload">↻ Reload</button></div><p id="proxy-status" class="status">Scramjet 2 · ready to start</p><div id="proxy-view" hidden></div>` +
    section("Apps", "Preset applets open through Caver.") +
    `<div class="grid">${applets.map(([n, m, u, c]) => `<button class="game-card" data-app="${u}"><div class="cover" style="--cover:${c}"><span class="cover-mark">${m}</span></div><div class="card-meta"><strong>${n}</strong><span>↗</span></div></button>`).join("")}</div><p class="catalog-note">External apps may require login and may refuse proxy access. Their availability is controlled by the provider.</p>` + section("Your projects", "Websites and source links from your public repositories.") + `<input id="project-search" type="search" aria-label="Search projects" placeholder="Find a project…"><div id="repository-projects" class="grid" style="margin-top:20px"><p>Loading projects…</p></div>`;
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
  const projectController=new AbortController();
  fetch(asset('repository-projects.json'),{signal:projectController.signal,cache:'no-cache'}).then(r=>{if(!r.ok)throw Error('Projects unavailable.');return r.json();}).then(projects=>{
    if(projectController.signal.aborted)return;
    const show=()=>{
      const q=$('#project-search').value.toLowerCase();
      $('#repository-projects').innerHTML=projects.filter(p=>p.name.toLowerCase().includes(q)).map(p=>`<article class="panel"><h3>${esc(p.name)}</h3><p>${esc(p.description)}</p><div class="actions">${p.url?`<a class="pill primary" href="${esc(p.url)}" target="_blank" rel="noopener noreferrer">Open website ↗</a>`:''}<a class="pill" href="${esc(p.source)}" target="_blank" rel="noopener noreferrer">Source ↗</a></div></article>`).join('')||'<p>No matching projects.</p>';
    };
    $('#project-search').oninput=show;show();
  }).catch(e=>{if(!projectController.signal.aborted)$('#repository-projects').textContent=e.message;});
  cleanup = () => {projectController.abort();proxy.destroy();};
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
    `<div class="search-row"><input id="movie-search" type="search" aria-label="Search movies" placeholder="Find a movie…"><select id="movie-filter" aria-label="Movie filter"><option>All films</option><option>My watchlist</option></select><button id="local-video">＋ Open local video</button><input id="video-file" type="file" accept="video/*" hidden></div><div id="movie-grid" class="grid"></div><p class="catalog-note">${movies.length} films in the catalog. ${movies.filter(m=>m.stream).length} have connected streams; other records remain previews until their streams are verified. Streams load only when selected. More films can be added as licensed sources become available.</p><div id="video-area"></div>`;
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
    `<div class="form-grid"><div class="panel"><h2>Look & feel</h2><label for="theme">Your theme</label><select id="theme">${["navy", ...(user?.owned || [])].map((t) => `<option value="${esc(t)}" ${prefs.theme === t ? "selected" : ""}>${t === "navy" ? "Galaxy" : config.shop.find((s) => s.id === t)?.name || t}</option>`).join("")}</select><label for="wallpaper">Wallpaper</label><select id="wallpaper"><option value="still">Galaxy</option><option value="reactive" ${prefs.wallpaper === "reactive" ? "selected" : ""}>Nebula follows cursor</option><option value="grid" ${prefs.wallpaper === "grid" ? "selected" : ""}>Space grid</option><option value="black" ${prefs.wallpaper === "black" ? "selected" : ""}>Just stars</option></select>${[
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
      )}<p class="catalog-note">Lightweight mode removes blur and background effects. Reduced-motion preferences are also respected.</p></div><div class="panel"><h2>Browser settings</h2><label for="tab-title">Tab title</label><input id="tab-title" maxlength="80" value="${esc(prefs.title || "Vexel")}"><label for="wisp">Caver server</label><input id="wisp" type="url" inputmode="url" spellcheck="false" placeholder="${esc(DEFAULT_WISP)}" value="${esc(visitorWisp())}"><small>Leave empty for the default. If Caver is blocked on your network, paste another wss:// Wisp server.</small><div class="actions"><button id="export">Export preferences</button><button id="import">Import preferences</button><input id="import-file" type="file" accept="application/json" hidden></div><p class="catalog-note">Favorites, notes, and appearance sync when signed in. Export excludes credentials and balances. Local movie progress stays on this device.</p><button id="reset">Reset appearance</button></div></div>`;
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
  $("#wisp").onchange = (e) => {
    const value = e.target.value.trim();
    if (value && !/^wss:\/\/[^\s/]+/i.test(value)) return toast("Use a wss:// address.");
    try { value ? localStorage.setItem("vexel.wisp", value) : localStorage.removeItem("vexel.wisp"); } catch {}
    toast(value ? "Caver will use this server after you reload." : "Caver is back on the default server after you reload.");
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
      `<div class="form-grid"><div class="panel"><span class="badge">SIGNED IN</span><h2 style="margin-top:20px">Your account</h2><p>◈ ${user.unlimitedCoins ? "∞" : user.coins} coins · ${user.owned.length} unlocked themes</p><p class="catalog-note">${"Earn 1 coin per active minute, or 3 while playing. One reward per minute, across your account. Coins have no cash value."}</p><div class="actions"><a href="#shop" class="pill primary">Visit the shop</a><button id="logout">Sign out</button></div><p class="catalog-note">Email/password accounts support email or username login. Email verification and password recovery are not configured in this first version.</p></div>${user.admin ? `<form id="grant" class="panel"><h2>Admin coin grant</h2><label for="grant-user">Username</label><input id="grant-user" required><label for="grant-amount">Coins</label><input id="grant-amount" type="number" min="1" max="10000" required><div class="actions"><button>Grant coins</button></div><p id="grant-status" class="status"></p></form>` : `<div class="panel"><h2>Saved data</h2><p>${staticMode?"Favorites, recent games, notes, and preferences stay on this device.":"Favorites, recent games, notes, and preferences sync with your account."}</p><a href="#settings" class="link">Settings →</a></div>`}</div>`;
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
    const note=document.createElement('p');note.className='catalog-note';note.textContent='GitHub Pages mode: Firebase handles sign-in when configured. Shared chat, cloud preferences and coins need a trusted backend. Discord uses the configured secure callback backend. Username-only accounts have unique handles. Email and social accounts use their email or provider.';main.prepend(note);
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
      f.querySelector(".status").textContent="";
      f.querySelector(".status").classList.remove("error");
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
        f.querySelector(".status").textContent = mode === "login" ? loginFailure(e) : e.message;
        f.querySelector(".status").classList.add("error");
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
    `<div class="grid">${config.shop.map((s) => `<article class="panel shop-card"><div class="swatch" style="background:${s.color}">vexel.</div><h3 style="margin-top:20px">${s.name}</h3><p>Account theme</p><div class="actions"><small>◈ ${s.price}</small><button data-buy="${s.id}" ${user?.owned.includes(s.id) ? "disabled" : ""}>${user?.owned.includes(s.id) ? "Owned ✓" : "Unlock"}</button></div></article>`).join("")}</div><p class="catalog-note">${user ? "Stay active to earn 1 coin per minute, or 3 while a game is open. Rewards share a server cooldown." : "Sign in to earn coins and unlock themes."} No purchases or real money.</p>`;
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
      : `<div class="panel chat-layout"><div class="rooms">${["general", "games", "creative"].map((r) => `<button data-room="${r}" class="${r === chatRoom ? "primary" : ""}"># ${r}</button>`).join("")}</div><div><h3 id="room-title"># ${chatRoom}</h3><div id="messages" class="messages" aria-live="polite"></div><form id="chat-form" class="inline-form"><input id="message" maxlength="1000" required autocomplete="off" placeholder="Say something…" aria-label="Chat message"><button class="primary">Send</button></form><p id="chat-status" class="status"></p></div></div><p class="catalog-note">Shared rooms for signed-in accounts. Keep personal information private: no real names, schools or addresses. Delete your own messages with ×; admins can remove any message.</p>`);
  if (!user) return;
  let stopped = false,
    stop = () => {};
  const room = chatRoom;
  function show(items) {
    const el = $("#messages");
    if (stopped || !el) return;
    const bottom = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
    el.innerHTML =
      items
        .map(
          (m) =>
            `<article class="message"><strong>${esc(m.username)}</strong><time>${new Date(m.created).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}</time>${m.uid === user.id || m.username === user.username || user.admin ? `<button data-delete="${esc(m.id)}" aria-label="Delete message">×</button>` : ""}<p>${esc(m.text)}</p></article>`,
        )
        .join("") || '<p class="muted">No messages yet. Say hi!</p>';
    if (bottom) el.scrollTop = el.scrollHeight;
    el.querySelectorAll("[data-delete]").forEach(
      (b) =>
        (b.onclick = async () => {
          try {
            await api("chat/delete", { room, id: staticMode ? b.dataset.delete : Number(b.dataset.delete) });
          } catch (e) {
            toast(e.message);
          }
        }),
    );
  }
  const failed = (e) => {
    if (!stopped && $("#chat-status")) $("#chat-status").textContent = e.message;
  };
  // New messages arrive live; nothing is re-downloaded on a timer.
  chatFeed(room, show, failed).then((unsubscribe) => (stopped ? unsubscribe() : (stop = unsubscribe)), failed);
  $("#chat-form").onsubmit = async (e) => {
    e.preventDefault();
    const input = $("#message");
    try {
      await api("chat", { room, text: input.value });
      input.value = "";
      $("#chat-status").textContent = "";
    } catch (e) {
      failed(e);
    }
  };
  main.querySelectorAll("[data-room]").forEach(
    (b) =>
      (b.onclick = () => {
        chatRoom = b.dataset.room;
        render();
      }),
  );
  cleanup = () => {
    stopped = true;
    stop();
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
  const [hashRoute, hashQuery = ""] = location.hash.slice(1).split("?");
  route = hashRoute || "home";
  const linkedGame = new URLSearchParams(hashQuery).get("game");
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
    request: requestPage,
    settings: settingsPage,
    account: accountPage,
    shop: shopPage,
    social: socialPage,
    tools: toolsPage,
    vm: vmPage,
  };
  pages[route]();
  if (linkedGame && games.some((g) => g.id === linkedGame)) preview(linkedGame);
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
// Rejects after `ms` so a slow or blocked service (Firebase on school networks) can't hold up the page.
const within = (promise, ms) => Promise.race([promise, new Promise((_, no) => setTimeout(() => no(Error("Timed out.")), ms))]);
// Re-render only list pages, and never while a game or video is open.
const refreshLists = () => { if (!playing && ["home", "games", "media"].includes(route) && !dialog.open) render(); };
try {
  // The site only needs its own config and catalog to work; show it as soon as those arrive.
  [config, games] = await Promise.all([api("config"), api("catalog")]);
  identity();
  render();
  if(new URLSearchParams(location.search).has("auth_error")){
    toast("Sign-in did not complete. Please try again or use your username and password.");
    history.replaceState(null,"",location.pathname+location.hash);
  }
  // Skip the changelog when someone arrives through a shared game link, so the game card stays on top.
  if (localStorage.getItem("vexel.seenVersion") !== VERSION && !location.hash.includes("game=")) {
    localStorage.setItem("vexel.seenVersion", VERSION);
    updates();
  }
  // Accounts and editor additions load in the background.
  within(api("me"), 8000).then(({ user: signedIn }) => {
    if (!signedIn) return;
    user = signedIn;
    prefs = { ...prefs, ...user.preferences };
    apply();
    identity();
  }).catch(() => {});
  loadEdits().then((edited) => {
    if (!edited) return;
    games.push(...edited.games);
    movies.push(...edited.movies);
    if (edited.wispUrl) { config.proxyReady = true; window.vexelWisp = edited.wispUrl; }
    refreshLists();
  });
} catch (e) {
  main.innerHTML =
    '<div class="empty">Vexel couldn’t load its files. Check your connection, then reload.</div>';
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
  if (playing && e.key.toLowerCase() === "f" && !e.ctrlKey && !e.metaKey) {
    $("#full")?.click();
    return;
  }
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
