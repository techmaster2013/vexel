# Vexel

A free game site that runs well on school Chromebooks.

**[Play now →](https://techmaster2013.github.io/vexel/)**

## What's on it

- **940+ browser games** from every techmaster2013 repo (game-hub, b-rn1c-1, T9, GamePlaza and more), all playable inside Vexel, with search, categories, favorites and a "recently played" list
- **Caver**, a built-in Scramjet web proxy (the same setup as nexSite) that works with no setup
- **Movies** from free and open film projects, plus a player for videos on your own computer
- **Tools and toys**: a music player, notes, a soundboard and more
- **A Linux computer** that runs right in your browser (it's big, so it only loads if you open it)
- **Themes and settings**, including a lightweight mode for slow laptops

No account needed. Your favorites and settings are saved in your browser.

## Tips

- Press `/` or `Ctrl + K` anywhere to search.
- Press `F` while playing for fullscreen.
- Every game has a **Copy link** button, so you can send it to a friend.
- If a game doesn't load, press **⇄ Source** while playing to try another copy.
- If the site feels slow, turn on **Lightweight mode** in Settings.

## For the site owner

**Add a game or movie:** open the [website editor](https://techmaster2013.github.io/vexel/edit.html), sign in and press Publish. The first time, follow the [editor setup](docs/EDITOR.md) (about 5 minutes).

**Games** live in the `games/` folder: the catalog (`games/manifest.json`), cover art and the games Vexel hosts itself. Big ports stay in the repos they're already in, and Vexel's service worker streams them from GitHub (see [docs/SETUP.md](docs/SETUP.md#1-games)). After adding games to any of your repos, run `python3 scripts/import-games.py` to update the catalog.

**Publishing:** everything on the `main` branch goes live automatically through GitHub Pages.

**Accounts, Caver and the optional server:** see [docs/SETUP.md](docs/SETUP.md).

### Run it on your own computer

You need Python 3.

```sh
python3 scripts/prepare-pages.py --output ../vexel-site
python3 -m http.server 8000 --directory ../vexel-site
```

Then open http://localhost:8000.

## Credits

Vexel grew out of GamePlaza, coreHZ, GPT Corner, nexSite, nexite and StreamPlaza. It uses open-source parts from other people; see [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).

Licensed under GPL-3.0.
