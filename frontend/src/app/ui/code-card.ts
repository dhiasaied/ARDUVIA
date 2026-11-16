import { ChangeDetectionStrategy, Component, ElementRef, computed, effect, inject, signal, viewChild } from '@angular/core';
import { I18n } from '../core/i18n';
import { LessonStore } from '../core/lesson.store';
import { SketchError, compile } from '../core/sim/interpreter';
import { SimService } from '../core/sim/sim.service';
import { UiState } from '../core/ui-state';
import { Completion, suggest } from './editor/completions';
import { Icon } from './icon';

const KW = new Set(['void', 'int', 'long', 'float', 'double', 'bool', 'boolean', 'byte', 'char', 'unsigned', 'const', 'static', 'if', 'else', 'for', 'while', 'do', 'return', 'break', 'continue', 'HIGH', 'LOW', 'INPUT', 'OUTPUT', 'INPUT_PULLUP', 'LED_BUILTIN', 'true', 'false', 'String', 'Servo', 'Stepper', 'A0', 'A1', 'A2', 'A3', 'A4', 'A5']);
const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const LINE_H = 19.5;
const PAIRS: Record<string, string> = { '(': ')', '[': ']', '"': '"', "'": "'" };

/** Lightweight Arduino syntax highlighter → HTML per line. */
export function highlight(code: string): string[] {
  return code.split('\n').map((line) => {
    let out = '';
    const re = /(\/\/.*$)|(#\w+.*$)|("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*')|(\b\d+(?:\.\d+)?\b)|([A-Za-z_]\w*)(?=\s*\()|([A-Za-z_]\w*)/g;
    let last = 0;
    let m: RegExpExecArray | null;
    while ((m = re.exec(line))) {
      out += esc(line.slice(last, m.index));
      const [tok] = m;
      if (m[1]) out += `<span class="cm">${esc(tok)}</span>`;
      else if (m[2]) out += `<span class="pp">${esc(tok)}</span>`;
      else if (m[3]) out += `<span class="str">${esc(tok)}</span>`;
      else if (m[4]) out += `<span class="num">${tok}</span>`;
      else if (m[5]) out += KW.has(tok) ? `<span class="kw">${tok}</span>` : ['setup', 'loop'].includes(tok) ? `<span class="id">${tok}</span>` : `<span class="fn">${tok}</span>`;
      else if (m[6]) out += KW.has(tok) ? `<span class="kw">${tok}</span>` : esc(tok);
      last = m.index + tok.length;
    }
    return out + esc(line.slice(last));
  });
}

const EDIT_KEY = 'arduvia.code.';
interface Diagnostic { line: number; message: string; }

@Component({
  selector: 'app-code-card',
  imports: [Icon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '[style.--console-h.px]': 'consoleH()' },
  template: `
    <section class="code-card" [class.is-expanded]="ui.codeExpanded()" [class.is-covered]="ui.infoExpanded()" [class.is-sizing]="sizing()"
             [attr.data-state]="sim.paused() ? 'paused' : sim.state()" [attr.aria-label]="t().code.title">
      <header>
        <h2>{{ t().code.title }} @if (edited()) { <small class="edited">· {{ t().code.edited }}</small> }</h2>
        <div class="code-actions">
          <button class="btn-ai" type="button" (click)="ui.openAssistant(sim.lastError() ? 'debug' : 'explain')" [attr.aria-label]="t().ai.open" [title]="t().ai.open">
            <app-icon name="sparkle" /><span>{{ t().ai.short }}</span>
          </button>
          @if (edited()) {
            <button class="btn-ghost" type="button" (click)="restore()" [attr.aria-label]="t().code.reset" [title]="t().code.reset"><app-icon name="undo" /></button>
          }
          <button class="btn-ghost btn-expand" type="button" (click)="ui.codeExpanded.set(!ui.codeExpanded())" [attr.aria-label]="t().code.expand" [title]="t().code.expand">
            <app-icon [name]="ui.codeExpanded() ? 'collapse' : 'expand'" />
          </button>
          <button class="btn-ghost btn-copy" type="button" (click)="copy()" [attr.aria-label]="t().code.copy" [title]="copied() ? t().code.copied : t().code.copy">
            <app-icon [name]="copied() ? 'check' : 'copy'" />
          </button>
          <button class="btn-run" type="button" [class.is-busy]="sim.state() === 'uploading'" (click)="toggleRun()"
                  [attr.aria-label]="sim.running() ? t().code.stop : t().code.run" [title]="(sim.running() ? t().code.stop : t().code.run) + ' (Ctrl+Enter)'">
            <app-icon [name]="sim.running() ? 'stop' : 'play'" />
          </button>
        </div>
      </header>
      <div class="code-wrap" dir="ltr">
        <div class="code-scroll" #scroller>
          <div class="code-grid">
            <div class="gutter" role="group" [attr.aria-label]="t().code.breakpoints">
              @for (n of lineNumbers(); track n) {
                <button type="button" tabindex="-1" [class.is-active]="n === sim.activeLine()" [class.is-error]="n === sim.errorLine() || n === diag()?.line"
                        [class.is-bp]="sim.breakpoints().has(n)" [class.is-paused]="sim.paused() && n === sim.activeLine()"
                        (click)="sim.toggleBreakpoint(n)" [title]="t().code.breakpointHint">{{ n }}</button>
              }
            </div>
            <div class="code-layers">
              <pre class="code" aria-hidden="true"><code>@for (l of lines(); track $index) {<span class="line" [class.is-active]="$index + 1 === sim.activeLine()" [class.is-error]="$index + 1 === sim.errorLine()" [class.is-diag]="$index + 1 === diag()?.line" [class.is-bp]="sim.breakpoints().has($index + 1)" [innerHTML]="l || ' '"></span>}</code></pre>
              <textarea #input class="code-input" spellcheck="false" autocapitalize="off" autocomplete="off" wrap="off"
                        [value]="code()" (input)="onInput($any($event.target))" (keydown)="onKey($event)" (blur)="closeSuggest()" (click)="closeSuggest()"
                        role="combobox" [attr.aria-expanded]="suggestions().length > 0" aria-autocomplete="list" [attr.aria-label]="t().code.title"></textarea>
              @if (suggestions().length) {
                <ul class="suggest" role="listbox" [style.top.px]="caret().top" [style.left.px]="caret().left">
                  @for (s of suggestions(); track s.label; let i = $index) {
                    <li role="option" [class.is-on]="i === suggestIndex()" [attr.aria-selected]="i === suggestIndex()" (mousedown)="$event.preventDefault(); accept(s)">
                      <i [attr.data-kind]="s.kind"></i><b>{{ s.label }}</b><small>{{ s.detail }}</small>
                    </li>
                  }
                </ul>
              }
            </div>
          </div>
        </div>
        <div class="diag-bar" [class.is-bad]="!!diag()" role="status">
          @if (diag(); as d) { <app-icon name="alert" /> {{ t().code.line }} {{ d.line }} · {{ d.message }} }
          @else { <app-icon name="check" /> {{ t().code.noProblems }} }
          <span class="diag-hint">{{ t().code.shortcuts }}</span>
        </div>
        <div class="console" [class.is-open]="consoleOpen()">
          <div class="console-grip" role="separator" tabindex="0" [attr.aria-label]="t().code.resize" (pointerdown)="startResize($event)" (keydown)="resizeKey($event)"></div>
          <div class="console-head" (pointerdown)="startResize($event)">
            <span class="console-dot"></span>
            <div class="console-tabs" role="tablist">
              <button type="button" role="tab" [class.is-on]="consoleTab() === 'serial'" [attr.aria-selected]="consoleTab() === 'serial'" (pointerdown)="$event.stopPropagation()" (click)="consoleTab.set('serial')">{{ t().code.serial }}</button>
              <button type="button" role="tab" [class.is-on]="consoleTab() === 'vars'" [attr.aria-selected]="consoleTab() === 'vars'" (pointerdown)="$event.stopPropagation()" (click)="consoleTab.set('vars')">{{ t().code.variables }}</button>
            </div>
            <span class="console-status">{{ statusText() }}</span>
            @if (sim.running()) {
              <div class="debug-bar" (pointerdown)="$event.stopPropagation()">
                @if (sim.paused()) {
                  <button type="button" (click)="sim.resume()" [title]="t().code.resume" [attr.aria-label]="t().code.resume"><app-icon name="play" /></button>
                  <button type="button" (click)="sim.step()" [title]="t().code.step" [attr.aria-label]="t().code.step"><app-icon name="stepOver" /></button>
                } @else {
                  <button type="button" (click)="sim.pause()" [title]="t().code.pause" [attr.aria-label]="t().code.pause"><app-icon name="pause" /></button>
                }
                <select [value]="sim.speed()" (change)="sim.setSpeed(+$any($event.target).value)" [attr.aria-label]="t().code.speed" [title]="t().code.speed">
                  @for (v of speeds; track v) { <option [value]="v" [selected]="v === sim.speed()">{{ v }}×</option> }
                </select>
              </div>
            }
            <button class="console-close" type="button" (pointerdown)="$event.stopPropagation()" (click)="closeConsole()" [attr.aria-label]="t().code.stop"><app-icon name="close" /></button>
          </div>
          @if (consoleTab() === 'serial') {
            <div class="console-lines" #consoleLines aria-live="polite">
              @for (l of sim.serial(); track $index) { <div [class]="'ln-' + l.kind">{{ l.text }}</div> }
            </div>
          } @else {
            <div class="console-lines watch">
              @if (sim.watch().length) {
                <table><tbody>
                  @for (w of sim.watch(); track w.name) { <tr><th>{{ w.name }}</th><td class="w-type">{{ w.type }}</td><td class="w-val">{{ w.value }}</td></tr> }
                </tbody></table>
              } @else { <p class="watch-empty">{{ t().code.noVariables }}</p> }
            </div>
          }
        </div>
      </div>
    </section>
  `,
})
export class CodeCard {
  protected readonly ui = inject(UiState);
  protected readonly sim = inject(SimService);
  private readonly store = inject(LessonStore);
  protected readonly t = inject(I18n).t;
  private readonly scroller = viewChild.required<ElementRef<HTMLDivElement>>('scroller');
  private readonly input = viewChild.required<ElementRef<HTMLTextAreaElement>>('input');
  private readonly consoleLines = viewChild<ElementRef<HTMLDivElement>>('consoleLines');
  protected readonly speeds = [0.25, 0.5, 1, 2];

  protected readonly code = signal('');
  protected readonly copied = signal(false);
  protected readonly consoleOpen = signal(false);
  protected readonly consoleTab = signal<'serial' | 'vars'>('serial');
  protected readonly consoleH = signal(92);
  protected readonly sizing = signal(false);
  protected readonly diag = signal<Diagnostic | null>(null);
  protected readonly suggestions = signal<Completion[]>([]);
  protected readonly suggestIndex = signal(0);
  protected readonly caret = signal({ top: 0, left: 0 });
  private prefix = '';
  private diagTimer: ReturnType<typeof setTimeout> | null = null;
  private charW = 0;

  protected readonly lines = computed(() => highlight(this.code()));
  protected readonly lineNumbers = computed(() => this.lines().map((_, i) => i + 1));
  protected readonly edited = computed(() => {
    const l = this.store.current();
    return !!l && this.code() !== l.code;
  });
  protected readonly statusText = computed(() => {
    const c = this.t().code;
    if (this.sim.paused()) return c.paused;
    return { idle: c.stopped, uploading: c.uploading, running: c.running, error: c.error }[this.sim.state()];
  });

  constructor() {
    effect(() => {
      const l = this.store.current();
      if (!l) return;
      let saved: string | null = null;
      try { saved = localStorage.getItem(EDIT_KEY + l.slug); } catch { /* ignore */ }
      this.code.set(saved ?? l.code);
      this.ui.editorCode.set(this.code());
      this.consoleOpen.set(false);
      this.sim.clearBreakpoints();
      this.diagnose();
    });
    effect(() => { if (this.sim.state() !== 'idle') this.consoleOpen.set(true); });
    effect(() => { if (this.sim.paused()) { this.consoleOpen.set(true); this.consoleTab.set('vars'); } });
    effect(() => {
      this.sim.serial();
      requestAnimationFrame(() => {
        const el = this.consoleLines()?.nativeElement;
        if (el) el.scrollTop = el.scrollHeight;
      });
    });
    // follow the executing line
    effect(() => {
      const n = this.sim.activeLine() || this.sim.errorLine();
      if (!n) return;
      const el = this.scroller().nativeElement;
      const y = (n - 1) * LINE_H;
      const visible = el.clientHeight - (this.consoleOpen() ? this.consoleH() : 0);
      if (y < el.scrollTop || y > el.scrollTop + visible - LINE_H * 2) el.scrollTo({ top: Math.max(0, y - visible / 3), behavior: 'smooth' });
    });
  }

  toggleRun(): void {
    const l = this.store.current();
    if (!l) return;
    if (this.sim.running()) this.sim.stop();
    else void this.sim.run(this.code(), l.slug);
  }

  // ───────── editing ─────────
  protected onInput(ta: HTMLTextAreaElement): void {
    this.setCode(ta.value);
    this.updateSuggestions(ta);
  }

  private setCode(value: string): void {
    this.code.set(value);
    this.ui.editorCode.set(value);
    const l = this.store.current();
    if (!l) return;
    try {
      if (value === l.code) localStorage.removeItem(EDIT_KEY + l.slug);
      else localStorage.setItem(EDIT_KEY + l.slug, value);
    } catch { /* ignore */ }
    if (this.sim.errorLine()) this.sim.errorLine.set(0);
    if (this.diagTimer) clearTimeout(this.diagTimer);
    this.diagTimer = setTimeout(() => this.diagnose(), 400);
  }

  /** Live diagnostics: compile in the background while typing. */
  private diagnose(): void {
    try {
      compile(this.code());
      this.diag.set(null);
    } catch (e) {
      this.diag.set({ line: e instanceof SketchError ? e.line : 1, message: e instanceof Error ? e.message : String(e) });
    }
  }

  protected onKey(e: KeyboardEvent): void {
    const ta = e.target as HTMLTextAreaElement;
    const list = this.suggestions();
    if (list.length) {
      if (e.key === 'ArrowDown') { e.preventDefault(); this.suggestIndex.set((this.suggestIndex() + 1) % list.length); return; }
      if (e.key === 'ArrowUp') { e.preventDefault(); this.suggestIndex.set((this.suggestIndex() - 1 + list.length) % list.length); return; }
      if (e.key === 'Enter' || e.key === 'Tab') { e.preventDefault(); this.accept(list[this.suggestIndex()]); return; }
      if (e.key === 'Escape') { e.preventDefault(); this.closeSuggest(); return; }
    }
    if (e.key === ' ' && e.ctrlKey) {
      e.preventDefault();
      this.updateSuggestions(ta, true);
    } else if (e.key === 'Tab') {
      e.preventDefault();
      ta.setRangeText('  ', ta.selectionStart, ta.selectionEnd, 'end');
      this.setCode(ta.value);
    } else if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      this.toggleRun();
    } else if (e.key === 'Enter') {
      const before = ta.value.slice(0, ta.selectionStart);
      const indent = /(^|\n)([ \t]*)[^\n]*$/.exec(before)?.[2] ?? '';
      const opens = before.trimEnd().endsWith('{');
      e.preventDefault();
      const after = ta.value.slice(ta.selectionEnd);
      if (opens && after.startsWith('}')) {
        ta.setRangeText('\n' + indent + '  \n' + indent, ta.selectionStart, ta.selectionEnd, 'start');
        ta.selectionStart = ta.selectionEnd = ta.selectionStart + indent.length + 3;
      } else {
        ta.setRangeText('\n' + indent + (opens ? '  ' : ''), ta.selectionStart, ta.selectionEnd, 'end');
      }
      this.setCode(ta.value);
    } else if (e.key in PAIRS && ta.selectionStart === ta.selectionEnd) {
      e.preventDefault();
      ta.setRangeText(e.key + PAIRS[e.key], ta.selectionStart, ta.selectionEnd, 'start');
      ta.selectionStart = ta.selectionEnd = ta.selectionStart + 1;
      this.setCode(ta.value);
    } else if (e.key === '{' && ta.selectionStart === ta.selectionEnd) {
      e.preventDefault();
      ta.setRangeText('{}', ta.selectionStart, ta.selectionEnd, 'start');
      ta.selectionStart = ta.selectionEnd = ta.selectionStart + 1;
      this.setCode(ta.value);
    } else if ((e.key === ')' || e.key === ']' || e.key === '}') && ta.value[ta.selectionStart] === e.key) {
      e.preventDefault();
      ta.selectionStart = ta.selectionEnd = ta.selectionStart + 1;
    }
  }

  private updateSuggestions(ta: HTMLTextAreaElement, force = false): void {
    const before = ta.value.slice(0, ta.selectionStart);
    const word = /[A-Za-z_][\w.]*$/.exec(before)?.[0] ?? '';
    this.prefix = word;
    const list = suggest(word, ta.value, 8, force ? 0 : 2);
    this.suggestions.set(list);
    this.suggestIndex.set(0);
    if (!list.length) return;
    const lines = before.split('\n');
    const col = lines[lines.length - 1].length - word.length;
    this.charW ||= this.measureChar(ta);
    this.caret.set({ top: lines.length * LINE_H + 2, left: 6 + col * this.charW });
  }

  protected accept(s: Completion): void {
    const ta = this.input().nativeElement;
    const end = ta.selectionStart;
    const start = end - this.prefix.length;
    const caretAt = s.insert.indexOf('|');
    const text = s.insert.replace('|', '');
    ta.setRangeText(text, start, end, 'end');
    ta.selectionStart = ta.selectionEnd = start + (caretAt >= 0 ? caretAt : text.length);
    ta.focus();
    this.closeSuggest();
    this.setCode(ta.value);
  }

  protected closeSuggest(): void {
    if (this.suggestions().length) this.suggestions.set([]);
  }

  private measureChar(ta: HTMLTextAreaElement): number {
    const ctx = document.createElement('canvas').getContext('2d');
    if (!ctx) return 8.2;
    ctx.font = getComputedStyle(ta).font;
    return ctx.measureText('MMMMMMMMMM').width / 10 || 8.2;
  }

  protected restore(): void {
    const l = this.store.current();
    if (!l) return;
    this.setCode(l.code);
    this.diagnose();
  }

  protected async copy(): Promise<void> {
    try {
      await navigator.clipboard.writeText(this.code());
    } catch {
      const ta = document.createElement('textarea');
      ta.value = this.code(); document.body.appendChild(ta); ta.select();
      document.execCommand('copy'); ta.remove();
    }
    this.copied.set(true);
    setTimeout(() => this.copied.set(false), 1400);
  }

  protected closeConsole(): void {
    this.sim.stop();
    this.consoleOpen.set(false);
  }

  /** Code currently in the editor (used by the assistant). */
  current(): string { return this.code(); }

  protected startResize(e: PointerEvent): void {
    e.preventDefault();
    const y0 = e.clientY, h0 = this.consoleH();
    const el = e.target as HTMLElement;
    const scale = el.getBoundingClientRect().height / el.offsetHeight || 1;
    this.sizing.set(true);
    const move = (ev: PointerEvent) => this.consoleH.set(Math.max(56, Math.min(260, h0 - (ev.clientY - y0) / scale)));
    const up = () => { this.sizing.set(false); window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up); };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  }

  protected resizeKey(e: KeyboardEvent): void {
    if (e.key === 'ArrowUp') this.consoleH.update((h) => Math.min(260, h + 12));
    if (e.key === 'ArrowDown') this.consoleH.update((h) => Math.max(56, h - 12));
  }
}
