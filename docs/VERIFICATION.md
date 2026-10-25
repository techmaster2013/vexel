# Verification — Vexel 1.0

## Automated checks

18 test groups pass: backend accounts/sessions/privileges/economy, catalog and probes, block signatures/false positives/private-address rejection, Google/Microsoft signed-token verification, Discord OAuth flow, one-use/expiry/origin-bound Firebase bridge logic, popup-source/channel checks, username identifiers and incorrect-login message mapping.

Pinned Firebase Admin 14.5.0 imports successfully with optional package build scripts disabled. No real service-account credentials or provider tokens were used in tests.

## Browser evidence

Earlier published Pages smoke checks: home/logo, per-reload changelog, catalog/search/pagination, MMG sandboxed singleplayer, URL Chess board, Canvas Tetris start. The static preview rendered the 3D City title screen after worker/texture sandbox fixes. Earlier Alpine boot/root shell, Scramjet navigation and open-film playback readiness were verified locally.

Version 1 changes require the final browser checks recorded by the task: minimal changelog, no manga navigation, exact wrong-login text, Caver-required Pac-Man/Eggfish records and static deployment publication.

## Limits

No real Firebase project/provider configuration or production Wisp endpoint is present. Live Google/Microsoft/Discord sign-in, custom-token delivery with real credentials, production Docker/Caddy and full game playthroughs remain unverified. Local SQLite owner privileges remain private to the local database.

The supplied Pac-Man HTML is a wrapper and still needs Google's remote game; Google's frame-ancestors policy prevents direct third-party framing. The wrapper is routed through Caver, not represented as a standalone offline game. Eggfish is creator-hosted and its asset/code inventory is metadata only.

GitHub Pages cannot read arbitrary cross-origin iframe documents. Static known-block detection remains limited to readable evidence; Node mode can probe approved URLs. Blank pages, normal errors and iframe restrictions never imply a network block.

## Main-only editor update

19 automated test groups pass. Static editor sign-in screen visually checked. Editor records round-trip and unsafe URL rejection are tested. The GamePlaza Firebase account, admin custom claim and Firestore rule block are not deployed or verified against the live project; the editor fails closed without them. No real admin credentials were available. The rule block is a prototype for review in the existing project, not a replacement for GamePlaza rules.
