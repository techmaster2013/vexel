#!/usr/bin/env python3
"""Give every catalog game without a cover one, saved in games/covers/.

Covers come from GN-Math's cover set (matched by GN-Math ID, then by title) or from
the image T9 shows for the game. Each is center-cropped to 16:9 and saved as a small
WebP (384x216), so the library loads quickly and works when CDNs are blocked.

Usage: python3 scripts/fetch-covers.py    (needs Pillow: pip install pillow)
"""
import concurrent.futures as cf, io, json, pathlib, re, urllib.parse, urllib.request
from PIL import Image

REPO = pathlib.Path(__file__).resolve().parents[1]
MANIFEST = REPO / "games" / "manifest.json"
COVERS = REPO / "games" / "covers"
UA = {"User-Agent": "vexel-covers"}
GN_COVERS = "https://raw.githubusercontent.com/gn-math/covers/main/"
T9 = "https://raw.githubusercontent.com/techmaster2013/t9_z13/HEAD/"


def get(url):
    return urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=30).read()


def key(title):
    return re.sub(r"[^a-z0-9]", "", title.lower().replace("&", "and"))


zones = json.loads(get("https://raw.githubusercontent.com/gn-math/assets/main/zones.json"))
zone_cover = {z["id"]: z["cover"].replace("{COVER_URL}/", GN_COVERS) for z in zones if z.get("cover", "").startswith("{COVER_URL}/")}
title_cover = {key(z["name"]): zone_cover[z["id"]] for z in zones if z["id"] in zone_cover}
t9_list = re.findall(r'\{name:"([^"]+)",href:"([^"]+)",img:"([^"]*)"\}', get(T9 + "g10.html").decode("utf8", "replace"))
t9_image = {}
for name, href, img in t9_list:
    url = img if img.startswith("https://") else T9 + urllib.parse.quote(img.lstrip("/"))
    t9_image[href.lstrip("/").lower()] = url
    title_cover.setdefault(key(name), url)


def candidates(g):
    for s in g.get("catalogSources", []):
        if m := re.match(r"gn-math/assets:zones\.json#(\d+)$", s):
            yield zone_cover.get(int(m[1]))
    for s in g["sources"]:
        if m := re.match(r"https://gn-math\.github\.io/html/(\d+)", s):
            yield zone_cover.get(int(m[1]))
        if s.startswith("gh:t9_z13/"):
            yield t9_image.get(s[10:].split("?")[0].lower())
    for s in g.get("catalogSources", []):
        if s.startswith("T9:"):
            yield t9_image.get(s[3:].lower())
    yield title_cover.get(key(g["title"]))


def save(job):
    g, urls = job
    for url in urls:
        try:
            image = Image.open(io.BytesIO(get(url))).convert("RGB")
        except Exception:
            continue
        w, h = image.size
        if w < 64 or h < 64:
            continue
        # Center-crop to 16:9, the shape of a library card.
        if w / h > 16 / 9:
            crop = int(h * 16 / 9); image = image.crop(((w - crop) // 2, 0, (w + crop) // 2, h))
        else:
            crop = int(w * 9 / 16); image = image.crop((0, (h - crop) // 2, w, (h + crop) // 2))
        image.resize((384, 216), Image.LANCZOS).save(COVERS / f"{g['id']}.webp", "WEBP", quality=72, method=6)
        return g["id"], f"/games/covers/{g['id']}.webp"
    return g["id"], None


games = json.loads(MANIFEST.read_text())
jobs = [(g, list(dict.fromkeys(u for u in candidates(g) if u))) for g in games if not g.get("cover")]
COVERS.mkdir(exist_ok=True)
with cf.ThreadPoolExecutor(16) as pool:
    found = dict(pool.map(save, [j for j in jobs if j[1]]))
for g in games:
    if found.get(g["id"]):
        g["cover"] = found[g["id"]]
MANIFEST.write_text(json.dumps(games, indent=1, ensure_ascii=False) + "\n")
missing = [g["title"] for g in games if not g.get("cover")]
print(f"{sum(1 for v in found.values() if v)} covers added; {len(missing)} games still without one.")
print("Without cover:", ", ".join(missing[:60]))
