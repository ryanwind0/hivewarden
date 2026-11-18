// HIVEWARDEN world: the whole simulation. Screens are states on one object:
// title -> play -> (pause) -> upgrade -> play ... -> victory | gameover.
// The renderer draws whatever state this holds; main.js only drives the loop.
import { W, H, HIVE, HIVE_MAX_HP, PLAYER, ENEMY, DAYS, TOTAL_DAYS, BOSS, POLLEN, COMBO } from './config.js';
import { makeRng } from './random.js';

// ---------------------------------------------------------------- upgrades
export const UPGRADES = [
  { id: 'extra-stinger', name: 'Extra Stinger', desc: '+1 Max Stinger', icon: 'sting', max: 3 },
  { id: 'swift-wings', name: 'Swift Wings', desc: '+15% move speed', icon: 'wing', max: 3 },
  { id: 'pollen-magnet', name: 'Pollen Magnet', desc: 'Pollen drifts to you within 120px', icon: 'magnet', max: 2 },
  { id: 'thorn-armor', name: 'Thorn Armor', desc: 'Enemies that touch you take 1 damage', icon: 'thorn', max: 1 },
  { id: 'combo-keeper', name: 'Combo Keeper', desc: 'Keep half your combo when hit', icon: 'chain', max: 1 },
  { id: 'long-sting', name: 'Long Sting', desc: '+40% sting reach', icon: 'reach', max: 2 },
  { id: 'quick-regrow', name: 'Quick Regrow', desc: 'Stingers regrow 40% faster', icon: 'clock', max: 2 },
  { id: 'hive-repair', name: 'Hive Repair', desc: 'Restore 1 Hive HP right now', icon: 'heart', max: 99 },
  { id: 'golden-pollen', name: 'Golden Pollen', desc: 'Pollen scores double', icon: 'gold', max: 1 },
  { id: 'wasp-slow', name: 'Wasp Slow', desc: 'All enemies 12% slower', icon: 'slow', max: 3 },
  { id: 'queen-bane', name: 'Queen Bane', desc: 'Stings deal 2 damage to the Queen', icon: 'bane', max: 1 },
  { id: 'rapid-sting', name: 'Rapid Sting', desc: 'Sting cooldown 30% shorter', icon: 'bolt', max: 2 },
  { id: 'honey-trail', name: 'Honey Trail', desc: 'Kills drop pollen motes worth +5', icon: 'drop', max: 1 },
  { id: 'second-wind', name: 'Second Wind', desc: 'Once a day, a lethal hit leaves 1 HP', icon: 'wind', max: 1 },
];

// ---------------------------------------------------------------- relics
export const RELICS = {
  royalJelly: { name: 'Royal Jelly', desc: '+1 Max Stinger, stingers regrow 20% faster' },
  propolis: { name: 'Propolis Shield', desc: 'Each day, the first hive hit is ignored' },
  sunpetal: { name: 'Sunpetal', desc: 'Flowers bloom twice as often' },
  amber: { name: 'Amber Charm', desc: 'All kills score +25%' },
};
// Awarded when a day is cleared: day -> relic id (first boss kill also grants amber).
const RELIC_DAYS = { 2: 'royalJelly', 4: 'propolis', 6: 'sunpetal' };

// ---------------------------------------------------------------- state
export function createWorld(seed) {
  const rng = makeRng(seed);
  return {
    rng,
    seed,
    screen: 'title', // title | play | pause | upgrade | gameover | victory
    time: 0,
    score: 0,
    best: 0,
    day: 1,
    dayState: 'waves', // waves | boss | clear
    quota: 0, spawned: 0, killed: 0,
    spawnTimer: 0,
    flowerTimer: 2,
    comboKills: 0,
    comboMult: 1,
    hiveHp: HIVE_MAX_HP,
    stingers: PLAYER.maxStingers,
    stingerTimer: 0,
    pollen: 0,
    pollenBank: 0,
    relics: [],
    relicSet: new Set(),
    upCounts: {},
    // derived upgrade effects, recomputed on every pick / relic
    up: { speedMul: 1, rangeMul: 1, cdMul: 1, regrowMul: 1, magnetR: 0, thorn: false, comboKeep: false, goldenPollen: false, slowMul: 1, queenBane: false, honeyTrail: false, secondWind: false },
    secondWindUsed: false,
    shieldReady: false, // propolis: first hive hit of the day ignored
    player: { x: W / 2, y: H / 2 - 40, vx: 0, vy: 0, facing: -Math.PI / 2, invuln: 0, stingCd: 0, stingAnim: 0 },
    enemies: [],
    boss: null,
    bossSpawned: false,
    flowers: [],
    motes: [],
    particles: [],
    floats: [],
    shake: 0,
    flash: 0,
    banner: null, // {text, sub, t}
    choices: [],
    stats: { kills: 0, stings: 0, pollenGot: 0, bosses: 0, damageTaken: 0 },
    rank: null,
    auto: false, // headless autoplay test hook (?auto=1)
    muted: false,
  };
}

