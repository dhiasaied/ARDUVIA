import { AfterViewChecked, ChangeDetectionStrategy, Component, ElementRef, computed, inject, output, viewChild } from '@angular/core';
import { ChallengeService } from '../core/challenge.service';
import { GamificationService } from '../core/gamification.service';
import { I18n } from '../core/i18n';
import { LearnerService } from '../core/learner.service';
import { LessonStore } from '../core/lesson.store';
import { UiState } from '../core/ui-state';
import { Icon } from './icon';
import { animateIn, countUp, stagger } from './motion';

const ACH_ICONS: Record<string, string> = {
  first_run: 'bolt', first_lesson: 'book', five_lessons: 'flame', all_lessons: 'trophy', first_challenge: 'target',
  challenger: 'trophy', debugger: 'alert', curious: 'sparkle', streak_3: 'flame', sensor_pro: 'eye',
};

/** Learning analytics: level, XP, streak, achievements, activity and lesson map. */
@Component({
  selector: 'app-dashboard',
  imports: [Icon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (ui.dashboardOpen()) {
      <div class="dash-scrim" (click)="close()"></div>
      <section class="dashboard glass" #root role="dialog" aria-modal="true" [attr.aria-label]="t().dash.title" (keydown.escape)="close()" tabindex="-1">
        <header class="dash-head">
          <div>
            <h2>{{ t().dash.title }}</h2>
            <p>{{ t().dash.subtitle }}</p>
          </div>
          <button type="button" class="icon-btn" (click)="close()" [attr.aria-label]="t().dash.close"><app-icon name="close" /></button>
        </header>

        @if (d(); as d) {
          <div class="dash-grid">
            <article class="dash-level dash-card">
              <svg viewBox="0 0 120 120" class="ring" aria-hidden="true">
                <defs><linearGradient id="ringGrad" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#a8b9a1"/><stop offset="1" stop-color="#52796f"/></linearGradient></defs>
                <circle cx="60" cy="60" r="50" class="ring-track"/>
                <circle cx="60" cy="60" r="50" class="ring-fill" [style.stroke-dashoffset]="314 - 314 * progress()"/>
              </svg>
              <div class="ring-label"><small>{{ t().dash.level }}</small><b #levelNum>{{ d.level }}</b></div>
              <div class="level-text">
                <h3>{{ levelTitle() }}</h3>
                <p><b #xpNum>{{ d.xp }}</b> {{ t().dash.xp }}</p>
                <small>{{ d.nextLevelXp - d.xp }} {{ t().dash.toNext }}</small>
              </div>
            </article>

            <article class="dash-card dash-streak">
              <app-icon name="flame" />
              <div><b>{{ d.streak }}</b><span>{{ t().dash.streak }}</span><small>{{ t().dash.best }}: {{ d.bestStreak }}</small></div>
            </article>

            <div class="dash-stats">
              @for (s of stats(); track s.label) {
                <article class="dash-card stat"><app-icon [name]="s.icon" /><b>{{ s.value }}</b><span>{{ s.label }}</span></article>
              }
            </div>

            <article class="dash-card dash-activity">
              <h3>{{ t().dash.activity }}</h3>
              <div class="bars" role="img" [attr.aria-label]="t().dash.activity">
                @for (a of d.activity; track a.date) {
                  <span class="bar" [style.--h]="a.count / maxActivity()" [title]="a.date + ' · ' + a.count"><i></i></span>
                }
              </div>
            </article>

            <article class="dash-card dash-map">
              <h3>{{ t().dash.map }}</h3>
              <ol>
                @for (l of store.lessons(); track l.slug) {
                  <li [class.is-done]="learner.isDone(l.slug)" [class.is-challenge]="challenges.isSolved(l.slug)" [title]="l.position + '. ' + l.title">
                    <button type="button" (click)="open(l.slug)">{{ l.position }}</button>
                  </li>
                }
              </ol>
            </article>

            <article class="dash-card dash-achievements">
              <h3>{{ t().dash.achievements }} <small>{{ unlocked() }}/{{ d.achievements.length }}</small></h3>
              <ul>
                @for (a of d.achievements; track a.id) {
                  <li class="ach" [class.is-unlocked]="a.unlocked" [title]="achText(a.id)[1]">
                    <span class="ach-icon"><app-icon [name]="a.unlocked ? icon(a.id) : 'lock'" /></span>
                    <b>{{ achText(a.id)[0] }}</b>
                    <small>{{ achText(a.id)[1] }}</small>
                  </li>
                }
              </ul>
            </article>
          </div>
        }
      </section>
    }
  `,
})
export class Dashboard implements AfterViewChecked {
  protected readonly ui = inject(UiState);
  protected readonly store = inject(LessonStore);
  protected readonly learner = inject(LearnerService);
  protected readonly challenges = inject(ChallengeService);
  private readonly gamify = inject(GamificationService);
  protected readonly t = inject(I18n).t;
  readonly navigate = output<string>();

  private readonly root = viewChild<ElementRef<HTMLElement>>('root');
  private readonly xpNum = viewChild<ElementRef<HTMLElement>>('xpNum');
  private wasOpen = false;

  protected readonly d = this.gamify.dashboard;
  protected readonly progress = this.gamify.levelProgress;
  protected readonly maxActivity = computed(() => Math.max(1, ...(this.d()?.activity.map((a) => a.count) ?? [1])));
  protected readonly unlocked = computed(() => this.d()?.achievements.filter((a) => a.unlocked).length ?? 0);
  protected readonly levelTitle = computed(() => {
    const titles = this.t().levels;
    return titles[Math.min(titles.length - 1, (this.d()?.level ?? 1) - 1)];
  });
  protected readonly stats = computed(() => {
    const d = this.d();
    const t = this.t().dash;
    if (!d) return [];
    return [
      { icon: 'book', value: `${d.completed.length}/${d.total}`, label: t.lessons },
      { icon: 'target', value: `${d.challenges.length}/${d.total}`, label: t.challenges },
      { icon: 'play', value: String(d.runs), label: t.runs },
      { icon: 'alert', value: String(d.fixes), label: t.fixes },
      { icon: 'sparkle', value: String(d.questions), label: t.questions },
    ];
  });

  ngAfterViewChecked(): void {
    const root = this.root()?.nativeElement;
    if (root && !this.wasOpen) {
      void this.gamify.refresh();
      animateIn(root, { y: 24, scale: 0.98 });
      stagger(root.querySelectorAll('.dash-card'), { delay: 0.08, each: 0.04 });
      const xp = this.xpNum()?.nativeElement;
      if (xp) countUp(xp, this.d()?.xp ?? 0);
      root.focus();
    }
    this.wasOpen = !!root;
  }

  protected achText(id: string): string[] {
    return (this.t().achievements as Record<string, string[]>)[id] ?? [id, ''];
  }
  protected icon(id: string): string { return ACH_ICONS[id] ?? 'trophy'; }
  protected close(): void { this.ui.dashboardOpen.set(false); }
  protected open(slug: string): void { this.close(); this.navigate.emit(slug); }
}
