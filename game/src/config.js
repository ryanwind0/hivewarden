// HIVEWARDEN tuning: one place for every number the game balances on.
// The playfield is a fixed logical 960x540; the renderer scales it to the canvas.
export const W = 960;
export const H = 540;

// The hive sits at bottom centre; enemies that reach its radius hurt it.
export const HIVE = { x: W / 2, y: H - 64, r: 46 };
export const HIVE_MAX_HP = 5;

export const PLAYER = {
  r: 13,
  speed: 250, // px/s, before Swift Wings
  stingRange: 78, // px, before Long Sting
  stingArc: 1.05, // radians either side of the facing direction
  stingCooldown: 0.34, // s, before Rapid Sting
  maxStingers: 3,
  stingerRegrow: 1.2, // s per stinger, before Quick Regrow
  invuln: 1.1, // s of mercy after a hit
};

// Enemy table: hp, speed, radius, score, colour, behaviour.
export const ENEMY = {
  wasp: { hp: 1, speed: 118, r: 11, score: 10, body: '#e5484d', dark: '#7a1f24', wing: '#ffd9d9' },
  hornet: { hp: 3, speed: 62, r: 17, score: 25, body: '#c2410c', dark: '#5f2206', wing: '#fde68a' },
  mite: { hp: 1, speed: 86, r: 6, score: 5, body: '#a855f7', dark: '#4c1d95', wing: '#e9d5ff' },
};

// A day is a quota of enemies to kill; spawn pacing tightens with the day.
export const DAYS = [
  { quota: 14, interval: 1.35, mix: { wasp: 0.8, hornet: 0.0, mite: 0.2 }, boss: false },
  { quota: 20, interval: 1.1, mix: { wasp: 0.65, hornet: 0.1, mite: 0.25 }, boss: false },
  { quota: 24, interval: 0.9, mix: { wasp: 0.55, hornet: 0.2, mite: 0.25 }, boss: true },
  { quota: 30, interval: 0.8, mix: { wasp: 0.5, hornet: 0.25, mite: 0.25 }, boss: false },
  { quota: 34, interval: 0.72, mix: { wasp: 0.45, hornet: 0.3, mite: 0.25 }, boss: true },
  { quota: 40, interval: 0.64, mix: { wasp: 0.4, hornet: 0.3, mite: 0.3 }, boss: false },
  { quota: 46, interval: 0.56, mix: { wasp: 0.35, hornet: 0.35, mite: 0.3 }, boss: true },
];
export const TOTAL_DAYS = 7;

// Hornet Queen: big, slow, charges, spawns minions, shows a top HP bar.
export const BOSS = {
  hp: 24, // + 7 per boss day (day 3 -> 31, day 5 -> 38, day 7 -> 45)
  hpPerBossDay: 7,
  speed: 52,
  chargeSpeed: 300,
  r: 34,
  score: 500,
  spawnInterval: 7.0, // s between minion spawns
  minionsPerSpawn: 2,
};

// Pollen flowers bloom on their own timer; a flower lives 9 s.
export const POLLEN = {
  interval: 4.5, // s between blooms
  life: 9,
  score: 10,
  magnetBase: 0, // px; Pollen Magnet upgrade sets this
};

export const COMBO = {
  // kills needed for each multiplier tier; index 0 is x1.
  tiers: [0, 3, 6, 9, 12, 15, 18, 21],
  max: 8,
};

// Colours: dark hive interior, amber honeycomb, bright gold bee, red foes.
export const COLORS = {
  bg0: '#160b08',
  bg1: '#2a130c',
  bg2: '#3d1c12',
  hex: 'rgba(255, 179, 0, 0.055)',
  hexLine: 'rgba(255, 179, 0, 0.10)',
  gold: '#ffc21c',
  goldBright: '#ffe066',
  goldDeep: '#b97e0c',
  honey: '#ff9d00',
  cream: '#fff3c4',
  ink: '#1c0f08',
  red: '#ff4d4d',
  purple: '#c084fc',
  green: '#7ee787',
};
