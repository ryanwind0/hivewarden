// HIVEWARDEN renderer: every pixel is canvas vector art — no images, no fonts
// beyond the system stack. The world is drawn in logical 960x540 space;
// main.js scales the canvas to fit.
import { W, H, HIVE, HIVE_MAX_HP, COLORS, TOTAL_DAYS } from './config.js';
import { UPGRADES, RELICS, maxStingers } from './world.js';

export const layout = { cards: [] }; // upgrade card hit rects, refreshed each draw

const TAU = Math.PI * 2;

function hexPath(ctx, x, y, r) {
  ctx.beginPath();
  for (let i = 0; i < 6; i++) {
    const a = (Math.PI / 3) * i + Math.PI / 6;
    const px = x + Math.cos(a) * r;
    const py = y + Math.sin(a) * r;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
}

function drawBackground(ctx, s) {
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, COLORS.bg0);
  g.addColorStop(0.55, COLORS.bg1);
  g.addColorStop(1, COLORS.bg2);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);

  // Honeycomb: a staggered hex grid, faint, drawn once per frame cheaply.
  const r = 34;
  const w = r * Math.sqrt(3);
  ctx.strokeStyle = COLORS.hexLine;
  ctx.lineWidth = 1;
  for (let row = -1; row < H / (r * 1.5) + 1; row++) {
    for (let col = -1; col < W / w + 1; col++) {
      const x = col * w + (row % 2 ? w / 2 : 0);
      const y = row * r * 1.5;
      hexPath(ctx, x, y, r - 2);
      ctx.stroke();
    }
  }
  // Warm glow from the hive at the bottom.
  const glow = ctx.createRadialGradient(HIVE.x, HIVE.y, 10, HIVE.x, HIVE.y, 320);
  glow.addColorStop(0, 'rgba(255, 157, 0, 0.20)');
  glow.addColorStop(1, 'rgba(255, 157, 0, 0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, W, H);
}

function drawHive(ctx, s) {
  const { x, y, r } = HIVE;
  // Golden dome.
  const g = ctx.createRadialGradient(x - r * 0.3, y - r * 0.4, 6, x, y, r * 1.15);
  g.addColorStop(0, '#ffe066');
  g.addColorStop(0.6, '#ffb300');
  g.addColorStop(1, '#8a5a00');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(x, y, r, Math.PI, 0);
  ctx.closePath();
  ctx.fill();
  // Hex cells on the dome.
  ctx.strokeStyle = 'rgba(120, 70, 0, 0.55)';
  ctx.lineWidth = 1.5;
  const cell = 13;
  for (let row = 0; row < 3; row++) {
    for (let col = -3; col <= 3; col++) {
      const cx = x + col * cell * 1.05;
      const cy = y - 10 - row * cell * 0.95;
      const dx = cx - x;
      const dy = cy - y;
      if (dx * dx + dy * dy < (r - 8) * (r - 8)) {
        hexPath(ctx, cx, cy, cell / 2);
        ctx.stroke();
      }
    }
  }
  // Entrance hole.
  ctx.fillStyle = '#2a1206';
  ctx.beginPath();
  ctx.ellipse(x, y - 2, 13, 9, 0, 0, TAU);
  ctx.fill();
  // HP hearts + label only during play: on menus they collide with the text.
  if (s.screen === 'play' || s.screen === 'pause') {
    for (let i = 0; i < HIVE_MAX_HP; i++) {
      const hx = x - (HIVE_MAX_HP - 1) * 13 + i * 26;
      const hy = y - r - 16;
      drawHeart(ctx, hx, hy, 9, i < s.hiveHp ? '#ff5a5a' : 'rgba(255,255,255,0.18)');
    }
    ctx.fillStyle = '#ffe9a8';
    ctx.font = 'bold 12px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('H I V E', x, y - r - 30);
  }
}

function drawHeart(ctx, x, y, size, color) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(x, y + size * 0.9);
  ctx.bezierCurveTo(x - size * 1.2, y, x - size * 0.6, y - size, x, y - size * 0.25);
  ctx.bezierCurveTo(x + size * 0.6, y - size, x + size * 1.2, y, x, y + size * 0.9);
  ctx.fill();
}

