# Authentication setup

The Pages URL is `https://techmaster2013.github.io/vexel/`. GitHub Pages serves static files and cannot store OAuth secrets, run callbacks, write SQLite or host a proxy transport.

## Recommended for Pages: Firebase Authentication

1. Create/select a Firebase project and register a Web app in the Firebase Console. Copy its public web configuration into the `firebase` object in `public/pages-config.json`. This object normally includes apiKey, authDomain, projectId and appId. These identify the web app; they are not OAuth client secrets.
2. In Authentication → Sign-in method, enable Email/Password and Google. For Microsoft, enable the Microsoft provider and enter the Microsoft application ID/secret privately in the Firebase Console.
3. In Authentication → Settings → Authorized domains, add `techmaster2013.github.io` and optionally `localhost`. These are hostnames, without the protocol, port or `/vexel` path.
4. For Microsoft, register a Web application in Entra. Use the Firebase callback displayed in the Firebase Console, typically `https://PROJECT_ID.firebaseapp.com/__/auth/handler`. Choose account types appropriate for the intended users.
5. Set the corresponding `firebaseProviders.google` and `firebaseProviders.microsoft` flags to true, regenerate the static output and publish `gh-pages`. No SDK installation or npm command is required; the pinned Firebase browser SDK loads only when configured.

Firebase Pages mode supports email sign-in plus a display name. Display names are not a unique username registry. It does not migrate the local SQLite accounts, grant privileges from the name “owner”, sync preferences, or implement an authoritative coin ledger. Admin/unlimited status comes only from trusted Firebase custom claims. Shared chat and the economy need their own protected backend integration before enabling them.

Firebase client integration is implemented but live provider sign-in remains unverified until a real project and providers are configured. No project, billing plan or credentials were fabricated.

## Optional Node backend: Google, Microsoft and Discord

The backend implements code/state/cookie binding, PKCE, nonce validation for OIDC, signed ID-token verification, Microsoft tenant restrictions, Discord issuer validation and `/users/@me` identity lookup, expiry and one-use callbacks. Provider cancellations/failures return to the account screen with a retry message. Accounts are keyed by provider + subject, never automatically linked by email or display name.

Configure secrets privately in `.env` or the backend host's environment:

- `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`
- `MICROSOFT_CLIENT_ID`, `MICROSOFT_CLIENT_SECRET`, `MICROSOFT_TENANT` (consumers/common/organizations/tenant UUID)
- `DISCORD_CLIENT_ID`, `DISCORD_CLIENT_SECRET`
- `PUBLIC_ORIGIN`: actual backend origin, not the GitHub Pages URL

Register exact backend callbacks `/auth/google/callback`, `/auth/microsoft/callback`, `/auth/discord/callback`. Local examples use `http://localhost:3000/auth/PROVIDER/callback`.

Discord cannot safely use a client secret in a GitHub Pages script. Its button remains disabled in Pages mode until a secure callback/custom-token integration is supplied. The existing Node backend implements Discord for its own server-hosted frontend; connecting it to Firebase Pages accounts requires an explicit account-linking integration.

Official references: [Firebase web auth](https://firebase.google.com/docs/auth/web/start), [Google OIDC](https://developers.google.com/identity/openid-connect/openid-connect), [Microsoft OIDC](https://learn.microsoft.com/en-us/entra/identity-platform/v2-protocols-oidc), [Discord OAuth2](https://docs.discord.com/developers/topics/oauth2).
