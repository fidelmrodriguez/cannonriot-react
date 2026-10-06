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

The Kraken is an additive third faction rather than a boss. It never replaces the required Chaser/Shooter spawn sequence and does not use a global boss bar. Only one Kraken may be active.

| Parameter | Value |
| --- | ---: |
| Hull | 180 HP |
| Move speed | 70 px/s |
| Collision radius | 48 px |
| Target perception reference | 460 px |
| Tentacle attack range | 270 px |
| Telegraph | 0.55 s |
| Attack cooldown | 2.2 s |
| Impact radius | 64 px |
| Damage to player | 11 |
| Damage to enemy ships | 18 |
| Chaser ram damage to Kraken | 32 |
| Active-enemy slot weight | 2 |

Every simulation tick the Kraken chooses the nearest living target among the player, Chasers and Shooters. It can change target immediately as distances change. Once a tentacle attack begins, the impact point is locked for the 0.55 s telegraph so the dodge remains readable. Dash immunity applies normally if the player is inside the impact during an active dash.

Nearby enemies treat the Kraken as a local hostile target when it is closer than the player. Shooters can enter Kraken aggro within 420 px; Chasers use 330 px. An 80 px release margin keeps the current Kraken target stable until the player becomes clearly closer or the creature leaves the extended range. This hysteresis prevents frame-to-frame target flicker. Shooters fire their normal cannon damage at the Kraken. Chasers that physically ram it explode and deal 32 damage to the Kraken. NPC-caused deaths never award player score.

The first Kraken becomes eligible after 30% of the configured session duration, only if at least 15 s remain and two active-enemy slots are available. Once eligible, normal ship spawns reserve those two slots until the Kraken can enter, preventing a saturated 1 s spawn profile from starving the event. After it is defeated, another can become eligible 50–55 s later. It does **not** disappear randomly; apart from match teardown, it remains until defeated. A player-caused Kraken defeat awards exactly **1 point**.

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

A normal Chaser/Shooter that triggers the armed barrel is destroyed and scores normally. The Kraken can also trigger a barrel, but receives the stored 62 damage instead of being auto-killed. Other normal enemy ships inside the expanded blast take heavy falloff damage capped to leave them at a minimum of 1 HP; a Kraken inside the blast can take the falloff damage normally. The player is immune to their own barrel explosion.

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
- barrel splash cannot kill neighbouring normal ships; Kraken damage is not clamped by that safeguard;
- support systems never change the value of a kill or the selected match settings.