export function maxStingers(s) {
  return PLAYER.maxStingers + (s.upCounts['extra-stinger'] || 0) + (s.relicSet.has('royalJelly') ? 1 : 0);
}

export function comboMultFor(kills) {
  let m = 1;
  for (let i = 0; i < COMBO.tiers.length; i++) if (kills >= COMBO.tiers[i]) m = i + 1;
  return Math.min(m, COMBO.max);
}

function recomputeUp(s) {
  const c = s.upCounts;
  const n = (id) => c[id] || 0;
  s.up.speedMul = 1 + 0.15 * n('swift-wings');
  s.up.rangeMul = 1 + 0.4 * n('long-sting');
  s.up.cdMul = Math.pow(0.7, n('rapid-sting'));
  s.up.regrowMul = Math.pow(0.6, n('quick-regrow')) * (s.relicSet.has('royalJelly') ? 0.8 : 1);
  s.up.magnetR = n('pollen-magnet') > 0 ? 120 + 40 * (n('pollen-magnet') - 1) : (s.relicSet.has('sunpetal') ? 0 : 0);
  if (s.relicSet.has('sunpetal')) s.up.magnetR = Math.max(s.up.magnetR, 0);
  s.up.thorn = n('thorn-armor') > 0;
  s.up.comboKeep = n('combo-keeper') > 0 || s.relicSet.has('amber');
  s.up.goldenPollen = n('golden-pollen') > 0;
  s.up.slowMul = Math.pow(0.88, n('wasp-slow'));
  s.up.queenBane = n('queen-bane') > 0;
  s.up.honeyTrail = n('honey-trail') > 0;
  s.up.secondWind = n('second-wind') > 0;
}

// ---------------------------------------------------------------- flow
export function newGame(s, sound) {
  const keepBest = s.best;
  const fresh = createWorld((Math.random() * 1e9) | 0);
  fresh.best = keepBest;
  fresh.auto = s.auto;
  Object.assign(s, fresh);
  s.screen = 'play';
  startDay(s, 1, sound);
}

export function startDay(s, day, sound) {
  const d = DAYS[day - 1];
  s.day = day;
  s.dayState = 'waves';
  s.quota = d.quota;
  s.spawned = 0;
  s.killed = 0;
  s.spawnTimer = 0.8;
  s.flowerTimer = 2;
  s.boss = null;
  s.bossSpawned = false;
  s.secondWindUsed = false;
  s.shieldReady = s.relicSet.has('propolis');
  s.enemies.length = 0;
  s.flowers.length = 0;
  s.motes.length = 0;
  s.player.x = W / 2;
  s.player.y = H / 2 - 40;
  s.player.invuln = 0;
  s.player.stingCd = 0;
  setBanner(s, `DAY ${day}`, day === 1 ? 'Defend the hive — 7 days to survive' : `Wave quota: ${d.quota} invaders`);
  if (sound) sound.click();
}

function setBanner(s, text, sub) {
  s.banner = { text, sub: sub || '', t: 2.6 };
}

function addFloat(s, x, y, text, color, size) {
  s.floats.push({ x, y, text, color: color || '#ffe066', size: size || 16, life: 1.1, max: 1.1 });
}

