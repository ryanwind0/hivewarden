// Keyboard, mouse and touch input. Movement is a held vector; stings, pauses
// and mutes are one-shot presses queued as flags the loop consumes once.
// The pointer gives a world position (in logical 960x540 space) the bee can
// steer toward, and a held mouse button is a held sting.
export const ACTION_STING = 1;
export const ACTION_PAUSE = 2;
export const ACTION_MUTE = 4;
export const ACTION_START = 8;
export const ACTION_RESTART = 16;

export class Input {
  constructor(canvas, toWorld) {
    this.toWorld = toWorld; // (clientX, clientY) -> {x, y} in logical space
    this.keys = new Set();
    this.pressed = 0;
    this.pointer = { x: 0, y: 0, active: false, down: false };
    this.touchMode = false;
    this._touchId = null;
    this._touchStart = null;

    window.addEventListener('keydown', (e) => {
      if (e.repeat) return;
      this.keys.add(e.code);
      if (e.code === 'Space') { this.pressed |= ACTION_STING | ACTION_START; e.preventDefault(); }
      if (e.code === 'Enter') this.pressed |= ACTION_START;
      if (e.code === 'KeyP' || e.code === 'Escape') this.pressed |= ACTION_PAUSE;
      if (e.code === 'KeyM') this.pressed |= ACTION_MUTE;
      if (e.code === 'KeyR') this.pressed |= ACTION_RESTART;
      if (e.code === 'Digit1' || e.code === 'Digit2' || e.code === 'Digit3') {
        this.pressed |= 32 << (Number(e.code.slice(-1)) - 1); // ACTION_PICK1..3
      }
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) e.preventDefault();
    });
    window.addEventListener('keyup', (e) => this.keys.delete(e.code));
    window.addEventListener('blur', () => this.keys.clear());

    canvas.addEventListener('pointerdown', (e) => {
      this.pointer.active = true;
      this.pointer.down = true;
      const p = this.toWorld(e.clientX, e.clientY);
      this.pointer.x = p.x;
      this.pointer.y = p.y;
      this.pressed |= ACTION_STING;
      this._touchId = e.pointerId;
      this._touchStart = { x: p.x, y: p.y, t: performance.now() };
    });
    canvas.addEventListener('pointermove', (e) => {
      const p = this.toWorld(e.clientX, e.clientY);
      this.pointer.x = p.x;
      this.pointer.y = p.y;
      if (e.pointerType === 'touch') this.touchMode = true;
    });
    const up = (e) => {
      if (e.pointerId === this._touchId) {
        this.pointer.down = false;
        this._touchId = null;
      }
    };
    canvas.addEventListener('pointerup', up);
    canvas.addEventListener('pointercancel', up);
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  takePressed() {
    const p = this.pressed;
    this.pressed = 0;
    return p;
  }

  // Held movement vector from WASD/arrows, normalised; {x, y} or null.
  moveVector() {
    let x = 0;
    let y = 0;
    if (this.keys.has('ArrowLeft') || this.keys.has('KeyA')) x -= 1;
    if (this.keys.has('ArrowRight') || this.keys.has('KeyD')) x += 1;
    if (this.keys.has('ArrowUp') || this.keys.has('KeyW')) y -= 1;
    if (this.keys.has('ArrowDown') || this.keys.has('KeyS')) y += 1;
    if (x === 0 && y === 0) return null;
    const len = Math.hypot(x, y);
    return { x: x / len, y: y / len };
  }

  get stingHeld() {
    return this.keys.has('Space') || this.pointer.down;
  }

  get pickIndex() {
    // Consumed via takePressed bits 32/64/128; see ACTION_PICK*.
    return -1;
  }
}

export const ACTION_PICK1 = 32;
export const ACTION_PICK2 = 64;
export const ACTION_PICK3 = 128;
