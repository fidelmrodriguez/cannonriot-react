# Art direction

Cannon Riot uses a saturated cartoon naval-arcade language: hard outlines, cyan/turquoise water, warm player colors, coral Chasers, purple Shooters, cream/navy UI and exaggerated but readable impact feedback.

The goal is frantic visual energy without changing simulation rules.

## Readability rules

1. Player/enemy silhouettes remain distinguishable at gameplay scale.
2. Chaser and Shooter use different color/behavior telegraphs.
3. Primary HUD information is always hull, time and score.
4. Reactions, streak labels and screen shake are presentation only.
5. Comic reaction cards avoid the player's and active enemies' screen regions whenever free space exists; overlap is allowed only as a fallback when the arena is saturated.
6. Low-hull danger uses an internal vignette rather than a stretched full-screen red border.

## Pseudo-depth

The game remains mechanically 2D. Pseudo-3D is presentation-only:

- projectile shadows + sinusoidal arc offsets;
- ship shadows/wake;
- layered island shore/sand/grass/canopy/shadows;
- trees, rocks and highlights inside islands;
- water current bands, caustics, reef haze and ripples;
- damaged-hull fire glow/pulse.

## Reaction panels

Damage, victory, idle and mechanic panels are independent. One panel never cancels another; each disappears only when its own lifetime expires. Portrait aspect ratio is preserved instead of stretching every image into a fixed rectangle.