function drawFlower(ctx, f, time) {
  const pulse = 1 + Math.sin(time * 3 + f.phase) * 0.12;
  const lifeA = Math.min(1, f.life / 2);
  ctx.save();
  ctx.globalAlpha = lifeA;
  // Glow.
  const glow = ctx.createRadialGradient(f.x, f.y, 2, f.x, f.y, 26 * pulse);
  glow.addColorStop(0, 'rgba(255, 213, 79, 0.55)');
  glow.addColorStop(1, 'rgba(255, 213, 79, 0)');
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(f.x, f.y, 26 * pulse, 0, TAU);
  ctx.fill();
  // Five petals.
  ctx.fillStyle = '#ffd54f';
  for (let i = 0; i < 5; i++) {
    const a = (TAU / 5) * i + f.phase * 0.2;
    const px = f.x + Math.cos(a) * 9 * pulse;
    const py = f.y + Math.sin(a) * 9 * pulse;
    ctx.beginPath();
    ctx.ellipse(px, py, 7, 4.5, a, 0, TAU);
    ctx.fill();
  }
  // Centre.
  ctx.fillStyle = '#ff9d00';
  ctx.beginPath();
  ctx.arc(f.x, f.y, 5.5, 0, TAU);
  ctx.fill();
  ctx.restore();
}

