import { Injectable, computed, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { ApiService } from './api.service';
import { DEFAULT_SETTINGS, LearnerProfile, Locale, Settings } from './models';

const TOKEN_KEY = 'arduvia.token';
const CACHE_KEY = 'arduvia.cache';

function storageGet(key: string): string | null {
  try { return localStorage.getItem(key); } catch { return null; }
}
function storageSet(key: string, value: string): void {
  try { localStorage.setItem(key, value); } catch { /* storage unavailable */ }
}

/**
 * Owns the anonymous learner: token, settings and completed lessons.
 * The Symfony API is the source of truth; a local cache keeps the UI usable
 * (and progress safe) if the API is unreachable.
 */
@Injectable({ providedIn: 'root' })
export class LearnerService {
  private readonly api = inject(ApiService);
  private token: string | null = storageGet(TOKEN_KEY);
  private settingsTimer: ReturnType<typeof setTimeout> | null = null;
  private pendingPatch: Partial<Settings> & { locale?: Locale } = {};

  readonly settings = signal<Settings>({ ...DEFAULT_SETTINGS });
  readonly completed = signal<Set<string>>(new Set());
  readonly online = signal(true);
  readonly justCompleted = signal<string | null>(null);
  readonly completedCount = computed(() => this.completed().size);

  constructor() {
    const cached = storageGet(CACHE_KEY);
    if (cached) {
      try {
        const c = JSON.parse(cached) as { settings: Settings; completed: string[] };
        this.settings.set({ ...DEFAULT_SETTINGS, ...c.settings });
        this.completed.set(new Set(c.completed));
      } catch { /* ignore corrupt cache */ }
    }
  }

  /** Loads (or creates) the learner. Returns the stored locale preference, if any. */
  async init(): Promise<Locale | null> {
    try {
      let profile: LearnerProfile | null = null;
      if (this.token) {
        profile = await firstValueFrom(this.api.learner(this.token)).catch((e) => {
          if (e?.status === 404) return null;
          throw e;
        });
      }
      if (!profile) {
        profile = await firstValueFrom(this.api.createLearner());
        // Carry over anything earned while offline.
        for (const slug of this.completed()) {
          await firstValueFrom(this.api.recordProgress(profile.token, slug)).catch(() => null);
        }
        profile.progress.completed = [...new Set([...profile.progress.completed, ...this.completed()])];
      }
      this.token = profile.token;
      storageSet(TOKEN_KEY, profile.token);
      this.settings.set({ ...DEFAULT_SETTINGS, ...profile.settings });
      this.completed.set(new Set(profile.progress.completed));
      this.online.set(true);
      this.persist();
      return profile.locale;
    } catch {
      this.online.set(false);
      return null;
    }
  }

  get currentToken(): string | null { return this.token; }

  isDone(slug: string): boolean {
    return this.completed().has(slug);
  }

  update<K extends keyof Settings>(key: K, value: Settings[K]): void {
    this.settings.update((s) => ({ ...s, [key]: value }));
    this.persist();
    this.queuePatch({ [key]: value } as Partial<Settings>);
  }

  saveLocale(locale: Locale): void {
    this.queuePatch({ locale });
  }

  complete(slug: string): void {
    const already = this.completed().has(slug);
    if (!already) {
      this.completed.update((s) => new Set(s).add(slug));
      this.justCompleted.set(slug);
      setTimeout(() => this.justCompleted.set(null), 900);
      this.persist();
    }
    if (this.token) {
      this.api.recordProgress(this.token, slug).subscribe({
        next: (snap) => { this.online.set(true); this.completed.set(new Set([...snap.completed, ...this.completed()])); this.persist(); },
        error: () => this.online.set(false),
      });
    }
  }

  reset(): void {
    this.completed.set(new Set());
    this.persist();
    if (this.token) {
      this.api.resetProgress(this.token).subscribe({ error: () => this.online.set(false) });
    }
  }

  private queuePatch(patch: Partial<Settings> & { locale?: Locale }): void {
    this.pendingPatch = { ...this.pendingPatch, ...patch };
    if (this.settingsTimer) clearTimeout(this.settingsTimer);
    this.settingsTimer = setTimeout(() => {
      const body = this.pendingPatch;
      this.pendingPatch = {};
      if (!this.token) return;
      this.api.updateSettings(this.token, body).subscribe({
        next: () => this.online.set(true),
        error: () => this.online.set(false),
      });
    }, 400);
  }

  private persist(): void {
    storageSet(CACHE_KEY, JSON.stringify({ settings: this.settings(), completed: [...this.completed()] }));
  }
}
