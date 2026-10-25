# Reference audit — October 24, 2026

The references were inspected before implementation. No existing source repositories were modified. No third-party game payloads, proprietary music/film/manga, credentials, existing user databases, or analytics configurations were imported.

## Existing projects

| Source | Inspection | Decision |
|---|---|---|
| techmaster2013/vexel | README and GPL-3.0 license only | Preserve license; create platform in this repository. |
| techmaster2013/vex-games | README only, private repo | Preserve privacy; add original game pack and manifest. |
| GamePlaza | Home, plaza styling, requests page, repository tree | Preserve search/favorites/changelog concepts; navy visual descendant. Request system is Firebase Firestore, collection `feedback`, fields category/message/game/source/status/createdAt. Vexel uses that schema via REST; no writes during research. |
| coreHZ | index, styling, JavaScript routing layer | Preserve integrated browser/tool hub role. Avoid its encoded external route indirection and third-party AI routing. AI provider integration is deferred. |
| GPT-corner | README, app source and project structure | Reimplement pocket tools, pixel editor, and synthesized music pads as original Vexel modules. No fake terminal presented as a real VM. |
| nexSite | package manifest, browser startup and build scripts, service worker | Reuse the studied Scramjet 2/controller/libcurl API pattern with pinned packages and operator-configured Wisp. No shared endpoint assumption. |
| nexite | auth, room/message handling, markdown, database rules | Preserve room-based interaction; new SQLite-backed Vexel accounts/chat. No users migrated; DMs/friends/attachments deferred. |
| StreamPlaza | app, local-file library/resume, manifest model | Local video reader with resume, watchlist and license-aware catalog records. No existing video files copied. |
| bv3 (Barnical) | navigation, themes, performance mode, recents, likes and category logic | Sidebar, category chips, compact option and low-end rendering informed the original interface. No source UI copied. |

## External references

| Source | Observed result | Treatment |
|---|---|---|
| Frogie's Arcade / FrogiesArcade GitHub profile, frogiee.one project presentation | Hybrid games/apps/proxy platform, project and music presentation | Informed consolidated platform structure; no game payload imports. |
| tru.ss | HTTP 200, Svelte client shell | Reference catalog metadata only; gameplay/license not verified. |
| d.sillyprootsoda.com | HTML loader with fullscreen, controls, save import/export, game archive references | Studied player utilities; Deltarune payloads not copied. Save import/export is not implemented for arbitrary cross-origin games. |
| gta.deloskiyt.pl | Migration page redirects toward FIVEPLAY.LOL | Unavailable reference record; no claim of a working GTA V browser game. Redirect not used as a playable source. |
| noterplusbunny3428.b-cdn.net (Nexora) | HTTP 200; navigation, assistant, circles, themes, announcements; note stating proxy worker removed | Theme/navigation/announcement architecture studied. No content, analytics, remote scripts or games copied. |
| sakuravault.netlify.app | HTTP 200 loader tries multiple Vault HTML filenames and references VM loading | Loader inspected; full Vault and VM internals unverified. No copied payloads. |
| s3.amazonaws.com/math/index.html | HTTP 200 modular shell and early configurable tab identity | Settings concept studied; content rights not verified. |
| blackwaves.up.railway.app | HTTP 404 in direct check; web tool inaccessible | No functionality reproduced from this inaccessible source. |
| gn-math.github.io / gn-math.dev | Old URL 404; current site HTTP 200; game-zone info, fullscreen, new tab, settings | Studied catalog/player controls. No zone payloads, ad scripts, covers or games copied. |
| nowgg.fun | HTTP 503 | Cloud gaming integration unavailable; no claimed local substitute. |
| cdn.jsdeliver.net/gh/coinbaselarper/svglatest/logo.svg# | Supplied hostname failed certificate verification; no bypass attempted. Correctly spelled jsDelivr host returned 404 | No asset used and no logo copied. |
| lemanga | User has no link | Only user-described reader concept implemented; source not inspected. |
| Koopbin | User states temporarily shut down | Only user-described reactive wallpaper/media/music concepts implemented; source not inspected. |
| tryliner.fun | Product page inspected: desktop music library/player, timed lyrics, reactive visuals and imports | Original local browser audio queue and LRC line lyrics. No binaries downloaded, proprietary code copied, or service-stream extraction reproduced. Full port not implemented. |
| Orb.Farm | HTTP 200 client app shell, ecosystem concept | Optional external experience. No code/assets copied. |
| Radio Garden | HTTP 200 JavaScript globe/radio client | Optional external experience. No station catalog or streams copied. |

The user clarified that inspiration sites should not be linked in the app. These source locations are recorded here for maintainers; public UI does not add launch links to those inspirations. Radio Garden and Orb.Farm are explicit optional experiences requested separately. Film project links are attribution, not inspiration shortcuts.

## Media

Blender Studio's official films index was inspected for title/year metadata; official project licensing pages establish the open-film model and that licenses must be checked per asset. Four older films have known CC BY credits; eight additional records are metadata previews pending per-title verification.

The common Google sample-bucket endpoints returned HTTP 403 during checks and were disabled in the app. A Tears of Steel WebM endpoint at media.xiph.org returned HTTP 200 with `video/webm`, and Blender's official 720p MOV endpoint also returned 200. Only the verified WebM endpoint is enabled. No remote video was downloaded or bundled. Actual browser decoding remains unverified.

Useful source documentation: https://studio.blender.org/films/ ; https://studio.blender.org/remixing/ ; https://studio.blender.org/projects/sprite-fright/pages/about/ ; https://github.com/MercuryWorkshop/scramjet ; https://developers.google.com/identity/openid-connect/openid-connect ; https://learn.microsoft.com/en-us/entra/identity-platform/v2-protocols-oidc ; https://github.com/panva/jose .

## Revision 0.2 — corrected Barnical reference

The user specified **https://barnical.github.io/GameSite/**. Its live HTML, stylesheet and game metadata were inspected, and the page was opened in the browser. The actual reference uses a compact category sidebar with counts, a black canvas, editorial Fraunces headings with Inter UI, search/sort controls, a recent shelf, and a three-column thumbnail library. Revision 0.2 follows those structural aspects with an original navy/black translucent treatment. The prior marketing hero, green default, and promotional copy were removed.

GamePlaza's title list was migrated as metadata into vex-games, excluding non-game navigation. Requested Truss, Deltarune and GTA V are explicit library records. There are 72 total entries: five installed games and twelve external launchers. Fifty-five are metadata only. External endpoint checks established HTTP 200 for the connected creator/official pages; they do not prove full gameplay or embedding compatibility. External games open after an explicit action and are not represented as installed payloads.

The original MIT-licensed 2048 source was inspected and copied into vex-games, with its license, copyright, original source revision, and credits retained. Changes remove an obsolete “official version” claim and adapt the surrounding colors. Its game loaded successfully in the sandboxed Vexel frame without console errors. No proprietary payload was imported.

Tetris uses the official play.tetris.com page, Pac-Man uses Google's official 2010 doodle, and Zombs Royale uses zombsroyale.io. The Truss launcher uses the user-supplied creator page. GamePlaza source URLs that were not verified are retained only in maintenance provenance, not automatically launched.