function drawBee(ctx, x, y, facing, flap, stingAnim, invuln, time) {
  ctx.save();
  ctx.translate(x, y);
  if (invuln > 0 && Math.floor(time * 14) % 2 === 0) ctx.globalAlpha = 0.45;
  ctx.rotate(facing);
  // Wings (flap).
  const w = Math.sin(flap) * 0.5;
  ctx.fillStyle = 'rgba(255, 255, 255, 0.55)';
  ctx.beginPath();
  ctx.ellipse(-2, -11 - w * 4, 11, 5, -0.5 - w * 0.2, 0, TAU);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(-2, 11 + w * 4, 11, 5, 0.5 + w * 0.2, 0, TAU);
  ctx.fill();
  // Body: gold with dark stripes.
  const g = ctx.createLinearGradient(-13, 0, 13, 0);
  g.addColorStop(0, '#ffcf3d');
  g.addColorStop(1, '#ff9d00');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.ellipse(0, 0, 13, 9.5, 0, 0, TAU);
  ctx.fill();
  ctx.fillStyle = '#2a1602';
  ctx.fillRect(-2, -9.5, 3.5, 19);
  ctx.fillRect(4, -8.5, 3.5, 17);
  // Head + eye.
  ctx.fillStyle = '#1c0f08';
  ctx.beginPath();
  ctx.arc(12, 0, 5.5, 0, TAU);
  ctx.fill();
  ctx.fillStyle = '#fff';
  ctx.beginPath();
  ctx.arc(13.5, -2, 1.8, 0, TAU);
  ctx.fill();
  // Stinger flash when stinging.
  if (stingAnim > 0) {
    ctx.fillStyle = '#fff3c4';
    ctx.beginPath();
    ctx.moveTo(-13, -4);
    ctx.lineTo(-13 - 16 * (stingAnim / 0.16), 0);
    ctx.lineTo(-13, 4);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
}

function drawEnemy(ctx, e, time) {
  const def = { wasp: '#e5484d', hornet: '#c2410c', mite: '#a855f7' }[e.type];
  const dark = { wasp: '#7a1f24', hornet: '#5f2206', mite: '#4c1d95' }[e.type];
  ctx.save();
  ctx.translate(e.x, e.y);
  const ang = Math.atan2(HIVE.y - e.y, HIVE.x - e.x);
  ctx.rotate(ang);
  if (e.flash > 0) ctx.globalAlpha = 0.6;
  // Wings.
  const w = Math.sin(time * 30 + e.wob) * 0.4;
  ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
  ctx.beginPath();
  ctx.ellipse(-e.r * 0.2, -e.r - 2 - w * 2, e.r * 0.8, e.r * 0.35, -0.4, 0, TAU);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(-e.r * 0.2, e.r + 2 + w * 2, e.r * 0.8, e.r * 0.35, 0.4, 0, TAU);
  ctx.fill();
  // Body.
  ctx.fillStyle = def;
  ctx.beginPath();
  ctx.ellipse(0, 0, e.r, e.r * 0.72, 0, 0, TAU);
  ctx.fill();
  // Stripes for wasp/hornet.
  if (e.type !== 'mite') {
    ctx.fillStyle = dark;
    ctx.fillRect(-e.r * 0.25, -e.r * 0.72, e.r * 0.28, e.r * 1.44);
    ctx.fillRect(e.r * 0.3, -e.r * 0.6, e.r * 0.24, e.r * 1.2);
  }
  // Head + eyes.
  ctx.fillStyle = dark;
  ctx.beginPath();
  ctx.arc(e.r * 0.85, 0, e.r * 0.42, 0, TAU);
  ctx.fill();
  ctx.fillStyle = '#ff2d2d';
  ctx.beginPath();
  ctx.arc(e.r * 0.95, -e.r * 0.18, e.r * 0.14, 0, TAU);
  ctx.arc(e.r * 0.95, e.r * 0.18, e.r * 0.14, 0, TAU);
  ctx.fill();
  // Mite legs.
  if (e.type === 'mite') {
    ctx.strokeStyle = dark;
    ctx.lineWidth = 1.5;
    for (let i = -1; i <= 1; i++) {
      ctx.beginPath();
      ctx.moveTo(i * 3, -e.r * 0.6);
      ctx.lineTo(i * 4, -e.r * 1.4);
      ctx.moveTo(i * 3, e.r * 0.6);
      ctx.lineTo(i * 4, e.r * 1.4);
      ctx.stroke();
    }
  }
  ctx.restore();
  // Hornet HP pips above.
  if (e.type === 'hornet' && e.hp < e.maxHp) {
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fillRect(e.x - 14, e.y - e.r - 10, 28, 4);
    ctx.fillStyle = '#ff5a5a';
    ctx.fillRect(e.x - 14, e.y - e.r - 10, 28 * (e.hp / e.maxHp), 4);
  }
}

function drawBoss(ctx, b, time) {
  ctx.save();
  ctx.translate(b.x, b.y);
  const telegraph = b.state === 'telegraph' && Math.floor(time * 10) % 2 === 0;
  if (telegraph) ctx.globalAlpha = 0.75;
  const w = Math.sin(time * 22) * 0.3;
  // Big wings.
  ctx.fillStyle = 'rgba(255, 240, 180, 0.5)';
  ctx.beginPath();
  ctx.ellipse(-8, -b.r - 6 - w * 6, 26, 10, -0.5, 0, TAU);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(-8, b.r + 6 + w * 6, 26, 10, 0.5, 0, TAU);
  ctx.fill();
  // Body.
  const g = ctx.createLinearGradient(-b.r, 0, b.r, 0);
  g.addColorStop(0, '#f97316');
  g.addColorStop(1, '#7c2d12');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.ellipse(0, 0, b.r, b.r * 0.78, 0, 0, TAU);
  ctx.fill();
  ctx.fillStyle = '#2a1206';
  ctx.fillRect(-b.r * 0.3, -b.r * 0.78, b.r * 0.22, b.r * 1.56);
  ctx.fillRect(b.r * 0.15, -b.r * 0.7, b.r * 0.2, b.r * 1.4);
  // Crown spikes.
  ctx.fillStyle = '#ffd54f';
  for (let i = -1; i <= 1; i++) {
    ctx.beginPath();
    ctx.moveTo(i * 12 - 6, -b.r * 0.7);
    ctx.lineTo(i * 12, -b.r * 1.15);
    ctx.lineTo(i * 12 + 6, -b.r * 0.7);
    ctx.closePath();
    ctx.fill();
  }
  // Head + angry eyes.
  ctx.fillStyle = '#1c0f08';
  ctx.beginPath();
  ctx.arc(b.r * 0.85, 0, b.r * 0.4, 0, TAU);
  ctx.fill();
  ctx.fillStyle = '#ff2d2d';
  ctx.beginPath();
  ctx.arc(b.r * 0.92, -b.r * 0.16, b.r * 0.13, 0, TAU);
  ctx.arc(b.r * 0.92, b.r * 0.16, b.r * 0.13, 0, TAU);
  ctx.fill();
  // Rested after a missed charge: show her as vulnerable.
  if (b.state === 'rest') {
    ctx.fillStyle = '#ffe066';
    ctx.font = 'bold 26px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('!', 0, -b.r - 16);
  }
  if (b.flash > 0) {
    ctx.globalAlpha = 0.5;
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.ellipse(0, 0, b.r, b.r * 0.78, 0, 0, TAU);
    ctx.fill();
  }
  ctx.restore();
}

// ---------------------------------------------------------------- icons
export function drawUpgradeIcon(ctx, icon, x, y, s) {
  ctx.save();
  ctx.translate(x, y);
  ctx.strokeStyle = '#ffe066';
  ctx.fillStyle = '#ffe066';
  ctx.lineWidth = 2;
  ctx.lineCap = 'round';
  switch (icon) {
    case 'sting':
      ctx.beginPath(); ctx.moveTo(-s * 0.5, -s * 0.3); ctx.lineTo(s * 0.6, 0); ctx.lineTo(-s * 0.5, s * 0.3); ctx.closePath(); ctx.fill();
      break;
    case 'wing':
      ctx.beginPath(); ctx.ellipse(0, 0, s * 0.6, s * 0.3, -0.6, 0, TAU); ctx.fill();
      break;
    case 'magnet':
      ctx.beginPath(); ctx.arc(0, 0, s * 0.5, Math.PI, 0); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(-s * 0.5, 0); ctx.lineTo(-s * 0.5, s * 0.4); ctx.moveTo(s * 0.5, 0); ctx.lineTo(s * 0.5, s * 0.4); ctx.stroke();
      break;
    case 'thorn':
      for (let i = -1; i <= 1; i++) {
        ctx.beginPath(); ctx.moveTo(i * s * 0.35, s * 0.4); ctx.lineTo(i * s * 0.35, -s * 0.4); ctx.stroke();
      }
      break;
    case 'chain':
      ctx.beginPath(); ctx.arc(-s * 0.22, 0, s * 0.26, 0, TAU); ctx.stroke();
      ctx.beginPath(); ctx.arc(s * 0.22, 0, s * 0.26, 0, TAU); ctx.stroke();
      break;
    case 'reach':
      ctx.beginPath(); ctx.moveTo(-s * 0.5, 0); ctx.lineTo(s * 0.3, 0); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(s * 0.1, -s * 0.3); ctx.lineTo(s * 0.5, 0); ctx.lineTo(s * 0.1, s * 0.3); ctx.closePath(); ctx.fill();
      break;
    case 'clock':
      ctx.beginPath(); ctx.arc(0, 0, s * 0.5, 0, TAU); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, -s * 0.32); ctx.moveTo(0, 0); ctx.lineTo(s * 0.28, 0); ctx.stroke();
      break;
    case 'heart':
      drawHeart(ctx, 0, s * 0.1, s * 0.42, '#ffe066');
      break;
    case 'gold':
      ctx.beginPath(); ctx.arc(0, 0, s * 0.5, 0, TAU); ctx.stroke();
      ctx.font = `bold ${Math.round(s * 0.6)}px system-ui, sans-serif`;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText('P', 0, 1);
      break;
    case 'slow':
      ctx.beginPath(); ctx.arc(0, 0, s * 0.5, 0.5, 5.2); ctx.stroke();
      ctx.beginPath(); ctx.arc(0, 0, s * 0.2, 0, TAU); ctx.stroke();
      break;
    case 'bane':
      ctx.beginPath(); ctx.moveTo(-s * 0.45, s * 0.35); ctx.lineTo(-s * 0.45, -s * 0.2); ctx.lineTo(0, s * 0.1); ctx.lineTo(s * 0.45, -s * 0.2); ctx.lineTo(s * 0.45, s * 0.35); ctx.closePath(); ctx.stroke();
      break;
    case 'bolt':
      ctx.beginPath(); ctx.moveTo(s * 0.1, -s * 0.55); ctx.lineTo(-s * 0.3, s * 0.1); ctx.lineTo(0, s * 0.1); ctx.lineTo(-s * 0.1, s * 0.55); ctx.lineTo(s * 0.3, -s * 0.1); ctx.lineTo(0, -s * 0.1); ctx.closePath(); ctx.fill();
      break;
    case 'drop':
      ctx.beginPath(); ctx.moveTo(0, -s * 0.55); ctx.quadraticCurveTo(s * 0.45, s * 0.05, 0, s * 0.5); ctx.quadraticCurveTo(-s * 0.45, s * 0.05, 0, -s * 0.55); ctx.fill();
      break;
    case 'wind':
      ctx.beginPath(); ctx.moveTo(-s * 0.5, -s * 0.2); ctx.quadraticCurveTo(0, -s * 0.45, s * 0.5, -s * 0.2); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(-s * 0.5, s * 0.2); ctx.quadraticCurveTo(0, -s * 0.05, s * 0.5, s * 0.2); ctx.stroke();
      break;
    default:
      ctx.beginPath(); ctx.arc(0, 0, s * 0.4, 0, TAU); ctx.fill();
  }
  ctx.restore();
}

