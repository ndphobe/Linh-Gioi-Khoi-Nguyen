export const PLAYER_ANIMATION_CLIPS = Object.freeze({
  idle: Object.freeze({ frames: [0], fps: 4, loop: true }),
  walk: Object.freeze({ frames: [0, 1, 0, 1], fps: 8, loop: true }),
  run: Object.freeze({ frames: [1, 0, 1, 0], fps: 12, loop: true }),
  attack: Object.freeze({ frames: [0, 2, 2, 0], fps: 14, loop: false, markerFrame: 1 }),
  cast: Object.freeze({ frames: [0, 3, 3, 0], fps: 10, loop: false, markerFrame: 2 }),
  block: Object.freeze({ frames: [3], fps: 6, loop: true }),
  hurt: Object.freeze({ frames: [3, 0], fps: 16, loop: false }),
  death: Object.freeze({ frames: [3, 3, 0], fps: 4, loop: false }),
});

export const MONSTER_ANIMATION_CLIPS = Object.freeze({
  idle: Object.freeze({ start: 0, count: 4, fps: 5, loop: true }),
  walk: Object.freeze({ start: 4, count: 6, fps: 9, loop: true }),
  // Atlas frames 11-15 are transition/fade fragments. Reusing the last full
  // movement poses keeps the monster visible throughout its wind-up and hit.
  attack: Object.freeze({ frames: [7, 8, 9, 10, 9], fps: 12, loop: false, markerFrame: 2 }),
  hurt: Object.freeze({ frames: [2, 3, 2], fps: 14, loop: false }),
  death: Object.freeze({ start: 16, count: 6, fps: 9, loop: false }),
});

const framesFor = clip => clip.frames ?? Array.from({ length: clip.count }, (_, index) => clip.start + index);

export class AnimationController {
  constructor(clips = PLAYER_ANIMATION_CLIPS, initialState = 'idle') {
    this.clips = clips;
    this.state = clips[initialState] ? initialState : Object.keys(clips)[0];
    this.frameCursor = 0;
    this.frameTime = 0;
    this.markerFired = false;
    this.finished = false;
    this.callbacks = null;
  }

  get clip() { return this.clips[this.state]; }
  get frame() { return framesFor(this.clip)[this.frameCursor] ?? 0; }
  get normalizedTime() { return framesFor(this.clip).length > 1 ? this.frameCursor / (framesFor(this.clip).length - 1) : 0; }

  play(state, callbacks = {}, force = false) {
    if (!this.clips[state]) return false;
    if (!force && this.state === state && !this.finished) return false;
    this.state = state;
    this.frameCursor = 0;
    this.frameTime = 0;
    this.markerFired = false;
    this.finished = false;
    this.callbacks = callbacks;
    if (this.clip.markerFrame === 0) this.fireMarker();
    return true;
  }

  resolve({ action, speed = 0, running = false, dead = false, hurt = false, blocking = false } = {}) {
    if (dead) return this.play('death');
    if (hurt) return this.play('hurt');
    if (blocking && this.clips.block) return this.play('block');
    if (action === 'slash') return this.play('attack');
    if (action === 'cast') return this.play('cast');
    if (!this.clip.loop && !this.finished) return false;
    return this.play(speed > 0.3 ? (running && this.clips.run ? 'run' : 'walk') : 'idle');
  }

  fireMarker() {
    if (this.markerFired) return;
    this.markerFired = true;
    this.callbacks?.onMarker?.({ state: this.state, frame: this.frame });
  }

  update(deltaSeconds) {
    const dt = Math.max(0, Math.min(0.1, Number(deltaSeconds) || 0));
    if (dt <= 0 || this.finished) return this.frame;
    const frames = framesFor(this.clip);
    const frameDuration = 1 / Math.max(1, this.clip.fps);
    this.frameTime += dt;
    while (this.frameTime + Number.EPSILON >= frameDuration && !this.finished) {
      this.frameTime -= frameDuration;
      const next = this.frameCursor + 1;
      if (next >= frames.length) {
        if (this.clip.loop) this.frameCursor = 0;
        else {
          this.frameCursor = frames.length - 1;
          this.finished = true;
          this.callbacks?.onComplete?.({ state: this.state });
        }
      } else this.frameCursor = next;
      if (this.frameCursor === this.clip.markerFrame) this.fireMarker();
    }
    return this.frame;
  }
}
