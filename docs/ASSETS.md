# Assets

## Runtime asset set

`public/assets/` contains the files referenced by the application. `public/assets/asset-manifest.json` is an inventory/metadata file; it is not required by runtime loading. During this documentation audit its byte counts, hashes and image dimensions were refreshed to match the current optimized files.

### Challenge-derived gameplay assets

- `png/default/ships/ship_6.png` — player ship;
- `png/default/ships/ship_16.png` — Chaser;
- `png/default/ships/ship_22.png` — Shooter;
- `png/default/ship_parts/cannon_ball.png` — projectile;
- `png/default/effects/explosion_1.png` — destruction effect;
- `png/default/effects/fire_1.png` — damaged-hull flame;
- provided cannon/broadside/explosion WAV assets used for combat feedback.

### Project-specific assets

- menu and result wallpapers (`1664×896`, optimized WebP);
- neutral-hostile Kraken gameplay sprite (`512×265`, transparent PNG at `png/default/enemies/kraken.png`);
- five damage portraits and five victory portraits (`640×640`, `react-damage-*` / `react-victory-*`);
- two hull-friction portraits (`640×640`, `react-friction-01.png` / `react-friction-02.png`) on the dedicated chartreuse reaction color;
- ten optimized idle portraits (`724×543`, `react-idle-*`);
- six optimized mechanic portraits (`640×640`, `react-mechanic-*`);
- two Kraken event portraits (`640×640`, `react-kraken-alert.png` / `react-kraken-relief.png`);
- US/Brazil/Spain flag SVGs for language controls;
- hit, collision, pickup, dash and idle-reaction SFX; Kraken spawn uses `kraken_react_chirp.wav`, while the non-player Kraken-defeat relief react reuses `idle_captain_chirp.wav`;
- menu/result tracks and seven battle tracks.

The source reaction illustrations were downscaled because they are displayed as small reaction portraits in the 1280×720 arena. This reduces download/decode/GPU memory pressure while retaining more source pixels than their on-screen presentation needs.

## Runtime-generated visuals

Water depth layers, caustics, reefs, wavelets, ripples, island geometry/vegetation, powder barrels, wakes, glows, action lines, projectile trails, smoke/sparks and most HUD-like arena decorations are generated/composited with PixiJS `Graphics`.

Collision geometry is separate from decorative art, so mobile visual reductions do not change gameplay.

## Loading pipeline

The blocking preloader loads only core gameplay textures, the menu scene and SFX before normal menu use.

- Required Pixi textures: adaptive concurrency (2 on constrained hardware, up to 3 otherwise), up to 3 attempts each.
- Menu scene: DOM `Image`; menu/result wallpapers are WebP.
- SFX: `fetch` into reusable object URLs.
- Reaction portraits: lazy Pixi decode; capable devices only warm the HTTP cache one file at a time after boot.
- Result scenes: deferred DOM image loading.
- Battle/result/jukebox music: streamed on demand instead of retained as boot-time blobs.
- Progress is reported to the boot screen. At 100%, **Board the Ship** provides the explicit browser gesture needed for audio.
- Permanent required-asset failures emit `[Cannon Riot preload]` diagnostics and perform a `HEAD` request before the visible retry screen.
- Runtime paths remain stable; no cache-busting query string is appended.

`GameEngine` defensively reuses the core Pixi cache and loads a reaction texture only when that panel is actually requested.
