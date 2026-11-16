/**
 * A tiny interpreter for the subset of Arduino C++ used by the lessons:
 * globals, arrays, functions, if/else, for/while/do, ternaries, int/float
 * arithmetic, Serial, digital/analog I/O, tone, pulseIn, Servo and Stepper.
 * Execution is async so delay() really waits and the UI stays responsive.
 */

export class SketchError extends Error {
  constructor(message: string, public line: number) { super(message); }
}
class Abort extends Error {}
class BreakSignal {}
class ContinueSignal {}
class ReturnSignal { constructor(public value: Val) {} }

/** Float values are boxed so int/float semantics (e.g. 7 / 2) match C. */
export class F { constructor(public v: number) {} }
type Obj = { __kind: 'servo' | 'stepper'; [k: string]: unknown };
type Val = number | F | string | Val[] | Obj | undefined;

export interface Hardware {
  pinMode(pin: number, mode: number): void;
  digitalWrite(pin: number, value: number): void;
  analogWrite(pin: number, value: number): void;
  digitalRead(pin: number): number;
  analogRead(pin: number): number;
  print(text: string, newline: boolean): void;
  tone(pin: number, freq: number, duration?: number): void;
  noTone(pin: number): void;
  pulseIn(pin: number, level: number): number;
  servoWrite(pin: number, angle: number): void;
  stepperStep(steps: number, stepsPerRev: number, rpm: number): number; // returns duration ms
  line(line: number): void;
}

/** Debugger controls shared between the UI and a running interpreter. */
export interface DebugControls {
  breakpoints: Set<number>;
  /** Simulation speed multiplier for delay() (1 = real time). */
  speed: number;
  /** Called when execution pauses on a line (breakpoint, step or pause request). */
  onPause(line: number): void;
}

export interface WatchEntry { name: string; type: string; value: string; }

// ───────────────────────── Tokenizer ─────────────────────────
type TokType = 'num' | 'str' | 'chr' | 'id' | 'op' | 'eof';
interface Tok { t: TokType; v: string; line: number; float?: boolean; }

const OPS = ['<<=', '>>=', '++', '--', '+=', '-=', '*=', '/=', '%=', '&=', '|=', '^=', '==', '!=', '<=', '>=', '&&', '||', '<<', '>>', '::',
  '+', '-', '*', '/', '%', '<', '>', '=', '!', '&', '|', '^', '~', '?', ':', ';', ',', '(', ')', '{', '}', '[', ']', '.'];

function tokenize(src: string): Tok[] {
  const out: Tok[] = [];
  let i = 0, line = 1;
  while (i < src.length) {
    const c = src[i];
    if (c === '\n') { line++; i++; continue; }
    if (/\s/.test(c)) { i++; continue; }
    if (c === '/' && src[i + 1] === '/') { while (i < src.length && src[i] !== '\n') i++; continue; }
    if (c === '/' && src[i + 1] === '*') {
      i += 2;
      while (i < src.length && !(src[i] === '*' && src[i + 1] === '/')) { if (src[i] === '\n') line++; i++; }
      i += 2; continue;
    }
    if (c === '#') { while (i < src.length && src[i] !== '\n') i++; continue; }
    if (/[0-9]/.test(c) || (c === '.' && /[0-9]/.test(src[i + 1] ?? ''))) {
      const m = /^(0x[0-9a-fA-F]+|0b[01]+|[0-9]*\.?[0-9]+(?:[eE][-+]?[0-9]+)?)([uUlLfF]*)/.exec(src.slice(i))!;
      const text = m[1];
      out.push({ t: 'num', v: text, line, float: /[.eE]/.test(text) && !text.startsWith('0x') || /f/i.test(m[2]) });
      i += m[0].length; continue;
    }
    if (c === '"' || c === '\'') {
      let j = i + 1, s = '';
      while (j < src.length && src[j] !== c) {
        if (src[j] === '\\') { const n = src[j + 1]; s += n === 'n' ? '\n' : n === 't' ? '\t' : n; j += 2; continue; }
        if (src[j] === '\n') throw new SketchError('missing terminating quote', line);
        s += src[j++];
      }
      if (j >= src.length) throw new SketchError('missing terminating quote', line);
      out.push({ t: c === '"' ? 'str' : 'chr', v: s, line });
      i = j + 1; continue;
    }
    if (/[A-Za-z_]/.test(c)) {
      const m = /^[A-Za-z_][A-Za-z0-9_]*/.exec(src.slice(i))!;
      out.push({ t: 'id', v: m[0], line });
      i += m[0].length; continue;
    }
    const op = OPS.find((o) => src.startsWith(o, i));
    if (!op) throw new SketchError(`stray '${c}' in program`, line);
    out.push({ t: 'op', v: op, line });
    i += op.length;
  }
  out.push({ t: 'eof', v: '', line });
  return out;
}

