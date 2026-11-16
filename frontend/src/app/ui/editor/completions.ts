/** Arduino API dictionary for editor autocomplete. */
export interface Completion {
  label: string;
  kind: 'fn' | 'const' | 'kw' | 'type' | 'var';
  /** Text inserted; `|` marks where the caret lands. */
  insert: string;
  detail: string;
}

const fn = (label: string, args: string, detail = `${label}(${args})`): Completion =>
  ({ label, kind: 'fn', insert: args ? `${label}(|)` : `${label}()|`, detail });
const c = (label: string, detail: string): Completion => ({ label, kind: 'const', insert: `${label}|`, detail });
const k = (label: string, insert = `${label} |`): Completion => ({ label, kind: 'kw', insert, detail: 'keyword' });
const t = (label: string): Completion => ({ label, kind: 'type', insert: `${label} |`, detail: 'type' });

export const ARDUINO_API: Completion[] = [
  fn('pinMode', 'pin, mode'), fn('digitalWrite', 'pin, value'), fn('digitalRead', 'pin'),
  fn('analogRead', 'pin'), fn('analogWrite', 'pin, 0–255'), fn('delay', 'ms'), fn('delayMicroseconds', 'µs'),
  fn('millis', ''), fn('micros', ''), fn('map', 'value, fromLow, fromHigh, toLow, toHigh'),
  fn('constrain', 'x, a, b'), fn('min', 'a, b'), fn('max', 'a, b'), fn('abs', 'x'), fn('random', 'min, max'),
  fn('tone', 'pin, frequency, duration'), fn('noTone', 'pin'), fn('pulseIn', 'pin, HIGH'),
  { label: 'Serial.begin', kind: 'fn', insert: 'Serial.begin(9600);|', detail: 'Serial.begin(baud)' },
  { label: 'Serial.print', kind: 'fn', insert: 'Serial.print(|);', detail: 'Serial.print(value)' },
  { label: 'Serial.println', kind: 'fn', insert: 'Serial.println(|);', detail: 'Serial.println(value)' },
  c('HIGH', '5 V / true'), c('LOW', '0 V / false'), c('INPUT', 'pin mode'), c('OUTPUT', 'pin mode'),
  c('INPUT_PULLUP', 'pin mode with internal pull-up'), c('LED_BUILTIN', 'pin 13'),
  c('A0', 'analog pin'), c('A1', 'analog pin'), c('A2', 'analog pin'), c('A3', 'analog pin'), c('A4', 'analog pin'), c('A5', 'analog pin'),
  k('if', 'if (|) {\n}'), k('else', 'else {\n  |\n}'), k('for', 'for (int i = 0; i < |; i++) {\n}'), k('while', 'while (|) {\n}'),
  k('return'), k('const'), k('void'),
  t('int'), t('long'), t('float'), t('bool'), t('byte'), t('String'),
];

/** Identifiers declared in the sketch (variables, constants, functions). */
export function sketchSymbols(code: string): Completion[] {
  const seen = new Set<string>();
  const out: Completion[] = [];
  const re = /\b(?:int|long|float|double|bool|boolean|byte|char|String|Servo|Stepper|void|unsigned)\s+([A-Za-z_]\w*)\s*(\(|\[|=|;|,)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(code))) {
    const name = m[1];
    if (seen.has(name) || ['setup', 'loop'].includes(name)) continue;
    seen.add(name);
    out.push(m[2] === '(' ? { label: name, kind: 'fn', insert: `${name}(|)`, detail: 'your function' } : { label: name, kind: 'var', insert: `${name}|`, detail: 'your variable' });
  }
  return out;
}

export function suggest(prefix: string, code: string, limit = 8, minLength = 2): Completion[] {
  if (prefix.length < minLength) return [];
  const p = prefix.toLowerCase();
  const all = [...sketchSymbols(code), ...ARDUINO_API];
  const seen = new Set<string>();
  return all
    .filter((x) => x.label.toLowerCase().startsWith(p) && x.label !== prefix && !seen.has(x.label) && seen.add(x.label))
    .slice(0, limit);
}
