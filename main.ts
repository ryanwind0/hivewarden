// HIVEWARDEN — a hive-defense arcade roguelite (Node 22, standard library only).
// The game itself is this directory's game/ folder: plain static files a desktop
// browser loads offline (game/index.html and its ES modules, no library and no
// network request). You are the Hive Warden, a guardian bee: wasps, hornets and
// mites swarm in from the edges to reach the golden hive, and you sting them
// down with a short-range attack that costs a stinger (three at most, they regrow
// and pollen restores them). Golden flowers bloom for pollen: +10 score, a stinger
// back, and every fifth pollen mends the hive. Kills without taking a hit build a
// combo multiplier up to x8. Seven days, a quota of invaders each day, and a
// Hornet Queen boss at the end of Day 3, Day 5 and Day 7; between days you pick
// one of three upgrade cards, and clearing days earns relics that change the run.
// Title / play / pause / upgrade / game-over / victory screens, a dense HUD with
// score, combo, day, hive hearts, stingers, pollen and relic icons, a boss HP bar,
// particles, screen shake and synthesized WebAudio effects (M mutes).
//
// This entry point hands the game in: it copies game/ and screenshots/ from beside
// this file to /output and writes /output/dossier.json, the summary the judge
// reads, with the vendored make.fun library.
//
// Serve it locally with `node serve.ts`, then open http://localhost:8080.
// Outside the grader's container, MAKEFUN_OUTPUT_DIR stands in for /output:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts

import { cpSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const here = fileURLToPath(new URL('.', import.meta.url));
const out = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

mkdirSync(out, { recursive: true });
cpSync(join(here, 'game'), join(out, 'game'), { recursive: true });
mkdirSync(join(out, 'screenshots'), { recursive: true });
if (existsSync(join(here, 'screenshots'))) cpSync(join(here, 'screenshots'), join(out, 'screenshots'), { recursive: true });

// The scorer's own caps (reference/gate.json): only text_max_bytes shapes the bytes; the others refuse an entry the
// scorer would refuse (more than 4 screenshots or one over 256 KiB; more than 993 files in game/ or 48 MiB of game
// files, in all, or a path under game/ over 1000 bytes: game/ counts beside /output's own 1000-entry cap, its
// screenshots/ and dossier.json).
writeFileSync(
  join(out, 'dossier.json'),
  buildDossier(out, {
    text_max_bytes: 163840,
    screenshots: { max: 4, max_bytes: 262144 },
    game_max_files: 993,
    game_max_bytes: 50331648,
    game_path_max_bytes: 1000,
  }),
);
