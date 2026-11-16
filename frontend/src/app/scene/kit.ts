import * as THREE from 'three';

/** Illustrated look: 3-step toon shading + dark ink outlines. */
export const INK = 0x263d38;

let gradient: THREE.DataTexture | null = null;
function toonGradient(): THREE.DataTexture {
  if (!gradient) {
    const data = new Uint8Array([150, 150, 150, 255, 205, 205, 205, 255, 255, 255, 255, 255]);
    gradient = new THREE.DataTexture(data, 3, 1, THREE.RGBAFormat);
    gradient.minFilter = gradient.magFilter = THREE.NearestFilter;
    gradient.needsUpdate = true;
  }
  return gradient;
}

const matCache = new Map<string, THREE.Material>();
export function toon(color: number | string, opts: { emissive?: number; transparent?: boolean; opacity?: number; map?: THREE.Texture } = {}): THREE.MeshToonMaterial {
  const key = `${color}|${opts.emissive ?? ''}|${opts.opacity ?? ''}`;
  if (!opts.map && !opts.emissive && matCache.has(key)) return matCache.get(key) as THREE.MeshToonMaterial;
  const m = new THREE.MeshToonMaterial({
    color: new THREE.Color(color),
    gradientMap: toonGradient(),
    transparent: !!opts.transparent,
    opacity: opts.opacity ?? 1,
    map: opts.map ?? null,
  });
  if (opts.emissive !== undefined) m.emissive = new THREE.Color(opts.emissive);
  if (!opts.map && opts.emissive === undefined) matCache.set(key, m);
  return m;
}

const lineMat = new THREE.LineBasicMaterial({ color: INK, transparent: true, opacity: 0.85 });
const edgeCache = new WeakMap<THREE.BufferGeometry, THREE.EdgesGeometry>();

/** Mesh with an ink outline child. */
export function mesh(geo: THREE.BufferGeometry, mat: THREE.Material, outline = true, threshold = 32): THREE.Mesh {
  const m = new THREE.Mesh(geo, mat);
  if (outline) {
    let edges = edgeCache.get(geo);
    if (!edges) { edges = new THREE.EdgesGeometry(geo, threshold); edgeCache.set(geo, edges); }
    const l = new THREE.LineSegments(edges, lineMat);
    l.raycast = () => {};
    m.add(l);
  }
  return m;
}

export function box(w: number, h: number, d: number, color: number | string, outline = true): THREE.Mesh {
  const m = mesh(new THREE.BoxGeometry(w, h, d), toon(color), outline);
  m.position.y = h / 2;
  return m;
}

export function cyl(rTop: number, rBot: number, h: number, color: number | string, seg = 20, outline = true): THREE.Mesh {
  const m = mesh(new THREE.CylinderGeometry(rTop, rBot, h, seg), toon(color), outline, 40);
  m.position.y = h / 2;
  return m;
}

export function at<T extends THREE.Object3D>(o: T, x: number, y: number, z: number): T {
  o.position.set(x, o.position.y + y, z);
  return o;
}

/** Tag a subtree as a selectable part. */
export function part<T extends THREE.Object3D>(o: T, id: string, interact?: string): T {
  o.userData['part'] = id;
  if (interact) o.userData['interact'] = interact;
  return o;
}

export function canvasTexture(w: number, h: number, draw: (g: CanvasRenderingContext2D) => void): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  draw(c.getContext('2d')!);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

/** Soft contact shadow under an object footprint. */
let shadowTex: THREE.Texture | null = null;
export function shadow(w: number, d: number, opacity = 0.22): THREE.Mesh {
  const tex = shadowTex ??= canvasTexture(128, 128, (g) => {
    const grd = g.createRadialGradient(64, 64, 10, 64, 64, 64);
    grd.addColorStop(0, 'rgba(38,61,56,1)');
    grd.addColorStop(1, 'rgba(38,61,56,0)');
    g.fillStyle = grd;
    g.fillRect(0, 0, 128, 128);
  });
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, d), new THREE.MeshBasicMaterial({ map: tex, transparent: true, opacity, depthWrite: false }));
  m.rotation.x = -Math.PI / 2;
  m.position.y = 0.005;
  m.raycast = () => {};
  m.renderOrder = -1;
  return m;
}

