> Current 0.4 update: supplied graffiti logo, navy glass home, lightweight page transitions, Caver naming, and conservative external-game block detection with original-URL recovery. See [verification](VERIFICATION.md) for current checks and limitations. Earlier milestone notes below are historical.

# First-version status

| Requirement | Status |
|---|---|
| One main repo + separate game payload repo | Implemented; no game payloads in vexel |
| Original identity, navy GamePlaza descendant, Barnical-style organization, glass panels | Implemented |
| Replaceable graffiti logo placeholder | SVG placeholder; final art pending user supply |
| Home, games, apps, request, settings, account, media, social, tools | Implemented routes |
| Game previews after selection | Implemented; launch requires explicit play |
| Search, categories, favorites, recents, random, fullscreen | Implemented |
| Startup changelog | Once per tab session, can reopen |
| Scramjet 2 proxy + preset applets | Runtime/assets and UI implemented; live Wisp setup and navigation unverified |
| Username/email accounts | Persistent password accounts; optional email login; no email verification/recovery |
| Google / Microsoft | OIDC handlers implemented; credentials and live flow verification pending |
| GamePlaza request mechanism | Same Firestore collection/schema; local fallback drafts. Live delivery intentionally untested |
| Nexite-based chatroom idea | Persistent shared rooms, polling, message deletion/moderation; DMs/friends/attachments deferred |
| Coins, customization shop, admin grants | Implemented with server cooldown, transactions and ledger |
| Lots of customization, reactive wallpaper | Three unlockable accents, navy base, wallpaper, density, lite, motion, tab title, import/export |
| StreamPlaza-style media | Local video/resume and remote player implemented |
| Larger onboard film catalog | 12 records; one verified remote stream, 11 preview records pending stream/license checks |
| Manga reading | Local images, scroll/paged, RTL; publisher integration/CBZ deferred |
| Music player / Liner concept | Original local queue, persistent player, timed LRC line lyrics; full port, word sync, library imports deferred |
| Soundboard / GPT Corner tools | Synth pads, pocket tools, notes, pixel editor/export implemented |
| Radio Garden / Orb.Farm | Optional external launches |
| Alpine Linux WASM VM | Deferred; no emulator/image bundled and no fake terminal substitute |
| coreHZ AI functionality | Hub/browser role implemented; live AI integration deferred |
| Ads for logged-out visitors only | Conditional inert placement implemented; no ad network connected |
| Protected games/movies/manga | Not bundled; original game pack and licensed/metadata architecture only |
| Deployment | Node/Docker configuration supplied; not publicly deployed, Docker unverified |

## Next integration work

Configure and verify OIDC and operator-owned Wisp, verify Firestore delivery against current rules, choose a licensed media source strategy and verify streams, select a vetted WASM emulator/image, extend chat parity and account recovery/deletion, then perform a production deployment review. Third-party proxy app compatibility cannot be guaranteed by the shell alone.

## Revision 0.2 supersedes the initial library/design counts above

The default home is now a library rather than a landing page. It uses the user-specified Barnical GameSite structure, navy/black colors, visible translucent glass layers, category counts, plain copy, and new original game illustrations. The old green logo placeholder has been replaced with a neutral navy placeholder.

The catalog now contains 72 entries: **5 installed games, 12 external launchers, and 55 metadata-only entries awaiting sources**. Deltarune and GTA V are not playable additions. The third-party launcher pages were checked for reachability, not full end-to-end gameplay. The 2048 MIT payload is locally installed with attribution and has been browser-tested. All games being playable remains incomplete.
