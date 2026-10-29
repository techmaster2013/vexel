#!/usr/bin/env python3
"""Rebuild manifest.json from every techmaster2013 repository that holds games.

Each catalog entry gets an ordered `sources` list. Vexel plays the first one and
offers the rest when a copy is down:
  /games/...           a file in this game pack
  gh:repo/path[?own]   a file mirrored from a public owner repository by Vexel's
                       service worker; ?own drops a stale CDN <base> because the
                       repository holds every file the page needs
  https://...          a hosted page shown in a frame
  caver:https://...    a site that refuses frames, opened through Caver

Usage: python3 scripts/import-games.py [--cache DIR] [--offline]   (--offline is a dry run)
Needs `gh` signed in as the owner (for trees and private repos). The script only
reads repositories; it never pushes. Re-run it after adding games to a repo.
"""
import argparse, concurrent.futures as cf, json, pathlib, re, subprocess, sys, urllib.error, urllib.parse, urllib.request

OWNER = "techmaster2013"
REPO = pathlib.Path(__file__).resolve().parents[1]
ROOT = REPO / "games"  # catalog, covers and local game files
UA = {"User-Agent": "vexel-catalog-import"}
# Same list as Vexel's mirror-sw.js: popunder ads and trackers, never game code.
ADS = re.compile(r"spitefuldecision|al5sm\.com|vayfuzsu|bacusmoa|googletagmanager|googlesyndication|google-analytics|adsbygoogle|cloudflareinsights|highperformanceformat|effectivegatecpm|profitableratecpm", re.I)
CDN_BASE = re.compile(r"<base\b[^>]*href\s*=\s*[\"'](https?://(?:cdn\.jsdelivr\.net/gh|(?:raw|rawcdn)\.githack\.com|cdn\.statically\.io/gh|raw\.githubusercontent\.com)/[^\"']*)[\"'][^>]*>", re.I)
CDN_FOLDER = re.compile(r"[\"'](https?://(?:cdn\.jsdelivr\.net/gh|(?:raw|rawcdn)\.githack\.com|cdn\.statically\.io/gh)/[^\"'\s<>]*/)[\"']")

ap = argparse.ArgumentParser()
ap.add_argument("--cache", type=pathlib.Path, default=REPO.parent / ".vexel-import-cache")
ap.add_argument("--offline", action="store_true", help="dry run from cached pages: skip link checks and write nothing")
args = ap.parse_args()
args.cache.mkdir(parents=True, exist_ok=True)


def gh(path):
    return json.loads(subprocess.run(["gh", "api", path], check=True, capture_output=True, text=True).stdout)


def tree(repo):
    cached = args.cache / f"tree-{repo}.json"
    if not cached.exists():
        branch = gh(f"repos/{OWNER}/{repo}")["default_branch"]
        cached.write_text(json.dumps(gh(f"repos/{OWNER}/{repo}/git/trees/{branch}?recursive=1")))
    return {x["path"]: x.get("size", 0) for x in json.loads(cached.read_text())["tree"] if x["type"] == "blob"}


def raw(repo, path):
    cached = args.cache / "raw" / repo / path
    if not cached.exists():
        cached.parent.mkdir(parents=True, exist_ok=True)
        url = f"https://raw.githubusercontent.com/{OWNER}/{repo}/HEAD/" + urllib.parse.quote(path)
        try:
            body = urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=30).read()
        except urllib.error.HTTPError as error:
            if error.code != 404:
                raise  # never cache a network failure as an empty page
            body = b""
        cached.write_bytes(body)
    return cached.read_text("utf8", "replace")


def check(url):
    """(ok, frameable) for a hosted page. Reachability only, not gameplay."""
    if args.offline:
        return True, True
    try:
        r = urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=20)
        body = r.read(4096).decode("utf8", "replace").lower()
        xfo = (r.headers.get("x-frame-options") or "").lower()
        csp = (r.headers.get("content-security-policy") or "").lower()
        frameable = not xfo and "frame-ancestors" not in csp
        return r.status == 200 and "<" in body, frameable
    except Exception:
        return False, True


