# Gameplay balance

## Required baseline

The challenge rules remain authoritative: fixed visible arena, forward movement + rotation, one front projectile, three parallel broadside projectiles, Chaser collision damage, Shooter ranged damage, configured spawn cadence and exactly one point per enemy killed by player attacks.

Default profile:

- session: 120 s;
- enemy spawn: 3 s;
- player HP: 100;
- player speed: 225 px/s;
- front cooldown: 0.38 s;
- broadside cooldown: 1.1 s;
- normal artillery direction switch lock: 0.25 s (front vs. broadside).

## Extreme configurations

Options allow 60–180 s and 1–8 s spawn intervals. A deterministic pressure value is derived from those two parameters. It influences support cadence, enemy cap and small assistance coefficients, not ranking identity or score value.

```text
pressure = clamp((3 / spawnTime) * (sessionTime / 120)^0.32, 0.7, 2.6)
```

High-pressure matches receive more support drops and a tighter active-enemy cap. Low-pressure matches avoid excessive assistance. The intent is to keep all allowed configurations playable without making the default trivial.

## Support/powerups

- **Medicine** repairs player hull.
- **Living Powder** temporarily accelerates and boosts artillery and automatically fires the front cannon + both broadsides whenever their boosted reloads are ready. The barrage starts on pickup, bypasses the normal 0.25 s direction lock, and stops when the power-up expires.
- **Wind at Your Back** increases movement speed and improves dash.
- **Reinforced Hull** reduces incoming damage temporarily.
- **Powder Barrel** destroys the triggering enemy and deals strong non-lethal splash damage in a wider 170 px blast radius so dense groups are affected; the player's ship is immune to its own barrel.

Buff drops prefer an inactive buff; repeated buffs extend duration instead of being wasted. Below 35% hull, an emergency support check guarantees a nearby Medicine/Reinforced Hull drop when no suitable support is already close, with a 12 s emergency cooldown.

## Fairness safeguards

- no enemy spawn inside islands or near the player;
- newly spawned enemies get a short visual `!` telegraph only; their AI and attack timing remain unchanged;
- dash lasts 0.28 s and grants projectile/ram collision immunity only while the dash state is active; a Chaser collision during that window self-destructs without hurting the player and remains non-scoring, with no post-dash grace period;
- active enemy cap scales between safe limits;
- Chaser self-destruction does not score;
- barrel splash cannot chain-kill surrounding ships;
- support systems never change the one-point-per-player-kill rule;
- player/enemy ship bodies are solid; Shooter contact does not deal collision damage;
- projectile substeps prevent boosted shots from tunnelling;
- quick touch taps blocked only by the 0.25 s direction lock are buffered briefly so mobile controls do not feel unresponsive;
- player destruction always plays the ship-explosion SFX, including lethal projectile hits, while suicide collisions avoid duplicating the same blast audio.