/** Additive radial glow sprite (LED halo). */
let glowTex: THREE.Texture | null = null;
export function glow(color: number | string, size: number): THREE.Sprite {
  glowTex ??= canvasTexture(64, 64, (g) => {
    const grd = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    grd.addColorStop(0, 'rgba(255,255,255,1)');
    grd.addColorStop(0.35, 'rgba(255,255,255,0.45)');
    grd.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = grd; g.fillRect(0, 0, 64, 64);
  });
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: new THREE.Color(color), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0 }));
  s.scale.setScalar(size);
  s.raycast = () => {};
  return s;
}

// ───────────────────────── components ─────────────────────────

export interface Led { group: THREE.Group; set(level: number, color?: THREE.Color): void; }

export function led(color: number, opts: { rgb?: boolean; light?: boolean } = {}): Led {
  const g = new THREE.Group();
  const legMat = toon(0xb9bcc2);
  const legA = mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.62, 6), legMat, false); legA.position.set(-0.06, 0.31, 0);
  const legB = mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.5, 6), legMat, false); legB.position.set(0.06, 0.25, 0);
  const base = color;
  const bodyMat = toon(opts.rgb ? 0xf1ece4 : base, { emissive: 0x000000, transparent: true, opacity: 0.95 });
  const rim = mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.06, 20), bodyMat); rim.position.y = 0.6;
  const body = mesh(new THREE.CylinderGeometry(0.17, 0.17, 0.26, 20), bodyMat); body.position.y = 0.76;
  const dome = mesh(new THREE.SphereGeometry(0.17, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2), bodyMat); dome.position.y = 0.89;
  const halo = glow(base, 1.6); halo.position.y = 0.85;
  g.add(legA, legB, rim, body, dome, halo);
  // Dynamic lighting: a lit LED tints the board and breadboard around it.
  const lamp = opts.light === false ? null : new THREE.PointLight(base, 0, 5.5, 1.6);
  if (lamp) { lamp.position.y = 1.0; g.add(lamp); }
  const baseColor = new THREE.Color(opts.rgb ? 0xf1ece4 : base);
  return {
    group: g,
    set(level: number, c?: THREE.Color) {
      const col = c ?? new THREE.Color(base);
      bodyMat.emissive.copy(col).multiplyScalar(level * 0.85);
      bodyMat.color.copy(opts.rgb && level > 0.02 ? baseColor.clone().lerp(col, Math.min(1, level)) : baseColor);
      halo.material.color.copy(col);
      halo.material.opacity = Math.min(1, level) * 0.9;
      halo.scale.setScalar(1.1 + level * 0.9);
      if (lamp) { lamp.color.copy(col); lamp.intensity = Math.min(1, level) * 6; }
    },
  };
}

export function resistor(bands: number[] = [0xc0392b, 0xc0392b, 0x6b3e1f, 0xd4a017]): THREE.Group {
  const g = new THREE.Group();
  const leg = toon(0xb9bcc2);
  const wire = mesh(new THREE.CylinderGeometry(0.018, 0.018, 1.3, 6), leg, false);
  wire.rotation.z = Math.PI / 2; wire.position.y = 0.32;
  const l1 = mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.32, 6), leg, false); l1.position.set(-0.65, 0.16, 0);
  const l2 = l1.clone(); l2.position.x = 0.65;
  const body = mesh(new THREE.CapsuleGeometry(0.1, 0.42, 4, 12), toon(0xe1c79a));
  body.rotation.z = Math.PI / 2; body.position.y = 0.32;
  g.add(wire, l1, l2, body);
  bands.forEach((c, i) => {
    const b = mesh(new THREE.CylinderGeometry(0.106, 0.106, 0.045, 14), toon(c), false);
    b.rotation.z = Math.PI / 2; b.position.set(-0.17 + i * 0.1 + (i === 3 ? 0.06 : 0), 0.32, 0);
    g.add(b);
  });
  return g;
}