def asset_ok(url):
    """A script or data file behind a CDN <base> still exists."""
    if args.offline:
        return True
    try:
        r = urllib.request.urlopen(urllib.request.Request(url, headers=UA, method="GET"), timeout=20)
        return r.status == 200 and not (r.headers.get("content-type") or "").startswith("text/html")
    except Exception:
        return False


def norm(title):
    t = title.lower().replace("&", "and")
    t = re.sub(r"\((?:fixed|web ?port|online|unblocked|html5)\)|\bweb ?port\b|\bunblocked\b", "", t)
    t = re.sub(r"[^a-z0-9]", "", t)
    return ALIASES.get(t, t.removeprefix("the") if len(t) > 6 else t)


ALIASES = {
    "1v1": "1v1lol", "amongus": "amongus", "usservice": "amongus", "bitlifelifesimulator": "bitlife",
    "geometrydashlite": "geometrydash", "dinosaurgame": "dinogame", "chromedinosaurgame": "dinogame", "chromedino": "dinogame",
    "minecraft": "minecraft188", "minecraft188eaglercraftx": "minecraft188", "eaglercraft": "minecraft188", "eaglercraft188": "minecraft188",
    "subway": "subwaysurfers", "fnf": "fridaynightfunkin", "fridaynightfunkinweekend1": "fridaynightfunkin", "asteroidgame": "asteroids",
    "undertaleyellowfanmadeprequel": "undertaleyellow", "bobtherobber": "bobtherobber2", "antiterroristrush3": "atr3",
    "geometrydashhacked": "geodashhacked", "puzzlemaker": "fifteenpuzzlemaker", "animeclicker": "animeclicker102",
    "fnaf": "fivenightsatfreddys", "fnaf2": "fivenightsatfreddys2", "baldisbasicsclassicremastered": "baldiremaster",
    "baldisbasicsplus": "baldiplus", "bendyandtheinkmachine": "bendyandtheinkmachine", "bendyantheinkmachine": "bendyandtheinkmachine",
    "kindergarten1": "kindergarten", "learn2fly": "learntofly", "ultrakillofflinedownload": "ultrakill", "slender8pages": "slender",
    "slendertheeightpages": "slender", "omorifixed": "omori", "cupheadremake": "cuphead", "repo": "repo", "rep0": "repo",
    "hollowknightweb": "hollowknight", "themanfromthewindow": "manfromthewindow",
    "manfromthewindow": "manfromthewindow", "themaninthewindow": "manfromthewindow", "laceysflashgames": "lacysflashgames",
    "fearstofathomhomealone": "fearstofathom",
    "tictactoe": "tictactoe", "crossyroad": "crossyroad", "crossy": "crossyroad", "cookieclicker": "cookieclicker",
    "retrobowl": "retrobowl", "worldshardestgame": "worldshardestgame", "worldshardestgame2": "worldshardestgame2",
    "stickmanhook": "stickmanhook", "superhotprototype": "superhot", "rocketleagueshitversion": "rocketleague",
    "mfrwebport": "myfemboyroommate", "mfr": "myfemboyroommate", "savethedoge": "savethedoge", "petsimulatorx": "petsimulatorx",
    "playlistcovermaker": "playlistsgenerator", "sonic1": "sonicthehedgehog", "sonicthehedgehog1": "sonicthehedgehog",
}

