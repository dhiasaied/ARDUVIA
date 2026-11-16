import { AfterViewChecked, ChangeDetectionStrategy, Component, ElementRef, inject, viewChild } from '@angular/core';
import { Celebration, GamificationService } from '../core/gamification.service';
import { I18n } from '../core/i18n';
import { LessonStore } from '../core/lesson.store';
import { Icon } from './icon';
import { animateIn, confetti } from './motion';

/** Toasts for XP, level-ups, achievements and solved challenges (+ confetti). */
@Component({
  selector: 'app-celebrations',
  imports: [Icon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="celebrations" #layer aria-live="polite">
      @for (c of gamify.celebrations(); track c.key) {
        <div class="toast glass" [attr.data-kind]="c.kind" [attr.data-key]="c.key" (click)="gamify.dismiss(c.key)">
          <span class="toast-icon"><app-icon [name]="icon(c)" /></span>
          <div>
            <b>{{ title(c) }}</b>
            @if (detail(c); as d) { <small>{{ d }}</small> }
          </div>
        </div>
      }
    </div>
  `,
})
export class Celebrations implements AfterViewChecked {
  protected readonly gamify = inject(GamificationService);
  private readonly store = inject(LessonStore);
  private readonly t = inject(I18n).t;
  private readonly layer = viewChild.required<ElementRef<HTMLElement>>('layer');
  private seen = new Set<number>();

  ngAfterViewChecked(): void {
    const layer = this.layer().nativeElement;
    for (const c of this.gamify.celebrations()) {
      if (this.seen.has(c.key)) continue;
      this.seen.add(c.key);
      const el = layer.querySelector(`[data-key="${c.key}"]`);
      if (el) animateIn(el, { y: -16, scale: 0.94 });
      if (c.kind !== 'xp') confetti(document.body, { x: innerWidth / 2, y: innerHeight * 0.28 });
    }
  }

  protected icon(c: Celebration): string {
    return { xp: 'bolt', level: 'trophy', achievement: 'trophy', challenge: 'target' }[c.kind];
  }

  protected title(c: Celebration): string {
    const t = this.t();
    switch (c.kind) {
      case 'xp': return `+${c.amount} XP`;
      case 'level': return `${t.celebrate.levelUp} ${t.dash.level} ${c.level}`;
      case 'achievement': return t.celebrate.achievement;
      case 'challenge': return t.celebrate.challenge;
    }
  }

  protected detail(c: Celebration): string | null {
    const t = this.t();
    if (c.kind === 'achievement') return ((t.achievements as Record<string, string[]>)[c.id] ?? [c.id])[0];
    if (c.kind === 'level') return t.levels[Math.min(t.levels.length - 1, c.level - 1)];
    if (c.kind === 'challenge') return this.store.current()?.challenge?.title ?? null;
    return null;
  }
}
