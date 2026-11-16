import { HttpClient } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { LearnerService } from './learner.service';

export type EventType = 'run' | 'error' | 'debug_fix' | 'challenge';

export interface Achievement { id: string; unlocked: boolean; unlockedAt: string | null; }
export interface Dashboard {
  xp: number;
  level: number;
  levelXp: number;
  nextLevelXp: number;
  streak: number;
  bestStreak: number;
  completed: string[];
  challenges: string[];
  runs: number;
  questions: number;
  fixes: number;
  total: number;
  achievements: Achievement[];
  activity: { date: string; count: number }[];
}

export type Celebration =
  | { kind: 'xp'; amount: number }
  | { kind: 'achievement'; id: string }
  | { kind: 'level'; level: number }
  | { kind: 'challenge'; slug: string };

/**
 * Client side of the gamification system: records learning events through the
 * API, keeps the dashboard in sync and turns changes into celebrations.
 */
@Injectable({ providedIn: 'root' })
export class GamificationService {
  private readonly http = inject(HttpClient);
  private readonly learner = inject(LearnerService);
  private queue: Promise<unknown> = Promise.resolve();

  readonly dashboard = signal<Dashboard | null>(null);
  readonly celebrations = signal<(Celebration & { key: number })[]>([]);
  readonly levelProgress = computed(() => {
    const d = this.dashboard();
    if (!d) return 0;
    return Math.min(1, (d.xp - d.levelXp) / Math.max(1, d.nextLevelXp - d.levelXp));
  });
  readonly solved = computed(() => new Set(this.dashboard()?.challenges ?? []));

  async refresh(): Promise<void> {
    const token = this.learner.currentToken;
    if (!token) return;
    try {
      this.apply(await firstValueFrom(this.http.get<Dashboard>(`/api/learners/${token}/dashboard`)), false);
    } catch { /* offline: keep the last known state */ }
  }

  /** Record an event; events are serialised so XP deltas stay accurate. */
  record(type: EventType, lesson: string): void {
    const token = this.learner.currentToken;
    if (!token) return;
    this.queue = this.queue.then(async () => {
      try {
        const d = await firstValueFrom(this.http.post<Dashboard>(`/api/learners/${token}/events`, { type, lesson }));
        this.apply(d, true);
      } catch { /* offline: the event is lost, progress still saved locally */ }
    });
  }

  /** Lesson completion is stored by LearnerService; pull the new totals. */
  afterCompletion(): void {
    this.queue = this.queue.then(async () => {
      await new Promise((r) => setTimeout(r, 400));
      const token = this.learner.currentToken;
      if (!token) return;
      try { this.apply(await firstValueFrom(this.http.get<Dashboard>(`/api/learners/${token}/dashboard`)), true); } catch { /* offline */ }
    });
  }

  celebrate(c: Celebration): void {
    const key = Date.now() + Math.random();
    this.celebrations.update((list) => [...list, { ...c, key }]);
    setTimeout(() => this.dismiss(key), c.kind === 'xp' ? 2200 : 4200);
  }

  dismiss(key: number): void {
    this.celebrations.update((list) => list.filter((x) => x.key !== key));
  }

  private apply(next: Dashboard, announce: boolean): void {
    const prev = this.dashboard();
    this.dashboard.set(next);
    if (!announce || !prev) return;
    const gained = next.xp - prev.xp;
    if (gained > 0) this.celebrate({ kind: 'xp', amount: gained });
    if (next.level > prev.level) this.celebrate({ kind: 'level', level: next.level });
    const before = new Set(prev.achievements.filter((a) => a.unlocked).map((a) => a.id));
    for (const a of next.achievements) if (a.unlocked && !before.has(a.id)) this.celebrate({ kind: 'achievement', id: a.id });
  }
}
