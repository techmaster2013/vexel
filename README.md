# Vexel

A navy glass game, media and tools platform. The frontend is plain HTML, CSS and JavaScript. GitHub Pages visitors need no Node, npm or pnpm.

## GitHub Pages

Public site: https://techmaster2013.github.io/vexel/

`main` contains the platform source and checked-in browser runtimes. `vex-games/main` contains the game catalog and payloads. The generated `gh-pages` branch contains deployment output from both repositories; the Pages workflow uploads that output without a package-install/build step.

To prepare a new static deployment, use Python (no package installation):

```sh
python3 scripts/prepare-pages.py --games ../vex-games --output ../pages-output
```

Use an empty output directory outside both source repositories. Publish that generated output to `gh-pages`. The workflow deploys it through GitHub Pages Actions. It does not publish databases, server secrets, accounts or source-repository credentials.

Edit `public/pages-config.json` for public Firebase web config and an optional `wss://` Wisp transport. Never place OAuth client secrets in that file. See [authentication setup](docs/AUTH_SETUP.md).

## What works without a backend

Home, the catalog and game previews, installed games, external game launchers, local preferences/favorites/recent games, media playback, local manga reader, soundboard/tools/music, and the on-demand Alpine VM. Browser runtimes and the VM image load only when their feature starts. Large catalogs are paginated.

Cross-origin games are sandboxed. Local sandbox storage is per-frame memory when persistent browser storage is unavailable; it is discarded when the player closes. No game gets access to Vexel account cookies or preferences.

## Connected features

Firebase web configuration enables Google/Microsoft/email authentication on Pages. It is not configured by default. Display names are not unique usernames; cloud preferences, shared chat and secure coin rewards require additional backend integration. Discord is implemented in the optional Node backend and needs registered OAuth credentials plus a running callback server. The original local `owner` account and privileges live only in the local SQLite database; no account database is published to Pages.

Caver uses Scramjet v2 but needs a Wisp WebSocket transport; GitHub Pages cannot provide one. Readable-frame block signatures still work statically; cross-origin server-side block probing requires the optional backend. Blank/error pages are never assumed blocked.

## Optional full backend

Node 24 and the pinned dependencies run the existing SQLite accounts, admin grants, economy, shared chat, GamePlaza Firestore request delivery, OAuth callbacks and built-in Wisp transport. For this optional mode only: install dependencies, copy `.env.example` to `.env`, configure values and run `pnpm dev`. Browser runtime assets are already checked in; `pnpm build` can regenerate them.

See [verification](docs/VERIFICATION.md), [status](docs/STATUS.md), and [third-party notices](THIRD_PARTY_NOTICES.md). Vexel retains GPL-3.0; individual imported games retain their own licenses.