export interface PushButton { group: THREE.Group; cap: THREE.Object3D; set(pressed: boolean): void; }
export function pushButton(capColor = 0xd8483a): PushButton {
  const g = new THREE.Group();
  g.add(box(0.62, 0.22, 0.62, 0x2b2f3a));
  const plate = box(0.5, 0.03, 0.5, 0xb9bcc2); plate.position.y = 0.235; g.add(plate);
  const cap = cyl(0.19, 0.2, 0.18, capColor); cap.position.y += 0.25; g.add(cap);
  for (const [x, z] of [[-0.24, -0.33], [0.24, -0.33], [-0.24, 0.33], [0.24, 0.33]]) {
    const leg = box(0.04, 0.1, 0.06, 0xb9bcc2, false); leg.position.set(x, 0.02, z); g.add(leg);
  }
  const y0 = cap.position.y;
  return { group: g, cap, set(p) { cap.position.y = y0 - (p ? 0.09 : 0); } };
}

export interface Knob { group: THREE.Group; set(v: number): void; }
export function potentiometer(): Knob {
  const g = new THREE.Group();
  g.add(box(0.9, 0.32, 0.9, 0x2a56a3));
  const ring = cyl(0.3, 0.3, 0.12, 0xb9bcc2); ring.position.y += 0.32; g.add(ring);
  const knob = new THREE.Group();
  const shaft = cyl(0.24, 0.26, 0.42, 0x2b2f3a); knob.add(shaft);
  const mark = box(0.05, 0.03, 0.2, 0xf5f5ef, false); mark.position.set(0, 0.42, -0.1); knob.add(mark);
  knob.position.y = 0.44; g.add(knob);
  for (const x of [-0.25, 0, 0.25]) { const leg = box(0.06, 0.18, 0.04, 0xb9bcc2, false); leg.position.set(x, 0, 0.47); g.add(leg); }
  return { group: g, set(v) { knob.rotation.y = (0.5 - v) * Math.PI * 1.5; } };
}

export function photoresistor(): THREE.Group {
  const g = new THREE.Group();
  const legMat = toon(0xb9bcc2);
  for (const x of [-0.06, 0.06]) { const l = mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.5, 6), legMat, false); l.position.set(x, 0.25, 0); g.add(l); }
  const tex = canvasTexture(64, 64, (c) => {
    c.fillStyle = '#e9e1cf'; c.fillRect(0, 0, 64, 64);
    c.strokeStyle = '#c8642d'; c.lineWidth = 5;
    c.beginPath(); c.moveTo(10, 14);
    for (let i = 0; i < 5; i++) { c.lineTo(54, 14 + i * 9); c.lineTo(10, 18.5 + i * 9); }
    c.stroke();
  });
  const disc = mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.08, 24), [toon(0xd9cdb5), toon(0xffffff, { map: tex }), toon(0xd9cdb5)] as unknown as THREE.Material);
  disc.position.y = 0.55;
  g.add(disc);
  return g;
}

export function buzzer(): THREE.Group {
  const g = new THREE.Group();
  g.add(cyl(0.5, 0.5, 0.42, 0x23262e, 28));
  const hole = cyl(0.07, 0.07, 0.02, 0x0e0f12, 12, false); hole.position.y += 0.42; g.add(hole);
  const sticker = cyl(0.3, 0.3, 0.01, 0x3a3e4a, 24, false); sticker.position.y += 0.425; g.add(sticker);
  return g;
}

export function pir(): THREE.Group {
  const g = new THREE.Group();
  g.add(box(1.0, 0.08, 1.0, 0x2f8d55));
  const collar = box(0.9, 0.12, 0.9, 0xf2efe7); collar.position.y += 0.08; g.add(collar);
  const dome = mesh(new THREE.SphereGeometry(0.42, 22, 14, 0, Math.PI * 2, 0, Math.PI / 2), toon(0xfbfaf6), true, 50);
  dome.position.y = 0.2; g.add(dome);
  return g;
}

export function transistor(): THREE.Group {
  const g = new THREE.Group();
  const body = box(0.42, 0.5, 0.16, 0x23262e); body.position.y += 0.35; g.add(body);
  const tab = box(0.42, 0.36, 0.05, 0xb9bcc2); tab.position.set(0, 0.85, 0.06); g.add(tab);
  for (const x of [-0.13, 0, 0.13]) { const l = box(0.04, 0.36, 0.03, 0xb9bcc2, false); l.position.set(x, 0, 0); g.add(l); }
  return g;
}

