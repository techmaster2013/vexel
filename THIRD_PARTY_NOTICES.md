# Third-party notices

Vexel's original platform code retains this repository's GPL-3.0 license. The separately loaded, unmodified MercuryWorkshop runtime packages retain AGPL-3.0-only. Their source, releases and build instructions are available at:

- Scramjet 2.0.67-alpha.2 and scramjet-controller 0.0.14: https://github.com/MercuryWorkshop/scramjet
- libcurl-transport 2.0.5: https://github.com/MercuryWorkshop/CurlTransport

Exact package versions and integrity hashes are in pnpm-lock.yaml. Runtime files are prepared by scripts/build.mjs, without modification except concatenating the service-worker lifecycle/fetch hooks. Those hooks are in that script. The AGPL license is served beside the runtime assets after building.

jose 6.x is MIT: https://github.com/panva/jose . It runs on the server.

DM Sans and Space Grotesk fonts are served by Google Fonts under the SIL Open Font License; system fonts are used when remote fonts are unavailable.

Film records include separate attribution and source links. Tears of Steel: (CC) Blender Foundation, Mango Open Movie Project, CC BY 3.0. Its full credits remain part of the streamed film. No movie data is distributed in this repository. Catalog metadata does not grant redistribution rights to other media.

Revision 0.3:
- Silkscreen regular/bold are bundled in public/fonts (unmodified, converted to WOFF2) under the SIL Open Font License.
- v86 0.5.472 is BSD-2-Clause: https://github.com/copy/v86 . Its license is copied beside prepared runtime files. Firmware source revisions and checksums are recorded in scripts/vm-sources.json; firmware licensing is copied alongside them.
- @mercuryworkshop/wisp-js 0.5.1 is LGPL-3.0-or-later: https://github.com/MercuryWorkshop/wisp-js . It is imported unmodified as a server library. The deprecated wisp-server-node implementation is not used.
- Alpine Linux is assembled from separately licensed packages. The unmodified x86 installation image is downloaded from the official Alpine mirror and SHA-256 verified, not committed to the source repository. Source/package details: https://alpinelinux.org/ and https://gitlab.alpinelinux.org/alpine/aports .
- Big Buck Bunny, Sintel, Elephants Dream, and Caminandes: Llamigos stream from Internet Archive items carrying CC BY 3.0 metadata, with creator attribution and full film credits preserved. No media files are bundled.

## Additional game sources

MMG (GPL-3.0), the licensed b-rn1c-1 game directories (MicropolisJS/3D City GPL with additional terms, URL Chess AGPL, Asteroids/Canvas Tetris/Particle Clicker/Tower Building MIT), and owner-authorized original nexHTML mini-games live in the `games/` folder. Their own licenses and source revisions are retained there. Catalog metadata does not license third-party proprietary payloads. The optional Firebase browser SDK is loaded from Google's pinned 12.4.0 CDN when configured.

Additional game source in `games/`: cars (jchabin, GPL-3.0), The House Game (Artur Kot, MIT), and original owner-authorized GPT Corner code. Their license files and pinned source revisions are included in the game pack. Other newly connected titles link to existing hosts and are not bundled.

## Revision 1.2

- Caver connects through the public Wisp server `wss://wisp.mercurywork.shop/` run by Mercury Workshop, as nexSite does, unless the site owner or visitor sets another server. Traffic to proxied sites passes through that server.
- Mirrored games (`gh:` sources) are streamed unmodified from techmaster2013's public repositories, except that their HTML has known ad and tracker scripts removed and root-relative paths adjusted. They keep the credits and licenses of their original porters, listed in each repository (for example game-hub's README). Vexel does not relicense them.