// ───────────────────────── AST ─────────────────────────
type Node =
  | { k: 'num'; v: number; float: boolean; line: number }
  | { k: 'str'; v: string; line: number }
  | { k: 'id'; name: string; line: number }
  | { k: 'list'; items: Node[]; line: number }
  | { k: 'bin'; op: string; a: Node; b: Node; line: number }
  | { k: 'un'; op: string; a: Node; line: number }
  | { k: 'post'; op: string; a: Node; line: number }
  | { k: 'assign'; op: string; target: Node; value: Node; line: number }
  | { k: 'tern'; c: Node; a: Node; b: Node; line: number }
  | { k: 'call'; callee: Node; args: Node[]; line: number }
  | { k: 'index'; a: Node; i: Node; line: number }
  | { k: 'member'; a: Node; name: string; line: number }
  | { k: 'cast'; type: string; a: Node; line: number };

interface Decl { name: string; type: string; isArray: boolean; size?: Node; init?: Node; ctorArgs?: Node[]; line: number; }
type Stmt =
  | { k: 'decl'; decls: Decl[]; line: number }
  | { k: 'expr'; e: Node; line: number }
  | { k: 'block'; body: Stmt[]; line: number }
  | { k: 'if'; c: Node; a: Stmt; b?: Stmt; line: number }
  | { k: 'for'; init?: Stmt; c?: Node; step?: Node; body: Stmt; line: number }
  | { k: 'while'; c: Node; body: Stmt; line: number }
  | { k: 'do'; c: Node; body: Stmt; line: number }
  | { k: 'return'; e?: Node; line: number }
  | { k: 'break'; line: number }
  | { k: 'continue'; line: number }
  | { k: 'empty'; line: number };

interface Fn { name: string; type: string; params: { name: string; type: string }[]; body: Stmt; line: number; }

const TYPES = new Set(['void', 'int', 'long', 'short', 'float', 'double', 'bool', 'boolean', 'byte', 'char', 'unsigned', 'signed', 'String', 'Servo', 'Stepper', 'uint8_t', 'uint16_t', 'uint32_t', 'int8_t', 'int16_t', 'int32_t', 'size_t', 'word']);
const QUALIFIERS = new Set(['const', 'static', 'volatile']);

// ───────────────────────── Parser ─────────────────────────
class Parser {
  private p = 0;
  constructor(private toks: Tok[]) {}

  private get cur(): Tok { return this.toks[this.p]; }
  private peek(n = 1): Tok { return this.toks[Math.min(this.p + n, this.toks.length - 1)]; }
  private is(v: string): boolean { return (this.cur.t === 'op' || this.cur.t === 'id') && this.cur.v === v; }
  private eat(v: string): boolean { if (this.is(v)) { this.p++; return true; } return false; }
  private expect(v: string): Tok {
    if (!this.is(v)) {
      const where = this.cur.t === 'eof' ? 'end of input' : `'${this.cur.v}'`;
      throw new SketchError(`expected '${v}' before ${where}`, this.cur.t === 'eof' ? this.toks[Math.max(0, this.p - 1)].line : this.cur.line);
    }
    return this.toks[this.p++];
  }
  private ident(): Tok {
    if (this.cur.t !== 'id') throw new SketchError(`expected identifier before '${this.cur.v}'`, this.cur.line);
    return this.toks[this.p++];
  }

  private atType(): boolean {
    let q = this.p;
    while (this.toks[q].t === 'id' && QUALIFIERS.has(this.toks[q].v)) q++;
    return this.toks[q].t === 'id' && TYPES.has(this.toks[q].v);
  }
  private parseType(): string {
    while (this.cur.t === 'id' && QUALIFIERS.has(this.cur.v)) this.p++;
    let type = this.ident().v;
    while (this.cur.t === 'id' && TYPES.has(this.cur.v) && (type === 'unsigned' || type === 'signed' || type === 'long')) type = this.ident().v;
    if (type === 'unsigned' || type === 'signed') type = 'int';
    return type;
  }