export function diode(): THREE.Group {
  const g = new THREE.Group();
  const b = mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.32, 14), toon(0x23262e)); b.rotation.z = Math.PI / 2; b.position.y = 0.2;
  const band = mesh(new THREE.CylinderGeometry(0.083, 0.083, 0.05, 14), toon(0xd5d8dd), false); band.rotation.z = Math.PI / 2; band.position.set(0.12, 0.2, 0);
  const w = mesh(new THREE.CylinderGeometry(0.016, 0.016, 0.9, 6), toon(0xb9bcc2), false); w.rotation.z = Math.PI / 2; w.position.y = 0.2;
  g.add(w, b, band);
  return g;
}

export interface Motor { group: THREE.Group; rotor: THREE.Object3D; }
export function dcMotor(): Motor {
  const g = new THREE.Group();
  const can = mesh(new THREE.CylinderGeometry(0.42, 0.42, 1.0, 24), toon(0xc9cdd3), true, 40);
  can.rotation.z = Math.PI / 2; can.position.y = 0.45; g.add(can);
  const end = mesh(new THREE.CylinderGeometry(0.36, 0.36, 0.1, 20), toon(0x2a56a3)); end.rotation.z = Math.PI / 2; end.position.set(-0.55, 0.45, 0); g.add(end);
  const rotor = new THREE.Group(); rotor.position.set(0.62, 0.45, 0);
  const shaft = mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.3, 8), toon(0x8e9094), false); shaft.rotation.z = Math.PI / 2; rotor.add(shaft);
  const hub = mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.1, 12), toon(0xd8483a)); hub.rotation.z = Math.PI / 2; hub.position.x = 0.15; rotor.add(hub);
  for (let i = 0; i < 3; i++) {
    const blade = mesh(new THREE.BoxGeometry(0.04, 0.62, 0.2), toon(0xe0a33a));
    const arm = new THREE.Group(); arm.rotation.x = (i * Math.PI * 2) / 3; blade.position.y = 0.36; arm.add(blade); arm.position.x = 0.16;
    rotor.add(arm);
  }
  g.add(rotor);
  const stand = box(0.6, 0.12, 0.7, 0x5b6170); g.add(stand);
  return { group: g, rotor };
}

export function tmp36(): THREE.Group {
  const g = new THREE.Group();
  const body = mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.42, 20, 1, false, 0, Math.PI), toon(0x23262e), true, 50);
  body.rotation.y = Math.PI / 2; body.position.y = 0.55;
  for (const x of [-0.1, 0, 0.1]) { const l = box(0.03, 0.36, 0.03, 0xb9bcc2, false); l.position.x = x; g.add(l); }
  g.add(body);
  return g;
}

export interface ServoParts { group: THREE.Group; horn: THREE.Object3D; }
export function servo(): ServoParts {
  const g = new THREE.Group();
  g.add(box(1.25, 1.1, 0.62, 0x2f6fbf));
  const flange = box(1.75, 0.06, 0.62, 0x2f6fbf); flange.position.y = 0.82; g.add(flange);
  const top = cyl(0.2, 0.22, 0.2, 0x2f6fbf); top.position.set(-0.32, 1.1, 0); g.add(top);
  const horn = new THREE.Group(); horn.position.set(-0.32, 1.32, 0);
  const hub = cyl(0.13, 0.13, 0.08, 0xf2efe7); horn.add(hub);
  const arm = box(0.16, 0.06, 1.0, 0xf2efe7); arm.position.set(0, 0.02, 0.38); horn.add(arm);
  const tip = cyl(0.08, 0.08, 0.06, 0xf2efe7); tip.position.set(0, 0.02, 0.86); horn.add(tip);
  g.add(horn);
  return { group: g, horn };
}