export function drawRelicIcon(ctx, id, x, y, s) {
  ctx.save();
  ctx.translate(x, y);
  ctx.lineWidth = 2;
  if (id === 'royalJelly') {
    ctx.fillStyle = '#ffb300';
    ctx.beginPath(); ctx.moveTo(0, -s * 0.5); ctx.quadraticCurveTo(s * 0.45, 0, 0, s * 0.5); ctx.quadraticCurveTo(-s * 0.45, 0, 0, -s * 0.5); ctx.fill();
    ctx.fillStyle = '#fff3c4';
    ctx.beginPath(); ctx.arc(0, -s * 0.08, s * 0.14, 0, TAU); ctx.fill();
  } else if (id === 'propolis') {
    ctx.strokeStyle = '#7ee787'; ctx.fillStyle = 'rgba(126, 231, 135, 0.25)';
    ctx.beginPath(); ctx.moveTo(0, -s * 0.5); ctx.lineTo(s * 0.45, -s * 0.2); ctx.lineTo(s * 0.3, s * 0.45); ctx.lineTo(-s * 0.3, s * 0.45); ctx.lineTo(-s * 0.45, -s * 0.2); ctx.closePath(); ctx.fill(); ctx.stroke();
  } else if (id === 'sunpetal') {
    ctx.fillStyle = '#ffd54f';
    for (let i = 0; i < 6; i++) {
      const a = (TAU / 6) * i;
      ctx.beginPath(); ctx.ellipse(Math.cos(a) * s * 0.28, Math.sin(a) * s * 0.28, s * 0.22, s * 0.13, a, 0, TAU); ctx.fill();
    }
    ctx.fillStyle = '#ff9d00';
    ctx.beginPath(); ctx.arc(0, 0, s * 0.2, 0, TAU); ctx.fill();
  } else if (id === 'amber') {
    ctx.fillStyle = '#ff9d00';
    ctx.beginPath(); ctx.moveTo(0, -s * 0.5); ctx.lineTo(s * 0.4, -s * 0.1); ctx.lineTo(s * 0.25, s * 0.45); ctx.lineTo(-s * 0.25, s * 0.45); ctx.lineTo(-s * 0.4, -s * 0.1); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#ffe9a8';
    ctx.beginPath(); ctx.arc(0, -s * 0.05, s * 0.1, 0, TAU); ctx.fill();
  }
  ctx.restore();
}

