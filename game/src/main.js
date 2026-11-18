// HIVEWARDEN bootstrap: canvas scaling, the frame loop, screen transitions,
// and the ?shot= / ?auto= test hooks.
//   ?seed=N fixes the run. ?shot=start|upgrade|boss|victory stages that scene
//   instead of running the loop, paints it and sets window.__shotReady.
//   ?auto=1 plays itself (headless test hook); ?fast=N speeds the simulation.
import { W, H } from './config.js';
import { createWorld, newGame, pickUpgrade, update } from './world.js';
import { draw, layout } from './render.js';
import { Input, ACTION_STING, ACTION_PAUSE, ACTION_MUTE, ACTION_START, ACTION_RESTART, ACTION_PICK1, ACTION_PICK2, ACTION_PICK3 } from './input.js';
import { Sound } from './audio.js';
import { stageShot } from './shots.js';

const params = new URLSearchParams(location.search);
const seed = Number(params.get('seed') || (Math.random() * 1e9) | 0);
const shot = params.get('shot');
const auto = params.get('auto') === '1';
const fast = Math.max(1, Number(params.get('fast') || 1));
// ?tick=1 advances a fixed 1/60 s per frame: under a headless virtual-time
// budget the real clock barely moves, so the loop would otherwise crawl.
const fixedTick = params.get('tick') === '1';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const statusEl = document.getElementById('status');

const sound = new Sound();
const world = createWorld(seed);
world.auto = auto;
try {
  world.best = Number(localStorage.getItem('hivewarden.best') || 0);
} catch { world.best = 0; }

let scale = 1;
let offX = 0;
let offY = 0;
function resize() {
  const cw = window.innerWidth;
  const ch = window.innerHeight;
  canvas.width = cw;
  canvas.height = ch;
  scale = Math.min(cw / W, ch / H);
  offX = (cw - W * scale) / 2;
  offY = (ch - H * scale) / 2;
}
window.addEventListener('resize', resize);
resize();

function toWorld(clientX, clientY) {
  const r = canvas.getBoundingClientRect();
  return { x: (clientX - r.left - offX) / scale, y: (clientY - r.top - offY) / scale };
}
const input = new Input(canvas, toWorld);

function announce(text) {
  if (statusEl) statusEl.textContent = text;
}

function render() {
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = '#160b08';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.setTransform(scale, 0, 0, scale, offX, offY);
  draw(ctx, world);
}

function saveBest() {
  try {
    localStorage.setItem('hivewarden.best', String(Math.max(world.best, world.score)));
  } catch { /* storage unavailable; best lives only for this session */ }
}

// -- shot mode: stage one scene, paint it, signal readiness, stop.
if (shot && stageShot(world, shot)) {
  world.time = 1.2;
  render();
  requestAnimationFrame(() => {
    render();
    window.__shotReady = true;
    document.title = `HIVEWARDEN shot:${shot}`;
  });
} else {
  let last = performance.now();
  function frame(now) {
    let dt = fixedTick ? 1 / 60 : Math.min(0.033, (now - last) / 1000);
    last = now;
    dt *= fast;

    const pressed = input.takePressed();

    if (pressed & ACTION_MUTE) {
      world.muted = !world.muted;
      sound.setMuted(world.muted);
    }

    if (world.screen === 'title') {
      if (world.auto) {
        // Headless test hook: start by itself so a run can be observed.
        newGame(world, sound);
      } else if (pressed & (ACTION_START | ACTION_STING)) {
        sound.ensure();
        sound.click();
        newGame(world, sound);
      }
    } else if (world.screen === 'play') {
      if (pressed & ACTION_PAUSE) {
        world.screen = 'pause';
        sound.click();
      } else {
        update(world, dt, input, pressed, sound);
      }
    } else if (world.screen === 'pause') {
      if (pressed & (ACTION_PAUSE | ACTION_STING)) {
        world.screen = 'play';
        sound.click();
      }
    } else if (world.screen === 'upgrade') {
      if (pressed & ACTION_PICK1) pickUpgrade(world, 0, sound);
      else if (pressed & ACTION_PICK2) pickUpgrade(world, 1, sound);
      else if (pressed & ACTION_PICK3) pickUpgrade(world, 2, sound);
      else if (pressed & ACTION_STING) {
        const p = toWorldFromPointer();
        if (p) {
          for (const c of layout.cards) {
            if (p.x >= c.x && p.x <= c.x + c.w && p.y >= c.y && p.y <= c.y + c.h) {
              pickUpgrade(world, c.index, sound);
              break;
            }
          }
        }
      }
      // Autopilot picks the first card so a headless run reaches Day 7.
      if (world.auto && world.screen === 'upgrade') pickUpgrade(world, 0, sound);
    } else if (world.screen === 'gameover' || world.screen === 'victory') {
      if (pressed & (ACTION_RESTART | ACTION_START | ACTION_STING)) {
        saveBest();
        newGame(world, sound);
      }
    }

    // Keep the world ticking behind upgrade cards? No: update() already
    // freezes on the upgrade screen; particles still animate via update's
    // early path, so call a light tick here for menu screens.
    if (world.screen !== 'play') {
      update(world, dt, input, 0, null);
    }

    render();
    document.title = `HIVEWARDEN ${world.screen} day ${world.day} score ${world.score}`;
    requestAnimationFrame(frame);
  }

  function toWorldFromPointer() {
    if (!input.pointer.active) return null;
    return { x: input.pointer.x, y: input.pointer.y };
  }

  window.addEventListener('beforeunload', saveBest);
  window.__game = world;
  requestAnimationFrame(frame);
}
