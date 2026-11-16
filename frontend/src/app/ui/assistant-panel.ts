import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { AfterViewChecked, ChangeDetectionStrategy, Component, ElementRef, effect, inject, signal, untracked, viewChild } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { GamificationService } from '../core/gamification.service';
import { I18n } from '../core/i18n';
import { LearnerService } from '../core/learner.service';
import { LessonStore } from '../core/lesson.store';
import { SimService } from '../core/sim/sim.service';
import { AssistantMode, UiState } from '../core/ui-state';
import { Icon } from './icon';
import { renderMarkdown } from './markdown';
import { animateIn } from './motion';

interface Message { role: 'user' | 'assistant'; html: string; source?: 'claude' | 'local'; error?: boolean; }

@Component({
  selector: 'app-assistant-panel',
  imports: [Icon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (ui.assistantOpen()) {
      <aside class="assistant glass" #panel role="dialog" [attr.aria-label]="t().ai.title" (keydown.escape)="close()">
        <header class="assistant-head">
          <span class="assistant-avatar"><app-icon name="sparkle" /></span>
          <div>
            <h2>{{ t().ai.title }}</h2>
            <small>{{ lessonTitle() }} · <b [class.is-ai]="ai()">{{ ai() ? t().ai.claude : t().ai.offline }}</b></small>
          </div>
          @if (messages().length) {
            <button type="button" class="icon-btn" (click)="clear()" [title]="t().ai.clear" [attr.aria-label]="t().ai.clear"><app-icon name="reset" /></button>
          }
          <button type="button" class="icon-btn" (click)="close()" [attr.aria-label]="t().close"><app-icon name="close" /></button>
        </header>

        <div class="assistant-body" #body aria-live="polite">
          <div class="msg is-assistant intro"><p>{{ t().ai.intro }}</p></div>
          @for (m of messages(); track $index) {
            <div class="msg" [class.is-user]="m.role === 'user'" [class.is-assistant]="m.role === 'assistant'" [class.is-error]="m.error">
              <div class="msg-body" [innerHTML]="m.html"></div>
              @if (m.source) { <span class="msg-source">{{ m.source === 'claude' ? t().ai.claude : t().ai.offline }}</span> }
            </div>
          }
          @if (loading()) { <div class="msg is-assistant typing"><i></i><i></i><i></i><span>{{ t().ai.thinking }}</span></div> }
        </div>

        <div class="assistant-chips">
          <button type="button" (click)="quick('explain')" [disabled]="loading()"><app-icon name="book" />{{ t().ai.explain }}</button>
          <button type="button" (click)="quick('debug')" [disabled]="loading()"><app-icon name="alert" />{{ t().ai.debug }}</button>
          <button type="button" (click)="quick('hint')" [disabled]="loading()"><app-icon name="target" />{{ t().ai.hint }}</button>
        </div>
        <form class="assistant-input" (submit)="$event.preventDefault(); send()">
          <textarea #input rows="2" maxlength="600" [placeholder]="t().ai.placeholder" [value]="draft()" (input)="draft.set($any($event.target).value)"
                    (keydown.enter)="onEnter($event)" [attr.aria-label]="t().ai.placeholder"></textarea>
          <button type="submit" class="send" [disabled]="loading() || !draft().trim()" [attr.aria-label]="t().ai.send"><app-icon name="send" /></button>
        </form>
      </aside>
    }
  `,
})
export class AssistantPanel implements AfterViewChecked {
  protected readonly ui = inject(UiState);
  private readonly http = inject(HttpClient);
  private readonly i18n = inject(I18n);
  private readonly learner = inject(LearnerService);
  private readonly store = inject(LessonStore);
  private readonly sim = inject(SimService);
  private readonly gamify = inject(GamificationService);
  protected readonly t = this.i18n.t;

  private readonly panel = viewChild<ElementRef<HTMLElement>>('panel');
  private readonly body = viewChild<ElementRef<HTMLElement>>('body');
  private readonly input = viewChild<ElementRef<HTMLTextAreaElement>>('input');

  protected readonly messages = signal<Message[]>([]);
  protected readonly loading = signal(false);
  protected readonly draft = signal('');
  protected readonly ai = signal(false);
  protected readonly lessonTitle = () => this.store.current()?.title ?? '';
  private statusChecked = false;
  private wasOpen = false;
  private scrollPending = false;

  constructor() {
    // A new lesson starts a new conversation.
    let slug = '';
    effect(() => {
      const s = this.store.current()?.slug ?? '';
      if (s !== slug) { slug = s; untracked(() => this.messages.set([])); }
    });
    effect(() => {
      const req = this.ui.assistantRequest();
      if (req && this.ui.assistantOpen()) untracked(() => { this.ui.assistantRequest.set(null); this.quick(req.mode); });
    });
    effect(() => {
      if (this.ui.assistantOpen() && !this.statusChecked) {
        this.statusChecked = true;
        firstValueFrom(this.http.get<{ ai: boolean }>('/api/assistant/status')).then((r) => this.ai.set(r.ai)).catch(() => this.ai.set(false));
      }
    });
  }

  ngAfterViewChecked(): void {
    const open = !!this.panel();
    if (open && !this.wasOpen) {
      animateIn(this.panel()!.nativeElement, { x: 24 * (this.i18n.dir() === 'rtl' ? -1 : 1) });
      setTimeout(() => this.input()?.nativeElement.focus(), 50);
    }
    this.wasOpen = open;
    if (this.scrollPending && this.body()) {
      this.scrollPending = false;
      const el = this.body()!.nativeElement;
      el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
    }
  }

  protected close(): void { this.ui.assistantOpen.set(false); }
  protected clear(): void { this.messages.set([]); }

  protected onEnter(e: Event): void {
    const k = e as KeyboardEvent;
    if (k.shiftKey) return;
    e.preventDefault();
    this.send();
  }

  protected quick(mode: AssistantMode): void {
    const labels = { explain: this.t().ai.explain, debug: this.t().ai.debug, hint: this.t().ai.hint, ask: '' };
    void this.ask(mode, '', labels[mode]);
  }

  protected send(): void {
    const q = this.draft().trim();
    if (!q || this.loading()) return;
    this.draft.set('');
    void this.ask('ask', q, q);
  }

  private async ask(mode: AssistantMode, question: string, shown: string): Promise<void> {
    const token = this.learner.currentToken;
    const lesson = this.store.current();
    if (!token || !lesson) return;
    const esc = shown.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    this.push({ role: 'user', html: `<p>${esc}</p>` });
    this.loading.set(true);
    try {
      const serial = this.sim.serial().filter((l) => l.kind !== 'sys').slice(-25).map((l) => l.text).join('\n');
      const res = await firstValueFrom(this.http.post<{ answer: string; source: 'claude' | 'local' }>('/api/assistant', {
        token, lesson: lesson.slug, locale: this.i18n.locale(), mode, question,
        code: this.ui.editorCode().slice(0, 8000), error: this.sim.lastError().slice(0, 600), serial: serial.slice(-2000),
      }));
      this.push({ role: 'assistant', html: renderMarkdown(res.answer), source: res.source });
      this.gamify.afterCompletion();
    } catch (e) {
      const msg = e instanceof HttpErrorResponse && e.status === 429 ? this.t().ai.rate : this.t().ai.error;
      this.push({ role: 'assistant', html: `<p>${msg}</p>`, error: true });
    } finally {
      this.loading.set(false);
    }
  }

  private push(m: Message): void {
    this.messages.update((list) => [...list, m]);
    this.scrollPending = true;
  }
}