// ---------------------------------------------------------------- HUD
function drawHud(ctx, s) {
  ctx.save();
  // Top bar.
  ctx.fillStyle = 'rgba(12, 6, 4, 0.72)';
  ctx.fillRect(0, 0, W, 46);
  ctx.fillStyle = '#ffe066';
  ctx.font = 'bold 22px system-ui, sans-serif';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText(`SCORE ${s.score}`, 14, 24);
  ctx.font = 'bold 15px system-ui, sans-serif';
  ctx.fillStyle = s.comboMult > 1 ? '#ff9d00' : 'rgba(255, 233, 168, 0.6)';
  ctx.fillText(s.comboMult > 1 ? `CHAIN x${s.comboMult}` : 'CHAIN x1', 190, 24);

  ctx.textAlign = 'center';
  ctx.fillStyle = '#fff3c4';
  ctx.font = 'bold 17px system-ui, sans-serif';
  ctx.fillText(`DAY ${s.day} / ${TOTAL_DAYS}`, W / 2, 24);
  ctx.font = '13px system-ui, sans-serif';
  ctx.fillStyle = '#ffd54f';
  const remain = s.dayState === 'boss' ? 'QUEEN!' : `${Math.max(0, s.quota - s.killed)} left`;
  ctx.fillText(remain, W / 2, 40);

  // Right: stingers, pollen, relics.
  const maxSt = maxStingers(s);
  ctx.textAlign = 'right';
  ctx.font = 'bold 15px system-ui, sans-serif';
  ctx.fillStyle = '#ffe066';
  ctx.fillText(`STING ${'◆'.repeat(s.stingers)}${'◇'.repeat(Math.max(0, maxSt - s.stingers))}`, W - 14, 15);
  ctx.fillStyle = '#ffd54f';
  ctx.fillText(`POLLEN ${s.pollen}`, W - 14, 34);
  let rx = W - 150;
  for (const id of s.relics) {
    drawRelicIcon(ctx, id, rx, 24, 11);
    rx -= 24;
  }
  ctx.restore();

  // Boss HP bar.
  if (s.boss && s.boss.state !== 'enter') {
    const b = s.boss;
    const bw = 420;
    const bx = (W - bw) / 2;
    const by = 56;
    ctx.save();
    ctx.fillStyle = 'rgba(12, 6, 4, 0.8)';
    ctx.fillRect(bx - 8, by - 8, bw + 16, 30);
    ctx.fillStyle = '#3d0a0a';
    ctx.fillRect(bx, by, bw, 12);
    ctx.fillStyle = '#ff2d2d';
    ctx.fillRect(bx, by, bw * Math.max(0, b.hp / b.maxHp), 12);
    ctx.strokeStyle = '#ffd54f';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(bx, by, bw, 12);
    ctx.fillStyle = '#fff3c4';
    ctx.font = 'bold 13px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('HORNET QUEEN', W / 2, by + 26);
    ctx.restore();
  }
}

