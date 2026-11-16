import { ChangeDetectionStrategy, Component, DestroyRef, HostListener, computed, effect, inject, signal, viewChild } from '@angular/core';
import { Meta, Title } from '@angular/platform-browser';
import { ActivatedRoute, NavigationEnd, Router } from '@angular/router';
import { filter } from 'rxjs';
import { ChallengeService } from './core/challenge.service';
import { GamificationService } from './core/gamification.service';
import { DEFAULT_LOCALE, I18n, isLocale } from './core/i18n';
import { LearnerService } from './core/learner.service';
import { LessonStore } from './core/lesson.store';
import { Locale } from './core/models';
import { SimService } from './core/sim/sim.service';
import { UiState } from './core/ui-state';
import { SceneEngine } from './scene/engine';
import { AssistantPanel } from './ui/assistant-panel';
import { Celebrations } from './ui/celebrations';
import { CodeCard } from './ui/code-card';
import { Dashboard } from './ui/dashboard';
import { setReducedMotion, stagger } from './ui/motion';
import { Brand, Logo, Status } from './ui/header';
import { InfoCard } from './ui/info-card';
import { LessonStrip } from './ui/lesson-strip';
import { Sidebar } from './ui/sidebar';
import { Stage } from './ui/stage';

const ART_W = 1672;
const ART_H = 941;
const MIN_W = 1180;