export interface StepperParts { group: THREE.Group; wheel: THREE.Object3D; }
export function stepperMotor(): StepperParts {
  const g = new THREE.Group();
  g.add(cyl(0.72, 0.72, 0.62, 0xc9cdd3, 32));
  const cap = cyl(0.6, 0.6, 0.08, 0x2f6fbf, 28); cap.position.y += 0.62; g.add(cap);
  const box1 = box(0.6, 0.5, 0.4, 0x2f6fbf); box1.position.set(0, 0.05, 0.8); g.add(box1);
  const wheel = new THREE.Group(); wheel.position.set(0.24, 0.78, 0);
  const tire = mesh(new THREE.TorusGeometry(0.62, 0.14, 10, 36), toon(0x2b2f3a), true, 60); tire.rotation.x = Math.PI / 2; wheel.add(tire);
  const rim = cyl(0.5, 0.5, 0.1, 0xe0a33a, 28); rim.position.y = -0.05; wheel.add(rim);
  for (let i = 0; i < 5; i++) {
    const s = box(0.08, 0.04, 0.42, 0xd8483a, false); s.position.set(Math.sin((i / 5) * Math.PI * 2) * 0.22, 0.06, Math.cos((i / 5) * Math.PI * 2) * 0.22);
    s.rotation.y = (i / 5) * Math.PI * 2; wheel.add(s);
  }
  const hub = cyl(0.1, 0.1, 0.14, 0xf2efe7); hub.position.y = -0.02; wheel.add(hub);
  g.add(wheel);
  return { group: g, wheel };
}

export interface DriverParts { group: THREE.Group; leds: THREE.MeshToonMaterial[]; }
export function uln2003(): DriverParts {
  const g = new THREE.Group();
  g.add(box(1.4, 0.08, 1.2, 0x2f8d55));
  const chip = box(0.8, 0.14, 0.34, 0x23262e); chip.position.set(-0.1, 0.08, 0.1); g.add(chip);
  const header = box(0.12, 0.3, 0.6, 0xf2efe7); header.position.set(0.55, 0.08, 0.1); g.add(header);
  const leds: THREE.MeshToonMaterial[] = [];
  for (let i = 0; i < 4; i++) {
    const m = toon(0x8a2a22, { emissive: 0x000000 });
    const l = mesh(new THREE.BoxGeometry(0.12, 0.08, 0.1), m); l.position.set(-0.45 + i * 0.22, 0.12, -0.38);
    g.add(l); leds.push(m);
  }
  return { group: g, leds };
}

export interface PlantParts { group: THREE.Group; soil: THREE.MeshToonMaterial; leaves: THREE.Group; }
export function plantPot(): PlantParts {
  const g = new THREE.Group();
  const pot = mesh(new THREE.CylinderGeometry(0.95, 0.7, 1.2, 28), toon(0xc8643d), true, 50); pot.position.y = 0.6; g.add(pot);
  const lip = mesh(new THREE.CylinderGeometry(1.02, 1.02, 0.18, 28), toon(0xd4744c), true, 50); lip.position.y = 1.16; g.add(lip);
  const soilMat = toon(0x6b4a2f, { emissive: 0x000000 });
  const soil = mesh(new THREE.CylinderGeometry(0.9, 0.9, 0.05, 28), soilMat, false); soil.position.y = 1.22; g.add(soil);
  const leaves = new THREE.Group(); leaves.position.y = 1.2;
  const stem = mesh(new THREE.CylinderGeometry(0.04, 0.05, 0.9, 8), toon(0x3f8a43), false); stem.position.y = 0.45; leaves.add(stem);
  for (let i = 0; i < 6; i++) {
    const leaf = mesh(new THREE.SphereGeometry(0.26, 12, 8), toon(i % 2 ? 0x56a85a : 0x3f8a43));
    leaf.scale.set(1, 0.32, 0.55);
    const a = (i / 6) * Math.PI * 2;
    leaf.position.set(Math.cos(a) * 0.3, 0.45 + (i % 3) * 0.2, Math.sin(a) * 0.3);
    leaf.rotation.y = -a; leaf.rotation.z = 0.5;
    leaves.add(leaf);
  }
  g.add(leaves);
  return { group: g, soil: soilMat, leaves };
}

export function soilProbe(): THREE.Group {
  const g = new THREE.Group();
  const head = box(0.5, 0.36, 0.06, 0x23262e); head.position.y = 1.5; g.add(head);
  for (const x of [-0.13, 0.13]) { const prong = box(0.14, 1.5, 0.05, 0x23262e); prong.position.set(x, 0, 0); g.add(prong); }
  const strip = box(0.4, 0.06, 0.07, 0xe0a33a, false); strip.position.y = 1.62; g.add(strip);
  return g;
}

