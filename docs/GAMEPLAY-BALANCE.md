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

- cooldown: 2.65 s before pressure assistance;
- active duration: 0.28 s;
- distance: 132 px;
- wind-boosted distance: 158 px.

Damage immunity exists only while the timed dash state is active. When the dash ends or is blocked by terrain, protection ends immediately.

A Chaser destroyed during the dash does not damage the player and awards **1 point** because the dash is an explicit player attack. It uses the regular victory portraits with dedicated dash-kill dialogue. A normal Chaser collision outside dash remains a non-scoring self-destruction. Islands and arena limits remain solid during dash.


## Shooter hull friction

Purple Shooters are still solid, but sustained hull-to-hull contact now deals continuous friction damage:

| Target | Friction DPS |
| --- | ---: |
| Player | 4.5 HP/s before armor mitigation |
| Touching Shooter | 26 HP/s |

The Shooter intentionally takes much more damage than the player. Scraping can therefore finish or soften a ship in an emergency, but it is slower and riskier than using the cannons. The player damage does not stack per touching Shooter; each Shooter still receives its own friction damage.

Friction has two dedicated chartreuse reaction portraits and five localized lines. One reaction stays visible for the full contact and lingers for **2.2 s** after the hulls separate.

## Kraken neutral-hostile event

The Kraken is a third-faction arena threat, not a boss. Only one can be active at a time and it occupies the equivalent of **2 active-enemy slots** while alive. It never despawns randomly; it leaves only when defeated or when the match itself ends.

Base values:

| Parameter | Value |
| --- | ---: |
| Health | 180 HP |
| Move speed | 72 px/s |
| Physical radius | 48 px |
| Tentacle attack range | 150 px |
| Telegraph | 0.55 s |
| Attack cooldown | 2.2 s |
| Impact radius | 64 px |
| Damage to player | 11 |
| Damage to ships | 18 |
| Chaser ram damage to Kraken | 32 |

The Kraken recalculates the **nearest living target every simulation tick**, so it can swap freely between the player, Shooters and Chasers. It moves toward that target and telegraphs the impact point before each tentacle slam. Island navigation uses a lightweight coarse A* water grid, full-collider segment checks, path smoothing and stuck-triggered replanning so the creature swims around land instead of pinning itself against a collider. Its base sprite no longer bobs vertically; four lightweight procedural tentacles, animated water rings and subtle squash/stretch provide the swimming motion. The impact can damage the player and normal enemies; player dash immunity still applies if the impact lands while the timed dash state is active.

Nearby normal enemies may redirect toward the Kraken instead of the player. Shooters consider it inside roughly **420 px** and Chasers inside roughly **330 px**, but proximity alone does not make every ship forget the player: the Kraken must also be the more attractive nearby target. The 80 px hysteresis margin prevents rapid target flicker. If a tentacle actually damages a normal enemy, that ship receives a **5 s forced retaliation** window against the Kraken. Shooters can damage the Kraken with cannon fire. Chasers that physically ram it explode and deal **32 damage** to the Kraken, awarding no player point.

The first Kraken becomes eligible at **30% of match duration** if at least 15 s remain. After it is defeated, another becomes eligible after a deterministic seeded delay between **50 and 55 s**. A player-delivered final hit awards the normal **+1 point**; kills caused by enemy fire or Chaser rams award zero. The player's powder-barrel blast can damage and finish the Kraken, but it is never a guaranteed one-shot.

## Pickups and emergency support

The four pickup kinds are:

- **Medicine** — repairs hull;
- **Living Powder** — automatic boosted artillery;
- **Wind at Your Back** — movement speed, 158 px dash distance and **no dash reload while the buff is active**;
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
- Shooter hull contact is solid and applies asymmetric continuous friction damage (4.5 HP/s player, 26 HP/s Shooter);
- Chaser collision outside dash damages the player and self-destructs without scoring;
- projectile substeps reduce tunnelling at boosted speeds;
- projectile hits are single-application;
- barrel splash cannot kill neighbouring enemies;
- support systems never change the value of a kill or the selected match settings.
