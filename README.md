# HIVEWARDEN

A hive-defense arcade roguelite: you are the Hive Warden, a guardian bee.
Wasps, hornets and mites swarm in from the edges to reach the golden hive —
sting them down, gather pollen, survive 7 days, and slay the Hornet Queen
at the end of Day 3, Day 5 and Day 7.

## How to play

- Move with **WASD / arrow keys / mouse**. On touch: drag to move.
- **Click or SPACE to STING**: a short-range attack in the direction you face.
  Each sting costs 1 stinger (max 3). Stingers regrow over time, and pollen
  restores one. A resting Queen (after a missed charge) takes double damage.
- Enemies that reach the hive — or touch you — cost the hive 1 HP. The hive
  starts with 5 HP; at 0 the run ends.
- **Pollen**: golden flowers bloom on their own timer. Collect one for +10
  score, +1 stinger, and every 5th pollen mends 1 hive HP.
- **Combo**: kills without taking a hit raise a multiplier (x2 up to x8).
  Taking a hit resets it.
- **Days**: each day has a quota of invaders to kill. Clear it to finish the
  day, then pick **1 of 3 upgrade cards** (14 in the pool: extra stingers,
  faster wings, pollen magnet, thorn armor, combo keeper, long sting, quick
  regrow, hive repair, golden pollen, wasp slow, queen bane, rapid sting,
  honey trail, second wind). Clearing days also earns **relics** (Royal Jelly,
  Propolis Shield, Sunpetal, Amber Charm), shown in the HUD.
- **Bosses**: the Hornet Queen is big, has a top HP bar, spawns minions, and
  charges at you after a flashing telegraph — sidestep it, then strike her
  while she rests.
- Win by surviving all 7 days: the victory screen ranks you **S / A / B / C**
  by score and hive HP left.
- **P** pauses. **M** mutes. **R** restarts after game over or victory.

Built for the [make.fun](https://make.fun) best-game-01 bounty.

## Run it

```sh
node serve.ts --port 8080
```

Then open http://localhost:8080. No build step; the game is plain HTML +
JavaScript (canvas + WebAudio, no libraries, no network requests).
