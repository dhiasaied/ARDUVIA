import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { I18n } from '../core/i18n';
import { LearnerService } from '../core/learner.service';
import { GamificationService } from '../core/gamification.service';
import { LessonStore } from '../core/lesson.store';
import { UiState } from '../core/ui-state';
import { Icon } from './icon';

/** The ARDUVIA mark (a chip carrying an "A"), used by the brand and the loader. */
@Component({
  selector: 'app-logo',
  template: `<svg class="brand-logo" viewBox="0 0 91 50" aria-hidden="true">
    <path class="pins" d="M27 15h-7M27 25h-7M27 35h-7M64 15h7M64 25h7M64 35h7"/>
    <rect class="chip" x="27" y="5" width="37" height="40" rx="9"/>
    <path class="mark" d="M37.5 36 45.5 14l8 22M40.5 28.5h10"/>
    <circle class="node" cx="45.5" cy="14" r="2.6"/></svg>`,
  styles: `:host { display: contents; }`,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Logo {}

@Component({
  selector: 'app-brand',
  imports: [Logo],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <header class="brand">
      <app-logo />
      <span class="brand-rule"></span>
      <div class="brand-text">
        <h1>{{ t().appTitle }}</h1>
        <p>@for (w of t().tagline; track w; let last = $last) {{{ w }}@if (!last) {<i>·</i>}}</p>
      </div>
    </header>
  `,
})
export class Brand {
  protected readonly t = inject(I18n).t;
}

@Component({
  selector: 'app-status',
  imports: [Icon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="status" [attr.aria-label]="t().progressAria">
      <button type="button" class="progress-card" (click)="openDashboard()" [title]="t().dash.open" [attr.aria-label]="t().dash.open">
        <app-icon class="progress-icon" name="book" />
        <div class="progress-body">
          <span class="progress-label">{{ t().progressLabel }}</span>
          <div class="progress-row">
            <span class="progress-track" role="progressbar" [attr.aria-valuenow]="done()" aria-valuemin="0" [attr.aria-valuemax]="total()">
              <span class="progress-fill" [style.width.%]="pct()"></span>
            </span>
            <span class="progress-count">{{ done() }}/{{ total() }}</span>
          </div>
        </div>
        @if (gamify.dashboard(); as d) {
          <span class="level-chip" [style.--p]="gamify.levelProgress()"><b>{{ d.level }}</b><small>{{ d.xp }} XP</small></span>
        }
      </button>
      <time class="clock" [attr.datetime]="iso()"><span>{{ date() }}</span><span>{{ time() }}</span></time>
      @if (!learner.online()) { <span class="offline-dot" [title]="t().offline"></span> }
    </section>
    <svg class="pixels" viewBox="0 0 60 60" aria-hidden="true">
      <rect x="36" y="0" width="10" height="10"/><rect x="48" y="0" width="10" height="10"/><rect x="48" y="12" width="10" height="10"/>
      <rect x="24" y="12" width="10" height="10" opacity=".5"/><rect x="36" y="24" width="10" height="10" opacity=".6"/><rect x="48" y="36" width="10" height="10" opacity=".35"/>
    </svg>
  `,
})
export class Status {
  protected readonly learner = inject(LearnerService);
  protected readonly gamify = inject(GamificationService);
  private readonly ui = inject(UiState);
  protected openDashboard(): void { this.ui.assistantOpen.set(false); this.ui.dashboardOpen.set(true); }
  private readonly store = inject(LessonStore);
  private readonly i18n = inject(I18n);
  protected readonly t = this.i18n.t;
  private readonly now = signal(new Date());

  protected readonly total = computed(() => this.store.lessons().length || 16);
  protected readonly done = computed(() => Math.min(this.learner.completedCount(), this.total()));
  protected readonly pct = computed(() => (this.done() / this.total()) * 100 || 0);
  protected readonly date = computed(() => {
    const d = this.now();
    const loc = this.i18n.locale();
    const raw = d.toLocaleString(loc === 'ar' ? 'ar-u-nu-latn' : loc, { month: 'short' }).replace('.', '');
    const m = loc === 'ar' ? raw : raw.slice(0, 3).toUpperCase();
    return `${String(d.getDate()).padStart(2, '0')} ${m} ${d.getFullYear()}`;
  });
  protected readonly time = computed(() => this.now().toTimeString().slice(0, 8));
  protected readonly iso = computed(() => this.now().toISOString());

  constructor() {
    const id = setInterval(() => this.now.set(new Date()), 1000);
    inject(DestroyRef).onDestroy(() => clearInterval(id));
  }
}
