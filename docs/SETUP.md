# Advanced setup: accounts, Caver and the server

Live site: https://techmaster2013.github.io/vexel/

The website is static HTML/CSS/JavaScript. Visitors and the Pages publishing workflow do not need npm/pnpm. Google/Microsoft/email/username accounts need Firebase configuration. Discord and Caver's Wisp transport need a running backend.

For everyday changes, use **[edit.html](https://techmaster2013.github.io/vexel/edit.html)** after the [one-time editor setup](EDITOR.md).

## 1. Publish changes and make games available

Game source stays in `techmaster2013/vex-games/main`. Platform source and movie/config records stay in `techmaster2013/vexel/main`.

### Give Pages read access to the private game repo once

1. In GitHub Settings → Developer settings → Personal access tokens → Fine-grained tokens, create a token owned by techmaster2013.
2. Select **only vex-games**. Give it **Contents: Read-only** (Metadata read access is automatic). No write permission is needed.
3. In **vexel** → Settings → Secrets and variables → Actions → New repository secret, save it as **VEX_GAMES_TOKEN**. Never commit the token to a file.

Without this secret, Pages still rebuilds platform/movie/public-config changes from main, but uses the game-pack-v1 release archive. New changes in the private game repo cannot be read until access is configured.

### Install a game

1. Upload the complete browser build to `vex-games/games/my-game/`: `index.html`, JavaScript, styles, images, audio, WASM/data files and license/credits. Use files you are allowed to host. An EXE or a webpage containing only an iframe is not a complete local game.
2. Use relative asset paths such as `./Build/game.wasm`, not site-root paths such as `/Build/game.wasm`.
3. Edit the matching record in `vex-games/manifest.json` (or add one with a unique ID). Set `path`, license and status; remove its old `remoteUrl`, `launchUrl`, `proxyTarget`, `launchViaCaver`, `openExternally`, and `unavailableReason` unless intentionally needed.

```json
{
  "id": "my-game",
  "title": "My Game",
  "category": "Arcade",
  "description": "A short description.",
  "path": "/games/my-game/index.html",
  "controls": "Arrow keys or WASD",
  "license": "The actual license for this game; retain its license file",
  "status": "Installed",
  "color": "#13284d"
}
```

4. Commit to `vex-games/main`. Its catalog check validates IDs, paths and license metadata.
5. In **vexel → Actions → Publish GitHub Pages → Run workflow**, select **main** and run it. With VEX_GAMES_TOKEN configured it reads the latest game pack and publishes it. Changes in the separate games repo do not themselves trigger the Vexel workflow.
6. Open Games and search for it. The default filter shows connected sources; choose All titles to see pending catalog entries too.

A catalog entry by itself does not include the game. Entries awaiting sources need the actual authorized browser files. For an independently hosted HTTPS game, use `remoteUrl` instead of `path`. Large assets can stay on a suitable game/CDN host; GitHub's normal per-file size limit is 100 MiB and Pages does not turn Git LFS pointers into playable assets.

## 2. Enable Firebase accounts, Google and Microsoft

1. Open https://console.firebase.google.com/, create/select your project, and register a Web app.
2. Copy its public Web configuration into **vexel/public/pages-config.json** under `firebase`:

```json
{
  "mode": "static",
  "wispUrl": "",
  "authBackendUrl": "",
  "firebase": {
    "apiKey": "YOUR_FIREBASE_WEB_API_KEY",
    "authDomain": "YOUR_PROJECT.firebaseapp.com",
    "projectId": "YOUR_PROJECT",
    "appId": "YOUR_WEB_APP_ID"
  },
  "firebaseProviders": {"google": true, "microsoft": true}
}
```

The Firebase Web configuration is public. OAuth client secrets and service-account keys are server secrets and never belong here.

3. In Firebase **Authentication → Sign-in method**, enable **Email/Password**. This enables both email accounts and Vexel username-only accounts. Set a password policy matching the UI's minimum of 10 characters.
4. Under Authentication settings → Authorized domains, add **techmaster2013.github.io** and, for local testing, **localhost**. Do not include `https://`, a port, or `/vexel/`.
5. Enable **Google**, choose your support email and save. Keep `firebaseProviders.google` true only once configured.
6. For **Microsoft**, open https://entra.microsoft.com/ → App registrations → New registration. For both work/school and personal accounts, choose the matching multi-tenant + personal account type. Register the Firebase callback shown in the Firebase Console as a **Web** redirect URI—normally `https://YOUR_PROJECT.firebaseapp.com/__/auth/handler`.
7. Create a Microsoft client secret. Put the application/client ID and the secret **value** in Firebase's Microsoft provider settings, not in GitHub's public config. Enable it and set `firebaseProviders.microsoft` true.
8. Commit `pages-config.json` to `vexel/main`. Pages rebuilds automatically. Test the sign-in buttons after deployment.

**Username sign-in:** leave the email blank when registering a username-only account. Firebase stores it under a reserved non-deliverable alias and enforces uniqueness. Sign in with that username/password later. Email accounts use their email; Google/Microsoft/Discord accounts use their provider. Display names are not passwords or unique login handles. Username-only accounts have no email recovery.

**Incorrect login!** appears for wrong credentials. A missing Firebase project, disabled provider, bad authorized-domain setting or network error is a setup/service problem and gets its own message. The old localhost SQLite `owner` account is not automatically a Firebase account, and no account database is published to Pages. Admin roles depend on a trusted account/UID, not a display name.

## 3. Host one backend for Discord and Wisp

Use an always-running server/container host that supports HTTPS and WebSocket upgrades. GitHub Pages cannot run this service. The included `compose.backend.yaml` runs Vexel plus Caddy; Caddy provides HTTPS and forwards WebSockets. You need Docker on the backend host, not npm on your own browser/device.

On a Docker-capable host, clone both repos side by side. In the vexel folder, copy `.env.example` to `.env`, point a domain's DNS to that host, and set:

```dotenv
BACKEND_DOMAIN=backend.your-domain.com
PUBLIC_ORIGIN=https://backend.your-domain.com
PAGES_ORIGIN=https://techmaster2013.github.io
WISP_ALLOWED_ORIGINS=https://techmaster2013.github.io
BUILTIN_WISP=true
```

`backend.your-domain.com` is an example: replace it with your real backend hostname. Allow inbound 80/443 so Caddy can obtain HTTPS certificates. The backend container's port 3000 is internal to the compose network.

```sh
mkdir -p secrets
docker compose -f compose.backend.yaml up -d --build
```

The backend's `/api/proxy-config` should report `wss://YOUR_BACKEND/wisp/`. Set the Pages config to:

```json
"wispUrl": "wss://backend.your-domain.com/wisp/"
```

Use `wss://` on the public HTTPS website and keep the trailing `/wisp/`. The WebSocket Origin is `https://techmaster2013.github.io`, without `/vexel/`. The backend retains public-destination-only, TCP 80/443 and connection/stream limits. Its allowed-origin list is exact; it does not use a wildcard.

Commit the public config to `vexel/main`, wait for Pages, and open Caver. If it cannot connect, check the endpoint, TLS certificate, WebSocket forwarding, allowed origin and backend logs. No public Wisp endpoint has been invented or selected for you.

## 4. Add Discord sign-in to the same Firebase project

1. Open https://discord.com/developers/applications and create/select your application. Under OAuth2, register **https://YOUR_BACKEND/auth/discord/callback** as a redirect URI.
2. Put **DISCORD_CLIENT_ID** and **DISCORD_CLIENT_SECRET** in the backend's private `.env`. Vexel requests only `identify`; no bot installation/server permissions are needed.
3. In Firebase → Project settings → Service accounts → Firebase Admin SDK, generate a service-account JSON key for this same project. Save it privately as `vexel/secrets/firebase-service-account.json` **on the backend**. This directory is excluded from Git and the Docker build context; compose mounts it read-only.
4. Set `FIREBASE_PROJECT_ID=YOUR_PROJECT` in the backend `.env`. The backend must use the same project as the Pages web config. The compose file already sets the service-account file path inside the container.
5. Restart the backend with `docker compose -f compose.backend.yaml up -d --build`.
6. In `public/pages-config.json`, set:

```json
"authBackendUrl": "https://backend.your-domain.com"
```

7. Commit to main and wait for Pages. The Discord button becomes available when both Firebase and authBackendUrl are configured.

The callback validates the Discord flow, then uses Firebase Admin to issue a custom token for the verified Discord ID. A random popup channel, exact backend origin and popup identity are checked before the browser accepts the token. Tokens are not placed in URLs. Existing accounts are not automatically merged by email. Live Discord sign-in still needs the real app/backend credentials; local tests use controlled fixtures.

## 5. Add movies

Append an entry at the **bottom** of `vexel/public/catalog.js`, after the existing starter-film adjustments:

```js
movies.push({
  id: "my-film",
  title: "My Film",
  year: "2026",
  category: "Adventure",
  description: "A short description.",
  stream: "https://YOUR_MEDIA_HOST/my-film.mp4",
  source: "https://YOUR_PROJECT_OR_CREDITS_PAGE",
  license: "Your actual viewing/distribution permission or license",
  color: "#203a68"
});
```

Use a direct HTTPS video URL that the browser can play, such as an MP4 or WebM stream you have permission to show—not a YouTube page, search page or download page. A metadata record without `stream` stays a preview. Use a unique ID. Commit to **vexel/main**; the Pages workflow rebuilds automatically, with no npm/pnpm step. Use a media host for large video files instead of committing movies to the platform repo. The player also supports local video files without uploading them.

## Pac-Man and Eggfish

Pac-Man uses the supplied HTML in `vex-games/games/pacman/`. The original is preserved as `source.html`; the launch copy adds UTF-8 and a Google base URL. Google's actual game assets stay remote and Google blocks direct third-party iframes, so the local wrapper is marked Caver-required.

Eggfish keeps its creator-hosted page and opens through Caver when Wisp is ready. The asset inventory is in `vex-games/integrations/eggfish`; its music/art/code were not copied. Proxy gameplay is unverified until a production Wisp endpoint is configured.

## Official references

- Firebase Google: https://firebase.google.com/docs/auth/web/google-signin
- Firebase Microsoft: https://firebase.google.com/docs/auth/web/microsoft-oauth
- Firebase custom tokens: https://firebase.google.com/docs/auth/admin/create-custom-tokens
- Discord OAuth2: https://docs.discord.com/developers/topics/oauth2
- Wisp JS: https://github.com/MercuryWorkshop/wisp-js
- Caddy reverse proxy: https://caddyserver.com/docs/quick-starts/reverse-proxy