  program(): { globals: Stmt[]; fns: Map<string, Fn> } {
    const globals: Stmt[] = [];
    const fns = new Map<string, Fn>();
    while (this.cur.t !== 'eof') {
      if (this.eat(';')) continue;
      if (!this.atType()) throw new SketchError(`'${this.cur.v}' does not name a type`, this.cur.line);
      const save = this.p;
      const line = this.cur.line;
      const type = this.parseType();
      const name = this.ident();
      if (this.is('(') && (this.peek().v === ')' || this.isParamStart())) {
        this.expect('(');
        const params: { name: string; type: string }[] = [];
        if (!this.is(')')) {
          if (this.is('void') && this.peek().v === ')') this.p++;
          else do {
            const pt = this.parseType();
            const pn = this.ident().v;
            if (this.eat('[')) this.expect(']');
            params.push({ name: pn, type: pt });
          } while (this.eat(','));
        }
        this.expect(')');
        if (this.eat(';')) continue; // prototype
        if (!this.is('{')) throw new SketchError(`expected '{' before '${this.cur.v}'`, this.cur.line);
        if (fns.has(name.v)) throw new SketchError(`redefinition of '${type} ${name.v}()'`, line);
        fns.set(name.v, { name: name.v, type, params, body: this.block(), line });
      } else {
        this.p = save;
        globals.push(this.declaration());
      }
    }
    return { globals, fns };
  }

  private isParamStart(): boolean {
    let q = this.p + 1;
    while (this.toks[q].t === 'id' && QUALIFIERS.has(this.toks[q].v)) q++;
    return this.toks[q].t === 'id' && TYPES.has(this.toks[q].v);
  }

  private declaration(): Stmt {
    const line = this.cur.line;
    const type = this.parseType();
    const decls: Decl[] = [];
    do {
      const name = this.ident();
      const d: Decl = { name: name.v, type, isArray: false, line: name.line };
      if (this.eat('[')) {
        d.isArray = true;
        if (!this.is(']')) d.size = this.expr();
        this.expect(']');
      }
      if (this.eat('=')) d.init = this.is('{') ? this.initList() : this.assign();
      else if (this.is('(')) {
        this.p++;
        d.ctorArgs = [];
        if (!this.is(')')) do { d.ctorArgs.push(this.assign()); } while (this.eat(','));
        this.expect(')');
      }
      decls.push(d);
    } while (this.eat(','));
    this.expect(';');
    return { k: 'decl', decls, line };
  }

  private initList(): Node {
    const line = this.expect('{').line;
    const items: Node[] = [];
    if (!this.is('}')) do { if (this.is('}')) break; items.push(this.is('{') ? this.initList() : this.assign()); } while (this.eat(','));
    this.expect('}');
    return { k: 'list', items, line };
  }

  private block(): Stmt {
    const line = this.expect('{').line;
    const body: Stmt[] = [];
    while (!this.is('}')) {
      if (this.cur.t === 'eof') throw new SketchError(`expected '}' at end of input`, this.toks[this.p - 1].line);
      body.push(this.statement());
    }
    this.expect('}');
    return { k: 'block', body, line };
  }

  private statement(): Stmt {
    const line = this.cur.line;
    if (this.is('{')) return this.block();
    if (this.eat(';')) return { k: 'empty', line };
    if (this.eat('if')) {
      this.expect('('); const c = this.expr(); this.expect(')');
      const a = this.statement();
      const b = this.eat('else') ? this.statement() : undefined;
      return { k: 'if', c, a, b, line };
    }
    if (this.eat('for')) {
      this.expect('(');
      let init: Stmt | undefined;
      if (this.atType()) init = this.declaration();
      else if (!this.eat(';')) { init = { k: 'expr', e: this.expr(), line }; this.expect(';'); }
      const c = this.is(';') ? undefined : this.expr();
      this.expect(';');
      const step = this.is(')') ? undefined : this.expr();
      this.expect(')');
      return { k: 'for', init, c, step, body: this.statement(), line };
    }
    if (this.eat('while')) {
      this.expect('('); const c = this.expr(); this.expect(')');
      return { k: 'while', c, body: this.statement(), line };
    }
    if (this.eat('do')) {
      const body = this.statement();
      this.expect('while'); this.expect('('); const c = this.expr(); this.expect(')'); this.expect(';');
      return { k: 'do', c, body, line };
    }
    if (this.eat('return')) {
      const e = this.is(';') ? undefined : this.expr();
      this.expect(';');
      return { k: 'return', e, line };
    }
    if (this.eat('break')) { this.expect(';'); return { k: 'break', line }; }
    if (this.eat('continue')) { this.expect(';'); return { k: 'continue', line }; }
    if (this.atType()) return this.declaration();
    const e = this.expr();
    this.expect(';');
    return { k: 'expr', e, line };
  }

  expr(): Node {
    let e = this.assign();
    while (this.is(',')) { this.p++; const b = this.assign(); e = { k: 'bin', op: ',', a: e, b, line: e.line }; }
    return e;
  }

