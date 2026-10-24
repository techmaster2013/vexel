> Current 0.4 update: supplied graffiti logo, navy glass home, lightweight page transitions, Caver naming, and conservative external-game block detection with original-URL recovery. See [verification](docs/VERIFICATION.md) for current checks and limitations. Earlier milestone notes below are historical.

# Vexel

Your space to play, watch, make, and connect. A navy/glass successor to GamePlaza, with one platform repository and a separate [vex-games](https://github.com/techmaster2013/vex-games) content repository.

## Run

Requires Node.js 24 and pnpm 11.25 (or newer compatible 11.x).

```sh
git clone https://github.com/techmaster2013/vexel.git
git clone https://github.com/techmaster2013/vex-games.git
cd vexel
cp .env.example .env
pnpm install --frozen-lockfile
pnpm build
pnpm dev
```

Open `http://localhost:3000`. For PR previews, check out the corresponding implementation branch in both repositories. Game content is private in GitHub and requires repository access to clone; credentials never enter browser code.

`pnpm test` uses an isolated temporary database and content fixture. `pnpm build` prepares pinned Scramjet 2 assets; it does not deploy anything. A normal Node server with persistent disk is required. GitHub Pages alone cannot run the account/chat/economy backend.

Alternatively, with both repositories cloned side by side, copy `.env.example` to `.env` and run `docker compose up --build`. The Compose configuration mounts game content read-only and persists SQLite data. Docker execution has not been verified in this environment.

## Included

- Responsive navy interface, glass panels, replaceable `public/logo.svg`, startup changelog, lite mode, motion controls, compact cards, tab title, cursor-reactive wallpaper.
- Game previews, search, categories, random selection, favorites, recents, sandboxed player and fullscreen. Four original games live exclusively in vex-games.
- Persistent username/password accounts with optional email login. Salted scrypt passwords, opaque hashed sessions, HttpOnly cookies, origin checks, bounded input and rate limits.
- Google and Microsoft OIDC authorization-code/PKCE handlers with signed ID-token, issuer, audience, state, binding-cookie and nonce validation. Providers remain disabled until configured.
- Server-stored chat in three rooms, own-message deletion and admin moderation. An original integration of nexite's room concept, not a migration of its users or Firebase data.
- Server-accounted coins, one reward per minute, an audit ledger, three purchasable themes and admin grants. Coins have no cash value. The reward system limits casual farming but does not claim cheat-proof game attestation.
- GamePlaza's existing Firestore `feedback` mechanism/schema. Source is `Vexel`; failed delivery saves a server draft and is explicitly reported. Admins can retrieve drafts at `/api/feedback/drafts`.
- Twelve movie catalog records, watchlist, local video playback and resume. **Only Tears of Steel has a verified remote stream endpoint.** Other film entries clearly say catalog preview. Streaming playback/decoding still needs browser verification. No commercial film payloads are bundled.
- Local manga page reader with vertical/paged modes and RTL layout; no manga payloads or scraping.
- Original soundboard, pixel editor with PNG export, random picker, coin flip, password generator, personal notes, local music queue with persistent player and LRC line lyrics, optional Orb.Farm and Radio Garden launches.
- Scramjet 2 proxy runtime, browser controls, preset applets and explicit setup/failure states.

## Configure deployment

Set `PUBLIC_ORIGIN` to the exact public HTTPS origin. Run behind an HTTPS reverse proxy. SQLite lives at `DATABASE_PATH`; preserve and back it up. This version targets a single server process with persistent disk, not stateless/serverless replicas.

Set `WISP_URL` to an operator-managed compatible Wisp WebSocket endpoint. No shared public endpoint is silently used. Scramjet builds locally; external app compatibility and Wisp navigation are unverified without a configured transport. A dedicated isolated proxy deployment/origin is recommended before running authenticated third-party pages alongside platform accounts.

For Google, register `/auth/google/callback`; set `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`. For Microsoft, register `/auth/microsoft/callback`; set the corresponding keys and `MICROSOFT_TENANT`, matching the app's supported account types. OIDC accounts are keyed by provider subject and are never automatically merged by an unverified email. New provider accounts receive a generated username. Live provider flows need testing with configured apps.

Set `ADMIN_USERNAMES` to a comma-separated list of **already registered, trusted** usernames before exposing admin controls. Never reserve a not-yet-registered name as admin. Email verification, email delivery, password recovery, account linking, OAuth username changes and user self-service deletion are not implemented yet.

Set `GAME_CONTENT_DIR` to the deployed vex-games checkout. Optionally set `GAME_CONTENT_ORIGIN` to a separate HTTPS static content origin (no trailing slash); the manifest is still read from `GAME_CONTENT_DIR`. Untrusted payloads should always use a separate origin. The starter games are served in frames without `allow-same-origin`.

GamePlaza feedback uses `FEEDBACK_PROJECT=gplaza-feedback`; an API key can be supplied through `FEEDBACK_API_KEY` if needed. Existing Firestore rules determine whether delivery is allowed. **No test feedback was posted to the live board.** `FEEDBACK_DRAFT_ONLY=true` retains requests locally and is used by tests. Existing GamePlaza collections and rules were not changed.

Guest ad placements are inert placeholders; no ad network or tracking is loaded. Signed-in users never render the placement. Connecting a network and payout account is separate setup.

## Scope and evidence

See [reference audit](docs/REFERENCE_AUDIT.md), [feature status](docs/STATUS.md), and [verification](docs/VERIFICATION.md). Inspiration sites are not linked from the app. Official film attribution links remain available where relevant.

This first version does not include commercial games, scraped movies/manga, a cloud gaming backend, an Alpine WASM VM image, a full Liner port, external music extraction, a live AI service, or nexite DMs/friends/attachments. Those remain explicit follow-up integrations rather than simulated functionality.

GPL-3.0; no warranty. Third-party dependencies retain their respective licenses. New implementation authored October 24, 2026.

## Revision 0.2

The initial visual design has been replaced after user feedback. Home now opens a Barnical-inspired game library with category counts, Fraunces/Inter typography, navy and black backgrounds, and translucent glass surfaces. Promotional hero text and green branding were removed.

The catalog is now **72 entries: 5 installed, 12 external launchers, 55 awaiting sources**. The installed pack adds the original MIT-licensed 2048 alongside four original games. Deltarune and GTA V are catalog-only; all requested games being playable remains unfinished. Game metadata and payloads remain in vex-games. External launchers open the verified creator/official page rather than claiming the games are hosted locally.