function drawBanner(ctx, s) {
  if (!s.banner) return;
  const a = Math.min(1, s.banner.t / 0.6);
  ctx.save();
  ctx.globalAlpha = a;
  ctx.textAlign = 'center';
  ctx.fillStyle = '#ffe066';
  ctx.font = 'bold 44px system-ui, sans-serif';
  ctx.shadowColor = 'rgba(255, 157, 0, 0.8)';
  ctx.shadowBlur = 24;
  ctx.fillText(s.banner.text, W / 2, H / 2 - 70);
  ctx.shadowBlur = 0;
  ctx.fillStyle = '#fff3c4';
  ctx.font = '16px system-ui, sans-serif';
  ctx.fillText(s.banner.sub, W / 2, H / 2 - 38);
  ctx.restore();
}

function dim(ctx, alpha) {
  ctx.fillStyle = `rgba(8, 4, 2, ${alpha})`;
  ctx.fillRect(0, 0, W, H);
}

// ---------------------------------------------------------------- screens
function drawTitle(ctx, s) {
  dim(ctx, 0.45);
  ctx.save();
  ctx.textAlign = 'center';
  // Decorative big bee.
  drawBee(ctx, W / 2, 128, -Math.PI / 2 + 0.35, s.time * 20, 0, 0, s.time);
  ctx.fillStyle = '#ffe066';
  ctx.font = 'bold 64px system-ui, sans-serif';
  ctx.shadowColor = 'rgba(255, 157, 0, 0.9)';
  ctx.shadowBlur = 30;
  ctx.fillText('HIVEWARDEN', W / 2, 215);
  ctx.shadowBlur = 0;
  ctx.fillStyle = '#fff3c4';
  ctx.font = '18px system-ui, sans-serif';
  ctx.fillText('One bee. Seven days. A hive worth dying for.', W / 2, 248);
  ctx.fillStyle = '#ffd54f';
  ctx.font = '15px system-ui, sans-serif';
  ctx.fillText('WASD / arrows / mouse to fly  •  Click or SPACE to sting  •  P pause  •  M mute', W / 2, 282);
  ctx.fillText('Sting wasps, hornets and mites before they reach the hive.', W / 2, 306);
  ctx.fillText('Gather pollen, survive 7 days, slay the Hornet Queens.', W / 2, 328);
  // Start prompt, blinking.
  if (Math.floor(s.time * 2) % 2 === 0) {
    ctx.fillStyle = '#ffe066';
    ctx.font = 'bold 24px system-ui, sans-serif';
    ctx.fillText('— PRESS SPACE OR CLICK TO START —', W / 2, 386);
  }
  if (s.best > 0) {
    ctx.fillStyle = '#ffd54f';
    ctx.font = 'bold 16px system-ui, sans-serif';
    ctx.fillText(`BEST SCORE  ${s.best}`, W / 2, 424);
  }
  ctx.restore();
}

function drawPause(ctx, s) {
  dim(ctx, 0.6);
  ctx.save();
  ctx.textAlign = 'center';
  ctx.fillStyle = '#ffe066';
  ctx.font = 'bold 44px system-ui, sans-serif';
  ctx.fillText('PAUSED', W / 2, H / 2 - 20);
  ctx.fillStyle = '#fff3c4';
  ctx.font = '16px system-ui, sans-serif';
  ctx.fillText('P or click to resume  •  M to mute', W / 2, H / 2 + 16);
  ctx.restore();
}