  private assign(): Node {
    const left = this.ternary();
    const ops = ['=', '+=', '-=', '*=', '/=', '%=', '&=', '|=', '^=', '<<=', '>>='];
    if (this.cur.t === 'op' && ops.includes(this.cur.v)) {
      const op = this.toks[this.p++].v;
      if (!['id', 'index', 'member'].includes(left.k)) throw new SketchError('lvalue required as left operand of assignment', left.line);
      return { k: 'assign', op, target: left, value: this.assign(), line: left.line };
    }
    return left;
  }

  private ternary(): Node {
    const c = this.binary(0);
    if (this.eat('?')) {
      const a = this.assign(); this.expect(':'); const b = this.assign();
      return { k: 'tern', c, a, b, line: c.line };
    }
    return c;
  }

  private static PREC: string[][] = [['||'], ['&&'], ['|'], ['^'], ['&'], ['==', '!='], ['<', '>', '<=', '>='], ['<<', '>>'], ['+', '-'], ['*', '/', '%']];

  private binary(level: number): Node {
    if (level >= Parser.PREC.length) return this.unary();
    let a = this.binary(level + 1);
    while (this.cur.t === 'op' && Parser.PREC[level].includes(this.cur.v)) {
      const op = this.toks[this.p++].v;
      const b = this.binary(level + 1);
      a = { k: 'bin', op, a, b, line: a.line };
    }
    return a;
  }

  private unary(): Node {
    const line = this.cur.line;
    if (this.cur.t === 'op' && ['!', '-', '+', '~', '++', '--'].includes(this.cur.v)) {
      const op = this.toks[this.p++].v;
      return { k: 'un', op, a: this.unary(), line };
    }
    // C-style cast: (int) x
    if (this.is('(') && this.peek().t === 'id' && TYPES.has(this.peek().v) && this.peek(2).v === ')') {
      this.p++; const type = this.ident().v; this.expect(')');
      return { k: 'cast', type, a: this.unary(), line };
    }
    return this.postfix();
  }

  private postfix(): Node {
    let e = this.primary();
    for (;;) {
      const line = this.cur.line;
      if (this.eat('(')) {
        const args: Node[] = [];
        if (!this.is(')')) do { args.push(this.assign()); } while (this.eat(','));
        this.expect(')');
        e = { k: 'call', callee: e, args, line: e.line };
      } else if (this.eat('[')) {
        const i = this.expr(); this.expect(']');
        e = { k: 'index', a: e, i, line };
      } else if (this.eat('.') || this.eat('::')) {
        e = { k: 'member', a: e, name: this.ident().v, line };
      } else if (this.is('++') || this.is('--')) {
        e = { k: 'post', op: this.toks[this.p++].v, a: e, line };
      } else return e;
    }
  }

  private primary(): Node {
    const t = this.cur;
    if (t.t === 'num') {
      this.p++;
      const v = t.v.startsWith('0b') ? parseInt(t.v.slice(2), 2) : Number(t.v);
      return { k: 'num', v, float: !!t.float, line: t.line };
    }
    if (t.t === 'str') { this.p++; return { k: 'str', v: t.v, line: t.line }; }
    if (t.t === 'chr') { this.p++; return { k: 'num', v: t.v.charCodeAt(0) || 0, float: false, line: t.line }; }
    if (t.t === 'id') {
      if (TYPES.has(t.v) && this.peek().v === '(') { // functional cast int(x) / String(x)
        this.p++;
        this.expect('('); const a = this.expr(); this.expect(')');
        return { k: 'cast', type: t.v, a, line: t.line };
      }
      this.p++;
      return { k: 'id', name: t.v, line: t.line };
    }
    if (this.eat('(')) { const e = this.expr(); this.expect(')'); return e; }
    if (t.t === 'eof') throw new SketchError(`expected expression at end of input`, this.toks[Math.max(0, this.p - 1)].line);
    throw new SketchError(`expected primary-expression before '${t.v}'`, t.line);
  }
}

// ───────────────────────── Runtime ─────────────────────────
interface Var { type: string; value: Val; isConst: boolean; }
class Scope {
  vars = new Map<string, Var>();
  constructor(public parent: Scope | null) {}
  find(name: string): Var | null {
    let s: Scope | null = this;
    while (s) { const v = s.vars.get(name); if (v) return v; s = s.parent; }
    return null;
  }
}

const CONSTANTS: Record<string, number> = {
  HIGH: 1, LOW: 0, INPUT: 0, OUTPUT: 1, INPUT_PULLUP: 2, LED_BUILTIN: 13, true: 1, false: 0,
  A0: 14, A1: 15, A2: 16, A3: 17, A4: 18, A5: 19, NULL: 0, PI: Math.PI,
};
const INT_TYPES = new Set(['int', 'long', 'short', 'byte', 'char', 'word', 'uint8_t', 'uint16_t', 'uint32_t', 'int8_t', 'int16_t', 'int32_t', 'size_t', 'unsigned']);
const FLOAT_TYPES = new Set(['float', 'double']);

