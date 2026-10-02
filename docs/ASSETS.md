# Assets

## Runtime asset set

The `public/assets/` folder has been reduced to files that are actually referenced by the application. A repository check confirms every remaining asset path is used.

### Challenge-derived gameplay assets

- `png/default/ships/ship_6.png` — player ship
- `png/default/ships/ship_16.png` — Chaser
- `png/default/ships/ship_22.png` — Shooter
- `png/default/ship_parts/cannon_ball.png` — projectile
- `png/default/effects/explosion_1.png` — destruction effect
- `png/default/effects/fire_1.png` — damaged-hull flame
- provided cannon/explosion WAV files used for combat feedback

### Additional project assets

- menu/result wallpapers;
- damage/victory/idle/mechanic reaction portraits;
- generated/edited SFX for hit, collision, pickup, dash and idle reaction;
- menu/result/battle music tracks.

## Runtime-generated visuals

Water depth layers, island geometry/vegetation, powder barrels, wakes, glows, action lines, projectile arc presentation, smoke/sparks and most HUD decorations are generated/composited at runtime with PixiJS Graphics. This avoids unnecessary static image variants and keeps collisions independent from decorative art.

## Loading

The global preloader loads game textures, wallpapers, SFX and soundtrack before normal menu use. Audio is fetched into object URLs and reused by the audio controller. Pixi textures are loaded through `Assets` and reused through `Texture.from`.