function drawUpgrade(ctx, s) {
  dim(ctx, 0.72);
  ctx.save();
  ctx.textAlign = 'center';
  ctx.fillStyle = '#7ee787';
  ctx.font = 'bold 34px system-ui, sans-serif';
  ctx.fillText(`DAY ${s.day} CLEAR!`, W / 2, 84);
  ctx.fillStyle = '#fff3c4';
  ctx.font = '16px system-ui, sans-serif';
  ctx.fillText(`Score ${s.score}   •   Hive HP ${s.hiveHp}/${HIVE_MAX_HP}   •   Choose one blessing for Day ${s.day + 1}`, W / 2, 114);
  const cw = 250;
  const ch = 240;
  const gap = 28;
  const total = cw * 3 + gap * 2;
  const x0 = (W - total) / 2;
  const y0 = 150;
  layout.cards = [];
  s.choices.forEach((u, i) => {
    const x = x0 + i * (cw + gap);
    const y = y0;
    const hover = false;
    ctx.fillStyle = hover ? '#3d2408' : '#241207';
    ctx.strokeStyle = '#ffb300';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(x, y, cw, ch, 14);
    ctx.fill();
    ctx.stroke();
    drawUpgradeIcon(ctx, u.icon, x + cw / 2, y + 52, 30);
    ctx.fillStyle = '#ffe066';
    ctx.font = 'bold 20px system-ui, sans-serif';
    ctx.fillText(u.name, x + cw / 2, y + 108);
    ctx.fillStyle = '#fff3c4';
    ctx.font = '15px system-ui, sans-serif';
    wrapText(ctx, u.desc, x + cw / 2, y + 140, cw - 36, 22);
    const owned = s.upCounts[u.id] || 0;
    ctx.fillStyle = '#ffd54f';
    ctx.font = 'bold 14px system-ui, sans-serif';
    ctx.fillText(`[${i + 1}]  ${owned > 0 ? `owned x${owned}` : 'NEW'}`, x + cw / 2, y + ch - 22);
    layout.cards.push({ x, y, w: cw, h: ch, index: i });
  });
  ctx.fillStyle = 'rgba(255, 233, 168, 0.75)';
  ctx.font = '14px system-ui, sans-serif';
  ctx.fillText('Click a card or press 1 / 2 / 3', W / 2, y0 + ch + 36);
  ctx.restore();
}

function wrapText(ctx, text, x, y, maxW, lh) {
  const words = text.split(' ');
  let line = '';
  let yy = y;
  for (const w of words) {
    const test = line ? line + ' ' + w : w;
    if (ctx.measureText(test).width > maxW && line) {
      ctx.fillText(line, x, yy);
      line = w;
      yy += lh;
    } else {
      line = test;
    }
  }
  if (line) ctx.fillText(line, x, yy);
}

function drawGameOver(ctx, s) {
  dim(ctx, 0.62);
  ctx.save();
  ctx.textAlign = 'center';
  ctx.fillStyle = '#ff5a5a';
  ctx.font = 'bold 52px system-ui, sans-serif';
  ctx.fillText('THE HIVE HAS FALLEN', W / 2, 190);
  ctx.fillStyle = '#fff3c4';
  ctx.font = '20px system-ui, sans-serif';
  ctx.fillText(`You held until Day ${s.day} — ${s.stats.kills} invaders stung down`, W / 2, 240);
  ctx.fillStyle = '#ffe066';
  ctx.font = 'bold 30px system-ui, sans-serif';
  ctx.fillText(`SCORE  ${s.score}`, W / 2, 292);
  ctx.fillStyle = '#ffd54f';
  ctx.font = '16px system-ui, sans-serif';
  ctx.fillText(`BEST  ${Math.max(s.best, s.score)}`, W / 2, 326);
  if (Math.floor(s.time * 2) % 2 === 0) {
    ctx.fillStyle = '#fff3c4';
    ctx.font = 'bold 20px system-ui, sans-serif';
    ctx.fillText('— PRESS R OR CLICK TO TRY AGAIN —', W / 2, 384);
  }
  ctx.restore();
}

