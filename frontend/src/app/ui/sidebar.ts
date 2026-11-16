import { ChangeDetectionStrategy, Component, computed, inject, output } from '@angular/core';
import { I18n, LANGUAGES } from '../core/i18n';
import { LearnerService } from '../core/learner.service';
import { LessonStore } from '../core/lesson.store';
import { Locale, Settings } from '../core/models';
import { isLocale } from '../core/i18n';
import { SimService } from '../core/sim/sim.service';
import { FlyoutKind, UiState } from '../core/ui-state';
import { BOARD_PARTS } from './board-parts';
import { Icon } from './icon';

type NavItem = { id: string; icon: string; label: string; aria?: string; kind?: Exclude<FlyoutKind, null>; muted?: boolean };

@Component({
  selector: 'app-sidebar',
  imports: [Icon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <nav class="sidebar" [class.is-open]="ui.sidebarOpen()" [attr.aria-label]="t().nav.main">
      <button class="side-toggle" type="button" (click)="ui.sidebarOpen.set(!ui.sidebarOpen())"
              [attr.aria-label]="ui.sidebarOpen() ? t().nav.collapse : t().nav.expand" [attr.aria-expanded]="ui.sidebarOpen()">
        <app-icon name="chevR" />
      </button>
      <ul class="side-nav">
        @for (item of items(); track item.id) {
          <li [class.is-on]="isOn(item)" [class.is-muted]="item.muted" [class.side-lang]="item.id === 'language'">
            <a href="#" [attr.aria-label]="item.aria ?? item.label" [attr.aria-pressed]="isOn(item)" (click)="activate(item, $event)">
              <span class="side-icon"><app-icon [name]="item.icon" />
                @if (item.id === 'language') { <span class="side-code">{{ i18n.locale().toUpperCase() }}</span> }
              </span>
              <span class="side-label">{{ item.label }}</span>
            </a>
          </li>
        }
      </ul>
      <div class="credit credit-side">
        <span class="credit-text"><small>{{ t().credit }}</small><b>{{ t().creditLink }}</b></span>
        <span class="credit-rule"></span>
      </div>
    </nav>

    <aside class="flyout" [class.is-open]="ui.flyout()" [class.beside-open]="ui.sidebarOpen()" [attr.data-kind]="ui.flyout()"
           [attr.aria-hidden]="!ui.flyout()" [style.--top.px]="flyTop()">
      @switch (ui.flyout()) {
        @case ('lessons') {
          <header><h2>{{ t().lessonsTitle }}</h2><span>{{ t().doneCount(learner.completedCount(), store.lessons().length || 16) }}</span></header>
          <ol class="fly-list">
            @for (l of store.lessons(); track l.slug) {
              <li><button type="button" [class.is-current]="l.slug === store.current()?.slug" (click)="openLesson(l.slug)">
                <span class="fly-num">@if (learner.isDone(l.slug)) { <app-icon name="check" /> } @else { {{ l.position }} }</span>
                <span class="fly-text"><b>{{ l.title }}</b><small>{{ l.subtitle }}</small></span>
              </button></li>
            }
          </ol>
        }
        @case ('parts') {
          <header><h2>{{ t().nav.parts }}</h2><span>{{ t().onScreen(parts().length) }}</span></header>
          <ul class="fly-list">
            @for (p of parts(); track p.id; let i = $index) {
              <li><button type="button" [class.is-current]="ui.selectedPart() === p.id" (click)="focusPart(p.id)">
                <span class="fly-num">{{ i + 1 }}</span>
                <span class="fly-text"><b>{{ p.name }}</b><small>{{ p.desc }}</small></span>
              </button></li>
            }
          </ul>
        }
        @case ('settings') {
          <header><h2>{{ t().nav.settings }}</h2></header>
          <ul class="fly-list">
            <li class="fly-lang"><label>
              <span class="fly-text"><b>{{ t().settings.language[0] }}</b><small>{{ t().settings.language[1] }}</small></span>
              <select [value]="i18n.locale()" (change)="setLang($any($event.target).value)" [attr.aria-label]="t().settings.language[0]">
                @for (l of languages; track l.code) { <option [value]="l.code" [selected]="l.code === i18n.locale()">{{ l.native }}</option> }
              </select>
            </label></li>
            @for (key of toggles; track key) {
              <li><label class="switch">
                <span class="fly-text"><b>{{ t().settings[key][0] }}</b><small>{{ t().settings[key][1] }}</small></span>
                <input type="checkbox" [checked]="learner.settings()[key]" (change)="learner.update(key, $any($event.target).checked)" />
                <span class="switch-track"><span></span></span>
              </label></li>
            }
          </ul>
          <button class="fly-reset" type="button" (click)="resetProgress()">{{ t().settings.reset }}</button>
        }
        @case ('language') {
          <header><h2>{{ t().nav.language }}</h2></header>
          <ul class="fly-list">
            @for (l of languages; track l.code) {
              <li><button type="button" [class.is-current]="l.code === i18n.locale()" [attr.aria-current]="l.code === i18n.locale()" (click)="setLang(l.code)">
                <span class="fly-num">@if (l.code === i18n.locale()) { <app-icon name="check" /> } @else { {{ l.code.toUpperCase() }} }</span>
                <span class="fly-text"><b [attr.lang]="l.code">{{ l.native }}</b>@if (l.code !== i18n.locale()) { <small>{{ t().langNames[l.code] }}</small> }</span>
              </button></li>
            }
          </ul>
        }
      }
    </aside>
    @if (ui.flyout()) { <div class="flyout-scrim" (click)="ui.flyout.set(null)"></div> }
  `,
})
export class Sidebar {
  protected readonly ui = inject(UiState);
  protected readonly i18n = inject(I18n);
  protected readonly learner = inject(LearnerService);
  protected readonly store = inject(LessonStore);
  private readonly sim = inject(SimService);
  protected readonly t = this.i18n.t;
  protected readonly languages = LANGUAGES;
  protected readonly toggles: (keyof Settings)[] = ['labels', 'flow', 'grid', 'autoRotate', 'sound', 'reducedMotion'];

  readonly navigate = output<string>();
  readonly language = output<Locale>();
  readonly home = output<void>();
  readonly runToggle = output<void>();

  protected readonly items = computed<NavItem[]>(() => {
    const n = this.t().nav;
    return [
      { id: 'home', icon: 'home', label: n.home },
      { id: 'dashboard', icon: 'chart', label: n.dashboard },
      { id: 'lessons', icon: 'book', label: n.lessons, kind: 'lessons' },
      { id: 'parts', icon: 'cpu', label: n.parts, kind: 'parts' },
      { id: 'sim', icon: 'sim', label: n.sim },
      { id: 'tutor', icon: 'sparkle', label: n.tutor },
      { id: 'settings', icon: 'gear', label: n.settings, kind: 'settings', muted: true },
      { id: 'language', icon: 'globe', label: LANGUAGES.find((l) => l.code === this.i18n.locale())?.native ?? n.language, aria: n.language, kind: 'language', muted: true },
    ];
  });

  protected readonly parts = computed(() => {
    const lesson = this.store.current();
    const board = BOARD_PARTS[this.i18n.locale()];
    return [...(lesson?.parts ?? []), ...board];
  });

  private readonly tops: Record<string, number> = { lessons: 160, parts: 220, settings: 300, language: 340 };
  protected readonly flyTop = computed(() => this.tops[this.ui.flyout() ?? 'lessons'] ?? 140);

  protected isOn(item: NavItem): boolean {
    if (item.kind) return this.ui.flyout() === item.kind;
    if (item.id === 'sim') return this.sim.running();
    if (item.id === 'dashboard') return this.ui.dashboardOpen();
    if (item.id === 'tutor') return this.ui.assistantOpen();
    return item.id === 'home' && !this.ui.flyout() && !this.ui.dashboardOpen() && this.store.current()?.slug === 'board';
  }

  protected activate(item: NavItem, e: Event): void {
    e.preventDefault();
    if (item.kind) { this.ui.toggleFlyout(item.kind); return; }
    this.ui.flyout.set(null);
    if (item.id === 'home') this.home.emit();
    if (item.id === 'sim') this.runToggle.emit();
    if (item.id === 'dashboard') { this.ui.assistantOpen.set(false); this.ui.dashboardOpen.set(!this.ui.dashboardOpen()); }
    if (item.id === 'tutor') { if (this.ui.assistantOpen()) this.ui.assistantOpen.set(false); else this.ui.openAssistant(); }
  }

  protected openLesson(slug: string): void {
    this.ui.flyout.set(null);
    this.navigate.emit(slug);
  }

  protected focusPart(id: string): void {
    this.ui.focusPart(id);
    if (this.ui.compact()) this.ui.flyout.set(null);
  }

  protected setLang(code: string): void {
    if (!isLocale(code)) return;
    if (this.ui.flyout() === 'language') this.ui.flyout.set(null);
    this.language.emit(code);
  }

  protected resetProgress(): void {
    if (confirm(this.t().settings.confirmReset)) this.learner.reset();
  }
}
