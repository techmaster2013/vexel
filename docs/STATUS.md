# Vexel 0.5 status

## Working core

Plain static frontend, navy glass home and supplied logo, Silkscreen, lightweight/reduced-motion transitions, game previews, category/search/sort/favorites/recent games, bounded 48-card pagination, settings and local tools/media/manga/music, and opt-in Alpine v86 VM. The static deployment contains game-pack output from the separate vex-games source repository.

The inventory covers 41 accessible repositories and GN-Math metadata. Current catalog: 919 entries; 17 installed, 14 external sources, 888 awaiting authorized files. Catalog records are not playable game payloads. Protected game assets were not copied under an unrelated collection license. MMG singleplayer starts; its Firebase multiplayer service is unchanged and multiplayer is unverified.

## Backend-dependent

The optional Node backend supports existing SQLite accounts, persisted admin/unlimited flags, authoritative rewards/shop/grants, three chatrooms, GamePlaza Firestore requests with durable draft fallback, Google/Microsoft/Discord provider flows and self-hosted Wisp. Provider credentials remain absent; request delivery and production operations remain unverified.

GitHub Pages has no Node runtime. Optional Firebase browser authentication is prepared for Google/Microsoft/email but needs a Firebase project/provider configuration. Shared Firebase chat, cloud preferences, unique username registry, authoritative economy and Discord-to-Firebase linking are not implemented. Static pages do not publish/migrate local SQLite accounts. Disabled connected features show setup/availability messages instead of pretending to succeed.

Caver's browser runtime is bundled; a configured Wisp endpoint is still required on Pages. Static block detection is restricted to readable iframe evidence; a browser cannot inspect arbitrary cross-origin frames. Node mode adds bounded source probes and private-address rejection.

## Not complete

Full game/media parity, protected payload redistribution, cloud chat/moderation operations, live identity-provider setup, production proxy hosting, real ad-provider integration, email recovery, verified gameplay for every imported game, and physical low-end-device benchmarks.
