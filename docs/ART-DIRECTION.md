# Art direction

Cannon Riot uses a loud comic-pirate presentation built around cream paper, dark navy ink, coral/red accents, yellow highlights, purple power-up color and halftone/noise treatment. The goal is to keep the application screens visually tied to the illustrated captain while the Pixi arena stays readable during dense combat.

The UI deliberately uses uneven borders, offset shadows and poster-like panels, but interactive text is kept geometrically stable on hover so the condensed/pixel-like typography does not blur from sub-pixel transforms.

## Readability rules

- The combat world remains a fixed 1280×720 coordinate system.
- Health bars are attached to ships; score/time/reload state remain in React HUD layers.
- Player projectiles, enemy projectiles, damage, explosion and pickup feedback use different visual accents.
- New enemies get a short `!` spawn telegraph attached to the ship. It is visual only and does not delay AI.
- Reaction panels avoid the immediate player safety zone and attempt to avoid other active panels.
- The global language/audio dock stays visually separate from primary menu/result content.
- Mobile/tablet layouts may scroll panels that do not fit vertically instead of hiding required content.

## Desktop vs touch composition

Desktop keeps the cinematic wallpaper composition and full decorative density. Touch/coarse-pointer layouts are reorganized only inside touch breakpoints: menu/data panels get mobile-safe spacing/scrolling, and gameplay uses steering arrows + dash on the left with artillery on the right.

The mobile renderer intentionally reduces purely decorative water/effect density and skips heavy blur filters. The art direction is preserved through shape, contrast and color rather than forcing desktop-level post-processing on weaker phones.

## Pseudo-depth

Depth is produced without changing gameplay collision geometry:

- layered ocean fills, caustics, reefs, ripples and wavelets;
- island shadows and decorative vegetation;
- ship shadows/outlines, wakes and impact bursts;
- projectile shadows/glows/trails;
- paper-card offset shadows in React UI.

Mobile reduces the number of decorative layers/particles but never changes authoritative colliders.

## Reaction panels

Four panel families are used:

- **damage** — player hull damage;
- **victory** — scoring enemy destruction/combo feedback;
- **idle** — calm-period captain reactions;
- **mechanic** — dash, medicine, Living Powder, wind, armor and powder-barrel reactions.

The captain idle chirp is exclusive to idle panels. Mechanic panels rely on their own action SFX so dash/pickup sounds are not doubled by the idle voice.