GAME_HUB = {
    "amanda-the-adventurer": ("Amanda the Adventurer", "Horror"), "andys-apple-farm": ("Andy's Apple Farm", "Horror"),
    "baldi-plus": ("Baldi's Basics Plus", "Horror"), "baldi-remaster": ("Baldi's Basics Classic Remastered", "Horror"),
    "bendy": ("Bendy and the Ink Machine", "Horror"), "bergentruck": ("BERGENTRUCK 201x", "Racing"),
    "bloodmoney": ("BLOODMONEY!", "Horror"), "buckshot-roulette": ("Buckshot Roulette", "Horror"),
    "class-of-09": ("Class of '09", "Adventure"), "dead-plate": ("Dead Plate", "Horror"), "deadseat": ("Deadseat", "Horror"),
    "deltatraveler": ("Deltatraveler", "Adventure"), "donottakethiscathome": ("Do NOT Take This Cat Home", "Horror"),
    "fears-to-fathom": ("Fears to Fathom: Home Alone", "Horror"), "getting-over-it": ("Getting Over It", "Action"),
    "happy-sheepies": ("Happy Sheepies", "Simulation"), "hotline-miami": ("Hotline Miami", "Action"),
    "human-expenditure-program": ("Human Expenditure Program", "Horror"), "jelly-drift": ("Jelly Drift", "Racing"),
    "karlson": ("Karlson", "Action"), "kindergarten/1": ("Kindergarten", "Adventure"), "kindergarten/2": ("Kindergarten 2", "Adventure"),
    "lacysflashgames": ("Lacey's Flash Games", "Horror"), "milkman-karlson": ("Milkman Karlson", "Action"),
    "minesweeperplus": ("Minesweeper Plus", "Puzzle"), "omori-fixed": ("OMORI", "Adventure"),
    "people-playground": ("People Playground", "Simulation"), "pizza-tower": ("Pizza Tower", "Action"), "raft": ("Raft", "Simulation"),
    "repo": ("R.E.P.O.", "Horror"), "schoolboy-runaway": ("SchoolBoy Runaway", "Adventure"), "slender": ("Slender: The Eight Pages", "Horror"),
    "sonic.exe": ("Sonic.exe", "Horror"), "speed-stars": ("Speed Stars", "Racing"), "tattletail": ("Tattletail", "Horror"),
    "thats-not-my-neighbor": ("That's Not My Neighbor", "Horror"), "the-man-in-the-window": ("The Man From the Window", "Horror"),
    "ultrakill": ("ULTRAKILL", "Action"), "undertale-yellow": ("Undertale Yellow", "Adventure"), "web-fishing": ("Webfishing", "Simulation"),
    "witch-heart": ("Witch Heart", "Adventure"), "yandere-simulator": ("Yandere Simulator", "Simulation"), "yume-nikki": ("Yume Nikki", "Adventure"),
}
STANDALONE = {  # repo: (title, category, entry html)
    "angry": ("Angry Birds 2", "Arcade", "index.html"), "granny": ("Granny", "Horror", "index.html"),
    "Kindergarten3": ("Kindergarten 3", "Adventure", "index.html"), "escape-road": ("Escape Road 3", "Racing", "index.html"),
}
FEATURED = ["minecraft262", "hollowknight", "buckshotroulette", "karlson", "pizzatower", "undertaleyellow", "slope", "retrobowl",
            "subwaysurfers", "geometrydash", "omori", "peopleplayground", "cuphead", "1v1lol", "fridaynightfunkin", "repo"]
CATEGORY_HINTS = [(r"horror|granny|fnaf|five nights|baldi|backrooms?|slender|scary|neighbor|bendy|amanda|poppy|freddy|creepy", "Horror"),
                  (r"drift|rac(?:e|er|ing)|cars?|moto\w*|trucks?|kart\w*|road|bikes?|polytrack|traffic|parking|driv(?:e|er|ing)", "Racing"),
                  (r"puzzle|2048|tetris|sudoku|wordle|chess|blocks?|riddle|minesweeper|mahjong|sort|merge|maze|quiz|cut the rope", "Puzzle"),
                  (r"shoot\w*|guns?|sniper|duel|fight\w*|war|wars|bullet|kill\w*|battle|smash|1v1|zombies?|ninja|sword|tank", "Action"),
                  (r"sim(?:ulator)?|tycoon|clicker|idle|papa'?s|garden|farm|cooking|restaurant|shop", "Simulation"),
                  (r"soccer|football|basket\w*|baseball|golf|bowl|sports?|goal|tennis|hockey|boxing|pool", "Sports"),
                  (r"funkin|fnf|rhythm|osu|piano|beat|music|dance", "Rhythm")]