function burst(s, x, y, color, n, speed) {
  for (let i = 0; i < n; i++) {
    const a = s.rng.range(0, Math.PI * 2);
    const v = s.rng.range(speed * 0.3, speed);
    s.particles.push({
      x, y,
      vx: Math.cos(a) * v, vy: Math.sin(a) * v,
      life: s.rng.range(0.3, 0.7), max: 0.7,
      color, size: s.rng.range(2, 5),
    });
  }
}

function addScore(s, base, x, y, label) {
  let pts = Math.round(base * s.comboMult * (s.relicSet.has('amber') ? 1.25 : 1));
  s.score += pts;
  addFloat(s, x, y, `+${pts}${label ? ' ' + label : ''}`, '#ffe066', 15);
  return pts;
}

// ---------------------------------------------------------------- spawning
function edgeSpawn(s) {
  // Never from the bottom edge: the hive sits there, and a bottom spawn
  // would reach it before any defender could intercept.
  const side = s.rng.int(0, 2);
  const m = 24;
  if (side === 0) return { x: s.rng.range(m, W - m), y: -m };
  if (side === 1) return { x: -m, y: s.rng.range(m, H - m) };
  return { x: W + m, y: s.rng.range(m, H - m) };
}

function pickType(s) {
  const mix = DAYS[s.day - 1].mix;
  const r = s.rng.next();
  if (r < mix.wasp) return 'wasp';
  if (r < mix.wasp + mix.hornet) return 'hornet';
  return 'mite';
}

function spawnEnemy(s, type, x, y) {
  const def = ENEMY[type];
  const p = x !== undefined ? { x, y } : edgeSpawn(s);
  const e = {
    type,
    x: p.x, y: p.y,
    hp: def.hp, maxHp: def.hp,
    speed: def.speed * s.rng.range(0.9, 1.1) * s.up.slowMul,
    r: def.r,
    wob: s.rng.range(0, Math.PI * 2),
    wobSpeed: s.rng.range(2, 4),
    wobAmp: type === 'mite' ? 46 : 14,
    flash: 0,
  };
  s.enemies.push(e);
  return e;
}

function spawnBoss(s) {
  const bossDay = s.day; // 3, 5 or 7
  const hp = BOSS.hp + BOSS.hpPerBossDay * (bossDay === 3 ? 1 : bossDay === 5 ? 2 : 3);
  s.boss = {
    x: W / 2, y: -60,
    hp, maxHp: hp,
    r: BOSS.r,
    speed: BOSS.speed * s.up.slowMul,
    state: 'enter', // enter -> fight -> telegraph -> charge -> rest -> fight
    stateT: 0,
    chargeDir: { x: 0, y: 1 },
    spawnT: 3,
    flash: 0,
    wob: 0,
  };
  s.bossSpawned = true;
  s.dayState = 'boss';
  setBanner(s, 'THE HORNET QUEEN', 'She comes for the hive — sting her down!');
}

function spawnFlower(s) {
  const x = s.rng.range(50, W - 50);
  const y = s.rng.range(50, H - 130);
  s.flowers.push({ x, y, life: POLLEN.life, max: POLLEN.life, phase: s.rng.range(0, Math.PI * 2) });
}

// ---------------------------------------------------------------- combat
function sting(s, sound) {
  const p = s.player;
  if (p.stingCd > 0) return;
  if (s.stingers <= 0) {
    if (sound) sound.stingEmpty();
    p.stingCd = 0.18;
    return;
  }
  s.stingers -= 1;
  s.stats.stings += 1;
  p.stingCd = PLAYER.stingCooldown * s.up.cdMul;
  p.stingAnim = 0.16;
  const range = PLAYER.stingRange * s.up.rangeMul;
  const fx = p.x + Math.cos(p.facing) * range * 0.55;
  const fy = p.y + Math.sin(p.facing) * range * 0.55;
  burst(s, fx, fy, '#ffe066', 6, 120);
  if (sound) sound.sting();

  const hitCone = (e) => {
    const dx = e.x - p.x;
    const dy = e.y - p.y;
    const d = Math.hypot(dx, dy);
    if (d > range + e.r) return false;
    if (d < 1) return true;
    let da = Math.atan2(dy, dx) - p.facing;
    while (da > Math.PI) da -= Math.PI * 2;
    while (da < -Math.PI) da += Math.PI * 2;
    return Math.abs(da) < PLAYER.stingArc;
  };

  let hitAny = false;
  for (const e of s.enemies) {
    if (e.hp > 0 && hitCone(e)) {
      damageEnemy(s, e, 1, sound);
      hitAny = true;
    }
  }
  if (s.boss && s.boss.hp > 0 && s.boss.state !== 'enter' && hitCone(s.boss)) {
    damageBoss(s, s.up.queenBane ? 2 : 1, sound);
    hitAny = true;
  }
  if (!hitAny) s.shake = Math.max(s.shake, 1.5);
}

