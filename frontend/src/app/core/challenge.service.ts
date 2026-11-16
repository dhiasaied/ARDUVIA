import { DestroyRef, Injectable, computed, inject, signal } from '@angular/core';
import { GamificationService } from './gamification.service';
import { LessonStore } from './lesson.store';
import { SimService } from './sim/sim.service';

export type ChallengeStatus = 'idle' | 'watching' | 'solved';

/** Per-run memory for checks that need a condition to hold over time. */
interface Memory { [key: string]: number; }

type Check = (sim: SimService, mem: Memory, dt: number, serial: string[]) => boolean;

const sustain = (mem: Memory, key: string, cond: boolean, dt: number, seconds: number): boolean => {
  mem[key] = cond ? (mem[key] ?? 0) + dt : 0;
  return mem[key] >= seconds;
};
const latch = (mem: Memory, key: string, value: boolean): boolean => {
  if (value) mem[key] = 1;
  return mem[key] === 1;
};
const highDurations = (sim: SimService, pin: number): number[] => {
  const out: number[] = [];
  let on: number | null = null;
  for (const e of sim.trace.toggles) {
    if (e.pin !== pin) continue;
    if (e.v >= 0.5 && on === null) on = e.t;
    else if (e.v < 0.5 && on !== null) { out.push(e.t - on); on = null; }
  }
  return out;
};

/**
 * Automatic verification of each lesson's challenge, by observing what the
 * simulated circuit actually does (pins, tones, servo, serial output).
 */
const CHECKS: Record<string, Check> = {
  board: (s) => { const t = s.trace.toggles.filter((e) => e.pin === 13); return t.length >= 4 && t.some((e) => e.v < 0.5); },
  blink: (s) => {
    const d = highDurations(s, 13).slice(-4).map((ms) => ms * s.speed());
    return d.length >= 3 && d.reduce((a, b) => a + b, 0) / d.length <= 230;
  },
  button: (s, m, dt) => {
    const released = latch(m, 'r', sustain(m, 'rt', !s.inputs.buttons[0] && s.pins[13] >= 0.5, dt, 1.2));
    const pressed = latch(m, 'p', sustain(m, 'pt', s.inputs.buttons[0] && s.pins[13] < 0.5, dt, 0.3));
    return released && pressed;
  },
  knob: (_s, _m, _dt, out) => out.some((l) => /\b\d{1,3}\s*%/.test(l)),
  rgb: (s, m, dt) => sustain(m, 'c', s.pins[9] > 0.6 && s.pins[11] > 0.6 && s.pins[10] < 0.15, dt, 0.3),
  light: (s, m, dt) => {
    const lit = latch(m, 'a', sustain(m, 'at', !s.inputs.covered && s.pins[13] >= 0.5, dt, 1));
    const dark = latch(m, 'b', sustain(m, 'bt', s.inputs.covered && s.pins[13] < 0.5, dt, 0.3));
    return lit && dark;
  },
  sensor: (_s, _m, _dt, out) => out.some((l) => /^\D*([2-9]|\d{2,})\D*$/.test(l.trim())),
  sound: (s) => s.trace.tones.has(440),
  piano: (s) => s.trace.tones.has(440),
  motor: (s, m, dt) => sustain(m, 'h', s.pins[3] > 0.45 && s.pins[3] < 0.56, dt, 2),
  heat: (s, m, dt) => sustain(m, 'w', s.inputs.temperature > 25 && s.inputs.temperature < 29.5 && s.pins[13] >= 0.5, dt, 0.3),
  servo: (s, m, dt) => {
    m['t'] = (m['t'] ?? 0) + dt;
    const { servoMin: lo, servoMax: hi } = s.trace;
    return m['t'] > 3 && lo >= 44 && hi <= 136 && hi - lo >= 60;
  },
  stepper: (s) => s.trace.stepperTurns >= 0.99,
  plant: (_s, _m, _dt, out) => out.some((l) => /water/i.test(l)),
  force: (_s, _m, _dt, out) => out.some((l) => /level\s*[:=]?\s*[0-3]\b/i.test(l)),
  project: (_s, _m, _dt, out) => out.some((l) => /\b\d+\s*cm\b/i.test(l)),
};

@Injectable({ providedIn: 'root' })
export class ChallengeService {
  private readonly sim = inject(SimService);
  private readonly store = inject(LessonStore);
  private readonly gamify = inject(GamificationService);
  private memory: Memory = {};
  private runStamp = 0;
  private last = performance.now();
  private readonly localSolved = signal<Set<string>>(new Set());

  readonly slug = computed(() => this.store.current()?.slug ?? '');
  readonly solved = computed(() => {
    const s = this.slug();
    return this.gamify.solved().has(s) || this.localSolved().has(s);
  });
  readonly status = computed<ChallengeStatus>(() => (this.solved() ? 'solved' : this.sim.running() ? 'watching' : 'idle'));
  readonly solvedCount = computed(() => new Set([...this.gamify.solved(), ...this.localSolved()]).size);

  constructor() {
    const id = setInterval(() => this.evaluate(), 200);
    inject(DestroyRef).onDestroy(() => clearInterval(id));
  }

  isSolved(slug: string): boolean {
    return this.gamify.solved().has(slug) || this.localSolved().has(slug);
  }

  private evaluate(): void {
    const now = performance.now();
    const dt = (now - this.last) / 1000;
    this.last = now;
    const slug = this.slug();
    if (this.sim.state() !== 'running' || this.sim.paused() || !slug || this.sim.slug !== slug || this.isSolved(slug)) return;
    if (this.sim.trace.startedAt !== this.runStamp) { this.runStamp = this.sim.trace.startedAt; this.memory = {}; }
    const check = CHECKS[slug];
    if (!check) return;
    const out = this.sim.serial().filter((l) => l.kind === 'out').map((l) => l.text);
    if (check(this.sim, this.memory, dt, out)) {
      this.localSolved.update((set) => new Set(set).add(slug));
      this.gamify.celebrate({ kind: 'challenge', slug });
      this.gamify.record('challenge', slug);
    }
  }
}