def guess_category(title):
    for pattern, category in CATEGORY_HINTS:
        if re.search(r"\b(?:" + pattern + r")\b", title, re.I):
            return category
    return "Arcade"


def relative_refs(html):
    refs = re.findall(r"(?:src|href)\s*=\s*\"([^\"#?]+)", html, re.I) + re.findall(r"(?:src|href)\s*=\s*'([^'#?]+)", html, re.I)
    refs += re.findall(r"[\"']((?:Build|build|js|data|TemplateData|html5game|game)/[^\"'?#\s]+\.[a-z0-9]+)[\"']", html)
    return [r for r in refs if not re.match(r"^(?:[a-z]+:|//|/|data:|#)", r, re.I) and "${" not in r]


def mirror_source(repo, files, path):
    """gh:repo/path, with ?own when the repository holds the page's own files.
    Returns (source or None, note)."""
    if path not in files:
        return None, "entry page missing"
    html = raw(repo, path)
    base_dir = path.rsplit("/", 1)[0] + "/" if "/" in path else ""
    cdn = CDN_BASE.search(html) or CDN_FOLDER.search(html)
    refs = relative_refs(CDN_BASE.sub("", html))
    code = [r for r in refs if re.search(r"\.(?:js|json|data|wasm|unityweb|pck)$", r)]
    present = [r for r in code if urllib.parse.unquote(base_dir + r.lstrip("./")) in files]
    # The CDN folder has the same name as ours and ours is a full game folder: same files.
    same_folder = cdn and urllib.parse.urlparse(cdn.group(1)).path.rstrip("/").split("/")[-1] == base_dir.rstrip("/").split("/")[-1] \
        and sum(1 for f in files if f.startswith(base_dir)) >= 4
    if cdn and (same_folder or code and len(present) == len(code)):
        return f"gh:{repo}/{path}?own", "own files"
    if cdn:
        base = cdn.group(1)
        if code and not asset_ok(urllib.parse.urljoin(base, code[0])):
            return None, "CDN copy behind <base> is gone: " + base
    return f"gh:{repo}/{path}", "mirrored"


def t9_source(files, href):
    """T9 pages are either a frame around another site or a page of their own."""
    path = urllib.parse.unquote(href.lstrip("/"))
    match = {p.lower(): p for p in files}.get(path.lower())
    if not match:
        return None, "missing from t9_z13"
    html = raw("t9_z13", match)
    if re.search(r"<title>\s*T9 Browser|uv/uv\.config\.js", html, re.I):
        return None, "T9's proxy browser page, not a game"
    stripped = re.sub(r"<script\b[^>]*>[\s\S]*?</script\s*>", lambda m: "" if len(m[0]) < 65536 and ADS.search(m[0]) else m[0], html, flags=re.I)
    frames = re.findall(r"<iframe\b[^>]*\bsrc\s*=\s*[\"']([^\"']+)[\"']", stripped, re.I)
    other_scripts = re.findall(r"<script\b[^>]*\bsrc\s*=", stripped, re.I)
    if len(frames) == 1 and not other_scripts and not re.search(r"<canvas|unity|createUnityInstance", stripped, re.I):
        inner = frames[0]
        if inner.startswith("https://"):
            return inner, "frame"
        if inner.startswith("/") and not inner.startswith("//"):
            inner_path = inner.strip("/")
            index = inner_path + "/index.html" if not inner_path.endswith(".html") else inner_path
            if index in files:
                return f"gh:t9_z13/{index}", "mirrored inner page"
            return None, "inner page missing: " + inner
    return mirror_source("t9_z13", files, match)


