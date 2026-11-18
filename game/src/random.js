// Seeded RNG (mulberry32) so screenshot scenes and replays are repeatable.
// ?seed=N in the URL pins the run; without it the seed comes from the clock.
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function makeRng(seed) {
  const rand = mulberry32(seed);
  return {
    next: rand,
    range: (lo, hi) => lo + rand() * (hi - lo),
    int: (lo, hi) => lo + Math.floor(rand() * (hi - lo + 1)),
    pick: (arr) => arr[Math.floor(rand() * arr.length)],
    chance: (p) => rand() < p,
  };
}