function damageEnemy(s, e, dmg, sound) {
  e.hp -= dmg;
  e.flash = 0.12;
  burst(s, e.x, e.y, '#ffb3b3', 5, 90);
  if (e.hp <= 0) killEnemy(s, e, sound);
}

function killEnemy(s, e, sound) {
  const def = ENEMY[e.type];
  s.stats.kills += 1;
  s.killed += 1;
  // A kill feeds the next sting: regrow progress jumps forward.
  s.stingerTimer += 0.5;
  s.comboKills += 1;
  const newMult = comboMultFor(s.comboKills);
  if (newMult > s.comboMult) {
    s.comboMult = newMult;
    addFloat(s, s.player.x, s.player.y - 34, `CHAIN x${newMult}`, '#ff9d00', 20);
  }
  addScore(s, def.score, e.x, e.y);
  burst(s, e.x, e.y, def.body, 12, 170);
  burst(s, e.x, e.y, '#ffe066', 5, 120);
  if (sound) sound.kill(s.comboMult);
  if (s.up.honeyTrail && s.rng.chance(0.3)) {
    s.motes.push({ x: e.x, y: e.y, vx: s.rng.range(-30, 30), vy: s.rng.range(-30, 30), life: 6, val: 5 });
  }
}

function damageBoss(s, dmg, sound) {
  const b = s.boss;
  if (!b || b.hp <= 0) return;
  // A Queen resting after a missed charge is vulnerable: double damage.
  if (b.state === 'rest') dmg *= 2;
  b.hp -= dmg;
  b.flash = 0.12;
  burst(s, b.x, b.y, '#ffb3b3', 8, 140);
  if (sound) sound.kill(s.comboMult);
  if (b.hp <= 0) killBoss(s, sound);
}

function killBoss(s, sound) {
  const b = s.boss;
  s.stats.bosses += 1;
  s.comboKills += 1;
  s.comboMult = comboMultFor(s.comboKills);
  addScore(s, BOSS.score, b.x, b.y, 'QUEEN DOWN!');
  burst(s, b.x, b.y, '#ffd54f', 40, 320);
  burst(s, b.x, b.y, '#e5484d', 25, 240);
  burst(s, b.x, b.y, '#fff3c4', 20, 180);
  s.shake = 14;
  s.flash = 0.35;
  if (sound) sound.bossDie();
  if (!s.relicSet.has('amber')) grantRelic(s, 'amber');
  s.boss = null;
  s.dayState = 'clear';
  dayClear(s, sound);
}

function grantRelic(s, id) {
  s.relicSet.add(id);
  s.relics.push(id);
  recomputeUp(s);
  addFloat(s, W / 2, H / 2 - 60, `RELIC: ${RELICS[id].name.toUpperCase()}`, '#7ee787', 20);
}

function hiveDamage(s, amount, sound, fromPlayer) {
  if (s.shieldReady) {
    s.shieldReady = false;
    addFloat(s, HIVE.x, HIVE.y - 60, 'SHIELDED!', '#7ee787', 20);
    burst(s, HIVE.x, HIVE.y - 20, '#7ee787', 14, 160);
    if (sound) sound.hiveHeal();
    return;
  }
  if (s.up.secondWind && !s.secondWindUsed && s.hiveHp - amount <= 0) {
    s.secondWindUsed = true;
    s.hiveHp = 1;
    addFloat(s, HIVE.x, HIVE.y - 60, 'SECOND WIND!', '#7ee787', 22);
    if (sound) sound.hiveHeal();
  } else {
    s.hiveHp -= amount;
  }
  s.stats.damageTaken += amount;
  s.shake = Math.max(s.shake, 9);
  s.flash = 0.25;
  if (sound) sound.hurt();
  // Combo breaks on any hive damage.
  if (s.up.comboKeep) {
    s.comboKills = Math.floor(s.comboKills / 2);
  } else {
    s.comboKills = 0;
  }
  s.comboMult = comboMultFor(s.comboKills);
  if (s.hiveHp <= 0) {
    s.hiveHp = 0;
    gameOver(s, sound);
  }
}

