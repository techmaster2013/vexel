# Vexel

A free game site that runs well on school Chromebooks.

**[Play now →](https://techmaster2013.github.io/vexel/)**

## What's on it

- **940+ browser games**, all playable inside Vexel, with search, categories, favorites and a "recently played" list
- **Caver**, a built-in Scramjet web proxy that works with no setup
- **Movies** from free and open film projects, plus a player for videos on your own computer
- **Tools and toys**: a music player, notes, a soundboard and more
- **A Linux computer** that runs right in your browser (it's pretty big for a chromebook, so it only loads if you open it)
- **Themes and settings**, including a lightweight mode for slow computers

No account needed (although reccomended). Your favorites and settings are saved in your browser.

## Tips

- Press `/` or `Ctrl + K` anywhere to search.
- Press `F` while playing for fullscreen.
- Every game has a **Copy link** button, so you can send it to a friend.
- If a game doesn't load, press **⇄ Source** while playing to try another copy.
- If the site feels slow, turn on **Lightweight mode** in Settings.

### Run it on your own computer

You need Python 3.

```sh
python3 scripts/prepare-pages.py --output ../vexel-site
python3 -m http.server 8000 --directory ../vexel-site
```

Then open http://localhost:8000.

## Credits

Vexel grew out of parts GamePlaza, coreHZ, GPT Corner, nexSite, nexite and StreamPlaza. It uses open-source parts from other people; see [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md). ChatGPT/Codex and Claude were a big help.

Licensed under GPL-3.0.
