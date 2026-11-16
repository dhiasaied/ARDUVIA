import * as THREE from 'three';
import type { SimService } from '../core/sim/sim.service';
import { Board, Breadboard, buildBoard, buildBreadboard } from './board';
import * as K from './kit';

export interface Readout { anchor: THREE.Vector3; text: string; warn?: boolean; }

export interface Bench {
  root: THREE.Group;
  anchors: Map<string, THREE.Vector3>;
  wires: K.Wire[];
  /** The part rendered alone for the lesson thumbnail. */
  hero: () => THREE.Object3D;
  update(sim: SimService, t: number, dt: number): void;
  readout?(sim: SimService): Readout | null;
  /** Drag axis for `slide` interactions, in world units per cm. */
  slide?: { axis: THREE.Vector3; perUnit: number };
}

const C = { orange: 0xe0a33a, navy: 0x2f3547, red: 0xd64a3a, blue: 0x2a56a3, teal: 0x1aa3a1, green: 0x2f9e5a, brown: 0x6b4a32, yellow: 0xe8c23a };
const BOARD_X = -4.7;
const BB_X = 4.4;
/** Components are drawn larger than life, like an illustration. */
const PART_SCALE = 1.85;

interface Ctx {
  root: THREE.Group;
  board: Board;
  bb: Breadboard | null;
  anchors: Map<string, THREE.Vector3>;
  wires: K.Wire[];
}

function setup(withBreadboard = true): Ctx {
  const root = new THREE.Group();
  const board = buildBoard();
  board.group.position.x = BOARD_X;
  root.add(board.group);
  let bb: Breadboard | null = null;
  if (withBreadboard) {
    bb = buildBreadboard();
    bb.group.position.set(BB_X, 0, -2.2);
    root.add(bb.group);
  }
  const anchors = new Map<string, THREE.Vector3>();
  for (const [k, v] of Object.entries(board.anchors)) anchors.set(k, v.clone().add(board.group.position));
  return { root, board, bb, anchors, wires: [] };
}

/** World position of a header pin. */
const pinW = (c: Ctx, name: string) => c.board.pin(name).add(c.board.group.position);
/** World position of a breadboard hole. */
const holeW = (c: Ctx, col: number, row: string) => c.bb!.hole(col, row).add(c.bb!.group.position);
/** Put an object on a breadboard hole (or the centre channel when row = 'mid'). */
function onBB(c: Ctx, o: THREE.Object3D, col: number, row: string): THREE.Object3D {
  const p = row === 'mid' ? holeW(c, col, 'e').lerp(holeW(c, col, 'f'), 0.5) : holeW(c, col, row);
  o.position.add(p);
  o.scale.multiplyScalar(PART_SCALE);
  c.root.add(o);
  return o;
}
function connect(c: Ctx, from: THREE.Vector3, to: THREE.Vector3, color: number, pin: number, lift = 1): K.Wire {
  const w = K.wire(from, to, color, pin, lift);
  c.root.add(w.mesh);
  c.wires.push(w);
  return w;
}
/** Put a free-standing part on the floor with a contact shadow. */
function place(c: Ctx, o: THREE.Object3D, x: number, z: number, scale: number): void {
  o.position.set(x, 0, z);
  o.scale.setScalar(scale);
  c.root.add(o);
  const b = new THREE.Box3().setFromObject(o);
  const sz = b.getSize(new THREE.Vector3());
  const sh = K.shadow(sz.x * 1.35, sz.z * 1.35);
  sh.position.set((b.min.x + b.max.x) / 2, 0.005, (b.min.z + b.max.z) / 2);
  c.root.add(sh);
  o.updateMatrixWorld(true);
}
/** A point in a part's local frame, in world space. */
const local = (o: THREE.Object3D, x: number, y: number, z: number) => { o.updateMatrixWorld(true); return o.localToWorld(new THREE.Vector3(x, y, z)); };
const pinAnchor = (c: Ctx, id: string, name: string) => c.anchors.set(id, pinW(c, name).add(new THREE.Vector3(0, 0.15, 0)));
/** Tag anchor: top-centre of the part's bounds (the y hint is only a fallback). */
const anchorOf = (o: THREE.Object3D, y = 0.9) => {
  o.updateMatrixWorld(true);
  const b = new THREE.Box3();
  o.traverse((m) => { if (m instanceof THREE.Mesh && m.visible) b.expandByObject(m, false); });
  if (b.isEmpty()) return new THREE.Vector3().setFromMatrixPosition(o.matrixWorld).add(new THREE.Vector3(0, y, 0));
  const c = b.getCenter(new THREE.Vector3());
  return new THREE.Vector3(c.x, b.max.y + 0.1, c.z);
};