// ---------------------------------------------------------------- day flow
function dayClear(s, sound) {
  if (s.dayState === 'clear' && s.screen === 'upgrade') return;
  const bonus = 100 * s.day;
  s.score += bonus;
  addFloat(s, W / 2, H / 2 - 40, `DAY ${s.day} CLEAR  +${bonus}`, '#7ee787', 22);
  if (sound) sound.dayClear();
  // Relic milestones.
  if (RELIC_DAYS[s.day] && !s.relicSet.has(RELIC_DAYS[s.day])) grantRelic(s, RELIC_DAYS[s.day]);
  if (s.day >= TOTAL_DAYS) {
    victory(s, sound);
    return;
  }
  s.dayState = 'clear';
  s.choices = drawChoices(s);
  s.screen = 'upgrade';
}

function drawChoices(s) {
  const pool = UPGRADES.filter((u) => (s.upCounts[u.id] || 0) < u.max);
  const out = [];
  const bag = [...pool];
  while (out.length < 3 && bag.length > 0) {
    const i = Math.floor(s.rng.next() * bag.length);
    out.push(bag.splice(i, 1)[0]);
  }
  // Hive Repair is always on the table if the pool runs dry.
  while (out.length < 3) out.push(UPGRADES.find((u) => u.id === 'hive-repair'));
  return out;
}

export function pickUpgrade(s, idx, sound) {
  const u = s.choices[idx];
  if (!u) return;
  s.upCounts[u.id] = (s.upCounts[u.id] || 0) + 1;
  if (u.id === 'hive-repair') s.hiveHp = Math.min(HIVE_MAX_HP, s.hiveHp + 1);
  recomputeUp(s);
  if (sound) sound.upgradePick();
  startDay(s, s.day + 1, sound);
  s.screen = 'play';
}

function gameOver(s, sound) {
  s.screen = 'gameover';
  if (sound) sound.gameOver();
  if (s.score > s.best) s.best = s.score;
}

function rankFor(s) {
  if (s.score >= 10000 && s.hiveHp >= 4) return 'S';
  if (s.score >= 7000) return 'A';
  if (s.score >= 4000) return 'B';
  return 'C';
}

function victory(s, sound) {
  s.screen = 'victory';
  s.rank = rankFor(s);
  if (sound) sound.victory();
  if (s.score > s.best) s.best = s.score;
}

