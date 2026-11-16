import { Injectable, computed, inject, signal } from '@angular/core';
import { I18n } from '../i18n';
import { GamificationService } from '../gamification.service';
import { LearnerService } from '../learner.service';
import { DebugControls, Hardware, Interpreter, SketchError, WatchEntry, compile } from './interpreter';

/** What happened during the current run: used to verify lesson challenges. */
export interface RunTrace {
  startedAt: number;
  toggles: { pin: number; v: number; t: number }[];
  tones: Set<number>;
  servoMin: number;
  servoMax: number;
  stepperTurns: number;
}
const freshTrace = (): RunTrace => ({ startedAt: performance.now(), toggles: [], tones: new Set(), servoMin: 999, servoMax: -1, stepperTurns: 0 });

export type RunState = 'idle' | 'uploading' | 'running' | 'error';

/** Physical inputs the learner manipulates in the 3D view. */
export interface Inputs {
  buttons: boolean[];   // push buttons / piano keys (pressed = true)
  pot: number;          // 0..1
  covered: boolean;     // hand over the photoresistor
  motionUntil: number;  // timestamp until which the PIR sees motion
  warming: boolean;     // finger on the TMP36
  temperature: number;  // °C
  moisture: number;     // 0..1
  pressing: boolean;    // finger on the FSR
  force: number;        // 0..1
  distance: number;     // cm to the obstacle
}

export interface SerialLine { text: string; kind: 'out' | 'sys' | 'err'; }

const freshInputs = (): Inputs => ({
  buttons: [false, false, false, false], pot: 0.55, covered: false, motionUntil: 0,
  warming: false, temperature: 22, moisture: 0.62, pressing: false, force: 0, distance: 80,
});

/**
 * The virtual Arduino Uno: pin levels, serial monitor, tone output, servo and
 * stepper positions, plus the environment each lesson's sensors read from.
 */
@Injectable({ providedIn: 'root' })
export class SimService implements Hardware {
  private readonly i18n = inject(I18n);
  private readonly learner = inject(LearnerService);
  private readonly gamify = inject(GamificationService);
  /** Lessons whose last run ended in an error (a later healthy run = a fixed bug). */
  private errored = new Set<string>();
  private watchClock = 0;
  private interp: Interpreter | null = null;
  private runId = 0;
  private audio: AudioContext | null = null;
  private osc: OscillatorNode | null = null;
  private toneTimer: ReturnType<typeof setTimeout> | null = null;
  private lineQueued = 0;
  private lineRaf = 0;
  private pendingText = '';
  private completeTimer: ReturnType<typeof setTimeout> | null = null;

  slug = 'board';
  readonly state = signal<RunState>('idle');
  readonly serial = signal<SerialLine[]>([]);
  readonly activeLine = signal(0);
  readonly errorLine = signal(0);
  /** pin level 0..1 (PWM = duty cycle). Index 0..19 (A0 = 14). */
  pins = new Float32Array(20);
  pinModes = new Int8Array(20).fill(-1);
  readonly pinsVersion = signal(0);
  inputs: Inputs = freshInputs();
  toneHz = 0;
  servoAngle = 90;
  stepperTarget = 0;   // radians
  stepperAngle = 0;
  stepperPhase = 0;
  txrx = 0;            // upload activity 0..1
  trace: RunTrace = freshTrace();
  readonly lastError = signal('');

  // ───────── debugger ─────────
  readonly paused = signal(false);
  readonly breakpoints = signal<Set<number>>(new Set());
  readonly speed = signal(1);
  readonly watch = signal<WatchEntry[]>([]);
  private readonly debug: DebugControls = {
    breakpoints: new Set(),
    speed: 1,
    onPause: () => { this.paused.set(true); this.refreshWatch(); },
  };
  readonly running = computed(() => this.state() === 'running' || this.state() === 'uploading');

  // ───────── lifecycle ─────────
  async run(code: string, slug: string): Promise<void> {
    this.stop(false);
    this.slug = slug;
    const id = ++this.runId;
    const t = this.i18n.t().code;
    this.serial.set([{ text: t.compiling, kind: 'sys' }]);
    this.errorLine.set(0);
    let prog;
    try {
      prog = compile(code);
    } catch (e) {
      this.fail(e);
      return;
    }
    this.lastError.set('');
    this.trace = freshTrace();
    this.gamify.record('run', slug);
    this.state.set('uploading');
    this.resetBoard();
    this.log(t.uploadingTo, 'sys');
    const t0 = performance.now();
    while (performance.now() - t0 < 1100) {
      if (id !== this.runId) return;
      this.txrx = (Math.sin((performance.now() - t0) / 40) + 1) / 2;
      await new Promise((r) => setTimeout(r, 30));
    }
    this.txrx = 0;
    if (id !== this.runId) return;
    this.log(t.done, 'sys');
    this.state.set('running');
    this.ensureAudio();
    this.completeTimer = setTimeout(() => {
      if (id !== this.runId || this.state() !== 'running') return;
      const first = !this.learner.isDone(slug);
      this.learner.complete(slug);
      if (first) this.gamify.afterCompletion();
      if (this.errored.delete(slug)) this.gamify.record('debug_fix', slug);
    }, 2500);
    this.paused.set(false);
    this.debug.breakpoints = this.breakpoints();
    this.debug.speed = this.speed();
    this.interp = new Interpreter(prog, this, this.debug);
    try {
      await this.interp.run();
    } catch (e) {
      if (id !== this.runId || Interpreter.isAbort(e)) return;
      this.fail(e);
    }
  }

