# Setting up the website editor

The editor (`edit.html`) lets you add games and movies to Vexel without touching code. It saves your changes to Firebase, using the same Firebase project and admin account as GamePlaza.

You only have to do this once. It takes about 5 minutes.

## 1. Let the website sign in

1. Open the [Firebase console](https://console.firebase.google.com/) and pick the **gplaza-feedback** project.
2. Go to **Authentication → Settings → Authorized domains**.
3. Click **Add domain** and add `techmaster2013.github.io`. Add `localhost` too if you want to test on your own computer.

## 2. Allow the editor to save

1. In the same project, go to **Firestore Database → Rules**.
2. Copy everything in [`EDITOR_RULES.txt`](EDITOR_RULES.txt).
3. Paste it **inside** the existing `match /databases/{database}/documents { ... }` block. Don't delete the rules that are already there; GamePlaza needs them.
4. Click **Publish**.

These rules let anyone *read* the published list (so visitors can see your games), but only your admin account can *change* it.

## 3. Use it

1. Open [edit.html](https://techmaster2013.github.io/vexel/edit.html).
2. Sign in with your GamePlaza admin email and password.
3. Add games or movies, then press **Publish changes**.

Visitors see the changes the next time they load Vexel.

## Something's not working?

The editor tells you what went wrong. The common ones:

| Message | Fix |
|---|---|
| "This website isn't allowed to sign in yet" | Do step 1. |
| "Firebase refused the request" | Do step 2, then reload the editor. |
| "This account isn't allowed to edit Vexel" | You signed in with the wrong account. The admin account's ID is set in `public/editor-config.js` (`editorUid`). |
| "Couldn't reach Firebase" | The network is blocking Google. Try another network. |

## Notes

- Game files still go in the [vex-games](https://github.com/techmaster2013/vex-games) repo. The editor only stores links to them.
- Your password goes straight to Firebase. It is never saved in Vexel or on GitHub.
- Want to sign in with a username instead of an email? Add it to `usernames` in `public/editor-config.js`, like `usernames = {owner: 'you@example.com'}`. That file is public, so only use an email you're fine with people seeing.
