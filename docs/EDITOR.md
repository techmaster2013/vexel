# Connect the website editor

The editor uses the **same Firebase project and accounts as GamePlaza**. Your password is sent to Firebase, never stored in Vexel or GitHub. Signing in alone does not grant editing permission.

1. In Firebase Console, open **gplaza-feedback → Authentication → Settings → Authorized domains**. Add `techmaster2013.github.io` (and `localhost` for local use).
2. Your admin UID is already configured: `PeDivPz9H3hvwW0TB33tgq6V4u63`. No backend or custom-claim command is needed for this account.
3. Add the match block in `docs/EDITOR_RULES.txt` inside your existing Firestore rules. Keep GamePlaza’s other rules. Review and test it in the Firebase rules playground: anonymous users can read only the published document; normal signed-in accounts cannot write; your admin can save; missing/extra fields and oversized payloads fail.
4. Open **edit.html**, sign in with your existing GamePlaza email and password, and publish your additions.

For username login, add an alias in `public/editor-config.js`, such as `usernames={owner:'your-existing-admin-email'}`. The alias is public, so use an address you are comfortable publishing. It points to your existing account; it does not create a password or grant permission. Email login already works without an alias.

Games and movie entries are additions to the built-in catalog. Remove an addition with its Remove button, then publish. Game files still belong in vex-games; the editor accepts their published HTTPS URL. The editor does not upload game folders or bypass licensing.

Published additions are stored in **vexel/site**, separately from GamePlaza’s feedback and changelog. It contains only public game/movie addresses and the public Wisp address. No passwords, secret keys, or provider secrets go there. The normal Vexel account system remains separate.

The supplied rule block is a prototype and has not been deployed or tested against your live Firebase project. Overlapping existing broad write rules can override these restrictions; review those rules too. Until this setup is completed, the editor fails closed and publishing remains unavailable.