  stop(announce = true): void {
    this.runId++;
    this.interp?.stop();
    this.interp = null;
    this.paused.set(false);
    if (this.completeTimer) clearTimeout(this.completeTimer);
    this.noTone(8);
    this.txrx = 0;
    this.activeLine.set(0);
    if (this.state() !== 'error' || announce) this.state.set('idle');
    this.resetBoard();
    if (announce) this.flushText();
  }

  /** Lesson switch: everything back to rest. */
  reset(slug: string): void {
    this.stop(false);
    this.slug = slug;
    this.serial.set([]);
    this.errorLine.set(0);
    this.inputs = freshInputs();
    this.servoAngle = 90;
    this.stepperAngle = this.stepperTarget = 0;
  }

  private resetBoard(): void {
    this.pins.fill(0);
    this.pinModes.fill(-1);
    this.pinsVersion.update((v) => v + 1);
  }

  private fail(e: unknown): void {
    const t = this.i18n.t().code;
    const line = e instanceof SketchError ? e.line : 0;
    const msg = e instanceof Error ? e.message : String(e);
    this.flushText();
    this.log(`${t.error}${line ? ` (${t.line} ${line})` : ''}: ${msg}`, 'err');
    this.errorLine.set(line);
    this.lastError.set(msg);
    this.activeLine.set(0);
    this.errored.add(this.slug);
    this.gamify.record('error', this.slug);
    this.paused.set(false);
    this.interp?.stop();
    this.interp = null;
    this.state.set('error');
    this.noTone(8);
  }

  /** Environment physics, called every frame by the 3D engine (dt in seconds). */
  tick(dt: number): void {
    const i = this.inputs;
    this.watchClock += dt;
    if (this.watchClock > 0.3 && this.state() === 'running' && !this.paused()) { this.watchClock = 0; this.refreshWatch(); }
    const target = i.warming ? 37 : 22;
    i.temperature += (target - i.temperature) * Math.min(1, dt * (i.warming ? 0.35 : 0.2));
    i.force += ((i.pressing ? 1 : 0) - i.force) * Math.min(1, dt * (i.pressing ? 0.9 : 3));
    if (this.state() === 'running' && this.slug === 'plant') i.moisture = Math.max(0.12, i.moisture - dt * 0.03);
    // Stepper eases toward its target so the wheel visibly turns.
    const d = this.stepperTarget - this.stepperAngle;
    if (Math.abs(d) > 1e-4) {
      const stepSize = Math.sign(d) * Math.min(Math.abs(d), dt * this.stepperSpeed);
      this.stepperAngle += stepSize;
      this.stepperPhase += Math.abs(stepSize) * 40;
    }
  }
  private stepperSpeed = 1;

  // ───────── Hardware interface (called by the interpreter) ─────────
  line(line: number): void {
    this.lineQueued = line;
    if (!this.lineRaf) {
      this.lineRaf = requestAnimationFrame(() => {
        this.lineRaf = 0;
        if (this.state() === 'running') this.activeLine.set(this.lineQueued);
      });
    }
  }

  pinMode(pin: number, mode: number): void {
    if (pin < 0 || pin > 19) return;
    this.pinModes[pin] = mode;
  }

  digitalWrite(pin: number, value: number): void {
    if (pin < 0 || pin > 19) return;
    if (this.pins[pin] !== value) {
      this.pins[pin] = value;
      this.recordToggle(pin, value);
      this.pinsVersion.update((v) => v + 1);
      if (this.slug === 'blink' || this.slug === 'board') this.log(`D${pin} → ${value ? 'HIGH' : 'LOW'}`, 'out', true);
    }
  }

  analogWrite(pin: number, value: number): void {
    if (pin < 0 || pin > 19) return;
    const v = value / 255;
    if (this.pins[pin] !== v) {
      this.pins[pin] = v;
      this.recordToggle(pin, v);
      this.pinsVersion.update((x) => x + 1);
    }
  }

  digitalRead(pin: number): number {
    const i = this.inputs;
    const pullup = this.pinModes[pin] === 2;
    switch (this.slug) {
      case 'button': if (pin === 2) return i.buttons[0] ? 0 : pullup ? 1 : 1; break;
      case 'piano': if (pin >= 2 && pin <= 5) return i.buttons[pin - 2] ? 0 : 1; break;
      case 'sensor': if (pin === 2) return performance.now() < i.motionUntil ? 1 : 0; break;
    }
    return this.pins[pin] >= 0.5 ? 1 : pullup ? 1 : 0;
  }

