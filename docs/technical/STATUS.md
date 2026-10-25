# Vexel 1.0 status

Static GitHub Pages frontend: supplied logo, Silkscreen, navy glass home, lightweight transitions, previews, filters and 48-card pagination, settings, local tools/media/music and opt-in Alpine VM. Changelog opens on every reload and says only “added website functionality”. Manga reader removed.

The catalog has 919 records: 17 standalone local games, one local Pac-Man HTML wrapper needing Caver/remote Google assets, 14 external sources/applets and 887 pending records. Eggfish opens its creator page through Caver when Wisp is configured. No protected game/movie/music payloads were copied under unrelated collection licenses.

Firebase adapters support email accounts, username-only accounts and Google/Microsoft. Discord has a backend-to-Firebase popup bridge using Firebase Admin custom tokens. Incorrect credentials show “Incorrect login!”; missing configuration and network errors stay distinct. Real provider setup remains pending.

The optional Node backend retains SQLite accounts, persisted admin/unlimited flags, authoritative coins/shop/grants, chat, GamePlaza requests and Wisp. Pages Firebase users do not yet have shared cloud preferences/chat/economy; those remain separate backend integrations. Local owner privileges are not published to Pages or granted from display names.

Caver's runtime is bundled; a production Wisp endpoint still needs hosting/configuration. Exact additional origins can be allowed without allowing private/loopback destinations. Static cross-origin block detection is limited by browser rules; the optional Node mode adds bounded source probes.

Publishing uses Python, not npm/pnpm. A read-only private game-repo token lets Actions fetch fresh game source; without it, the last published game pack is reused. Full imported-game playthroughs, live providers/Discord bridge, production Wisp, Docker deployment and low-end-device benchmarks remain unverified unless recorded in VERIFICATION.md.