export function fsrSensor(): THREE.Group {
  const g = new THREE.Group();
  const pad = cyl(0.45, 0.45, 0.04, 0x2b2f3a, 28); g.add(pad);
  const ring = cyl(0.36, 0.36, 0.045, 0xd8c79a, 28, false); g.add(ring);
  const tail = box(0.22, 0.03, 1.1, 0xd8c79a); tail.position.z = 0.75; g.add(tail);
  return g;
}

export function ultrasonic(): THREE.Group {
  const g = new THREE.Group();
  const pcb = box(1.8, 0.82, 0.08, 0x2a56a3); pcb.position.y = 0.2; g.add(pcb);
  for (const x of [-0.5, 0.5]) {
    const eye = mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.42, 24), toon(0xc9cdd3), true, 50);
    eye.rotation.x = Math.PI / 2; eye.position.set(x, 0.62, -0.24); g.add(eye);
    const mesh2 = mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.02, 20), toon(0x5b6170), false);
    mesh2.rotation.x = Math.PI / 2; mesh2.position.set(x, 0.62, -0.46); g.add(mesh2);
  }
  const crystal = box(0.26, 0.12, 0.08, 0xd5d8dd); crystal.position.set(0, 0.88, -0.08); g.add(crystal);
  for (let i = 0; i < 4; i++) { const p = box(0.04, 0.3, 0.04, 0xb9bcc2, false); p.position.set(-0.15 + i * 0.1, 0, 0.0); g.add(p); }
  return g;
}

export function obstacle(): THREE.Group {
  const g = new THREE.Group();
  const tex = canvasTexture(128, 128, (c) => {
    c.fillStyle = '#c8643d'; c.fillRect(0, 0, 128, 128);
    c.strokeStyle = '#f5f5ef'; c.lineWidth = 4;
    for (let r = 0; r < 4; r++) {
      c.beginPath(); c.moveTo(0, r * 32); c.lineTo(128, r * 32); c.stroke();
      for (let k = 0; k < 3; k++) { const x = (k * 48 + (r % 2) * 24) % 128; c.beginPath(); c.moveTo(x, r * 32); c.lineTo(x, r * 32 + 32); c.stroke(); }
    }
  });
  const wall = mesh(new THREE.BoxGeometry(2.6, 1.6, 0.4), toon(0xffffff, { map: tex }));
  wall.position.y = 0.8; g.add(wall);
  return g;
}

/** A wire as a tube along an arched curve. Exposes the curve for current dots. */
export interface Wire { mesh: THREE.Mesh; curve: THREE.CatmullRomCurve3; pin: number; color: number; dots: THREE.Mesh[]; }
export function wire(from: THREE.Vector3, to: THREE.Vector3, color: number, pin: number, lift = 1.1): Wire {
  const mid = from.clone().lerp(to, 0.5);
  const len = from.distanceTo(to);
  const up = Math.max(0.6, Math.min(2.2, len * 0.25)) * lift;
  const pts = [
    from.clone(),
    from.clone().add(new THREE.Vector3(0, up * 0.7, 0)),
    mid.clone().add(new THREE.Vector3(0, up, 0)),
    to.clone().add(new THREE.Vector3(0, up * 0.7, 0)),
    to.clone(),
  ];
  const curve = new THREE.CatmullRomCurve3(pts, false, 'centripetal');
  const m = mesh(new THREE.TubeGeometry(curve, 48, 0.055, 8, false), toon(color), false);
  m.raycast = () => {};
  const dots: THREE.Mesh[] = [];
  const dotMat = new THREE.MeshBasicMaterial({ color: 0xfff6d8, transparent: true, opacity: 0 });
  for (let i = 0; i < 5; i++) {
    const d = new THREE.Mesh(new THREE.SphereGeometry(0.075, 8, 6), dotMat);
    d.raycast = () => {};
    m.add(d); dots.push(d);
  }
  return { mesh: m, curve, pin, color, dots };
}