// ---------------------------------------------------------------- update
export function update(s, dt, input, pressed, sound) {
  s.time += dt;
  if (s.banner) {
    s.banner.t -= dt;
    if (s.banner.t <= 0) s.banner = null;
  }
  s.shake = Math.max(0, s.shake - dt * 26);
  s.flash = Math.max(0, s.flash - dt * 2.2);

  // Particles and floating text always animate (even on menus, for life).
  for (const p of s.particles) {
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.vx *= 0.96;
    p.vy *= 0.96;
    p.life -= dt;
  }
  s.particles = s.particles.filter((p) => p.life > 0);
  for (const f of s.floats) {
    f.y -= 34 * dt;
    f.life -= dt;
  }
  s.floats = s.floats.filter((f) => f.life > 0);

  if (s.screen === 'upgrade') return; // frozen behind the cards

  if (s.screen !== 'play') return;

  const p = s.player;
  p.invuln = Math.max(0, p.invuln - dt);
  p.stingCd = Math.max(0, p.stingCd - dt);
  p.stingAnim = Math.max(0, p.stingAnim - dt);

  // --- autopilot (headless test hook ?auto=1): decide intent BEFORE movement.
  if (s.auto) autoPilot(s, input);

  // --- movement: keys win; otherwise steer toward the held pointer.
  const mv = input.moveVector();
  let tx = 0;
  let ty = 0;
  if (s.auto && s._autoMove) {
    tx = s._autoMove.x;
    ty = s._autoMove.y;
  } else if (mv) {
    tx = mv.x;
    ty = mv.y;
  } else if (input.pointer.down) {
    const dx = input.pointer.x - p.x;
    const dy = input.pointer.y - p.y;
    const d = Math.hypot(dx, dy);
    if (d > 8) {
      tx = dx / d;
      ty = dy / d;
    }
  }
  const speed = PLAYER.speed * s.up.speedMul;
  p.vx = tx * speed;
  p.vy = ty * speed;
  p.x = Math.min(W - 20, Math.max(20, p.x + p.vx * dt));
  p.y = Math.min(H - 20, Math.max(20, p.y + p.vy * dt));
  // Facing follows movement — except under autopilot, which aims at its target.
  if (!s.auto && (tx !== 0 || ty !== 0)) p.facing = Math.atan2(ty, tx);
  if (!s.auto && input.pointer.down) {
    const dx = input.pointer.x - p.x;
    const dy = input.pointer.y - p.y;
    if (Math.hypot(dx, dy) > 24) p.facing = Math.atan2(dy, dx);
  }

  // --- stinger regrow
  const maxSt = maxStingers(s);
  if (s.stingers < maxSt) {
    s.stingerTimer += dt;
    const need = PLAYER.stingerRegrow * s.up.regrowMul;
    if (s.stingerTimer >= need) {
      s.stingerTimer = 0;
      s.stingers = Math.min(maxSt, s.stingers + 1);
    }
  } else {
    s.stingerTimer = 0;
  }

  // --- sting: pressed flag, held button, or autopilot intent
  if ((pressed & 1) || input.stingHeld || (s.auto && s._autoSting)) sting(s, sound);

  // --- spawning
  const day = DAYS[s.day - 1];
  if (s.dayState === 'waves') {
    s.spawnTimer -= dt;
    if (s.spawned < s.quota && s.spawnTimer <= 0) {
      s.spawnTimer = day.interval * s.rng.range(0.75, 1.25);
      const type = pickType(s);
      if (type === 'mite') {
        const base = edgeSpawn(s);
        for (let i = 0; i < 3; i++) spawnEnemy(s, 'mite', base.x + s.rng.range(-26, 26), base.y + s.rng.range(-26, 26));
        s.spawned += 3;
      } else {
        spawnEnemy(s, type);
        s.spawned += 1;
      }
    }
    if (s.spawned >= s.quota && s.enemies.length === 0) {
      if (day.boss && !s.bossSpawned) {
        spawnBoss(s);
        if (sound) sound.bossRoar();
      } else {
        s.dayState = 'clear';
        dayClear(s, sound);
      }
    }
  }

  // --- flowers
  const bloomEvery = POLLEN.interval * (s.relicSet.has('sunpetal') ? 0.5 : 1);
  s.flowerTimer -= dt;
  if (s.flowerTimer <= 0) {
    s.flowerTimer = bloomEvery;
    if (s.flowers.length < 4) spawnFlower(s);
  }
  for (const f of s.flowers) f.life -= dt;
  s.flowers = s.flowers.filter((f) => f.life > 0);

  // --- pollen magnet + collection
  const magnetR = s.up.magnetR;
  for (const f of s.flowers) {
    const dx = p.x - f.x;
    const dy = p.y - f.y;
    const d = Math.hypot(dx, dy);
    if (magnetR > 0 && d < magnetR && d > 1) {
      f.x += (dx / d) * 190 * dt;
      f.y += (dy / d) * 190 * dt;
    }
    if (d < p.r + 20) collectPollen(s, f, sound);
  }
  s.flowers = s.flowers.filter((f) => !f.eaten);
  for (const m of s.motes) {
    m.x += m.vx * dt;
    m.y += m.vy * dt;
    m.life -= dt;
    const d = Math.hypot(p.x - m.x, p.y - m.y);
    if (d < p.r + 12) {
      m.eaten = true;
      addScore(s, m.val, m.x, m.y);
      if (sound) sound.pollen();
    }
  }
  s.motes = s.motes.filter((m) => m.life > 0 && !m.eaten);

  // --- enemies: drift toward the hive with a wobble
  for (const e of s.enemies) {
    e.flash = Math.max(0, e.flash - dt);
    e.wob += e.wobSpeed * dt;
    const dx = HIVE.x - e.x;
    const dy = HIVE.y - e.y;
    const d = Math.hypot(dx, dy) || 1;
    const nx = dx / d;
    const ny = dy / d;
    // Perpendicular wobble so the swarm never flies in a straight line.
    const px = -ny * Math.sin(e.wob) * e.wobAmp;
    const py = nx * Math.sin(e.wob) * e.wobAmp;
    e.x += (nx * e.speed + px) * dt;
    e.y += (ny * e.speed + py) * dt;

    const hd = Math.hypot(HIVE.x - e.x, HIVE.y - e.y);
    if (hd < HIVE.r + e.r * 0.5) {
      e.dead = true;
      burst(s, e.x, e.y, '#ff4d4d', 10, 150);
      hiveDamage(s, 1, sound, false);
      continue;
    }
    const pd = Math.hypot(p.x - e.x, p.y - e.y);
    if (pd < p.r + e.r && p.invuln <= 0) {
      if (s.up.thorn) {
        e.hp -= 1;
        e.flash = 0.12;
        if (e.hp <= 0) {
          killEnemy(s, e, sound);
          continue;
        }
      }
      e.dead = true;
      p.invuln = PLAYER.invuln;
      burst(s, p.x, p.y, '#ff4d4d', 10, 150);
      hiveDamage(s, 1, sound, true);
    }
  }
  s.enemies = s.enemies.filter((e) => !e.dead && e.hp > 0);

  // --- boss
  if (s.boss) updateBoss(s, dt, sound);
}