function finish(c: Ctx, hero: () => THREE.Object3D, update: Bench['update'], extra: Partial<Bench> = {}): Bench {
  c.root.updateMatrixWorld(true);
  return { root: c.root, anchors: c.anchors, wires: c.wires, hero, update, ...extra };
}

function boardLeds(c: Ctx, sim: SimService): void {
  c.board.ledOn.set(1);
  c.board.ledL.set(sim.pins[13]);
  c.board.ledTx.set(sim.txrx);
  c.board.ledRx.set(sim.txrx * 0.8);
}

/** Sound waves for buzzers. */
function waves(at: THREE.Vector3, root: THREE.Group): (on: boolean, t: number) => void {
  const rings: THREE.Mesh[] = [];
  for (let i = 0; i < 3; i++) {
    const r = new THREE.Mesh(new THREE.TorusGeometry(0.5, 0.025, 6, 40), new THREE.MeshBasicMaterial({ color: 0x1aa3a1, transparent: true, opacity: 0 }));
    r.rotation.x = Math.PI / 2;
    r.position.copy(at);
    r.raycast = () => {};
    root.add(r); rings.push(r);
  }
  return (on, t) => rings.forEach((r, i) => {
    const k = (t * 1.6 + i / 3) % 1;
    r.scale.setScalar(0.6 + k * 1.6);
    (r.material as THREE.MeshBasicMaterial).opacity = on ? (1 - k) * 0.7 : 0;
  });
}

// ───────────────────────── lessons ─────────────────────────