def rank(source):
    # T9 pages are thin wrappers, so a hosted copy elsewhere usually plays better.
    return RANK[kind(source)] + (1.5 if source.startswith("gh:t9_z13/") else 0)


def kind(source):
    return "local" if source.startswith("/") else "mirror" if source.startswith("gh:") else "caver" if source.startswith("caver:") else \
        "same" if source.startswith(f"https://{OWNER}.github.io/") else "frame"


RANK = {"local": 0, "same": 1, "mirror": 2, "frame": 3, "caver": 4}
STATUS = {"local": "Installed", "same": "Ported", "mirror": "Ported", "frame": "Hosted", "caver": "Via Caver"}
BOILERPLATE = re.compile(r"\s*(?:Opens the existing hosted game in a new tab\.|Gameplay has not been verified\.)")

report = {"dropped": [], "added": [], "merged": []}
old = json.loads((ROOT / "manifest.json").read_text())
entries, by_key = [], {}


# Kept out of the catalog on purpose: junk gn-math titles and the older Minecraft
# versions (Minecraft 26.2 and Pocket Edition stay).
KEEP_MINECRAFT = {"minecraft262", "minecraftpocketedition"}
RENAMES = {"pulse": "Reaction Time Tester"}
# The page loads but the game inside is gone (404 or missing files), checked 2026-10-29.
BROKEN = {"catalog-stackball", "gp-oneshot"}


def excluded(title):
    raw = re.sub(r"[^a-z0-9]", "", title.lower())
    return len(raw) <= 1 or "minecraft" in raw and raw not in KEEP_MINECRAFT or "eaglercraft" in raw


def add(entry, sources, why):
    entry["title"] = RENAMES.get(entry.get("id"), entry["title"])
    if excluded(entry["title"]) or entry.get("id") in BROKEN:
        report["dropped"].append(f"{entry['title']}: excluded")
        return None
    key = norm(entry["title"])
    sources = [s for s in sources if s]
    if key in by_key:
        target = by_key[key]
        new = [s for s in sources if s not in target["sources"]]
        # Keep the full title ("Subway Surfers" over "Subway") when merging aliases.
        if re.sub(r"[^a-z0-9]", "", target["title"].lower()) != key and re.sub(r"[^a-z0-9]", "", entry["title"].lower()) == key:
            target["title"] = entry["title"]
        if new:
            target["sources"] += new
            report["merged"].append(f"{entry['title']} → {target['title']}: {why}")
        for field in ("cover", "controls", "license", "author", "saves"):
            if field in entry and field not in target:
                target[field] = entry[field]
        if any(s.startswith("/") for s in sources):
            target["description"] = entry["description"]  # a copy in this pack describes itself best
        return target
    entry["sources"] = sources
    entries.append(entry)
    by_key[key] = entry
    if why != "existing":
        report["added"].append(f"{entry['title']}: {why}")
    return entry