function drawVictory(ctx, s) {
  dim(ctx, 0.5);
  // Gold rays.
  ctx.save();
  ctx.translate(W / 2, 200);
  ctx.fillStyle = 'rgba(255, 179, 0, 0.10)';
  for (let i = 0; i < 12; i++) {
    ctx.rotate(TAU / 12);
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(420, -26);
    ctx.lineTo(420, 26);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
  ctx.save();
  ctx.textAlign = 'center';
  ctx.fillStyle = '#ffe066';
  ctx.font = 'bold 52px system-ui, sans-serif';
  ctx.shadowColor = 'rgba(255, 157, 0, 0.9)';
  ctx.shadowBlur = 28;
  ctx.fillText('THE HIVE ENDURES!', W / 2, 130);
  ctx.shadowBlur = 0;
  // Rank letter.
  const rankColor = { S: '#ffe066', A: '#7ee787', B: '#7dd3fc', C: '#e5e7eb' }[s.rank || 'C'];
  ctx.fillStyle = rankColor;
  ctx.font = 'bold 120px system-ui, sans-serif';
  ctx.fillText(s.rank || 'C', W / 2, 250);
  ctx.fillStyle = '#fff3c4';
  ctx.font = '20px system-ui, sans-serif';
  ctx.fillText('RANK', W / 2, 270);
  ctx.fillStyle = '#ffe066';
  ctx.font = 'bold 30px system-ui, sans-serif';
  ctx.fillText(`FINAL SCORE  ${s.score}`, W / 2, 330);
  ctx.fillStyle = '#ffd54f';
  ctx.font = '17px system-ui, sans-serif';
  ctx.fillText(`7 days survived  •  ${s.stats.kills} invaders stung  •  ${s.stats.pollenGot} pollen gathered  •  Hive HP ${s.hiveHp}/${HIVE_MAX_HP} left`, W / 2, 366);
  ctx.fillStyle = '#fff3c4';
  ctx.font = '15px system-ui, sans-serif';
  ctx.fillText(`Relics earned: ${s.relics.map((r) => RELICS[r].name).join('  •  ') || 'none'}`, W / 2, 396);
  if (Math.floor(s.time * 2) % 2 === 0) {
    ctx.fillStyle = '#ffe066';
    ctx.font = 'bold 20px system-ui, sans-serif';
    ctx.fillText('— PRESS R OR CLICK TO PLAY AGAIN —', W / 2, 448);
  }
  ctx.restore();
}

// ---------------------------------------------------------------- main draw
export function draw(ctx, s) {
  ctx.save();
  if (s.shake > 0.3) {
    ctx.translate((Math.random() - 0.5) * s.shake, (Math.random() - 0.5) * s.shake);
  }
  drawBackground(ctx, s);
  drawHive(ctx, s);
  for (const f of s.flowers) drawFlower(ctx, f, s.time);
  for (const m of s.motes) {
    ctx.fillStyle = '#ffd54f';
    ctx.beginPath();
    ctx.arc(m.x, m.y, 4, 0, TAU);
    ctx.fill();
  }
  for (const e of s.enemies) drawEnemy(ctx, e, s.time);
  if (s.boss) drawBoss(ctx, s.boss, s.time);

  // Sting arc flash.
  const p = s.player;
  if (p.stingAnim > 0) {
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(p.facing);
    ctx.strokeStyle = `rgba(255, 240, 180, ${p.stingAnim / 0.16})`;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(0, 0, 62, -0.9, 0.9);
    ctx.stroke();
    ctx.restore();
  }
  // The player bee is only part of the scene while playing (or frozen behind
  // the upgrade cards); on title / game-over / victory it would poke through
  // the overlay text.
  if (s.screen === 'play' || s.screen === 'pause' || s.screen === 'upgrade') {
    drawBee(ctx, p.x, p.y, p.facing, s.time * 20, p.stingAnim, p.invuln, s.time);
  }

  // Particles.
  for (const pt of s.particles) {
    ctx.globalAlpha = Math.max(0, pt.life / pt.max);
    ctx.fillStyle = pt.color;
    ctx.beginPath();
    ctx.arc(pt.x, pt.y, pt.size, 0, TAU);
    ctx.fill();
  }
  ctx.globalAlpha = 1;

  // Floating score text.
  ctx.textAlign = 'center';
  for (const f of s.floats) {
    ctx.globalAlpha = Math.max(0, f.life / f.max);
    ctx.fillStyle = f.color;
    ctx.font = `bold ${f.size}px system-ui, sans-serif`;
    ctx.fillText(f.text, f.x, f.y);
  }
  ctx.globalAlpha = 1;

  if (s.screen === 'play' || s.screen === 'pause') {
    drawHud(ctx, s);
    drawBanner(ctx, s);
  }
  if (s.flash > 0) {
    ctx.fillStyle = `rgba(255, 60, 60, ${s.flash * 0.35})`;
    ctx.fillRect(0, 0, W, H);
  }
  ctx.restore();

  // Screen overlays (drawn unshaken).
  if (s.screen === 'title') drawTitle(ctx, s);
  else if (s.screen === 'pause') drawPause(ctx, s);
  else if (s.screen === 'upgrade') drawUpgrade(ctx, s);
  else if (s.screen === 'gameover') drawGameOver(ctx, s);
  else if (s.screen === 'victory') drawVictory(ctx, s);
}