/** Root shell: the scaled artboard (desktop/tablet) or stacked layout (phones). */
@Component({
  selector: 'app-root',
  imports: [Sidebar, Brand, Status, Stage, InfoCard, CodeCard, LessonStrip, Logo, AssistantPanel, Dashboard, Celebrations],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="viewport" [class.is-compact]="ui.compact()" [class.is-landscape]="landscape()" [class.reduced]="learner.settings().reducedMotion">
      <div class="artboard" [style.width.px]="ui.compact() ? null : artW()" [style.height.px]="ui.compact() ? null : artH()"
           [style.transform]="ui.compact() ? null : 'scale(' + scale() + ')'">
        <app-sidebar (navigate)="go($event)" (language)="setLocale($event)" (home)="goHome()" (runToggle)="code()?.toggleRun()" />
        <app-brand />
        <app-status />
        <app-stage [scale]="ui.compact() ? 1 : scale()" />
        <app-info-card />
        <app-code-card />
        <app-lesson-strip (open)="go($event)" />
        <app-assistant-panel />
        <footer class="app-foot"><div class="credit credit-row"><span class="credit-rule"></span><span class="credit-text"><small>{{ t().credit }}</small><b>{{ t().creditLink }}</b></span></div></footer>
        <svg class="traces" aria-hidden="true" viewBox="0 0 1672 941" preserveAspectRatio="none">
          <path d="M72 120h140l30 30h260M72 610h60l40 40h120M1140 120v-30l30-30h240M1600 830h-90l-30 30H1300M640 900h300l20-20h120M90 300h40v120l30 30"/>
          <circle cx="502" cy="150" r="4"/><circle cx="292" cy="650" r="4"/><circle cx="1410" cy="60" r="4"/><circle cx="1300" cy="860" r="4"/><circle cx="1080" cy="880" r="4"/>
        </svg>
      </div>
    </div>

    <app-dashboard (navigate)="go($event)" />
    <app-celebrations />

    @if (loading()) {
      <div class="loader" [class.is-done]="loadDone()" role="status">
        <app-logo />
        <b>{{ t().appTitle }}</b>
        <span class="loader-track"><span [style.width.%]="loadPct()"></span></span>
        <small>{{ t().loading }}@if (thumbCount()) { · {{ thumbCount() }} / {{ store.lessons().length }} }</small>
      </div>
    }
  `,
})
export class App {
  protected readonly ui = inject(UiState);
  protected readonly learner = inject(LearnerService);
  protected readonly store = inject(LessonStore);
  private readonly i18n = inject(I18n);
  private readonly sim = inject(SimService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly title = inject(Title);
  private readonly meta = inject(Meta);
  private readonly gamify = inject(GamificationService);
  // Instantiated here so challenges are verified from the first run.
  private readonly challenges = inject(ChallengeService);
  protected readonly t = this.i18n.t;
  protected readonly code = viewChild(CodeCard);
  private readonly stage = viewChild(Stage);

  private readonly vw = signal(window.innerWidth);
  private readonly vh = signal(window.innerHeight);
  protected readonly scale = computed(() => Math.min(this.vh() / ART_H, this.vw() / MIN_W));
  protected readonly artW = computed(() => Math.max(MIN_W, this.vw() / this.scale()));
  protected readonly artH = computed(() => this.vh() / this.scale());
  protected readonly landscape = computed(() => this.ui.compact() && this.vw() > this.vh());

  protected readonly loading = signal(true);
  protected readonly loadDone = signal(false);
  protected readonly thumbCount = signal(0);
  protected readonly loadPct = computed(() => {
    const n = this.store.lessons().length || 16;
    return 15 + (this.thumbCount() / n) * 85;
  });

  private booted = false;
  private currentLocale: Locale | null = null;

  constructor() {
    this.updateCompact();
    effect(() => setReducedMotion(this.learner.settings().reducedMotion));
    effect(() => {
      const l = this.store.current();
      const app = this.t().appTitle;
      const t = this.t();
      this.title.setTitle(l && l.slug !== 'board' ? `${l.title} · ${app}` : t.metaTitle);
      this.meta.updateTag({ name: 'description', content: l && l.slug !== 'board' ? l.lede.replace(/<[^>]+>/g, '') : t.metaDescription });
      this.meta.updateTag({ property: 'og:title', content: l && l.slug !== 'board' ? `${l.title} · ${app}` : t.metaTitle });
      this.meta.updateTag({ property: 'og:locale', content: this.i18n.locale() });
    });
    const sub = this.router.events.pipe(filter((e) => e instanceof NavigationEnd)).subscribe(() => void this.syncRoute());
    inject(DestroyRef).onDestroy(() => sub.unsubscribe());
    void this.boot();
  }

  private async boot(): Promise<void> {
    // Board silkscreen is painted with the brand font: give it a moment to arrive.
    const fonts = Promise.race([document.fonts.load('800 40px "Plus Jakarta Sans"'), new Promise((r) => setTimeout(r, 1500))]);
    const [saved] = await Promise.all([this.learner.init(), fonts]);
    void this.gamify.refresh();
    const urlLang = this.router.url.split('/')[1];
    const locale = this.i18n.set(isLocale(urlLang) ? urlLang : saved ?? DEFAULT_LOCALE);
    await this.store.loadCatalogue(locale);
    this.currentLocale = locale;
    this.booted = true;
    await this.syncRoute();
    this.drawThumbnails();
  }

  /** Lesson thumbnails are drawn offscreen, one per frame, while the loader shows progress. */
  private drawThumbnails(): void {
    const slugs = this.store.lessons().map((l) => l.slug);
    let i = 0;
    const next = () => {
      if (i >= slugs.length) {
        this.loadDone.set(true);
        setTimeout(() => this.loading.set(false), 600);
        // Signature entrance: the interface assembles itself.
        stagger(document.querySelectorAll('.brand, .status, .info-card, .code-card, .lessons, .viewbar'), { y: 18, delay: 0.15, each: 0.07 });
        return;
      }
      const slug = slugs[i++];
      try {
        const url = SceneEngine.renderThumbnail(slug);
        this.ui.thumbs.update((t) => ({ ...t, [slug]: url }));
      } catch { /* WebGL unavailable: no thumbnail */ }
      this.thumbCount.set(i);
      setTimeout(next, 16);
    };
    if (!slugs.length) { this.loadDone.set(true); setTimeout(() => this.loading.set(false), 400); return; }
    requestAnimationFrame(next);
  }

  private async syncRoute(): Promise<void> {
    if (!this.booted) return;
    const [, lang, slug] = this.router.url.split('?')[0].split('#')[0].split('/');
    const locale: Locale = isLocale(lang) ? lang : DEFAULT_LOCALE;
    if (lang !== locale) { void this.router.navigate(['/', locale, slug || 'board'], { replaceUrl: true }); return; }
    // Slugs are identical in every language, so the current catalogue can validate the URL.
    const target = slug && this.store.lessons().some((l) => l.slug === slug) ? slug : 'board';
    if (slug && target !== slug) { void this.router.navigate(['/', locale, target], { replaceUrl: true }); return; }
    const pending: Promise<unknown>[] = [];
    if (locale !== this.currentLocale) {
      this.i18n.set(locale);
      this.currentLocale = locale;
      pending.push(this.store.loadCatalogue(locale));
    }
    if (this.store.current()?.slug !== target || this.store.current()?.locale !== locale) {
      const same = this.store.current()?.slug === target;
      if (!same) this.sim.reset(target);
      pending.push(this.store.open(target, locale));
      if (!same) { this.ui.infoExpanded.set(false); this.ui.codeExpanded.set(false); }
    }
    await Promise.all(pending);
    this.store.prefetchAround(target, locale);
  }

  protected go(slug: string): void {
    void this.router.navigate(['/', this.i18n.locale(), slug]);
  }

  protected goHome(): void {
    this.ui.resetRequest.update((n) => n + 1);
    this.go('board');
  }

  protected setLocale(locale: Locale): void {
    this.learner.saveLocale(locale);
    void this.router.navigate(['/', locale, this.store.current()?.slug ?? 'board']);
  }

  @HostListener('window:resize')
  protected updateCompact(): void {
    const w = window.innerWidth, h = window.innerHeight;
    this.vw.set(w);
    this.vh.set(h);
    this.ui.compact.set(w <= 760 || (h > w && w < 900) || (w > h && h <= 500));
  }

  @HostListener('window:keydown', ['$event'])
  protected onKey(e: KeyboardEvent): void {
    const target = e.target as HTMLElement;
    if (target.closest('textarea, input, select') || e.ctrlKey || e.metaKey || e.altKey) return;
    const stage = this.stage();
    const k = e.key.toLowerCase();
    const slug = this.store.current()?.slug;
    if (slug === 'piano' && ['1', '2', '3', '4'].includes(k)) { this.sim.inputs.buttons[+k - 1] = true; return; }
    if (slug === 'button' && k === ' ' && !target.closest('button, a, [role=link]')) { e.preventDefault(); this.sim.inputs.buttons[0] = true; return; }
    if (!stage) return;
    const step = 40;
    switch (k) {
      case 'w': case 'arrowup': if (k === 'w' || target.tagName === 'CANVAS') stage.pan(0, -step); break;
      case 's': case 'arrowdown': if (k === 's' || target.tagName === 'CANVAS') stage.pan(0, step); break;
      case 'a': case 'arrowleft': if (k === 'a' || target.tagName === 'CANVAS') stage.pan(-step, 0); break;
      case 'd': case 'arrowright': if (k === 'd' || target.tagName === 'CANVAS') stage.pan(step, 0); break;
      case 'q': stage.rotate(-1); break;
      case 'e': stage.rotate(1); break;
      case '+': case '=': stage.zoom(1.2); break;
      case '-': stage.zoom(1 / 1.2); break;
      case 'escape': this.ui.dashboardOpen.set(false); this.ui.assistantOpen.set(false); this.ui.flyout.set(null); this.ui.selectedPart.set(null); this.ui.infoExpanded.set(false); this.ui.codeExpanded.set(false); break;
    }
  }

  @HostListener('window:keyup', ['$event'])
  protected onKeyUp(e: KeyboardEvent): void {
    const k = e.key.toLowerCase();
    if (['1', '2', '3', '4'].includes(k)) this.sim.inputs.buttons[+k - 1] = false;
    if (k === ' ') this.sim.inputs.buttons[0] = false;
  }
}