# 1. Existing catalog. Old new-tab links become in-site sources.
for g in old:
    if g["id"] == "repo-name":
        continue  # placeholder record pointing at example.com
    external = g.get("proxyTarget") or g.get("remoteUrl") or g.get("launchUrl")
    sources = g["sources"] if "sources" in g else ["caver:" + external] if g.get("launchViaCaver") and external else [g.get("path"), external]
    entry = {k: v for k, v in g.items() if k not in ("sources", "path", "launchUrl", "remoteUrl", "proxyTarget", "launchViaCaver", "openExternally", "sourceChecked", "unavailableReason", "mark", "status", "featured")}
    # A pack file that was removed (Eaglercraft 1.8 became Minecraft 26.2) takes its local-only details with it.
    gone = [s for s in sources if s and s.startswith("/") and not (REPO / s.lstrip("/")).is_file()]
    if gone:
        sources = [s for s in sources if s not in gone]
        for field in ("saves", "license", "controls"):
            entry.pop(field, None)
        entry["description"] = ""
    entry["description"] = BOILERPLATE.sub("", entry.get("description", "")).strip()
    if re.search(r"·\s*discovered in the requested game collections\.$|from (?:the GamePlaza library|your repository collections)\.$", entry["description"]):
        entry["description"] = f"By {g['author']}." if g.get("author") else ""
    if entry["category"] == "Arcade" and all(s.startswith("gn-math/") for s in g.get("catalogSources", ["gn-math/"])):
        entry["category"] = guess_category(entry["title"])  # the bulk import filed everything under Arcade
    add(entry, sources, "existing")

# 2. game-hub: Unity, GameMaker, Godot and RPG Maker ports (14 GB, mirrored).
hub = tree("game-hub")
for folder, (title, category) in GAME_HUB.items():
    pages = sorted((p for p in hub if p.startswith(folder + "/") and p.count("/") == folder.count("/") + 1 and p.endswith((".html", ".htm"))),
                   key=lambda p: not p.endswith("/index.html"))
    page = folder + "/home-alone/index.html" if folder == "fears-to-fathom" else next(iter(pages), None)
    source, note = mirror_source("game-hub", hub, page) if page else (None, "no entry page")
    if not source:
        report["dropped"].append(f"game-hub/{folder}: {note}")
        continue
    add({"id": "hub-" + re.sub(r"[^a-z0-9]+", "-", folder.lower()).strip("-"), "title": title, "category": category,
         "color": "#1b1638", "description": "Web port from game-hub.", "catalogSources": [f"{OWNER}/game-hub:{folder}"]}, [source], "game-hub " + note)

# 3. Standalone game repositories without a working Pages site.
for repo, (title, category, page) in STANDALONE.items():
    source, note = mirror_source(repo, tree(repo), page)
    if not source:
        report["dropped"].append(f"{repo}: {note}")
        continue
    add({"id": "repo-" + repo.lower(), "title": title, "category": category, "color": "#1b2a4a",
         "description": f"From the {repo} repository.", "catalogSources": [f"{OWNER}/{repo}"]}, [source], repo + " " + note)

# 4. T9's curated library (g10.html), without its popunder ad scripts.
t9 = tree("t9_z13")
for name, href, image in re.findall(r'\{name:"([^"]+)",href:"([^"]+)",img:"([^"]*)"\}', raw("t9_z13", "g10.html")):
    source, note = t9_source(t9, href)
    if not source:
        report["dropped"].append(f"T9 {name}: {note}")
        continue
    add({"id": "t9-" + re.sub(r"[^a-z0-9]+", "-", href.lower().rsplit("/", 1)[-1].removesuffix(".html")).strip("-"), "title": name,
         "category": guess_category(name), "color": "#241640", "description": "From the T9 library.",
         "catalogSources": [f"T9:{href.lstrip('/')}"]}, [source], "T9 " + note)

# 5. Pages in b-rn1c-1 and GamePlaza that were not in the catalog yet (same site as Vexel).
for title, path, category in [("Pet Simulator X", "b-rn1c-1/Games/psx.html", "Simulation"),
                              ("Playlist Cover Maker", "b-rn1c-1/Games/playlists-generator-main/index.html", "Puzzle"),
                              ("Papa's Freezeria", "GamePlaza/games/ruffles/freeze.html", "Simulation"),
                              ("Pac-Man (Flash)", "GamePlaza/games/ruffles/pacman.html", "Arcade"), ("Tetris (Flash)", "GamePlaza/games/ruffles/tetris.html", "Puzzle")]:
    add({"id": "repo-" + re.sub(r"[^a-z0-9]+", "-", title.lower()).strip("-"), "title": title, "category": category, "color": "#1b2a4a",
         "description": f"From {path.split('/')[0]}.", "catalogSources": [path.replace("/", ":", 1)]},
        [f"https://{OWNER}.github.io/" + urllib.parse.quote(path)], "repository page")

