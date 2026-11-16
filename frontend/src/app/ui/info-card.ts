import { ChangeDetectionStrategy, Component, ElementRef, computed, effect, inject, signal, viewChild } from '@angular/core';
import { ChallengeService } from '../core/challenge.service';
import { I18n } from '../core/i18n';
import { LessonStore } from '../core/lesson.store';
import { UiState } from '../core/ui-state';
import { Icon } from './icon';
import { lessonSwap } from './motion';

type Tab = 'overview' | 'pinout' | 'example' | 'specs' | 'challenge';

@Component({
  selector: 'app-info-card',
  imports: [Icon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="info-card" [class.is-expanded]="ui.infoExpanded()" [class.is-covered]="ui.codeExpanded()" [attr.aria-label]="lesson()?.heading">
      <div class="tabs" role="tablist">
        @for (tab of tabs; track tab) {
          <button type="button" role="tab" [class.is-active]="active() === tab" [class.tab-challenge]="tab === 'challenge'" [class.is-solved]="tab === 'challenge' && challenge.solved()"
                  [attr.aria-selected]="active() === tab" (click)="select(tab)">@if (tab === 'challenge') {<app-icon [name]="challenge.solved() ? 'check' : 'target'" />{{ t().challenge.tab }}} @else {{{ t().tabs[tab] }}}</button>
        }
      </div>
      <div class="info-body" #body>
        <button class="expand" type="button" (click)="ui.infoExpanded.set(!ui.infoExpanded())" [attr.aria-label]="ui.infoExpanded() ? t().collapsePanel : t().expandPanel">
          <app-icon [name]="ui.infoExpanded() ? 'collapse' : 'expand'" />
        </button>
        @if (lesson(); as l) {
          <div class="info-content" [class.is-in]="shown()" role="tabpanel">
            @switch (active()) {
              @case ('overview') {
                <h2>{{ l.heading }}</h2>
                <p class="lede" [innerHTML]="l.lede"></p>
                <ul class="features">
                  @for (f of l.features; track $index) {
                    <li><span class="feature-icon"><app-icon [name]="f.icon" /></span><span [innerHTML]="f.html"></span></li>
                  }
                </ul>
              }
              @case ('pinout') {
                <h2>{{ t().pinoutTitle }}</h2>
                <p class="sub">{{ l.pinoutSub }}</p>
                <table class="pin-table">
                  <thead><tr><th>{{ t().pinHead[0] }}</th><th>{{ t().pinHead[1] }}</th><th>{{ t().pinHead[2] }}</th></tr></thead>
                  <tbody>
                    @for (r of l.pinout; track $index) {
                      <tr><td><span class="wire-dot" [style.--c]="r.color"></span><code>{{ r.pin }}</code></td><td>{{ r.to }}</td><td>{{ r.role }}</td></tr>
                    }
                  </tbody>
                </table>
              }
              @case ('example') {
                <h2>{{ t().howItWorks }}</h2>
                <ol class="steps">@for (s of l.steps; track $index) { <li [innerHTML]="s"></li> }</ol>
              }
              @case ('challenge') {
                @if (l.challenge; as c) {
                  <div class="challenge" [attr.data-status]="challenge.status()">
                    <span class="challenge-badge"><app-icon [name]="challenge.solved() ? 'trophy' : 'target'" />{{ t().challenge.tab }} · {{ t().challenge.reward }}</span>
                    <h2>{{ c.title }}</h2>
                    <p class="lede" [innerHTML]="c.goal"></p>
                    <div class="challenge-status" role="status">
                      @switch (challenge.status()) {
                        @case ('solved') { <app-icon name="check" /> {{ t().challenge.solved }} }
                        @case ('watching') { <i class="live-dot"></i> {{ t().challenge.watching }} }
                        @default { <app-icon name="play" /> {{ t().challenge.idle }} }
                      }
                    </div>
                    <div class="challenge-actions">
                      <button type="button" class="btn-soft" (click)="showHint.set(!showHint())">{{ showHint() ? t().challenge.hideHint : t().challenge.showHint }}</button>
                      <button type="button" class="btn-soft is-primary" (click)="ui.openAssistant('hint')"><app-icon name="sparkle" />{{ t().challenge.askHint }}</button>
                    </div>
                    @if (showHint()) { <p class="challenge-hint" [innerHTML]="c.hint"></p> }
                  </div>
                }
              }
              @case ('specs') {
                <h2>{{ t().specsTitle }}</h2>
                <dl class="spec-grid">@for (s of l.specs; track $index) { <div><dt>{{ s.label }}</dt><dd>{{ s.value }}</dd></div> }</dl>
              }
            }
          </div>
        }
      </div>
    </section>
  `,
})
export class InfoCard {
  protected readonly ui = inject(UiState);
  private readonly store = inject(LessonStore);
  protected readonly t = inject(I18n).t;
  protected readonly challenge = inject(ChallengeService);
  protected readonly tabs: Tab[] = ['overview', 'pinout', 'example', 'specs', 'challenge'];
  protected readonly active = this.ui.infoTab;
  protected readonly showHint = signal(false);
  private readonly body = viewChild<ElementRef<HTMLElement>>('body');
  protected readonly shown = signal(true);
  protected readonly lesson = computed(() => this.store.current());

  constructor() {
    // Back to the overview with a soft fade whenever the lesson changes.
    let slug = '';
    effect(() => {
      const l = this.lesson();
      if (l && l.slug !== slug) {
        slug = l.slug;
        this.active.set('overview');
        this.showHint.set(false);
        this.fade();
        const body = this.body()?.nativeElement;
        if (body) lessonSwap([body]);
      }
    });
  }

  protected select(tab: Tab): void {
    if (tab === this.active()) return;
    this.active.set(tab);
    this.fade();
  }

  private fade(): void {
    this.shown.set(false);
    requestAnimationFrame(() => requestAnimationFrame(() => this.shown.set(true)));
  }
}