const num = (v: Val): number => (v instanceof F ? v.v : typeof v === 'number' ? v : typeof v === 'string' ? Number(v) || 0 : 0);
const isF = (v: Val): v is F => v instanceof F;

function coerce(type: string, v: Val): Val {
  if (FLOAT_TYPES.has(type)) return new F(num(v));
  if (type === 'bool' || type === 'boolean') return num(v) ? 1 : 0;
  if (type === 'byte' || type === 'uint8_t') return Math.trunc(num(v)) & 0xff;
  if (type === 'int' || type === 'short' || type === 'int16_t') { const n = Math.trunc(num(v)) & 0xffff; return n > 0x7fff ? n - 0x10000 : n; }
  if (INT_TYPES.has(type)) return Math.trunc(num(v));
  return v;
}

export function formatValue(v: Val, digits = 2): string {
  if (v instanceof F) return v.v.toFixed(digits);
  if (typeof v === 'number') return String(Math.trunc(v));
  if (typeof v === 'string') return v;
  return String(v ?? '');
}

export interface CompiledSketch { globals: Stmt[]; fns: Map<string, Fn>; }

export function compile(source: string): CompiledSketch {
  const prog = new Parser(tokenize(source)).program();
  for (const required of ['setup', 'loop']) {
    if (!prog.fns.has(required)) throw new SketchError(`undefined reference to '${required}'`, 1);
  }
  return prog;
}

export class Interpreter {
  private aborted = false;
  private ops = 0;
  private lastYield = performance.now();
  private readonly global = new Scope(null);
  readonly start = performance.now();

  // ───────── debugger state ─────────
  private pauseRequested = false;
  private stepping = false;
  private resumeGate: (() => void) | null = null;
  private skipLine = 0;
  private lastLine = 0;

  constructor(private prog: CompiledSketch, private hw: Hardware, private dbg?: DebugControls) {}

  stop(): void {
    this.aborted = true;
    this.resumeGate?.();
  }

  get paused(): boolean { return !!this.resumeGate; }
  /** Pause at the next statement. */
  pause(): void { this.pauseRequested = true; }
  resume(): void { this.stepping = false; this.release(); }
  /** Run exactly one statement, then pause again. */
  step(): void { this.stepping = true; this.release(); }

  private release(): void {
    const go = this.resumeGate;
    this.resumeGate = null;
    this.skipLine = this.lastLine; // don't re-break on the line we're leaving
    go?.();
  }

  /** Breakpoint / step gate, evaluated before each statement. */
  private async gate(line: number): Promise<void> {
    if (!this.dbg) return;
    const hitBreakpoint = this.dbg.breakpoints.has(line) && line !== this.skipLine;
    if (line !== this.skipLine) this.skipLine = 0;
    if (!(this.pauseRequested || this.stepping || hitBreakpoint)) return;
    this.pauseRequested = false;
    this.stepping = false;
    this.lastLine = line;
    this.hw.line(line);
    this.dbg.onPause(line);
    await new Promise<void>((resolve) => (this.resumeGate = resolve));
    if (this.aborted) throw new Abort();
    this.lastYield = performance.now();
  }

  /** Current values of the sketch's global variables (for the watch panel). */
  globals(): WatchEntry[] {
    const out: WatchEntry[] = [];
    for (const [name, v] of this.global.vars) {
      let value: string;
      if (Array.isArray(v.value)) value = `{${(v.value as Val[]).map((x) => formatValue(x)).join(', ')}}`;
      else if (v.value && typeof v.value === 'object' && !(v.value instanceof F)) value = (v.value as Obj).__kind === 'servo' ? `Servo(${(v.value as Obj)['angle']}°)` : 'Stepper';
      else value = formatValue(v.value as Val);
      out.push({ name, type: v.type, value });
    }
    return out;
  }

  async run(): Promise<void> {
    for (const g of this.prog.globals) await this.exec(g, this.global);
    await this.callFn('setup', [], 0);
    while (!this.aborted) {
      await this.callFn('loop', [], 0);
      await this.yieldNow(true);
    }
  }