function collectPollen(s, f, sound) {
  f.eaten = true;
  s.pollen += 1;
  s.pollenBank += 1;
  s.stats.pollenGot += 1;
  const val = POLLEN.score * (s.up.goldenPollen ? 2 : 1);
  addScore(s, val, f.x, f.y, 'POLLEN');
  burst(s, f.x, f.y, '#ffd54f', 12, 140);
  if (s.stingers < maxStingers(s)) s.stingers += 1;
  if (sound) sound.pollen();
  if (s.pollenBank >= 5) {
    s.pollenBank = 0;
    if (s.hiveHp < HIVE_MAX_HP) {
      s.hiveHp += 1;
      addFloat(s, HIVE.x, HIVE.y - 60, '+1 HIVE HP', '#7ee787', 18);
      if (sound) sound.hiveHeal();
    }
  }
}

function updateBoss(s, dt, sound) {
  const b = s.boss;
  const p = s.player;
  b.flash = Math.max(0, b.flash - dt);
  b.stateT += dt;
  b.wob += dt;

  if (b.state === 'enter') {
    b.y += 60 * dt;
    if (b.y >= 130) {
      b.y = 130;
      b.state = 'fight';
      b.stateT = 0;
    }
    return;
  }

  // Minion spawns during the fight.
  b.spawnT -= dt;
  if (b.spawnT <= 0) {
    b.spawnT = BOSS.spawnInterval;
    for (let i = 0; i < BOSS.minionsPerSpawn; i++) {
      const t = s.rng.chance(0.6) ? 'wasp' : 'mite';
      spawnEnemy(s, t, b.x + s.rng.range(-40, 40), b.y + s.rng.range(-20, 40));
    }
  }

  if (b.state === 'fight') {
    // Drift toward the player, slow and menacing.
    const dx = p.x - b.x;
    const dy = p.y - b.y;
    const d = Math.hypot(dx, dy) || 1;
    b.x += (dx / d) * b.speed * dt;
    b.y += (dy / d) * b.speed * dt;
    b.x = Math.min(W - 50, Math.max(50, b.x));
    b.y = Math.min(H - 150, Math.max(80, b.y));
    if (b.stateT > 3.2) {
      b.state = 'telegraph';
      b.stateT = 0;
      if (sound) sound.bossRoar();
    }
  } else if (b.state === 'telegraph') {
    // Flash and lock the charge direction at the player.
    b.chargeDir = { x: (p.x - b.x) / (Math.hypot(p.x - b.x, p.y - b.y) || 1), y: (p.y - b.y) / (Math.hypot(p.x - b.x, p.y - b.y) || 1) };
    if (b.stateT > 0.65) {
      b.state = 'charge';
      b.stateT = 0;
    }
  } else if (b.state === 'charge') {
    b.x += b.chargeDir.x * BOSS.chargeSpeed * dt;
    b.y += b.chargeDir.y * BOSS.chargeSpeed * dt;
    if (b.stateT > 0.55 || b.x < 40 || b.x > W - 40 || b.y < 60 || b.y > H - 60) {
      b.state = 'rest';
      b.stateT = 0;
      s.shake = Math.max(s.shake, 6);
    }
    // Charging into the player hurts the hive.
    const pd = Math.hypot(p.x - b.x, p.y - b.y);
    if (pd < p.r + b.r && p.invuln <= 0) {
      p.invuln = PLAYER.invuln;
      hiveDamage(s, 1, sound, true);
    }
  } else if (b.state === 'rest') {
    if (b.stateT > 1.1) {
      b.state = 'fight';
      b.stateT = 0;
    }
  }

  // Boss touching the hive also hurts it.
  const hd = Math.hypot(HIVE.x - b.x, HIVE.y - b.y);
  if (hd < HIVE.r + b.r * 0.6 && b.state !== 'enter') {
    b.y = HIVE.y - HIVE.r - b.r - 4;
    hiveDamage(s, 1, sound, false);
    b.state = 'rest';
    b.stateT = 0;
  }
}

