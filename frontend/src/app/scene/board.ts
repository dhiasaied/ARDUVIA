import * as THREE from 'three';
import { Led, at, box, canvasTexture, cyl, led, mesh, part, shadow, toon } from './kit';

export const PCB_W = 6.86;
export const PCB_D = 5.34;
const PCB_Y = 0.14;            // standoff height
const PCB_T = 0.16;
export const PCB_TOP = PCB_Y + PCB_T;
const HEADER_H = 0.82;
const PITCH = 0.254;

const DIGITAL_A = ['SCL', 'SDA', 'AREF', 'GND2', 'D13', 'D12', 'D11', 'D10', 'D9', 'D8'];
const DIGITAL_B = ['D7', 'D6', 'D5', 'D4', 'D3', 'D2', 'D1', 'D0'];
const POWER = ['NC', 'IOREF', 'RESET', '3V3', '5V', 'GND', 'GND3', 'VIN'];
const ANALOG = ['A0', 'A1', 'A2', 'A3', 'A4', 'A5'];

interface Strip { names: string[]; x0: number; z: number; }
const STRIPS: Strip[] = [
  { names: DIGITAL_A, x0: -1.25, z: -PCB_D / 2 + 0.22 },
  { names: DIGITAL_B, x0: 1.42, z: -PCB_D / 2 + 0.22 },
  { names: POWER, x0: -0.62, z: PCB_D / 2 - 0.22 },
  { names: ANALOG, x0: 1.78, z: PCB_D / 2 - 0.22 },
];

export interface Board {
  group: THREE.Group;
  ledL: Led;
  ledOn: Led;
  ledTx: Led;
  ledRx: Led;
  /** World-space (relative to board group) position on top of a header socket. */
  pin(name: string): THREE.Vector3;
  anchors: Record<string, THREE.Vector3>;
}

let silkCache: THREE.CanvasTexture | null = null;
function silkscreen(): THREE.CanvasTexture {
  if (silkCache) return silkCache;
  const W = 1372, H = 1068; // 200 px per unit
  return (silkCache = canvasTexture(W, H, (g) => {
    const s = W / PCB_W;
    g.fillStyle = '#2c58a0';
    g.fillRect(0, 0, W, H);
    // subtle copper traces
    g.strokeStyle = 'rgba(120,170,235,0.22)';
    g.lineWidth = 6;
    for (let i = 0; i < 18; i++) {
      g.beginPath();
      const y = 180 + i * 42;
      g.moveTo(330, y); g.lineTo(560 + (i % 5) * 60, y); g.lineTo(640 + (i % 5) * 60, y + 60); g.lineTo(1150, y + 60);
      g.stroke();
    }
    g.fillStyle = '#ffffff';
    g.strokeStyle = '#ffffff';
    // ∞ logo
    g.lineWidth = 16;
    const lx = 760, ly = 520;
    g.beginPath(); g.ellipse(lx - 62, ly, 58, 46, 0, 0, Math.PI * 2); g.stroke();
    g.beginPath(); g.ellipse(lx + 62, ly, 58, 46, 0, 0, Math.PI * 2); g.stroke();
    g.lineWidth = 10;
    g.beginPath(); g.moveTo(lx - 86, ly); g.lineTo(lx - 38, ly); g.stroke();
    g.beginPath(); g.moveTo(lx + 38, ly); g.lineTo(lx + 86, ly); g.moveTo(lx + 62, ly - 24); g.lineTo(lx + 62, ly + 24); g.stroke();
    g.font = '800 92px "Plus Jakarta Sans", Inter, sans-serif';
    g.textAlign = 'center';
    g.fillText('ARDUINO', 760, 680);
    g.lineWidth = 6;
    g.strokeRect(1010, 600, 170, 92);
    g.font = '700 70px "Plus Jakarta Sans", Inter, sans-serif';
    g.fillText('UNO', 1095, 672);
    g.font = '700 40px "Plus Jakarta Sans", Inter, sans-serif';
    g.fillText('DIGITAL (PWM~)', 920, 175);
    g.fillText('POWER', 560, 900);
    g.fillText('ANALOG IN', 1050, 900);
    g.font = '600 26px "JetBrains Mono", monospace';
    const label = (strip: Strip, above: boolean) => strip.names.forEach((n, i) => {
      const x = (strip.x0 + i * PITCH + PCB_W / 2) * s;
      const y = (strip.z + PCB_D / 2) * s + (above ? 74 : -64);
      g.save(); g.translate(x, y); g.rotate(-Math.PI / 2);
      g.fillText(n.replace(/^D/, '').replace(/\d$/, (d) => (n.startsWith('GND') ? '' : d)).replace('NC', ''), 0, 9);
      g.restore();
    });
    label(STRIPS[0], true); label(STRIPS[1], true); label(STRIPS[2], false); label(STRIPS[3], false);
    g.font = '600 30px "JetBrains Mono", monospace';
    g.textAlign = 'left';
    g.fillText('L', 640, 300); g.fillText('TX', 640, 372); g.fillText('RX', 640, 412); g.fillText('ON', 1180, 300);
    // mounting hole rings
    for (const [x, y] of [[180, 140], [1290, 120], [1290, 900], [260, 960]]) {
      g.fillStyle = '#d8c79a'; g.beginPath(); g.arc(x, y, 34, 0, Math.PI * 2); g.fill();
      g.fillStyle = '#f5f5ef'; g.beginPath(); g.arc(x, y, 20, 0, Math.PI * 2); g.fill();
    }
  }));
}