  /** Waits that respect stop(). */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve, reject) => {
      if (this.aborted) return reject(new Abort());
      const end = performance.now() + Math.max(0, ms) / Math.max(0.05, this.dbg?.speed ?? 1);
      const step = () => {
        if (this.aborted) return reject(new Abort());
        const left = end - performance.now();
        if (left <= 0) { this.lastYield = performance.now(); resolve(); } else setTimeout(step, Math.min(left, 50));
      };
      step();
    });
  }

  private async yieldNow(force = false): Promise<void> {
    if (this.aborted) throw new Abort();
    if (force || ++this.ops % 64 === 0) {
      if (force || performance.now() - this.lastYield > 12) {
        await new Promise((r) => setTimeout(r, force ? 1 : 0));
        this.lastYield = performance.now();
        if (this.aborted) throw new Abort();
      }
    }
  }

  private async exec(s: Stmt, scope: Scope): Promise<void> {
    await this.yieldNow();
    if (s.k !== 'block' && s.k !== 'empty') await this.gate(s.line);
    switch (s.k) {
      case 'empty': return;
      case 'block': {
        const inner = new Scope(scope);
        for (const st of s.body) await this.exec(st, inner);
        return;
      }
      case 'decl':
        this.hw.line(s.line);
        for (const d of s.decls) {
          if (scope.vars.has(d.name)) throw new SketchError(`redeclaration of '${d.name}'`, d.line);
          let value: Val;
          if (d.type === 'Servo') value = { __kind: 'servo', pin: -1, angle: 90 };
          else if (d.type === 'Stepper') {
            const args = await this.evalArgs(d.ctorArgs ?? [], scope);
            value = { __kind: 'stepper', steps: num(args[0]) || 200, rpm: 10 };
          } else if (d.isArray) {
            const size = d.size ? num(await this.eval(d.size, scope)) : 0;
            const items = d.init && d.init.k === 'list' ? await Promise.all(d.init.items.map((n) => this.eval(n, scope))) : [];
            const len = Math.max(size, items.length);
            value = Array.from({ length: len }, (_, i) => coerce(d.type, items[i] ?? 0));
          } else {
            value = d.init ? coerce(d.type, await this.eval(d.init, scope)) : coerce(d.type, 0);
            if (d.type === 'String') value = d.init ? formatValue(await this.eval(d.init, scope)) : '';
          }
          scope.vars.set(d.name, { type: d.type, value, isConst: false });
        }
        return;
      case 'expr':
        this.hw.line(s.line);
        await this.eval(s.e, scope);
        return;
      case 'if':
        this.hw.line(s.line);
        if (num(await this.eval(s.c, scope))) await this.exec(s.a, new Scope(scope));
        else if (s.b) await this.exec(s.b, new Scope(scope));
        return;
      case 'for': {
        const fs = new Scope(scope);
        if (s.init) await this.exec(s.init, fs);
        for (;;) {
          this.hw.line(s.line);
          if (s.c && !num(await this.eval(s.c, fs))) break;
          try { await this.exec(s.body, new Scope(fs)); } catch (e) {
            if (e instanceof BreakSignal) break;
            if (!(e instanceof ContinueSignal)) throw e;
          }
          if (s.step) await this.eval(s.step, fs);
          await this.yieldNow();
        }
        return;
      }
      case 'while':
      case 'do': {
        let first = s.k === 'do';
        for (;;) {
          this.hw.line(s.line);
          if (!first && !num(await this.eval(s.c, scope))) break;
          first = false;
          try { await this.exec(s.body, new Scope(scope)); } catch (e) {
            if (e instanceof BreakSignal) break;
            if (!(e instanceof ContinueSignal)) throw e;
          }
          await this.yieldNow(true);
        }
        return;
      }
      case 'return':
        this.hw.line(s.line);
        throw new ReturnSignal(s.e ? await this.eval(s.e, scope) : undefined);
      case 'break': throw new BreakSignal();
      case 'continue': throw new ContinueSignal();
    }
  }

  private async evalArgs(args: Node[], scope: Scope): Promise<Val[]> {
    const out: Val[] = [];
    for (const a of args) out.push(await this.eval(a, scope));
    return out;
  }

  private ref(n: Node, scope: Scope): Promise<{ get(): Val; set(v: Val): void; type: string }> | { get(): Val; set(v: Val): void; type: string } {
    if (n.k === 'id') {
      const v = scope.find(n.name);
      if (!v) throw new SketchError(`'${n.name}' was not declared in this scope`, n.line);
      return { get: () => v.value, set: (x) => { v.value = coerce(v.type, x); }, type: v.type };
    }
    if (n.k === 'index') {
      return (async () => {
        const arrRef = await this.ref(n.a, scope);
        const arr = arrRef.get();
        if (!Array.isArray(arr)) throw new SketchError('subscripted value is not an array', n.line);
        const i = Math.trunc(num(await this.eval(n.i, scope)));
        if (i < 0 || i >= arr.length) throw new SketchError(`index ${i} is out of bounds for array of size ${arr.length}`, n.line);
        return { get: () => arr[i], set: (x: Val) => { arr[i] = coerce(arrRef.type, x); }, type: arrRef.type };
      })();
    }
    throw new SketchError('lvalue required', n.line);
  }

  private async eval(n: Node, scope: Scope): Promise<Val> {
    switch (n.k) {
      case 'num': return n.float ? new F(n.v) : n.v;
      case 'str': return n.v;
      case 'list': return Promise.all(n.items.map((i) => this.eval(i, scope)));
      case 'id': {
        const v = scope.find(n.name);
        if (v) return v.value;
        if (n.name in CONSTANTS) return CONSTANTS[n.name];
        throw new SketchError(`'${n.name}' was not declared in this scope`, n.line);
      }
      case 'cast': {
        const v = await this.eval(n.a, scope);
        if (n.type === 'String') return formatValue(v);
        return coerce(n.type, v);
      }
      case 'tern': return num(await this.eval(n.c, scope)) ? this.eval(n.a, scope) : this.eval(n.b, scope);
      case 'un': {
        if (n.op === '++' || n.op === '--') {
          const r = await this.ref(n.a, scope);
          const v = num(r.get()) + (n.op === '++' ? 1 : -1);
          r.set(isF(r.get()) ? new F(v) : v);
          return r.get();
        }
        const v = await this.eval(n.a, scope);
        if (n.op === '!') return num(v) ? 0 : 1;
        if (n.op === '~') return ~num(v);
        if (n.op === '-') return isF(v) ? new F(-v.v) : -num(v);
        return v;
      }
      case 'post': {
        const r = await this.ref(n.a, scope);
        const old = r.get();
        const v = num(old) + (n.op === '++' ? 1 : -1);
        r.set(isF(old) ? new F(v) : v);
        return old;
      }
      case 'assign': {
        const r = await this.ref(n.target, scope);
        let v = await this.eval(n.value, scope);
        if (n.op !== '=') v = this.binop(n.op.slice(0, -1), r.get(), v, n.line);
        r.set(v);
        return r.get();
      }
      case 'bin': {
        if (n.op === '&&') return num(await this.eval(n.a, scope)) && num(await this.eval(n.b, scope)) ? 1 : 0;
        if (n.op === '||') return num(await this.eval(n.a, scope)) || num(await this.eval(n.b, scope)) ? 1 : 0;
        if (n.op === ',') { await this.eval(n.a, scope); return this.eval(n.b, scope); }
        return this.binop(n.op, await this.eval(n.a, scope), await this.eval(n.b, scope), n.line);
      }
      case 'index': return (await this.ref(n, scope)).get();
      case 'member': throw new SketchError(`invalid use of member '${n.name}'`, n.line);
      case 'call': return this.call(n, scope);
    }
  }

  private binop(op: string, a: Val, b: Val, line: number): Val {
    if ((typeof a === 'string' || typeof b === 'string') && op === '+') return formatValue(a) + formatValue(b);
    const fl = isF(a) || isF(b);
    const x = num(a), y = num(b);
    switch (op) {
      case '+': return fl ? new F(x + y) : x + y;
      case '-': return fl ? new F(x - y) : x - y;
      case '*': return fl ? new F(x * y) : x * y;
      case '/':
        if (y === 0 && !fl) throw new SketchError('division by zero', line);
        return fl ? new F(x / y) : Math.trunc(x / y);
      case '%': if (y === 0) throw new SketchError('division by zero', line); return Math.trunc(x) % Math.trunc(y);
      case '<': return x < y ? 1 : 0;
      case '>': return x > y ? 1 : 0;
      case '<=': return x <= y ? 1 : 0;
      case '>=': return x >= y ? 1 : 0;
      case '==': return x === y ? 1 : 0;
      case '!=': return x !== y ? 1 : 0;
      case '&': return x & y;
      case '|': return x | y;
      case '^': return x ^ y;
      case '<<': return x << y;
      case '>>': return x >> y;
    }
    throw new SketchError(`unknown operator '${op}'`, line);
  }

  private async call(n: Extract<Node, { k: 'call' }>, scope: Scope): Promise<Val> {
    const args = await this.evalArgs(n.args, scope);
    const a = (i: number) => num(args[i]);
    const hw = this.hw;
    if (n.callee.k === 'member') {
      const target = n.callee.a;
      const method = n.callee.name;
      if (target.k === 'id' && target.name === 'Serial') {
        if (method === 'begin' || method === 'flush' || method === 'end') return 0;
        if (method === 'print' || method === 'println') {
          const text = args.length ? formatValue(args[0], args.length > 1 ? a(1) : 2) : '';
          hw.print(text, method === 'println');
          return text.length;
        }
        if (method === 'available' || method === 'read') return method === 'read' ? -1 : 0;
        throw new SketchError(`'class HardwareSerial' has no member named '${method}'`, n.line);
      }
      const obj = (await this.ref(target, scope)).get() as Obj;
      if (obj?.__kind === 'servo') {
        if (method === 'attach') { obj['pin'] = a(0); return 1; }
        if (method === 'write') { const ang = Math.max(0, Math.min(180, a(0))); obj['angle'] = ang; hw.servoWrite(obj['pin'] as number, ang); return 0; }
        if (method === 'read') return obj['angle'] as number;
        if (method === 'detach') return 0;
      }
      if (obj?.__kind === 'stepper') {
        if (method === 'setSpeed') { obj['rpm'] = Math.max(1, a(0)); return 0; }
        if (method === 'step') { const ms = hw.stepperStep(a(0), obj['steps'] as number, obj['rpm'] as number); await this.sleep(ms); return 0; }
      }
      throw new SketchError(`no member named '${method}'`, n.line);
    }
    if (n.callee.k !== 'id') throw new SketchError('expression cannot be used as a function', n.line);
    const name = n.callee.name;
    const user = this.prog.fns.get(name);
    if (user) return this.callFn(name, args, n.line);
    const need = (k: number) => { if (args.length < k) throw new SketchError(`too few arguments to function '${name}'`, n.line); };
    switch (name) {
      case 'pinMode': need(2); hw.pinMode(a(0), a(1)); return 0;
      case 'digitalWrite': need(2); hw.digitalWrite(a(0), a(1) ? 1 : 0); return 0;
      case 'digitalRead': need(1); return hw.digitalRead(a(0));
      case 'analogRead': need(1); return hw.analogRead(a(0) < 14 ? a(0) + 14 : a(0));
      case 'analogWrite': need(2); hw.analogWrite(a(0), Math.max(0, Math.min(255, Math.trunc(a(1))))); return 0;
      case 'delay': need(1); await this.sleep(a(0)); return 0;
      case 'delayMicroseconds': need(1); await this.sleep(a(0) / 1000); return 0;
      case 'millis': return Math.trunc(performance.now() - this.start);
      case 'micros': return Math.trunc((performance.now() - this.start) * 1000);
      case 'map': need(5); { const [x, i0, i1, o0, o1] = [a(0), a(1), a(2), a(3), a(4)]; return i1 === i0 ? o0 : Math.trunc(((x - i0) * (o1 - o0)) / (i1 - i0) + o0); }
      case 'constrain': need(3); { const v = Math.min(Math.max(a(0), a(1)), a(2)); return args.some(isF) ? new F(v) : v; }
      case 'min': need(2); return args.some(isF) ? new F(Math.min(a(0), a(1))) : Math.min(a(0), a(1));
      case 'max': need(2); return args.some(isF) ? new F(Math.max(a(0), a(1))) : Math.max(a(0), a(1));
      case 'abs': need(1); return isF(args[0]) ? new F(Math.abs(a(0))) : Math.abs(a(0));
      case 'sq': need(1); return isF(args[0]) ? new F(a(0) * a(0)) : a(0) * a(0);
      case 'sqrt': need(1); return new F(Math.sqrt(a(0)));
      case 'pow': need(2); return new F(Math.pow(a(0), a(1)));
      case 'sin': return new F(Math.sin(a(0)));
      case 'cos': return new F(Math.cos(a(0)));
      case 'random': return args.length >= 2 ? Math.floor(a(0) + Math.random() * (a(1) - a(0))) : Math.floor(Math.random() * a(0));
      case 'randomSeed': return 0;
      case 'tone': need(2); hw.tone(a(0), a(1), args.length > 2 ? a(2) : undefined); return 0;
      case 'noTone': need(1); hw.noTone(a(0)); return 0;
      case 'pulseIn': need(2); { const us = hw.pulseIn(a(0), a(1)); await this.sleep(us / 1000); return us; }
    }
    throw new SketchError(`'${name}' was not declared in this scope`, n.line);
  }

  private async callFn(name: string, args: Val[], line: number): Promise<Val> {
    const fn = this.prog.fns.get(name)!;
    if (args.length !== fn.params.length) throw new SketchError(`wrong number of arguments to '${name}'`, line || fn.line);
    const scope = new Scope(this.global);
    fn.params.forEach((p, i) => scope.vars.set(p.name, { type: p.type, value: Array.isArray(args[i]) ? args[i] : coerce(p.type, args[i]), isConst: false }));
    try {
      await this.exec(fn.body, scope);
    } catch (e) {
      if (e instanceof ReturnSignal) return fn.type === 'void' ? undefined : coerce(fn.type, e.value);
      throw e;
    }
    return undefined;
  }

  static isAbort(e: unknown): boolean { return e instanceof Abort; }
}
