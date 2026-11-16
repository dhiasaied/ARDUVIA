import { AfterViewInit, ChangeDetectionStrategy, Component, ElementRef, NgZone, OnDestroy, computed, effect, inject, input, signal, untracked, viewChild, viewChildren } from '@angular/core';
import { I18n } from '../core/i18n';
import { LearnerService } from '../core/learner.service';
import { LessonStore } from '../core/lesson.store';
import { PartInfo } from '../core/models';
import { SimService } from '../core/sim/sim.service';
import { UiState } from '../core/ui-state';
import { SceneEngine } from '../scene/engine';
import { BOARD_PARTS } from './board-parts';
import { Icon } from './icon';

interface Tag { part: string; label: string; }

@Component({
  selector: 'app-stage',
  imports: [Icon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <main class="stage" #host [class.no-webgl]="noWebgl()" [attr.data-hand]="hand()">
      <canvas #canvas [attr.aria-label]="t().view.canvas" tabindex="0"></canvas>

      <div class="signals" aria-hidden="true">
        @for (w of wireSlots(); track $index) { <span class="signal" #signal></span> }
      </div>

      <div class="tags" [class.is-off]="!learner.settings().labels">
        <div class="readout" #readout></div>
        @for (tag of tags(); track tag.part + tag.label) {
          <button class="tag" type="button" #tagEl [attr.data-part]="tag.part" [class.is-selected]="ui.selectedPart() === tag.part"
                  (click)="select(tag.part)"><i></i><span>{{ tag.label }}</span></button>
        }
      </div>

      @if (selected(); as p) {
        <article class="inspector callout" #inspector role="dialog" [attr.aria-label]="t().inspector">
          <div>
            <h3>{{ p.name }}</h3>
            <p [innerHTML]="p.desc"></p>
          </div>
          <button class="inspector-close" type="button" (click)="ui.selectedPart.set(null)" [attr.aria-label]="t().close"><app-icon name="close" /></button>
        </article>
      }

      @if (ui.schematic() && lesson(); as l) {
        <section class="schematic" [attr.aria-label]="t().schematic">
          <header class="sch-head">
            <h3>{{ t().schematic }}</h3>
            <span class="sch-lesson">{{ l.position }}. {{ l.title }}</span>
            <button class="sch-close" type="button" (click)="ui.schematic.set(false)" [attr.aria-label]="t().closeSchematic"><app-icon name="close" /></button>
          </header>
          <div class="sch-body">
            <svg [attr.viewBox]="'0 0 300 ' + schH()" role="img">
              <rect x="8" y="8" width="96" [attr.height]="schH() - 16" rx="6" class="sch-board" />
              <text x="56" y="26" class="sch-title">ARDUINO</text><text x="56" y="38" class="sch-title sm">UNO</text>
              @for (r of schRows(); track $index) {
                <text x="98" [attr.y]="r.y + 4" class="sch-pin">{{ r.pin }}</text>
                <path [attr.d]="'M104 ' + r.y + ' H180'" [attr.stroke]="r.color" class="sch-wire" />
                <circle cx="104" [attr.cy]="r.y" r="3" [attr.fill]="r.color" />
                <rect x="180" [attr.y]="r.y - 11" width="110" height="22" rx="5" class="sch-part" />
                <text x="235" [attr.y]="r.y + 4" class="sch-label">{{ r.to }}</text>
              }
            </svg>
          </div>
        </section>
      }

      @if (tip(); as tp) { <div class="tip" [class.is-on]="true"><b><app-icon name="hand" /></b><span>{{ tp }}</span></div> }

      <div class="minimap" [attr.aria-label]="t().view.minimap" (click)="miniClick($event)">
        <canvas #mini width="160" height="104"></canvas>
      </div>

      <div class="viewbar" [class.is-away]="away()" [attr.aria-label]="t().view.canvas">
        <p class="view-hint" [class.is-gone]="hintGone()">{{ t().view.hint }}</p>
        <button type="button" (click)="engine?.rotate(-1)" [attr.aria-label]="t().view.left" [title]="t().view.left"><app-icon name="rotL" /></button>
        <button type="button" (click)="engine?.rotate(1)" [attr.aria-label]="t().view.right" [title]="t().view.right"><app-icon name="rotR" /></button>
        <span class="viewbar-sep"></span>
        <button type="button" (click)="engine?.zoomBy(1 / 1.25)" [attr.aria-label]="t().view.zoomOut" [title]="t().view.zoomOut"><app-icon name="minus" /></button>
        <button type="button" (click)="engine?.zoomBy(1.25)" [attr.aria-label]="t().view.zoomIn" [title]="t().view.zoomIn"><app-icon name="plus" /></button>
        <span class="viewbar-sep"></span>
        <button type="button" class="compass" (click)="engine?.resetView()" [attr.aria-label]="t().view.reset" [title]="t().view.reset"><app-icon name="compass" /></button>
        <span class="viewbar-sep"></span>
        <button type="button" class="toggle" [class.is-on]="learner.settings().flow" (click)="learner.update('flow', !learner.settings().flow)"
                [attr.aria-pressed]="learner.settings().flow" [attr.aria-label]="t().view.flow" [title]="t().view.flow"><app-icon name="flow" /></button>
        <button type="button" class="toggle" [class.is-on]="ui.schematic()" (click)="ui.schematic.set(!ui.schematic())"
                [attr.aria-pressed]="ui.schematic()" [attr.aria-label]="t().view.schematic" [title]="t().view.schematic"><app-icon name="schematic" /></button>
      </div>

      @if (noWebgl()) {
        <div class="stage-note"><b>{{ t().noWebgl[0] }}</b><p>{{ t().noWebgl[1] }}</p></div>
      }
    </main>
  `,
})
export class Stage implements AfterViewInit, OnDestroy {
  protected readonly ui = inject(UiState);
  protected readonly learner = inject(LearnerService);
  private readonly sim = inject(SimService);
  private readonly store = inject(LessonStore);
  private readonly i18n = inject(I18n);
  private readonly zone = inject(NgZone);
  protected readonly t = this.i18n.t;

  /** Artboard scale, used for a crisp drawing buffer. */
  readonly scale = input(1);

  private readonly host = viewChild.required<ElementRef<HTMLElement>>('host');
  private readonly canvas = viewChild.required<ElementRef<HTMLCanvasElement>>('canvas');
  private readonly mini = viewChild.required<ElementRef<HTMLCanvasElement>>('mini');
  private readonly readoutEl = viewChild.required<ElementRef<HTMLDivElement>>('readout');
  private readonly inspectorEl = viewChild<ElementRef<HTMLElement>>('inspector');
  private readonly tagEls = viewChildren<ElementRef<HTMLButtonElement>>('tagEl');
  private readonly signalEls = viewChildren<ElementRef<HTMLSpanElement>>('signal');

  engine: SceneEngine | null = null;
  protected readonly noWebgl = signal(false);
  protected readonly hintGone = signal(false);
  protected readonly hand = signal<string | null>(null);
  protected readonly away = signal(false);
  protected readonly wireSlots = signal<number[]>([]);
  private observer: ResizeObserver | null = null;
  private frame = 0;

  protected readonly lesson = computed(() => this.store.current());
  protected readonly tags = computed<Tag[]>(() => {
    const l = this.lesson();
    if (!l) return [];
    return l.callouts.length ? l.callouts.map((c) => ({ part: c.part, label: c.title })) : l.tags;
  });
  private readonly partIndex = computed(() => {
    const map = new Map<string, PartInfo>();
    for (const p of BOARD_PARTS[this.i18n.locale()]) map.set(p.id, p);
    const l = this.lesson();
    l?.callouts.forEach((c) => map.set(c.part, { id: c.part, name: c.title, desc: c.text }));
    l?.parts.forEach((p) => map.set(p.id, p));
    l?.tags.forEach((tg) => {
      if (map.has(tg.part)) return;
      const num = /\d+$/.exec(tg.part)?.[0];
      const row = l.pinout.find((r) => (tg.part.startsWith('a') ? r.pin.startsWith('A' + num) : tg.part === 'gnd' ? r.pin === 'GND' : !!num && new RegExp('D' + num + '(?!\\d)').test(r.pin)));
      map.set(tg.part, { id: tg.part, name: tg.label, desc: row ? `${row.to} — ${row.role}` : '' });
    });
    return map;
  });
  protected readonly selected = computed(() => {
    const id = this.ui.selectedPart();
    if (!id) return null;
    const key = /^key\d$/.test(id) ? 'button' : id;
    const p = this.partIndex().get(id) ?? this.partIndex().get(key);
    return p && p.desc ? p : p ? { ...p, desc: this.partIndex().get(key)?.desc ?? '' } : null;
  });
  protected readonly tip = computed(() => {
    const l = this.lesson();
    if (!l?.hint) return null;
    return this.sim.state() === 'running' || this.hand() ? l.hint : null;
  });
  protected readonly schRows = computed(() => (this.lesson()?.pinout ?? []).map((r, i) => ({ ...r, y: 60 + i * 30 })));
  protected readonly schH = computed(() => Math.max(120, 60 + this.schRows().length * 30));

  constructor() {
    effect(() => {
      const l = this.lesson();
      if (!l || !this.engine) return;
      untracked(() => {
        this.engine!.setBench(l.slug);
        this.wireSlots.set(Array.from({ length: this.engine!.wireCount }, (_, i) => i));
        this.ui.selectedPart.set(null);
      });
    });
    effect(() => { const s = this.learner.settings(); if (this.engine) this.engine.settings = s; });
    effect(() => {
      const req = this.ui.focusRequest();
      if (req && this.engine) untracked(() => this.engine!.focus(req.part));
    });
    effect(() => { if (this.ui.resetRequest() && this.engine) untracked(() => this.engine!.resetView()); });
    effect(() => {
      const s = this.scale();
      if (this.engine) this.engine.renderer.setPixelRatio(Math.min(2, window.devicePixelRatio * Math.max(0.6, s)));
      untracked(() => this.resize());
    });
  }

  ngAfterViewInit(): void {
    try {
      this.engine = this.zone.runOutsideAngular(() => new SceneEngine(this.canvas().nativeElement, this.sim));
    } catch {
      this.noWebgl.set(true);
      return;
    }
    const e = this.engine;
    e.settings = this.learner.settings();
    e.onPick = (part) => this.zone.run(() => {
      this.hintGone.set(true);
      this.ui.selectedPart.set(part && part !== 'board' && part !== 'breadboard' ? part : part === 'breadboard' ? 'breadboard' : null);
    });
    e.onHover = (kind) => {
      const hand = kind && kind !== 'inspect' ? kind.split(':')[0] : kind ? 'tap' : null;
      if (hand !== this.hand()) this.zone.run(() => this.hand.set(hand));
    };
    e.onFrame = () => this.onFrame();
    this.canvas().nativeElement.addEventListener('pointerdown', () => { if (!this.hintGone()) this.zone.run(() => this.hintGone.set(true)); });
    this.observer = new ResizeObserver(() => this.resize());
    this.observer.observe(this.host().nativeElement);
    this.resize();
    const l = this.lesson();
    if (l) {
      e.setBench(l.slug);
      this.wireSlots.set(Array.from({ length: e.wireCount }, (_, i) => i));
    }
  }

  ngOnDestroy(): void {
    this.observer?.disconnect();
    this.engine?.dispose();
  }

  rotate(dir: 1 | -1): void { this.engine?.rotate(dir); }
  zoom(f: number): void { this.engine?.zoomBy(f); }
  pan(dx: number, dy: number): void { this.engine?.panScreen(dx, dy); this.hintGone.set(true); }

  protected select(part: string): void {
    this.ui.selectedPart.set(this.ui.selectedPart() === part ? null : part);
  }

  protected miniClick(e: MouseEvent): void {
    const m = this.engine?.minimap();
    if (!m) return;
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const c = this.mini().nativeElement;
    const px = ((e.clientX - rect.left) / rect.width) * c.width, py = ((e.clientY - rect.top) / rect.height) * c.height;
    const { min, max } = m.bounds;
    const sc = Math.min(c.width / (max.x - min.x), c.height / (max.z - min.z));
    const ox = (c.width - (max.x - min.x) * sc) / 2, oz = (c.height - (max.z - min.z) * sc) / 2;
    this.engine!.moveTo(min.x + (px - ox) / sc, min.z + (py - oz) / sc);
  }

  private resize(): void {
    const el = this.host().nativeElement;
    this.engine?.resize(el.clientWidth, el.clientHeight);
  }

  /** Runs outside Angular every animation frame: positions overlays directly. */
  private onFrame(): void {
    const e = this.engine!;
    this.frame++;
    const anchors = e.anchors;
    const labelsOn = this.learner.settings().labels;
    const w = this.host().nativeElement.clientWidth;
    // Place tags at their anchors, nudging overlapping ones apart vertically.
    const placed: { l: number; r: number; t: number; b: number }[] = [];
    const items = this.tagEls().map((ref) => {
      const el = ref.nativeElement;
      const a = anchors.get(el.dataset['part'] ?? '');
      return { el, p: a && labelsOn ? e.project(a) : null };
    }).sort((x, y) => (x.p?.y ?? 0) - (y.p?.y ?? 0));
    for (const { el, p } of items) {
      if (!p) { el.classList.add('is-hidden'); continue; }
      el.classList.toggle('is-hidden', !p.visible);
      const flip = p.x > w * 0.62;
      el.classList.toggle('is-flip', flip);
      const tw = el.offsetWidth, th = el.offsetHeight;
      const left = flip ? p.x - tw + 9 : p.x - 9;
      let top = p.y - th / 2;
      for (let guard = 0; guard < 6; guard++) {
        const hit = placed.find((r) => left < r.r && left + tw > r.l && top < r.b && top + th > r.t);
        if (!hit) break;
        top = hit.b + 3;
      }
      placed.push({ l: left, r: left + tw, t: top, b: top + th });
      el.style.transform = `translate(${Math.round(left)}px, ${Math.round(top)}px)`;
    }
    const insp = this.inspectorEl()?.nativeElement;
    const sel = this.ui.selectedPart();
    if (insp && sel) {
      const a = anchors.get(sel) ?? anchors.get(/^key\d$/.test(sel) ? sel : '') ?? null;
      const host = this.host().nativeElement;
      let x = 24, y = 24;
      if (a) {
        const p = e.project(a);
        x = Math.min(Math.max(12, p.x + 26), host.clientWidth - insp.offsetWidth - 12);
        y = Math.min(Math.max(70, p.y - insp.offsetHeight - 20), host.clientHeight - insp.offsetHeight - 60);
        if (p.x + 26 + insp.offsetWidth > host.clientWidth - 12) x = Math.max(12, p.x - insp.offsetWidth - 26);
      }
      insp.style.transform = `translate(${Math.round(x)}px, ${Math.round(y)}px)`;
    }
    const sigs = this.signalEls();
    const labels = e.wireLabels();
    sigs.forEach((ref, i) => {
      const el = ref.nativeElement;
      const l = labels[i];
      if (!l) { el.classList.remove('is-on'); return; }
      el.classList.add('is-on');
      el.dataset['level'] = l.level;
      if (el.textContent !== l.text) el.textContent = l.text;
      el.style.transform = `translate(${Math.round(l.x)}px, ${Math.round(l.y)}px) translate(-50%, -50%)`;
    });
    const r = e.readout();
    const ro = this.readoutEl().nativeElement;
    if (r && labelsOn) {
      ro.classList.add('is-on');
      ro.classList.toggle('is-warn', r.warn);
      if (ro.textContent !== r.text) ro.textContent = r.text;
      ro.style.transform = `translate(${Math.round(r.x)}px, ${Math.round(r.y)}px) translate(-50%, -100%)`;
    } else ro.classList.remove('is-on');

    if (this.frame % 6 === 0) {
      this.drawMinimap();
      const away = e.isAway;
      if (away !== this.away()) this.zone.run(() => this.away.set(away));
    }
  }

  private drawMinimap(): void {
    const m = this.engine?.minimap();
    const c = this.mini().nativeElement;
    const g = c.getContext('2d');
    if (!m || !g) return;
    const { min, max } = m.bounds;
    const sc = Math.min(c.width / (max.x - min.x), c.height / (max.z - min.z));
    const sx = sc, sz = sc;
    const ox = (c.width - (max.x - min.x) * sc) / 2, oz = (c.height - (max.z - min.z) * sc) / 2;
    const X = (x: number) => ox + (x - min.x) * sx, Z = (z: number) => oz + (z - min.z) * sz;
    g.clearRect(0, 0, c.width, c.height);
    g.save(); g.beginPath(); g.rect(0, 0, c.width, c.height); g.clip();
    g.fillStyle = 'rgba(36,48,74,0.16)';
    g.strokeStyle = 'rgba(36,48,74,0.45)';
    g.lineWidth = 1;
    for (const b of m.boxes) { g.fillRect(X(b.x), Z(b.z), b.w * sx, b.d * sz); g.strokeRect(X(b.x), Z(b.z), b.w * sx, b.d * sz); }
    g.strokeStyle = '#1aa3a1'; g.lineWidth = 2; g.fillStyle = 'rgba(26,163,161,0.1)';
    g.beginPath();
    m.view.forEach((p, i) => (i ? g.lineTo(X(p.x), Z(p.z)) : g.moveTo(X(p.x), Z(p.z))));
    g.closePath(); g.fill(); g.stroke();
    g.restore();
  }
}
