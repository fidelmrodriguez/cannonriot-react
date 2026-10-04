# Gameplay balance

## Required baseline

The technical challenge's core rules remain authoritative: visible bounded arena, forward movement + rotation, one front projectile, three parallel broadside projectiles, Chaser collision damage/self-destruction, Shooter ranged damage, configurable spawn cadence and exactly one point per enemy destroyed by a scoring player attack.

Default profile:

| Parameter | Value |
| --- | ---: |
| Session time | 120 s |
| Enemy spawn interval | 3 s |
| Player hull | 100 |
| Player speed | 225 px/s |
| Player rotation speed | 2.9 rad/s |
| Front cooldown | 0.38 s |
| Shared broadside cooldown | 1.10 s |
| Front/broadside switch lock | 0.25 s |
| Quick input buffer | 0.32 s |
| Enemy projectile damage | 14 |
| Chaser collision damage | 26 |

Options allow 60–180 s sessions (10 s steps) and 1–8 s spawn intervals (0.5 s steps).

## Pressure model

A deterministic pressure value is derived only from the two editable match settings:

```text
pressure = clamp((3 / spawnTime) * (sessionTime / 120)^0.32, 0.7, 2.6)
```

Pressure is not another leaderboard dimension. It tunes assistance/performance coefficients such as:

- active-enemy cap (9–17);
- support-drop frequency/chance;
- small enemy health/damage adjustments at high pressure;
- dash/barrel cooldown assistance;
- pickup strength/duration within caps.

This keeps 180 s / 1 s deliberately intense without changing the one-point scoring rule or silently changing the configured spawn interval.

## Weapon cadence

Normal play allows access to all three firing directions but prevents front + broadside from firing on exactly the same instant. A successful normal shot starts the 0.25 s switch lock. Left/right broadsides share the same reload.

Touch taps may be buffered for 0.32 s so a quick tap during the switch lock is not lost.

**Living Powder** is the explicit exception: collecting it clears current weapon cooldowns and enables full automatic fire. The front cannon and both broadsides fire whenever their boosted reloads are ready until the buff expires; no fire button needs to be held.

## Dash

Base dash values:

- cooldown: 2.65 s before pressure/wind assistance;
- active duration: 0.28 s;
- distance: 132 px;
- wind-boosted distance: 158 px.

Damage immunity exists only while the timed dash state is active. When the dash ends or is blocked by terrain, protection ends immediately.

A Chaser struck during the dash self-destructs without damaging the player. It does **not** award a point, preserving the Chaser collision scoring rule. Islands and arena limits remain solid during dash.

## Pickups and emergency support

The four pickup kinds are:

- **Medicine** — repairs hull;
- **Living Powder** — automatic boosted artillery;
- **Wind at Your Back** — movement speed + dash assistance;
- **Reinforced Hull** — incoming damage multiplier of 0.64 while active.

Normal drops consider pressure, current hull and active buff timers. Repeated temporary buffs extend duration, capped at 1.65× their base duration.

Emergency support activates at **≤35% hull** when no Medicine/Armor pickup is within **300 px**. It attempts to place Medicine or Armor 105–180 px from the player and then starts a **12 s** emergency cooldown. If all four normal pickup slots are occupied, a less-useful/farther pickup can be removed to make room.

Emergency support still requires the player to navigate to the crate; it is not direct healing.

## Powder barrel

Base values:

| Parameter | Value |
| --- | ---: |
| Base cooldown | 6.4 s |
| Lifetime | 10.5 s |
| Arm time | 0.48 s |
| Stored damage | 62 |
| Blast radius | 170 px |
| Trigger radius | 58 px |
| Maximum active barrels | 3 |

The enemy that triggers the armed barrel is destroyed and scores normally. Other enemies inside the expanded blast take heavy falloff damage, but splash is capped to leave them at a minimum of 1 HP. The player is immune to their own barrel explosion.

This lets a barrel soften 7–10 tightly grouped ships without turning one trigger into an automatic mass kill.

## Fairness safeguards

- spawn points are validated against islands, arena bounds, nearby enemies and minimum player distance;
- if no safe spawn exists, the attempt is deferred instead of forcing an invalid position;
- spawned enemies get a short visual `!` only — no hidden attack delay is added;
- dash i-frame is tied exactly to the dash state with no post-dash grace;
- Shooter hull contact is solid but non-damaging;
- Chaser collision outside dash damages the player and self-destructs without scoring;
- projectile substeps reduce tunnelling at boosted speeds;
- projectile hits are single-application;
- barrel splash cannot kill neighbouring enemies;
- support systems never change the value of a kill or the selected match settings.
