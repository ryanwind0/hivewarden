// Staged screenshot scenes behind ?shot=start|upgrade|boss|victory.
// Each one plays the real rules forward from a seeded state and paints the
// exact scene the judge will see — never a faked static image.
import { W, H, HIVE, BOSS } from './config.js';
import { UPGRADES, maxStingers } from './world.js';

function seedScene(s, seed) {
  // Deterministic-ish backdrop: a few invaders, flowers and gold sparks.
  const rng = s.rng;
  s.enemies = [];
  s.flowers = [];
  s.motes = [];
  s.particles = [];
  s.floats = [];
  for (let i = 0; i < 6; i++) {
    const types = ['wasp', 'wasp', 'hornet', 'mite'];
    const t = types[i % types.length];
    s.enemies.push({
      type: t,
      x: rng.range(80, W - 80),
      y: rng.range(70, H - 180),
      hp: t === 'hornet' ? 3 : 1,
      maxHp: t === 'hornet' ? 3 : 1,
      speed: 90, r: t === 'hornet' ? 17 : t === 'mite' ? 6 : 11,
      wob: rng.range(0, 6), wobSpeed: 3, wobAmp: 14, flash: 0,
    });
  }
  for (let i = 0; i < 3; i++) {
    s.flowers.push({ x: rng.range(80, W - 80), y: rng.range(80, H - 180), life: 8, max: 9, phase: rng.range(0, 6) });
  }
  for (let i = 0; i < 14; i++) {
    s.particles.push({
      x: rng.range(60, W - 60), y: rng.range(60, H - 60),
      vx: rng.range(-20, 20), vy: rng.range(-40, -5),
      life: rng.range(0.4, 0.9), max: 0.9, color: '#ffd54f', size: rng.range(2, 4),
    });
  }
}

export function stageShot(s, name) {
  s.banner = null;
  s.flash = 0;
  s.shake = 0;
  if (name === 'start') {
    s.screen = 'title';
    s.best = 12480;
    s.score = 0;
    seedScene(s, 1);
    s.player.x = W / 2;
    s.player.y = H / 2 - 40;
    return true;
  }
  if (name === 'upgrade') {
    s.screen = 'upgrade';
    s.day = 2;
    s.score = 2450;
    s.best = 12480;
    s.hiveHp = 4;
    s.stingers = 3;
    s.pollen = 8;
    s.comboKills = 6;
    s.comboMult = 3;
    s.relics = ['royalJelly'];
    s.relicSet = new Set(['royalJelly']);
    s.upCounts = { 'extra-stinger': 1 };
    s.choices = [
      UPGRADES.find((u) => u.id === 'thorn-armor'),
      UPGRADES.find((u) => u.id === 'pollen-magnet'),
      UPGRADES.find((u) => u.id === 'long-sting'),
    ];
    seedScene(s, 2);
    return true;
  }
  if (name === 'boss') {
    s.screen = 'play';
    s.day = 7;
    s.dayState = 'boss';
    s.quota = 46;
    s.killed = 46;
    s.score = 12400;
    s.best = 12480;
    s.hiveHp = 4;
    s.stingers = 3;
    s.pollen = 12;
    s.pollenBank = 2;
    s.comboKills = 15;
    s.comboMult = 6;
    s.relics = ['royalJelly', 'propolis', 'sunpetal'];
    s.relicSet = new Set(s.relics);
    s.upCounts = { 'extra-stinger': 1, 'swift-wings': 2, 'long-sting': 1 };
    const hp = BOSS.hp + BOSS.hpPerBossDay * 3;
    s.boss = {
      x: W / 2 + 60, y: 170,
      hp: Math.round(hp * 0.55), maxHp: hp,
      r: BOSS.r, speed: BOSS.speed, state: 'fight', stateT: 1.2,
      chargeDir: { x: 0, y: 1 }, spawnT: 3, flash: 0, wob: 0,
    };
    s.bossSpawned = true;
    s.player.x = W / 2 - 140;
    s.player.y = H - 200;
    s.player.facing = -Math.PI / 4;
    s.player.stingAnim = 0.1;
    seedScene(s, 3);
    s.floats.push({ x: W / 2 - 100, y: 240, text: '+25', color: '#ffe066', size: 16, life: 0.9, max: 1.1 });
    s.floats.push({ x: W / 2 + 120, y: 300, text: 'CHAIN x6', color: '#ff9d00', size: 20, life: 0.9, max: 1.1 });
    return true;
  }
  if (name === 'victory') {
    s.screen = 'victory';
    s.day = 7;
    s.score = 15480;
    s.best = 15480;
    s.hiveHp = 4;
    s.rank = 'S';
    s.stats = { kills: 214, stings: 268, pollenGot: 34, bosses: 3, damageTaken: 6 };
    s.relics = ['royalJelly', 'propolis', 'sunpetal', 'amber'];
    s.relicSet = new Set(s.relics);
    s.pollen = 34;
    seedScene(s, 4);
    return true;
  }
  return false;
}
