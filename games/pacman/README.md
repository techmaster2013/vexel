# Supplied Pac-Man wrapper

`index.html` is the HTML provided by the Vexel owner, with UTF-8 and a Google base URL so its root-relative embedded game URL resolves correctly.

This wrapper is not a self-contained game. The real game still loads from Google. Google serves it with a frame-ancestors policy that excludes third-party sites, so Vexel routes the local wrapper through Caver after a Wisp endpoint is configured. No Google game code, sprites or audio were copied into this repository. Proxy playback remains unverified until a working Wisp deployment is configured.