# 6. Minecraft 26.2 (EaglercraftX Wasm-GC), packed from its single-file build by
# scripts/pack-minecraft.mjs. The older Eaglercraft 1.8 copies merge into "Minecraft 1.8.8".
if (REPO / "games" / "minecraft-26-2" / "index.html").is_file():
    add({"id": "minecraft-26-2", "title": "Minecraft 26.2", "category": "Adventure", "color": "#2b3a1f",
         "description": "Minecraft 26.2 in your browser (EaglercraftX Wasm-GC). Worlds save in your browser. The first launch downloads about 54 MB.",
         "saves": True, "license": "EaglercraftX community build; Minecraft is © Mojang AB",
         "controls": "WASD to move · mouse to look · E for inventory · Esc for the menu"},
        ["/games/minecraft-26-2/index.html"], "Minecraft 26.2 pack")

# 7. Check hosted pages, move frame-refusing sites to Caver, drop dead copies.
external = sorted({s for g in entries for s in g["sources"] if s.startswith("https://")})
with cf.ThreadPoolExecutor(24) as pool:
    results = dict(zip(external, pool.map(check, external)))
dead = sum(1 for ok, _ in results.values() if not ok)
if external and dead > len(external) // 4:
    sys.exit(f"{dead} of {len(external)} links failed; that looks like a network problem, so nothing was written.")
for g in entries:
    kept = []
    for s in g["sources"]:
        if s in results:
            ok, frameable = results[s]
            if not ok:
                report["dropped"].append(f"{g['title']}: unreachable {s}")
                continue
            if not frameable and kind(s) == "frame":
                s = "caver:" + s
            if kind(s) == "same":
                # Same-site pages that carry ads go through the mirror, which strips them.
                repo, _, path = urllib.parse.unquote(s.removeprefix(f"https://{OWNER}.github.io/")).partition("/")
                path = path + "index.html" if not path or path.endswith("/") else path
                if ADS.search(raw(repo, path)):
                    s = f"gh:{repo}/{path}"
        kept.append(s)
    g["sources"] = sorted(dict.fromkeys(kept), key=rank)
    g["status"] = STATUS[kind(g["sources"][0])] if g["sources"] else "Awaiting source"
    if not g["sources"]:
        g["unavailableReason"] = "No working copy of this game was found in the connected repositories yet."
    if norm(g["title"]) in FEATURED:
        g["featured"] = True
    elif "featured" in g:
        del g["featured"]

# A title discovered in this run with no working copy is not worth a catalog card.
new_ids = {g["id"] for g in old}
entries = [g for g in entries if g["sources"] or g["id"] in new_ids]
ids = set()
for g in entries:
    while g["id"] in ids:
        g["id"] += "-2"
    ids.add(g["id"])
entries.sort(key=lambda g: (not g.get("featured"), g["title"].lower()))
if not args.offline:  # unchecked links must never reach the catalog
    (ROOT / "manifest.json").write_text(json.dumps(entries, indent=1, ensure_ascii=False) + "\n")
counts = {k: sum(1 for g in entries if g["sources"] and kind(g["sources"][0]) == k) for k in RANK}
summary = {"total": len(entries), "playable": sum(1 for g in entries if g["sources"]), "byFirstSource": counts,
           "multipleSources": sum(1 for g in entries if len(g["sources"]) > 1), **report}
if not args.offline:
    (REPO / "docs" / "game-sources" / "repository-import.json").write_text(json.dumps(summary, indent=1, ensure_ascii=False) + "\n")
print(json.dumps({k: v if not isinstance(v, list) else len(v) for k, v in summary.items()}, indent=1))