// ---------------------------------------------------------------- autopilot (headless test hook only)
function autoPilot(s, input) {
  const p = s.player;
  s._autoMove = null;
  s._autoSting = false;
  // Dodge the Queen's telegraphed charge: sidestep perpendicular to her line.
  if (s.boss && (s.boss.state === 'telegraph' || s.boss.state === 'charge')) {
    const cd = s.boss.chargeDir;
    const px = -cd.y;
    const py = cd.x;
    const dot = (p.x - s.boss.x) * px + (p.y - s.boss.y) * py;
    const sgn = dot >= 0 ? 1 : -1;
    s._autoMove = { x: px * sgn, y: py * sgn };
    return;
  }
  // Most urgent first: the enemy closest to the hive. The boss is the target
  // only when nothing is threatening the hive up close.
  let target = null;
  let hiveDist = Infinity;
  for (const e of s.enemies) {
    const dh = Math.hypot(e.x - HIVE.x, e.y - HIVE.y);
    if (dh < hiveDist) { hiveDist = dh; target = e; }
  }
  if (s.boss && s.boss.state !== 'enter' && hiveDist > 220) target = s.boss;
  // No urgent threat: grab a nearby flower instead of chasing far foes.
  if ((!target || hiveDist > 260) && s.flowers.length > 0) {
    let bestF = Infinity;
    let flower = null;
    for (const f of s.flowers) {
      const d = Math.hypot(f.x - p.x, f.y - p.y);
      if (d < bestF) { bestF = d; flower = f; }
    }
    if (flower && bestF < 220) target = flower;
  }
  if (!target) {
    let best = Infinity;
    for (const f of s.flowers) {
      const d = Math.hypot(f.x - p.x, f.y - p.y);
      if (d < best) { best = d; target = f; }
    }
  }
  if (!target) target = { x: HIVE.x, y: HIVE.y - 130 };
  const dx = target.x - p.x;
  const dy = target.y - p.y;
  const d = Math.hypot(dx, dy) || 1;
  p.facing = Math.atan2(dy, dx);
  const isFoe = target === s.boss || s.enemies.includes(target);
  const stingRange = PLAYER.stingRange * s.up.rangeMul;
  if (isFoe) {
    // Hold at sting range and sting; back off if on top of the target.
    if (d > stingRange + 8) {
      s._autoMove = { x: dx / d, y: dy / d };
    } else if (d < stingRange - 30) {
      s._autoMove = { x: -dx / d, y: -dy / d };
    }
    if (d <= stingRange + 10) s._autoSting = true;
  } else if (d > 14) {
    s._autoMove = { x: dx / d, y: dy / d };
  }
}
