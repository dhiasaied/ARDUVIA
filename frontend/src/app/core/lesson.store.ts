import { Injectable, computed, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { ApiService } from './api.service';
import { LessonDetail, LessonSummary, Locale } from './models';

/** Lesson catalogue + per-locale detail cache. */
@Injectable({ providedIn: 'root' })
export class LessonStore {
  private readonly api = inject(ApiService);
  private readonly cache = new Map<string, LessonDetail>();
  /** Latest request ids: a slow, older response must never overwrite a newer one. */
  private catalogueSeq = 0;
  private openSeq = 0;

  readonly lessons = signal<LessonSummary[]>([]);
  readonly current = signal<LessonDetail | null>(null);
  readonly error = signal<string | null>(null);
  readonly index = computed(() => {
    const c = this.current();
    return c ? this.lessons().findIndex((l) => l.slug === c.slug) : -1;
  });

  async loadCatalogue(locale: Locale): Promise<LessonSummary[]> {
    const seq = ++this.catalogueSeq;
    try {
      const list = await firstValueFrom(this.api.lessons(locale));
      if (seq !== this.catalogueSeq) return list;
      this.lessons.set(list);
      this.error.set(null);
      return list;
    } catch {
      this.error.set('api');
      return [];
    }
  }

  async open(slug: string, locale: Locale): Promise<LessonDetail | null> {
    const seq = ++this.openSeq;
    const key = `${locale}:${slug}`;
    let detail = this.cache.get(key) ?? null;
    if (!detail) {
      try {
        detail = await firstValueFrom(this.api.lesson(slug, locale));
        this.cache.set(key, detail);
      } catch {
        return null;
      }
    }
    if (seq === this.openSeq) this.current.set(detail);
    return detail;
  }

  /** Warm the cache for the previous and next lessons only (keeps the API unloaded). */
  prefetchAround(slug: string, locale: Locale): void {
    const list = this.lessons();
    const i = list.findIndex((l) => l.slug === slug);
    for (const l of [list[i - 1], list[i + 1]].filter(Boolean)) {
      const key = `${locale}:${l.slug}`;
      if (!this.cache.has(key)) {
        this.api.lesson(l.slug, locale).subscribe({ next: (d) => this.cache.set(key, d), error: () => {} });
      }
    }
  }
}