const builders: Record<string, () => Bench> = {
  board() {
    const c = setup(false);
    c.board.group.position.x = 0;
    c.anchors.clear();
    for (const [k, v] of Object.entries(c.board.anchors)) c.anchors.set(k, v.clone());
    return finish(c, () => buildBoard().group, (sim) => boardLeds(c, sim));
  },

  blink() {
    const c = setup();
    const l = K.led(0xd8483a);
    onBB(c, l.group, 17, 'g');
    const r = K.resistor(); onBB(c, r, 13, 'h');
    connect(c, pinW(c, 'D13'), holeW(c, 10, 'h'), C.orange, 13);
    connect(c, pinW(c, 'GND2'), holeW(c, 19, 'j'), C.navy, -1);
    c.root.updateMatrixWorld(true);
    c.anchors.set('led', anchorOf(l.group, 1.05));
    c.anchors.set('resistor', anchorOf(r, 0.45));
    pinAnchor(c, 'pin13', 'D13'); pinAnchor(c, 'gnd', 'GND2');
    K.part(l.group, 'led', 'inspect'); K.part(r, 'resistor');
    return finish(c, () => K.led(0xd8483a).group, (sim) => { boardLeds(c, sim); l.set(sim.pins[13]); });
  },

  button() {
    const c = setup();
    const btn = K.pushButton(); onBB(c, btn.group, 8, 'mid');
    const l = K.led(0xd8483a); onBB(c, l.group, 20, 'g');
    const r = K.resistor(); onBB(c, r, 16, 'h');
    connect(c, pinW(c, 'D2'), holeW(c, 7, 'j'), C.blue, 2);
    connect(c, pinW(c, 'D13'), holeW(c, 13, 'i'), C.orange, 13);
    connect(c, pinW(c, 'GND2'), holeW(c, 9, '-bot'), C.navy, -1, 1.3);
    c.root.updateMatrixWorld(true);
    c.anchors.set('button', anchorOf(btn.group, 0.6)); c.anchors.set('led', anchorOf(l.group, 1.05));
    pinAnchor(c, 'pin2', 'D2'); pinAnchor(c, 'pin13', 'D13');
    K.part(btn.group, 'button', 'press:0'); K.part(l.group, 'led'); K.part(r, 'resistor');
    return finish(c, () => K.pushButton().group, (sim) => { boardLeds(c, sim); btn.set(sim.inputs.buttons[0]); l.set(sim.pins[13]); });
  },

  knob() {
    const c = setup();
    const pot = K.potentiometer(); onBB(c, pot.group, 7, 'g');
    const l = K.led(0xd8483a); onBB(c, l.group, 20, 'g');
    const r = K.resistor(); onBB(c, r, 16, 'h');
    connect(c, pinW(c, 'A0'), holeW(c, 7, 'j'), C.teal, 14);
    connect(c, pinW(c, '5V'), holeW(c, 3, '+bot'), C.red, -2, 0.8);
    connect(c, pinW(c, 'GND'), holeW(c, 4, '-bot'), C.navy, -1, 0.7);
    connect(c, pinW(c, 'D9'), holeW(c, 13, 'i'), C.blue, 9);
    c.root.updateMatrixWorld(true);
    c.anchors.set('pot', anchorOf(pot.group, 1.0)); c.anchors.set('led', anchorOf(l.group, 1.05));
    pinAnchor(c, 'a0', 'A0'); pinAnchor(c, 'pin9', 'D9');
    K.part(pot.group, 'pot', 'knob'); K.part(l.group, 'led'); K.part(r, 'resistor');
    return finish(c, () => K.potentiometer().group, (sim) => { boardLeds(c, sim); pot.set(sim.inputs.pot); l.set(sim.pins[9]); },
      { readout: (sim) => ({ anchor: c.anchors.get('pot')!.clone().add(new THREE.Vector3(0, 0.5, 0)), text: `A0 = ${Math.round(sim.inputs.pot * 1023)}` }) });
  },

  rgb() {
    const c = setup();
    const l = K.led(0xffffff, { rgb: true }); onBB(c, l.group, 15, 'h');
    const rs = [11, 13, 15].map((col) => { const r = K.resistor([0xc0392b, 0xc0392b, 0x6b3e1f, 0xd4a017]); r.rotation.y = Math.PI / 2; onBB(c, r, col, 'mid'); return r; });
    connect(c, pinW(c, 'D9'), holeW(c, 11, 'a'), C.red, 9);
    connect(c, pinW(c, 'D10'), holeW(c, 13, 'a'), C.green, 10, 1.15);
    connect(c, pinW(c, 'D11'), holeW(c, 15, 'a'), C.blue, 11, 1.3);
    connect(c, pinW(c, 'GND2'), holeW(c, 18, '-bot'), C.navy, -1, 1.5);
    c.root.updateMatrixWorld(true);
    c.anchors.set('rgb', anchorOf(l.group, 1.05));
    pinAnchor(c, 'pin9', 'D9'); pinAnchor(c, 'pin10', 'D10'); pinAnchor(c, 'pin11', 'D11');
    K.part(l.group, 'rgb'); rs.forEach((r) => K.part(r, 'resistor'));
    const col = new THREE.Color();
    return finish(c, () => { const x = K.led(0xffffff, { rgb: true }); x.set(1, new THREE.Color(0xff4fa0)); return x.group; }, (sim) => {
      boardLeds(c, sim);
      const [r, g, b] = [sim.pins[9], sim.pins[10], sim.pins[11]];
      const m = Math.max(r, g, b);
      col.setRGB(r / (m || 1), g / (m || 1), b / (m || 1));
      l.set(m, col);
    });
  },

  light() {
    const c = setup();
    const ldr = K.photoresistor(); onBB(c, ldr, 11, 'g');
    const r10 = K.resistor([0x6b3e1f, 0x23262e, 0xe0a33a, 0xd4a017]); r10.rotation.y = Math.PI / 2; onBB(c, r10, 9, 'mid');
    const l = K.led(0xe8c23a); onBB(c, l.group, 21, 'g');
    const r = K.resistor(); onBB(c, r, 17, 'h');
    const shade = K.mesh(new THREE.CylinderGeometry(0.75, 0.75, 0.06, 28), K.toon(0x2f3547, { transparent: true, opacity: 0.85 }));
    shade.position.copy(holeW(c, 11, 'g')).add(new THREE.Vector3(0, 1.25, 0));
    shade.raycast = () => {};
    c.root.add(shade);
    connect(c, pinW(c, 'A0'), holeW(c, 11, 'j'), C.teal, 14);
    connect(c, pinW(c, '5V'), holeW(c, 3, '+bot'), C.red, -2, 0.8);
    connect(c, pinW(c, 'GND'), holeW(c, 4, '-bot'), C.navy, -1, 0.7);
    connect(c, pinW(c, 'D13'), holeW(c, 14, 'i'), C.orange, 13);
    c.root.updateMatrixWorld(true);
    c.anchors.set('ldr', anchorOf(ldr, 0.8)); c.anchors.set('led', anchorOf(l.group, 1.05));
    pinAnchor(c, 'a0', 'A0');
    K.part(ldr, 'ldr', 'hold:covered'); K.part(l.group, 'led'); K.part(r, 'resistor'); K.part(r10, 'resistor');
    return finish(c, () => K.photoresistor(), (sim, t) => {
      boardLeds(c, sim);
      l.set(sim.pins[13]);
      shade.visible = sim.inputs.covered;
      shade.position.y = 1.25 + Math.sin(t * 3) * 0.04;
    }, { readout: (sim) => ({ anchor: c.anchors.get('ldr')!.clone().add(new THREE.Vector3(0, 0.6, 0)), text: `A0 ≈ ${sim.inputs.covered ? 120 : 720}` }) });
  },

  sensor() {
    const c = setup();
    const p = K.pir(); onBB(c, p, 9, 'mid');
    const l = K.led(0xd8483a); onBB(c, l.group, 21, 'g');
    const r = K.resistor(); onBB(c, r, 17, 'h');
    connect(c, pinW(c, 'D2'), holeW(c, 9, 'a'), C.blue, 2);
    connect(c, pinW(c, '5V'), holeW(c, 7, '+bot'), C.red, -2, 0.8);
    connect(c, pinW(c, 'GND'), holeW(c, 8, '-bot'), C.navy, -1, 0.7);
    connect(c, pinW(c, 'D13'), holeW(c, 14, 'i'), C.orange, 13, 1.3);
    const sweep = waves(holeW(c, 9, 'e').add(new THREE.Vector3(0, 0.5, 0.3)), c.root);
    c.root.updateMatrixWorld(true);
    c.anchors.set('pir', anchorOf(p, 0.75)); c.anchors.set('led', anchorOf(l.group, 1.05));
    pinAnchor(c, 'pin2', 'D2');
    K.part(p, 'pir', 'tap:motion'); K.part(l.group, 'led'); K.part(r, 'resistor');
    return finish(c, () => K.pir(), (sim, t) => {
      boardLeds(c, sim);
      l.set(sim.pins[13]);
      sweep(performance.now() < sim.inputs.motionUntil, t);
    });
  },

  sound() {
    const c = setup();
    const bz = K.buzzer(); onBB(c, bz, 15, 'mid');
    connect(c, pinW(c, 'D8'), holeW(c, 13, 'a'), C.blue, 8);
    connect(c, pinW(c, 'GND2'), holeW(c, 17, 'j'), C.navy, -1, 1.3);
    const w = waves(holeW(c, 15, 'e').add(new THREE.Vector3(0, 0.6, 0.13)), c.root);
    c.root.updateMatrixWorld(true);
    c.anchors.set('buzzer', anchorOf(bz, 0.6)); pinAnchor(c, 'pin8', 'D8');
    K.part(bz, 'buzzer');
    return finish(c, () => K.buzzer(), (sim, t) => {
      boardLeds(c, sim);
      const on = sim.toneHz > 0;
      w(on, t);
      bz.scale.setScalar(on ? 1 + Math.sin(t * 60) * 0.015 : 1);
    }, { readout: (sim) => (sim.toneHz ? { anchor: c.anchors.get('buzzer')!.clone().add(new THREE.Vector3(0, 0.6, 0)), text: `♪ ${sim.toneHz} Hz` } : null) });
  },

  piano() {
    const c = setup();
    const caps = [0xd8483a, 0xe8c23a, 0x2f9e5a, 0x2a56a3];
    const keys = caps.map((cap, i) => { const b = K.pushButton(cap); onBB(c, b.group, 4 + i * 5, 'mid'); K.part(b.group, `key${i}`, `press:${i}`); return b; });
    const bz = K.buzzer(); onBB(c, bz, 26, 'mid');
    keys.forEach((_, i) => connect(c, pinW(c, `D${2 + i}`), holeW(c, 3 + i * 5, 'j'), [C.blue, C.teal, C.green, C.orange][i], 2 + i, 0.9 + i * 0.12));
    connect(c, pinW(c, 'D8'), holeW(c, 25, 'a'), C.red, 8, 1.4);
    connect(c, pinW(c, 'GND2'), holeW(c, 28, '-top'), C.navy, -1, 1.6);
    const w = waves(holeW(c, 26, 'e').add(new THREE.Vector3(0, 0.6, 0.13)), c.root);
    c.root.updateMatrixWorld(true);
    keys.forEach((k, i) => c.anchors.set(`key${i}`, anchorOf(k.group, 0.6)));
    c.anchors.set('buzzer', anchorOf(bz, 0.6));
    K.part(bz, 'buzzer');
    return finish(c, () => K.pushButton(0xe8c23a).group, (sim, t) => {
      boardLeds(c, sim);
      keys.forEach((k, i) => k.set(sim.inputs.buttons[i]));
      w(sim.toneHz > 0, t);
    }, { readout: (sim) => (sim.toneHz ? { anchor: c.anchors.get('buzzer')!.clone().add(new THREE.Vector3(0, 0.6, 0)), text: `♪ ${sim.toneHz} Hz` } : null) });
  },

  motor() {
    const c = setup();
    const tr = K.transistor(); onBB(c, tr, 9, 'f');
    const d = K.diode(); onBB(c, d, 15, 'h');
    const m = K.dcMotor(); onBB(c, m.group, 22, 'mid');
    connect(c, pinW(c, 'D3'), holeW(c, 8, 'j'), C.blue, 3);
    connect(c, pinW(c, '5V'), holeW(c, 3, '+bot'), C.red, -2, 0.8);
    connect(c, pinW(c, 'GND'), holeW(c, 4, '-bot'), C.navy, -1, 0.7);
    c.root.updateMatrixWorld(true);
    c.anchors.set('motor', anchorOf(m.group, 1.1)); c.anchors.set('transistor', anchorOf(tr, 1.1));
    pinAnchor(c, 'pin3', 'D3');
    K.part(m.group, 'motor'); K.part(tr, 'transistor'); K.part(d, 'diode');
    return finish(c, () => K.dcMotor().group, (sim, _t, dt) => { boardLeds(c, sim); m.rotor.rotation.x += sim.pins[3] * dt * 28; },
      { readout: (sim) => ({ anchor: c.anchors.get('motor')!.clone().add(new THREE.Vector3(0, 0.5, 0)), text: `PWM ${Math.round(sim.pins[3] * 255)}` }) });
  },

  heat() {
    const c = setup();
    const s = K.tmp36(); onBB(c, s, 11, 'g');
    const l = K.led(0xd8483a); onBB(c, l.group, 21, 'g');
    const r = K.resistor(); onBB(c, r, 17, 'h');
    connect(c, pinW(c, 'A0'), holeW(c, 11, 'j'), C.teal, 14);
    connect(c, pinW(c, '5V'), holeW(c, 3, '+bot'), C.red, -2, 0.8);
    connect(c, pinW(c, 'GND'), holeW(c, 4, '-bot'), C.navy, -1, 0.7);
    connect(c, pinW(c, 'D13'), holeW(c, 14, 'i'), C.orange, 13, 1.3);
    const heatGlow = K.glow(0xff7a3a, 1.8); heatGlow.position.copy(holeW(c, 11, 'g')).add(new THREE.Vector3(0, 0.6, 0)); c.root.add(heatGlow);
    c.root.updateMatrixWorld(true);
    c.anchors.set('tmp36', anchorOf(s, 0.85)); c.anchors.set('led', anchorOf(l.group, 1.05));
    pinAnchor(c, 'a0', 'A0');
    K.part(s, 'tmp36', 'hold:warming'); K.part(l.group, 'led'); K.part(r, 'resistor');
    return finish(c, () => K.tmp36(), (sim) => {
      boardLeds(c, sim);
      l.set(sim.pins[13]);
      heatGlow.material.opacity = Math.max(0, (sim.inputs.temperature - 23) / 14) * 0.8;
    }, { readout: (sim) => ({ anchor: c.anchors.get('tmp36')!.clone().add(new THREE.Vector3(0, 0.6, 0)), text: `${sim.inputs.temperature.toFixed(1)} °C`, warn: sim.inputs.temperature > 30 }) });
  },

  servo() {
    const c = setup(false);
    const s = K.servo();
    place(c, s.group, 2.4, -0.4, 1.7);
    const plug = local(s.group, -0.63, 0.35, 0);
    connect(c, pinW(c, 'D9'), plug.clone().add(new THREE.Vector3(0, 0, -0.18)), C.orange, 9, 1.0);
    connect(c, pinW(c, '5V'), plug.clone(), C.red, -2, 0.9);
    connect(c, pinW(c, 'GND'), plug.clone().add(new THREE.Vector3(0, 0, 0.18)), C.brown, -1, 0.8);
    c.root.updateMatrixWorld(true);
    c.anchors.set('servo', anchorOf(s.group));
    c.anchors.set('arm', local(s.group, -0.32, 1.45, 0.86));
    pinAnchor(c, 'pin9', 'D9');
    K.part(s.group, 'servo');
    let angle = 90;
    return finish(c, () => K.servo().group, (sim, _t, dt) => {
      boardLeds(c, sim);
      angle += (sim.servoAngle - angle) * Math.min(1, dt * 8);
      s.horn.rotation.y = THREE.MathUtils.degToRad(angle - 90);
    }, { readout: (sim) => ({ anchor: c.anchors.get('servo')!.clone().add(new THREE.Vector3(0, 0.6, 0)), text: `${Math.round(sim.servoAngle)}°` }) });
  },

  stepper() {
    const c = setup(false);
    const drv = K.uln2003(); place(c, drv.group, 1.5, 1.3, 1.6);
    const st = K.stepperMotor(); place(c, st.group, 4.6, -0.6, 1.6);
    [8, 9, 10, 11].forEach((p, i) => connect(c, pinW(c, `D${p}`), local(drv.group, 0.55, 0.2, -0.15 + i * 0.1), [C.blue, C.teal, C.green, C.orange][i], p, 0.9 + i * 0.1));
    connect(c, pinW(c, '5V'), local(drv.group, -0.55, 0.1, 0.5), C.red, -2, 0.6);
    connect(c, pinW(c, 'GND'), local(drv.group, -0.4, 0.1, 0.5), C.navy, -1, 0.6);
    connect(c, local(drv.group, 0.6, 0.15, -0.5), local(st.group, 0, 0.3, 1.0), 0xe8c23a, -3, 0.5);
    c.root.updateMatrixWorld(true);
    c.anchors.set('stepper', local(st.group, -0.5, 0.7, 0)); c.anchors.set('driver', anchorOf(drv.group)); c.anchors.set('wheel', anchorOf(st.wheel));
    K.part(st.group, 'stepper'); K.part(drv.group, 'driver'); K.part(st.wheel, 'wheel');
    return finish(c, () => K.stepperMotor().group, (sim) => {
      boardLeds(c, sim);
      st.wheel.rotation.y = -sim.stepperAngle;
      const moving = Math.abs(sim.stepperTarget - sim.stepperAngle) > 1e-3;
      const phase = Math.floor(sim.stepperPhase) % 4;
      drv.leds.forEach((m, i) => m.emissive.setHex(moving && i === phase ? 0xff3a2a : 0x000000));
    });
  },

  plant() {
    const c = setup();
    const l = K.led(0xd8483a); onBB(c, l.group, 8, 'g');
    const r = K.resistor(); onBB(c, r, 4, 'h');
    const plant = K.plantPot();
    const probe = K.soilProbe(); probe.position.set(0.5, 0.25, 0); plant.group.add(probe);
    place(c, plant.group, 11.2, -1.6, 1.5);
    const drops: THREE.Mesh[] = [];
    for (let i = 0; i < 6; i++) {
      const d = new THREE.Mesh(new THREE.SphereGeometry(0.11, 8, 6), new THREE.MeshBasicMaterial({ color: 0x5aa9e6 }));
      d.visible = false; d.raycast = () => {};
      c.root.add(d); drops.push(d);
    }
    const head = local(plant.group, 0.5, 1.95, 0);
    connect(c, pinW(c, 'A0'), head.clone().add(new THREE.Vector3(-0.2, 0, 0)), C.teal, 14, 1.4);
    connect(c, pinW(c, '5V'), head.clone(), C.red, -2, 1.3);
    connect(c, pinW(c, 'GND'), head.clone().add(new THREE.Vector3(0.2, 0, 0)), C.navy, -1, 1.2);
    connect(c, pinW(c, 'D13'), holeW(c, 1, 'i'), C.orange, 13);
    c.root.updateMatrixWorld(true);
    const top = local(plant.group, 0, 2.6, 0);
    c.anchors.set('soil', head.clone().add(new THREE.Vector3(0, 0.3, 0)));
    c.anchors.set('pot-plant', top.clone());
    c.anchors.set('led', anchorOf(l.group));
    K.part(plant.group, 'pot-plant', 'tap:water'); K.part(probe, 'soil'); K.part(l.group, 'led'); K.part(r, 'resistor');
    const dry = new THREE.Color(0xa47b52), wet = new THREE.Color(0x4a3220);
    let lastMoisture = 0;
    let rainUntil = 0;
    return finish(c, () => K.plantPot().group, (sim, t) => {
      boardLeds(c, sim);
      l.set(sim.pins[13]);
      const m = sim.inputs.moisture;
      plant.soil.color.copy(dry).lerp(wet, m);
      plant.leaves.scale.y = 0.75 + m * 0.35;
      plant.leaves.rotation.z = (1 - m) * 0.25;
      if (m > lastMoisture + 0.1) rainUntil = t + 1.2;
      lastMoisture = m;
      drops.forEach((d, i) => {
        d.visible = t < rainUntil;
        const k = (t * 1.8 + i / drops.length) % 1;
        d.position.set(top.x + Math.sin(i * 2.1) * 0.7, top.y + 1.6 - k * 2.6, top.z + Math.cos(i * 1.7) * 0.6);
      });
    }, { readout: (sim) => ({ anchor: top.clone().add(new THREE.Vector3(0, 0.5, 0)), text: `${Math.round(sim.inputs.moisture * 100)} %`, warn: sim.inputs.moisture * 1023 < 350 }) });
  },

  force() {
    const c = setup();
    const f = K.fsrSensor(); onBB(c, f, 8, 'mid'); f.position.y += 0.05;
    const r10 = K.resistor([0x6b3e1f, 0x23262e, 0xe0a33a, 0xd4a017]); onBB(c, r10, 6, 'h');
    const leds = [0x2f9e5a, 0xe8c23a, 0xd8483a].map((col, i) => { const l = K.led(col); onBB(c, l.group, 17 + i * 4, 'g'); K.part(l.group, 'led'); return l; });
    connect(c, pinW(c, 'A0'), holeW(c, 8, 'j'), C.teal, 14);
    connect(c, pinW(c, '5V'), holeW(c, 3, '+bot'), C.red, -2, 0.8);
    connect(c, pinW(c, 'GND'), holeW(c, 4, '-bot'), C.navy, -1, 0.7);
    [11, 12, 13].forEach((p, i) => connect(c, pinW(c, `D${p}`), holeW(c, 16 + i * 4, 'a'), [C.green, C.yellow, C.orange][i], p, 1 + i * 0.15));
    c.root.updateMatrixWorld(true);
    c.anchors.set('fsr', anchorOf(f, 0.4)); c.anchors.set('led', anchorOf(leds[1].group, 1.05));
    pinAnchor(c, 'a0', 'A0');
    K.part(f, 'fsr', 'hold:pressing'); K.part(r10, 'resistor');
    return finish(c, () => K.fsrSensor(), (sim) => {
      boardLeds(c, sim);
      leds.forEach((l, i) => l.set(sim.pins[11 + i]));
      f.scale.y = 1 - sim.inputs.force * 0.6;
    }, { readout: (sim) => ({ anchor: c.anchors.get('fsr')!.clone().add(new THREE.Vector3(0, 0.6, 0)), text: `A0 = ${Math.round(sim.inputs.force * 1023)}` }) });
  },

  project() {
    const c = setup();
    const us = K.ultrasonic(); us.rotation.y = -Math.PI / 2; onBB(c, us, 26, 'mid');
    const bz = K.buzzer(); onBB(c, bz, 12, 'mid');
    const wall = K.obstacle(); wall.rotation.y = Math.PI / 2; c.root.add(wall);
    const wallShadow = K.shadow(1.2, 3.2); c.root.add(wallShadow);
    connect(c, pinW(c, 'D9'), holeW(c, 25, 'j'), C.blue, 9, 1.2);
    connect(c, pinW(c, 'D10'), holeW(c, 26, 'j'), C.teal, 10, 1.35);
    connect(c, pinW(c, 'D8'), holeW(c, 11, 'a'), C.orange, 8);
    connect(c, pinW(c, '5V'), holeW(c, 3, '+bot'), C.red, -2, 0.8);
    connect(c, pinW(c, 'GND'), holeW(c, 4, '-bot'), C.navy, -1, 0.7);
    const sensorX = holeW(c, 26, 'e').x + 0.6;
    const pulse = waves(new THREE.Vector3(sensorX + 0.2, 0.75, holeW(c, 26, 'e').z + 0.13), c.root);
    const w = waves(holeW(c, 12, 'e').add(new THREE.Vector3(0, 0.6, 0.13)), c.root);
    c.root.updateMatrixWorld(true);
    c.anchors.set('ultrasonic', anchorOf(us, 1.2)); c.anchors.set('buzzer', anchorOf(bz, 0.6));
    c.anchors.set('obstacle', new THREE.Vector3());
    K.part(us, 'ultrasonic'); K.part(bz, 'buzzer'); K.part(wall, 'obstacle', 'slide:distance');
    const perUnit = 0.065; // world units per cm
    return finish(c, () => K.ultrasonic(), (sim, t) => {
      boardLeds(c, sim);
      const x = sensorX + 0.4 + sim.inputs.distance * perUnit;
      wall.position.set(x, 0, 0.1);
      wallShadow.position.set(x, 0.005, 0.1);
      c.anchors.get('obstacle')!.set(x, 2.0, 0.1);
      w(sim.toneHz > 0, t);
      pulse(sim.state() === 'running', t);
    }, {
      readout: (sim) => ({ anchor: new THREE.Vector3(sensorX + 0.4 + sim.inputs.distance * perUnit, 2.4, 0.1), text: `${Math.round(sim.inputs.distance)} cm`, warn: sim.inputs.distance < 50 }),
      slide: { axis: new THREE.Vector3(1, 0, 0), perUnit },
    });
  },
};

export function buildBench(slug: string): Bench {
  return (builders[slug] ?? builders['board'])();
}

export const BENCH_SLUGS = Object.keys(builders);
