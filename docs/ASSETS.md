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

- menu and result wallpapers (`1672×941`);
- five damage portraits and five victory portraits (`640×640`, `react-damage-*` / `react-victory-*`);
- ten optimized idle portraits (`724×543`, `react-idle-*`);
- six optimized mechanic portraits (`640×640`, `react-mechanic-*`);
- US/Brazil/Spain flag SVGs for language controls;
- hit, collision, pickup, dash and idle-reaction SFX;
- menu/result tracks and seven battle tracks.

The source reaction illustrations were downscaled because they are displayed as small reaction portraits in the 1280×720 arena. This reduces download/decode/GPU memory pressure while retaining more source pixels than their on-screen presentation needs.

## Runtime-generated visuals

Water depth layers, caustics, reefs, wavelets, ripples, island geometry/vegetation, powder barrels, wakes, glows, action lines, projectile trails, smoke/sparks and most HUD-like arena decorations are generated/composited with PixiJS `Graphics`.

Collision geometry is separate from decorative art, so mobile visual reductions do not change gameplay.

## Loading pipeline

The global preloader loads all declared gameplay textures, screen wallpapers, SFX and soundtrack before normal menu use.

- Pixi textures: concurrency 3, up to 3 attempts each.
- Screen images: DOM `Image` decode/load.
- Audio/music: `fetch` into reusable object URLs.
- Progress is reported to the boot screen.
- Permanent failures emit `[Cannon Riot preload]` console diagnostics and perform a `HEAD` request to expose HTTP status/headers before the visible retry screen.
- Runtime image paths remain unchanged; no cache-busting query string is appended.

`GameEngine` calls `Texture.from()`/preloaded URLs after boot rather than downloading a separate copy for each entity/effect.