  analogRead(pin: number): number {
    const i = this.inputs;
    const noise = () => Math.round((Math.random() - 0.5) * 6);
    if (pin !== 14) return 0;
    switch (this.slug) {
      case 'knob': return clamp(Math.round(i.pot * 1023));
      case 'light': return clamp((i.covered ? 120 : 720) + noise());
      case 'heat': return clamp(Math.round(((0.5 + i.temperature / 100) * 1023) / 5) + Math.round(Math.random() * 2));
      case 'plant': return clamp(Math.round(i.moisture * 1023) + noise());
      case 'force': return clamp(Math.round(i.force * 1023));
    }
    return clamp(512 + noise());
  }

  print(text: string, newline: boolean): void {
    this.pendingText += text;
    if (newline) this.flushText();
  }

  tone(pin: number, freq: number, duration?: number): void {
    this.toneHz = freq;
    this.trace.tones.add(Math.round(freq));
    this.pins[pin] = 0.5;
    this.pinsVersion.update((v) => v + 1);
    this.playTone(freq);
    if (this.toneTimer) clearTimeout(this.toneTimer);
    if (duration) this.toneTimer = setTimeout(() => this.noTone(pin), duration);
  }

  noTone(pin: number): void {
    this.toneHz = 0;
    if (pin >= 0 && pin < 20) this.pins[pin] = 0;
    this.pinsVersion.update((v) => v + 1);
    if (this.toneTimer) clearTimeout(this.toneTimer);
    this.toneTimer = null;
    if (this.osc) {
      try { this.osc.stop(); } catch { /* already stopped */ }
      this.osc.disconnect();
      this.osc = null;
    }
  }

  pulseIn(pin: number): number {
    if (this.slug === 'project' && pin === 10) return Math.round(this.inputs.distance * 58);
    return 0;
  }

  servoWrite(_pin: number, angle: number): void {
    this.trace.servoMin = Math.min(this.trace.servoMin, angle);
    this.trace.servoMax = Math.max(this.trace.servoMax, angle);
    this.servoAngle = angle;
  }

  stepperStep(steps: number, stepsPerRev: number, rpm: number): number {
    const turns = steps / stepsPerRev;
    this.trace.stepperTurns = Math.max(this.trace.stepperTurns, Math.abs(turns));
    const ms = Math.abs(turns) * (60000 / rpm);
    this.stepperTarget += turns * Math.PI * 2;
    this.stepperSpeed = (Math.PI * 2 * rpm) / 60;
    return ms;
  }

  // ───────── debugger API ─────────
  pause(): void { this.interp?.pause(); }
  resume(): void { this.paused.set(false); this.interp?.resume(); }
  step(): void { this.paused.set(false); this.interp?.step(); }
  toggleBreakpoint(line: number): void {
    const next = new Set(this.breakpoints());
    if (next.has(line)) next.delete(line); else next.add(line);
    this.breakpoints.set(next);
    this.debug.breakpoints = next;
  }
  clearBreakpoints(): void { this.breakpoints.set(new Set()); this.debug.breakpoints = new Set(); }
  setSpeed(v: number): void { this.speed.set(v); this.debug.speed = v; }
  private refreshWatch(): void { if (this.interp) this.watch.set(this.interp.globals()); }

  private recordToggle(pin: number, v: number): void {
    const t = this.trace.toggles;
    t.push({ pin, v, t: performance.now() });
    if (t.length > 400) t.splice(0, t.length - 300);
  }

  // ───────── serial helpers ─────────
  private flushText(): void {
    if (!this.pendingText) return;
    this.log(this.pendingText, 'out');
    this.pendingText = '';
  }

  private log(text: string, kind: SerialLine['kind'], _event = false): void {
    this.serial.update((lines) => {
      const next = lines.length > 200 ? lines.slice(-150) : lines.slice();
      next.push({ text, kind });
      return next;
    });
  }

  // ───────── audio ─────────
  private ensureAudio(): void {
    if (this.audio || typeof AudioContext === 'undefined') return;
    try { this.audio = new AudioContext(); } catch { this.audio = null; }
  }

  private playTone(freq: number): void {
    if (!this.learner.settings().sound) return;
    this.ensureAudio();
    const ctx = this.audio;
    if (!ctx) return;
    if (ctx.state === 'suspended') void ctx.resume();
    if (this.osc) {
      this.osc.frequency.setValueAtTime(freq, ctx.currentTime);
      return;
    }
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'square';
    osc.frequency.value = freq;
    gain.gain.value = 0.035;
    osc.connect(gain).connect(ctx.destination);
    osc.start();
    this.osc = osc;
  }
}

function clamp(v: number): number {
  return Math.max(0, Math.min(1023, v));
}