const headerCache = new Map<number, THREE.CanvasTexture>();
function headerTexture(n: number): THREE.CanvasTexture {
  if (headerCache.has(n)) return headerCache.get(n)!;
  const t = canvasTexture(n * 32, 32, (g) => {
    g.fillStyle = '#2a2d36'; g.fillRect(0, 0, n * 32, 32);
    g.fillStyle = '#0c0d10';
    for (let i = 0; i < n; i++) g.fillRect(i * 32 + 10, 10, 12, 12);
  });
  headerCache.set(n, t);
  return t;
}

export function buildBoard(): Board {
  const g = new THREE.Group();
  g.add(shadow(PCB_W * 1.3, PCB_D * 1.35, 0.28));

  // PCB with silkscreen on top
  const side = toon(0x234a87);
  const top = toon(0xffffff, { map: silkscreen() });
  const pcb = mesh(new THREE.BoxGeometry(PCB_W, PCB_T, PCB_D), [side, side, top, side, side, side] as unknown as THREE.Material);
  pcb.position.y = PCB_Y + PCB_T / 2;
  g.add(part(pcb, 'board'));
  for (const [x, z] of [[-2.55, -1.98], [2.95, -2.1], [2.95, 1.9], [-2.15, 2.15]]) g.add(at(cyl(0.12, 0.12, PCB_Y, 0xc9cdd3, 10, false), x, 0, z));

  // Headers
  const pinMap = new Map<string, THREE.Vector3>();
  for (const s of STRIPS) {
    const n = s.names.length;
    const tex = headerTexture(n);
    const topMat = toon(0xffffff, { map: tex });
    const sideMat = toon(0x2a2d36);
    const h = mesh(new THREE.BoxGeometry(n * PITCH, HEADER_H, PITCH * 1.05), [sideMat, sideMat, topMat, sideMat, sideMat, sideMat] as unknown as THREE.Material);
    h.position.set(s.x0 + ((n - 1) * PITCH) / 2, PCB_TOP + HEADER_H / 2, s.z);
    const id = s === STRIPS[2] ? 'power' : s === STRIPS[3] ? 'analog' : 'digital';
    g.add(part(h, id));
    s.names.forEach((name, i) => pinMap.set(name, new THREE.Vector3(s.x0 + i * PITCH, PCB_TOP + HEADER_H, s.z)));
  }

  // USB-B
  const usb = new THREE.Group();
  usb.add(box(1.55, 1.05, 1.2, 0xc9cdd3));
  const usbFace = box(0.05, 0.62, 0.78, 0x2b2f3a, false); usbFace.position.set(-0.79, 0.2, 0); usb.add(usbFace);
  usb.position.set(-PCB_W / 2 + 0.55, PCB_TOP, -1.35);
  g.add(part(usb, 'usb'));

  // DC barrel jack
  const jack = new THREE.Group();
  jack.add(box(1.45, 1.0, 0.9, 0x23262e));
  const jackHole = cyl(0.26, 0.26, 0.06, 0x0e0f12, 16, false); jackHole.rotation.z = Math.PI / 2; jackHole.position.set(-0.74, 0.5, 0); jack.add(jackHole);
  jack.position.set(-PCB_W / 2 + 0.45, PCB_TOP, 1.75);
  g.add(part(jack, 'jack'));

  // ATmega328P DIP + socket
  const mcu = new THREE.Group();
  mcu.add(box(3.6, 0.12, 0.95, 0xf2efe7));
  const chip = box(3.45, 0.3, 0.72, 0x2a2d35); chip.position.y += 0.12; mcu.add(chip);
  const notch = cyl(0.08, 0.08, 0.02, 0x15161a, 10, false); notch.position.set(-1.6, 0.42, 0); mcu.add(notch);
  for (let i = 0; i < 14; i++) for (const z of [-0.4, 0.4]) {
    const leg = box(0.07, 0.24, 0.08, 0xc9cdd3, false); leg.position.set(-1.6 + i * 0.246, 0.08, z); mcu.add(leg);
  }
  mcu.position.set(1.15, PCB_TOP, 1.05);
  g.add(part(mcu, 'mcu'));

  // ATmega16U2 (USB-serial)
  const u2 = box(0.62, 0.12, 0.62, 0x2a2d35); u2.position.set(-1.55, PCB_TOP, -1.3);
  g.add(part(u2, 'u2'));

  // 16 MHz crystal
  const xtal = mesh(new THREE.CapsuleGeometry(0.2, 0.55, 4, 12), toon(0xd5d8dd));
  xtal.rotation.z = Math.PI / 2; xtal.scale.set(1, 1, 0.55); xtal.position.set(-1.05, PCB_TOP + 0.18, -0.25);
  g.add(part(xtal, 'crystal'));

  // Reset button
  const reset = new THREE.Group();
  reset.add(box(0.5, 0.18, 0.5, 0xc9cdd3));
  const rcap = cyl(0.15, 0.15, 0.12, 0xd8483a); rcap.position.y += 0.18; reset.add(rcap);
  reset.position.set(-2.55, PCB_TOP, -2.2);
  g.add(part(reset, 'reset'));

  // Electrolytic caps, regulator, ICSP
  for (const [x, z] of [[-1.95, 1.9], [-1.35, 1.95]]) {
    const cap = cyl(0.27, 0.27, 0.62, 0x3b3f4c, 18); at(cap, x, PCB_TOP, z); g.add(cap);
    const capTop = cyl(0.25, 0.25, 0.02, 0xc9cdd3, 18, false); at(capTop, x, PCB_TOP + 0.62, z); g.add(capTop);
  }
  const reg = box(0.5, 0.18, 0.4, 0x2a2d35); reg.position.set(-2.1, PCB_TOP, 1.0); g.add(reg);
  const icsp = new THREE.Group();
  for (let i = 0; i < 3; i++) for (let j = 0; j < 2; j++) { const p = box(0.07, 0.45, 0.07, 0xd5b04a, false); p.position.set(i * 0.254, 0, j * 0.254); icsp.add(p); }
  icsp.add(box(0.76, 0.2, 0.5, 0x2a2d36));
  icsp.position.set(PCB_W / 2 - 0.55, PCB_TOP, 0.05); icsp.rotation.y = Math.PI / 2;
  g.add(icsp);

  // On-board LEDs (L, TX, RX, ON)
  const smd = (color: number, x: number, z: number): Led => {
    const l = led(color, { light: false });
    l.group.scale.setScalar(0.5);
    l.group.children.slice(0, 2).forEach((c) => (c.visible = false));
    l.group.position.set(x, PCB_TOP - 0.28, z);
    g.add(l.group);
    return l;
  };
  const ledL = smd(0xf0a13a, -0.42, -1.45);
  const ledTx = smd(0xf0a13a, -0.42, -1.1);
  const ledRx = smd(0xf0a13a, -0.42, -0.9);
  const ledOn = smd(0x3fc46a, 2.55, -1.45);
  part(ledL.group, 'ledL');

  const anchors: Record<string, THREE.Vector3> = {
    usb: new THREE.Vector3(-PCB_W / 2 + 0.55, PCB_TOP + 1.05, -1.35),
    jack: new THREE.Vector3(-PCB_W / 2 + 0.45, PCB_TOP + 1.0, 1.75),
    mcu: new THREE.Vector3(1.15, PCB_TOP + 0.45, 1.05),
    digital: new THREE.Vector3(0.9, PCB_TOP + HEADER_H, -PCB_D / 2 + 0.22),
    power: new THREE.Vector3(0.0, PCB_TOP + HEADER_H, PCB_D / 2 - 0.22),
    analog: new THREE.Vector3(2.4, PCB_TOP + HEADER_H, PCB_D / 2 - 0.22),
    reset: new THREE.Vector3(-2.55, PCB_TOP + 0.3, -2.2),
    u2: new THREE.Vector3(-1.55, PCB_TOP + 0.12, -1.3),
    crystal: new THREE.Vector3(-1.05, PCB_TOP + 0.35, -0.25),
    ledL: new THREE.Vector3(-0.42, PCB_TOP + 0.2, -1.45),
    board: new THREE.Vector3(0, PCB_TOP, 0),
  };

  return {
    group: g, ledL, ledOn, ledTx, ledRx, anchors,
    pin(name: string) {
      const key = /^\d+$/.test(name) ? `D${name}` : name === 'GND' ? 'GND' : name;
      const p = pinMap.get(key) ?? pinMap.get('GND')!;
      return p.clone();
    },
  };
}

