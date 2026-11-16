import { AfterViewInit, ChangeDetectionStrategy, Component, ElementRef, effect, inject, output, signal, viewChild } from '@angular/core';
import { I18n } from '../core/i18n';
import { LearnerService } from '../core/learner.service';
import { LessonStore } from '../core/lesson.store';
import { UiState } from '../core/ui-state';
import { Icon } from './icon';

@Component({
  selector: 'app-lesson-strip',
  imports: [Icon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="lessons" [class.can-left]="canLeft()" [class.can-right]="canRight()" [attr.aria-label]="t().lessonsTitle">
      <h2>{{ t().lessonsTitle }}</h2>
      <ol class="lesson-list" #list (scroll)="measure()">
        @for (l of store.lessons(); track l.slug) {
          <li class="lesson" tabindex="0" role="link"
              [class.is-active]="l.slug === store.current()?.slug"
              [class.is-done]="learner.isDone(l.slug)"
              [class.just-done]="learner.justCompleted() === l.slug"
              [attr.aria-current]="l.slug === store.current()?.slug ? 'page' : null"
              [attr.aria-label]="t().lessonAria(l.position, l.title)"
              [attr.data-slug]="l.slug"
              (click)="open.emit(l.slug)" (keydown.enter)="open.emit(l.slug)" (keydown.space)="$event.preventDefault(); open.emit(l.slug)">
            <img class="lesson-thumb" [class.is-ready]="!!ui.thumbs()[l.slug]" [src]="ui.thumbs()[l.slug] || blank" alt="" />
            <span class="lesson-title">{{ l.position }}. {{ l.title }}</span>
            <app-icon class="chev" name="chevR" />
            <span class="lesson-done"><app-icon name="check" /></span>
          </li>
        }
      </ol>
      <button class="lesson-step prev" type="button" [attr.aria-label]="i18n.dir() === 'rtl' ? t().next : t().prev" (click)="step(-1)"><app-icon name="chevL" /></button>
      <button class="lesson-step next" type="button" [attr.aria-label]="i18n.dir() === 'rtl' ? t().prev : t().next" (click)="step(1)"><app-icon name="chevR" /></button>
    </section>
  `,
})
export class LessonStrip implements AfterViewInit {
  protected readonly store = inject(LessonStore);
  protected readonly learner = inject(LearnerService);
  protected readonly ui = inject(UiState);
  protected readonly i18n = inject(I18n);
  protected readonly t = this.i18n.t;
  protected readonly blank = 'data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw==';
  private readonly list = viewChild.required<ElementRef<HTMLOListElement>>('list');
  protected readonly canLeft = signal(false);
  protected readonly canRight = signal(false);
  readonly open = output<string>();

  constructor() {
    // Keep the active lesson in view.
    effect(() => {
      const slug = this.store.current()?.slug;
      this.store.lessons();
      this.i18n.dir();
      if (!slug) return;
      requestAnimationFrame(() => {
        const list = this.list().nativeElement;
        const el = list.querySelector<HTMLElement>(`[data-slug="${slug}"]`);
        if (el) {
          // Physical geometry works for both LTR and RTL scroll containers.
          const lr = list.getBoundingClientRect(), er = el.getBoundingClientRect();
          if (er.left < lr.left + 20) list.scrollBy({ left: er.left - lr.left - 40, behavior: 'smooth' });
          else if (er.right > lr.right - 20) list.scrollBy({ left: er.right - lr.right + 40, behavior: 'smooth' });
        }
        setTimeout(() => this.measure(), 400);
      });
    });
  }

  ngAfterViewInit(): void {
    new ResizeObserver(() => this.measure()).observe(this.list().nativeElement);
  }

  /** Hidden content on the physical left / right (RTL scrollLeft runs from 0 down to negative). */
  protected measure(): void {
    const el = this.list().nativeElement;
    const range = el.scrollWidth - el.clientWidth;
    const rtl = this.i18n.dir() === 'rtl';
    const fromLeft = rtl ? range + el.scrollLeft : el.scrollLeft;
    this.canLeft.set(fromLeft > 4);
    this.canRight.set(fromLeft < range - 4);
  }

  /** dir: -1 = towards the physical left, 1 = towards the physical right. */
  protected step(dir: number): void {
    const el = this.list().nativeElement;
    el.scrollBy({ left: dir * el.clientWidth * 0.8, behavior: 'smooth' });
  }
}
