# Verification — October 24, 2026

## Current checks (0.5)

- Fourteen automated test groups pass: accounts, sessions, preferences, economy, authorization, content separation, proxy origin handling, catalog-only game probes, dynamic block signatures, false positives, and private-address rejection.
- Browser verified: supplied logo on home/sidebar/top bar, navigation, game preview and installed game launch, Deltarune chapter menu, actual Scramjet navigation, Alpine boot and root shell, and Big Buck Bunny remote playback readiness.
- Controlled browser fixture verified the exact blocked-page message and Open in Caver button. Clicking it opened the original URL, including its query string, through the real Scramjet route.
- Block detection ignores blank pages, loading pages, ordinary errors, iframe restrictions, hidden/script text and unrelated denial pages. Dynamic IDs, wrappers, whitespace and entities are covered by tests.
- Page transitions use a 150 ms opacity/translation animation and are disabled by lightweight mode, reduced-motion preference or the motion setting. Game checks run once per launch, have bounded network requests, and are cancelled when leaving the player.

## Limits and unverified flows

Cross-origin browser rules prevent reading arbitrary iframe documents. Vexel also probes the catalog-approved URL from the server; browser-only network filters may therefore be invisible. The manual Caver button remains available. Blank pages alone never trigger the blocked fallback.

Google/Microsoft sign-in needs deployment credentials. Real Firestore request delivery, email recovery, ad-provider integration, VM state import/export, all game win/loss paths, physical low-end-device performance, Docker and public deployment remain unverified. GTA gameplay is unverified; only its source loader was inspected. Remote sources can change or refuse framing.

The catalog contains 919 entries: 17 installed games, 3 remote players, 11 external launchers and 888 entries awaiting legitimate sources. The movie catalog has 13 records with 5 connected open-film streams. Protected media payloads were not copied.

Local game pack update: Dino Game and Adventures with Anxiety now load from vex-games. Dino gameplay start and Anxiety loading/title screen were browser-smoke-tested. Upstream licenses, source pins and credits remain in each game directory; full story completion is unverified.

## Static deployment and provider changes

A static HTTP preview under `/vexel/` loads without `/api` or a Node backend. Browser verified catalog pagination/search, MMG preview and sandboxed singleplayer start. Firebase and live Google/Microsoft/Discord sign-in remain unverified because no provider credentials/project are configured. Local signed-token provider tests cover Google/Microsoft audiences, nonce, issuer/tenant handling, Discord profile validation, cookie binding, callback replay and cancellation.

Pages mode deliberately disables shared backend features. Static cross-origin blocked-game detection is limited by the browser same-origin policy. Runtime asset and Alpine boot-image copies are checked in and published without requiring an npm/pnpm build. VM boot on the final Pages origin still needs verification.
