## reminders

**Add a game or movie:** open the [website editor](https://techmaster2013.github.io/vexel/edit.html), sign in and press Publish. The first time, follow the [editor setup](docs/EDITOR.md) (about 5 minutes).

**Games** live in the `games/` folder: the catalog (`games/manifest.json`), cover art and the games Vexel hosts itself. Big ports stay in the repos they're already in, and Vexel's service worker streams them from GitHub (see [docs/SETUP.md](docs/SETUP.md#1-games)). After adding games to any of your repos, run `python3 scripts/import-games.py` to update the catalog.

**Publishing:** everything on the `main` branch goes live automatically through GitHub Pages.

**Accounts, Caver and the optional server:** see [docs/SETUP.md](docs/SETUP.md).
