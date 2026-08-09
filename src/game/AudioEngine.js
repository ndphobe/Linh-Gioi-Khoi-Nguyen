export class AudioEngine {
  constructor() {
    this.context = null;
    this.master = null;
    this.enabled = true;
    this.ambience = [];
  }

  async init() {
    if (!this.context) {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (!AudioContext) return;
      this.context = new AudioContext();
      this.master = this.context.createGain();
      this.master.gain.value = 0.24;
      this.master.connect(this.context.destination);
      this.startAmbience();
    }
    if (this.context.state === 'suspended') await this.context.resume();
  }

  setVolume(value) {
    if (!this.master) return;
    this.master.gain.setTargetAtTime(Math.max(0, Math.min(1, value)) * 0.32, this.context.currentTime, 0.03);
  }

  tone({ frequency = 440, endFrequency = frequency, duration = 0.12, type = 'sine', gain = 0.2, delay = 0 }) {
    if (!this.context || !this.enabled) return;
    const now = this.context.currentTime + delay;
    const oscillator = this.context.createOscillator();
    const envelope = this.context.createGain();
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, now);
    oscillator.frequency.exponentialRampToValueAtTime(Math.max(20, endFrequency), now + duration);
    envelope.gain.setValueAtTime(0.0001, now);
    envelope.gain.exponentialRampToValueAtTime(Math.max(0.0002, gain), now + Math.min(0.025, duration * 0.2));
    envelope.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    oscillator.connect(envelope);
    envelope.connect(this.master);
    oscillator.start(now);
    oscillator.stop(now + duration + 0.02);
  }

  noise(duration = 0.2, gain = 0.1, filterFrequency = 900) {
    if (!this.context || !this.enabled) return;
    const length = Math.floor(this.context.sampleRate * duration);
    const buffer = this.context.createBuffer(1, length, this.context.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i += 1) data[i] = Math.random() * 2 - 1;
    const source = this.context.createBufferSource();
    source.buffer = buffer;
    const filter = this.context.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = filterFrequency;
    const envelope = this.context.createGain();
    const now = this.context.currentTime;
    envelope.gain.setValueAtTime(gain, now);
    envelope.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    source.connect(filter);
    filter.connect(envelope);
    envelope.connect(this.master);
    source.start();
  }

  play(name) {
    switch (name) {
      case 'ui':
        this.tone({ frequency: 520, endFrequency: 680, duration: 0.055, type: 'triangle', gain: 0.035 });
        break;
      case 'coin':
        this.tone({ frequency: 880, endFrequency: 1320, duration: 0.1, type: 'square', gain: 0.045 });
        this.tone({ frequency: 1320, endFrequency: 1760, duration: 0.12, type: 'triangle', gain: 0.035, delay: 0.07 });
        break;
      case 'coin-drop':
        this.tone({ frequency: 620, endFrequency: 360, duration: 0.09, type: 'triangle', gain: 0.035 });
        this.tone({ frequency: 940, endFrequency: 710, duration: 0.08, type: 'square', gain: 0.025, delay: 0.06 });
        break;
      case 'cooldown-ready':
        this.tone({ frequency: 740, endFrequency: 1040, duration: 0.16, type: 'sine', gain: 0.035 });
        this.tone({ frequency: 1110, endFrequency: 1480, duration: 0.2, type: 'triangle', gain: 0.025, delay: 0.07 });
        break;
      case 'sect-sword':
        this.noise(.08,.055,3200);this.tone({frequency:920,endFrequency:1540,duration:.16,type:'triangle',gain:.055});
        break;
      case 'sect-demon':
        this.noise(.28,.13,520);this.tone({frequency:105,endFrequency:42,duration:.34,type:'sawtooth',gain:.095});
        break;
      case 'sect-poison':
        this.noise(.22,.06,1450);this.tone({frequency:360,endFrequency:170,duration:.3,type:'sine',gain:.055});
        break;
      case 'slash':
        this.noise(0.12, 0.12, 1800);
        this.tone({ frequency: 420, endFrequency: 105, duration: 0.16, type: 'sawtooth', gain: 0.08 });
        break;
      case 'hit':
        this.noise(0.09, 0.16, 540);
        this.tone({ frequency: 105, endFrequency: 55, duration: 0.11, type: 'square', gain: 0.08 });
        break;
      case 'monster-claw':
        this.noise(.16,.15,1900);this.tone({frequency:310,endFrequency:70,duration:.2,type:'sawtooth',gain:.09});
        break;
      case 'monster-magic':
        this.noise(.22,.11,720);this.tone({frequency:190,endFrequency:52,duration:.3,type:'square',gain:.08});
        break;
      case 'monster-impact':
        this.noise(.32,.2,430);this.tone({frequency:92,endFrequency:32,duration:.34,type:'sawtooth',gain:.13});
        break;
      case 'block':
        this.noise(0.08, 0.09, 3400);
        this.tone({ frequency: 980, endFrequency: 520, duration: 0.14, type: 'square', gain: 0.075 });
        this.tone({ frequency: 1480, endFrequency: 760, duration: 0.09, type: 'triangle', gain: 0.045 });
        break;
      case 'dash':
        this.noise(0.18, 0.08, 2500);
        this.tone({ frequency: 170, endFrequency: 620, duration: 0.15, type: 'sine', gain: 0.07 });
        break;
      case 'skill':
        this.tone({ frequency: 260, endFrequency: 920, duration: 0.26, type: 'sine', gain: 0.12 });
        this.tone({ frequency: 390, endFrequency: 1250, duration: 0.34, type: 'triangle', gain: 0.06, delay: 0.03 });
        break;
      case 'heal':
        [0, 0.07, 0.14].forEach((delay, i) => this.tone({ frequency: 420 * (1 + i * 0.25), endFrequency: 620 * (1 + i * 0.2), duration: 0.34, type: 'sine', gain: 0.06, delay }));
        break;
      case 'thunder':
        this.noise(0.8, 0.24, 420);
        this.tone({ frequency: 82, endFrequency: 28, duration: 0.86, type: 'sawtooth', gain: 0.15 });
        break;
      case 'success':
        [0, 0.12, 0.25, 0.38].forEach((delay, i) => this.tone({ frequency: [330, 440, 660, 880][i], endFrequency: [390, 520, 790, 1050][i], duration: 0.58, type: 'sine', gain: 0.085, delay }));
        break;
      case 'error':
        this.tone({ frequency: 180, endFrequency: 120, duration: 0.18, type: 'square', gain: 0.05 });
        break;
      default:
        break;
    }
  }

  startAmbience() {
    if (!this.context || this.ambience.length) return;
    const frequencies = [55, 82.4, 110];
    frequencies.forEach((frequency, index) => {
      const oscillator = this.context.createOscillator();
      const gain = this.context.createGain();
      const filter = this.context.createBiquadFilter();
      oscillator.type = index === 0 ? 'sine' : 'triangle';
      oscillator.frequency.value = frequency;
      filter.type = 'lowpass';
      filter.frequency.value = 280 + index * 120;
      gain.gain.value = 0.012 / (index + 1);
      oscillator.connect(filter);
      filter.connect(gain);
      gain.connect(this.master);
      oscillator.start();
      this.ambience.push({ oscillator, gain });
    });
  }
}