// ───────────────────────── Breadboard ─────────────────────────
export const BB_COLS = 30;
const BB_W = 8.4, BB_D = 5.7, BB_H = 0.42;

export interface Breadboard {
  group: THREE.Group;
  /** col 0..29, row: 'a'..'j' (a-e back, f-j front) or rails '+top','-top','+bot','-bot' */
  hole(col: number, row: string): THREE.Vector3;
}

function rowZ(row: string): number {
  const rails: Record<string, number> = { '-top': -2.45, '+top': -2.2, '+bot': 2.2, '-bot': 2.45 };
  if (row in rails) return rails[row];
  const i = row.charCodeAt(0) - 97; // a=0
  return i < 5 ? -(0.38 + (4 - i) * 0.254) : 0.38 + (i - 5) * 0.254;
}
const colX = (c: number) => -((BB_COLS - 1) * 0.254) / 2 + c * 0.254;

let bbTex: THREE.CanvasTexture | null = null;
export function buildBreadboard(): Breadboard {
  const g = new THREE.Group();
  g.add(shadow(BB_W * 1.25, BB_D * 1.3, 0.24));
  const s = 120;
  const tex = bbTex ??= canvasTexture(Math.round(BB_W * s), Math.round(BB_D * s), (c) => {
    c.fillStyle = '#fbfbf8'; c.fillRect(0, 0, BB_W * s, BB_D * s);
    const px = (x: number) => (x + BB_W / 2) * s, pz = (z: number) => (z + BB_D / 2) * s;
    c.fillStyle = '#e5e9df'; c.fillRect(0, pz(-0.12), BB_W * s, 0.24 * s);
    c.lineWidth = 5;
    c.strokeStyle = '#d64a3a'; c.beginPath(); c.moveTo(px(-3.9), pz(-1.98)); c.lineTo(px(3.9), pz(-1.98)); c.moveTo(px(-3.9), pz(1.98)); c.lineTo(px(3.9), pz(1.98)); c.stroke();
    c.strokeStyle = '#2a56a3'; c.beginPath(); c.moveTo(px(-3.9), pz(-2.66)); c.lineTo(px(3.9), pz(-2.66)); c.moveTo(px(-3.9), pz(2.66)); c.lineTo(px(3.9), pz(2.66)); c.stroke();
    c.fillStyle = '#56645e';
    const hole = (x: number, z: number) => c.fillRect(px(x) - 7, pz(z) - 7, 14, 14);
    for (let col = 0; col < BB_COLS; col++) {
      for (let r = 0; r < 10; r++) hole(colX(col), rowZ(String.fromCharCode(97 + r)));
      if (col % 6 !== 5) for (const rail of ['-top', '+top', '+bot', '-bot']) hole(colX(col), rowZ(rail));
    }
  });
  const sideMat = toon(0xe5e9df);
  const b = mesh(new THREE.BoxGeometry(BB_W, BB_H, BB_D), [sideMat, sideMat, toon(0xffffff, { map: tex }), sideMat, sideMat, sideMat] as unknown as THREE.Material);
  b.position.y = BB_H / 2;
  g.add(part(b, 'breadboard'));
  return {
    group: g,
    hole: (col, row) => new THREE.Vector3(colX(col), BB_H, rowZ(row)),
  };
}
