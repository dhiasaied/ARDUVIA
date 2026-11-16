import * as THREE from 'three';
import type { Settings } from '../core/models';
import type { SimService } from '../core/sim/sim.service';
import { Bench, buildBench } from './benches';
import { canvasTexture } from './kit';

export interface ScreenPoint { x: number; y: number; visible: boolean; }
export interface WireLabel { x: number; y: number; text: string; level: 'high' | 'low' | 'pwm' | 'gnd' | 'pwr'; }

const PITCH = THREE.MathUtils.degToRad(34);
const BASE_YAW = Math.PI / 4;

/**
 * Owns the WebGL renderer, the isometric camera and the current lesson bench.
 * Framework-agnostic: the Angular Stage component drives it.
 */
export class SceneEngine {
  readonly renderer: THREE.WebGLRenderer;
  private readonly scene = new THREE.Scene();
  private readonly camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 400);
  private readonly raycaster = new THREE.Raycaster();
  private readonly grid: THREE.Mesh;
  private bench: Bench | null = null;
  private benchSlug = '';
  private raf = 0;
  private last = performance.now();
  private width = 1;
  private height = 1;

  // camera state (current → target, eased)
  private yaw = BASE_YAW; private yawTo = BASE_YAW;
  private zoom = 1; private zoomTo = 1;
  private target = new THREE.Vector3(); private targetTo = new THREE.Vector3();
  private home = { target: new THREE.Vector3(), viewH: 14 };
  private viewH = 14;
  private intro = 1;
  private lastInput = performance.now();
  private nextAutoTurn = 0;

  // pointer state
  private drag: { mode: 'pan' | 'rotate' | 'part'; x: number; y: number; moved: boolean; interact?: string; part?: string; startValue?: number } | null = null;
  private pointers = new Map<number, { x: number; y: number }>();
  private pinchDist = 0;

  settings: Settings | null = null;
  onPick: (part: string | null) => void = () => {};
  onHover: (interactive: string | null) => void = () => {};
  onFrame: () => void = () => {};

  constructor(private readonly canvas: HTMLCanvasElement, private readonly sim: SimService) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, preserveDrawingBuffer: false });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.setClearColor(0x000000, 0);

    // Key / fill / rim: a soft studio setup that keeps the illustrated toon look.
    this.scene.add(new THREE.HemisphereLight(0xfbfcf8, 0xc3cfbe, 1.45));
    const sun = new THREE.DirectionalLight(0xfff6ea, 1.55);
    sun.position.set(-6, 14, 9);
    this.scene.add(sun);
    const rim = new THREE.DirectionalLight(0xcfe3da, 0.7);
    rim.position.set(8, 6, -10);
    this.scene.add(rim);

    // Subtle floor grid that fades out at the edges
    const gridTex = canvasTexture(64, 64, (g) => {
      g.strokeStyle = 'rgba(140,162,146,0.5)'; g.lineWidth = 1.5;
      g.strokeRect(0, 0, 64, 64);
    });
    gridTex.wrapS = gridTex.wrapT = THREE.RepeatWrapping;
    gridTex.repeat.set(60, 60);
    const fade = canvasTexture(256, 256, (g) => {
      const grd = g.createRadialGradient(128, 128, 20, 128, 128, 128);
      grd.addColorStop(0, '#fff'); grd.addColorStop(0.55, '#888'); grd.addColorStop(1, '#000');
      g.fillStyle = grd; g.fillRect(0, 0, 256, 256);
    });
    this.grid = new THREE.Mesh(new THREE.PlaneGeometry(60, 60), new THREE.MeshBasicMaterial({ map: gridTex, alphaMap: fade, transparent: true, opacity: 0.5, depthWrite: false }));
    this.grid.rotation.x = -Math.PI / 2;
    this.grid.position.y = -0.01;
    this.grid.raycast = () => {};
    this.scene.add(this.grid);

    this.bindInput();
    this.loop = this.loop.bind(this);
    this.raf = requestAnimationFrame(this.loop);
  }

  // ───────── public API ─────────
  setBench(slug: string): void {
    if (slug === this.benchSlug && this.bench) return;
    if (this.bench) {
      this.scene.remove(this.bench.root);
      disposeTree(this.bench.root);
    }
    this.benchSlug = slug;
    this.bench = buildBench(slug);
    this.scene.add(this.bench.root);
    this.intro = this.settings?.reducedMotion ? 1 : 0;
    this.fit(true);
  }

  get anchors(): Map<string, THREE.Vector3> { return this.bench?.anchors ?? new Map(); }
  get wireCount(): number { return this.bench?.wires.length ?? 0; }

  resize(w: number, h: number): void {
    this.width = Math.max(1, w);
    this.height = Math.max(1, h);
    this.renderer.setSize(this.width, this.height, false);
    this.fit(false);
  }

  rotate(dir: 1 | -1): void { this.touch(); this.yawTo += (dir * Math.PI) / 2; }
  zoomBy(f: number): void { this.touch(); this.zoomTo = THREE.MathUtils.clamp(this.zoomTo * f, 0.55, 3.2); }
  resetView(): void { this.touch(); this.yawTo = BASE_YAW + Math.round((this.yaw - BASE_YAW) / (Math.PI * 2)) * Math.PI * 2; this.zoomTo = 1; this.targetTo.copy(this.home.target); }
  get isAway(): boolean { return Math.abs(this.zoomTo - 1) > 0.02 || this.targetTo.distanceTo(this.home.target) > 0.3 || Math.abs(((this.yawTo - BASE_YAW) % (Math.PI * 2))) > 0.01; }

  /** Pan so a part sits in the middle of the view. */
  focus(partId: string): void {
    const p = this.bench?.anchors.get(partId);
    if (!p) return;
    this.touch();
    this.targetTo.set(p.x, 0, p.z);
    this.zoomTo = Math.max(this.zoomTo, 1.35);
  }

  /** Move by keyboard (screen-relative). */
  panScreen(dx: number, dy: number): void {
    this.touch();
    const per = this.viewH / this.zoomTo / this.height;
    const { right, fwd } = this.groundAxes();
    this.targetTo.addScaledVector(right, dx * per).addScaledVector(fwd, dy * per / Math.sin(PITCH));
  }

  project(p: THREE.Vector3): ScreenPoint {
    const v = p.clone().project(this.camera);
    return { x: ((v.x + 1) / 2) * this.width, y: ((1 - v.y) / 2) * this.height, visible: v.z < 1 && v.x > -1.1 && v.x < 1.1 && v.y > -1.1 && v.y < 1.1 };
  }

  wireLabels(): WireLabel[] {
    if (!this.bench || !this.settings?.flow || !this.sim.running()) return [];
    return this.bench.wires.map((w) => {
      const p = this.project(w.curve.getPoint(0.5).add(new THREE.Vector3(0, 0.25, 0)));
      // inputs show what the pin reads, outputs what it drives
      const isInput = w.pin >= 0 && w.pin < 14 && this.sim.pinModes[w.pin] !== 1;
      const lvl = w.pin < 0 ? 0 : isInput ? this.sim.digitalRead(w.pin) : this.sim.pins[w.pin];
      let text = 'GND'; let level: WireLabel['level'] = 'gnd';
      if (w.pin === -2) { text = '5V'; level = 'pwr'; }
      else if (w.pin === -3) { text = 'A–D'; level = 'pwm'; }
      else if (w.pin >= 14) { text = `A${w.pin - 14}`; level = 'pwm'; }
      else if (w.pin >= 0) {
        const pwm = lvl > 0.01 && lvl < 0.99;
        text = pwm ? `~${Math.round(lvl * 255)}` : lvl >= 0.5 ? 'HIGH' : 'LOW';
        level = pwm ? 'pwm' : lvl >= 0.5 ? 'high' : 'low';
      }
      return { x: p.x, y: p.y, text, level };
    });
  }

  readout(): { x: number; y: number; text: string; warn: boolean } | null {
    const r = this.bench?.readout?.(this.sim);
    if (!r) return null;
    const p = this.project(r.anchor);
    return { x: p.x, y: p.y, text: r.text, warn: !!r.warn };
  }

  /** Data for the 2D minimap: footprint boxes + view rectangle in ground coords. */
  minimap(): { boxes: { x: number; z: number; w: number; d: number }[]; view: THREE.Vector3[]; bounds: THREE.Box3 } | null {
    if (!this.bench) return null;
    const boxes: { x: number; z: number; w: number; d: number }[] = [];
    const bounds = new THREE.Box3();
    for (const child of this.bench.root.children) {
      if (!(child instanceof THREE.Group)) continue;
      const b = new THREE.Box3().setFromObject(child);
      if (b.isEmpty()) continue;
      bounds.union(b);
      boxes.push({ x: b.min.x, z: b.min.z, w: b.max.x - b.min.x, d: b.max.z - b.min.z });
    }
    bounds.expandByScalar(1.5);
    const corners = [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([x, y]) => this.groundAt(x, y));
    // keep the map square-ish around content + the visible area
    const target = this.targetTo;
    bounds.expandByPoint(new THREE.Vector3(target.x - 2, 0, target.z - 2)).expandByPoint(new THREE.Vector3(target.x + 2, 0, target.z + 2));
    return { boxes, view: corners, bounds };
  }

  moveTo(x: number, z: number): void { this.touch(); this.targetTo.set(x, 0, z); }

  dispose(): void {
    cancelAnimationFrame(this.raf);
    this.unbind();
    if (this.bench) disposeTree(this.bench.root);
    this.renderer.dispose();
  }

  // ───────── thumbnails ─────────
  private static thumbRenderer: THREE.WebGLRenderer | null = null;
  static renderThumbnail(slug: string, w = 260, h = 174): string {
    const r = (SceneEngine.thumbRenderer ??= (() => {
      const rr = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
      rr.outputColorSpace = THREE.SRGBColorSpace;
      rr.setPixelRatio(1);
      return rr;
    })());
    r.setSize(w, h, false);
    const scene = new THREE.Scene();
    scene.add(new THREE.HemisphereLight(0xfbfcf8, 0xc3cfbe, 1.6));
    const sun = new THREE.DirectionalLight(0xffffff, 1.6); sun.position.set(-6, 14, 9); scene.add(sun);
    const bench = buildBench(slug);
    const hero = bench.hero();
    disposeTree(bench.root);
    scene.add(hero);
    hero.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(hero);
    const center = box.getCenter(new THREE.Vector3());
    const size = box.getSize(new THREE.Vector3());
    const cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 200);
    const dir = new THREE.Vector3(Math.sin(BASE_YAW) * Math.cos(PITCH), Math.sin(PITCH), Math.cos(BASE_YAW) * Math.cos(PITCH));
    cam.position.copy(center).addScaledVector(dir, 50);
    cam.lookAt(center);
    const ext = Math.max(size.x, size.y, size.z) * 1.05;
    const aspect = w / h;
    cam.left = (-ext * aspect) / 2; cam.right = (ext * aspect) / 2; cam.top = ext / 2; cam.bottom = -ext / 2;
    cam.updateProjectionMatrix();
    r.setClearColor(0x000000, 0);
    r.render(scene, cam);
    const url = r.domElement.toDataURL('image/png');
    disposeTree(hero);
    return url;
  }

  // ───────── internals ─────────
  private touch(): void { this.lastInput = performance.now(); this.nextAutoTurn = 0; }

  private groundAxes(): { right: THREE.Vector3; fwd: THREE.Vector3 } {
    const right = new THREE.Vector3(Math.cos(this.yaw), 0, -Math.sin(this.yaw));
    const fwd = new THREE.Vector3(-Math.sin(this.yaw), 0, -Math.cos(this.yaw));
    return { right, fwd };
  }

  /** Where a normalized device coordinate hits the ground plane. */
  private groundAt(nx: number, ny: number): THREE.Vector3 {
    const ray = new THREE.Raycaster();
    ray.setFromCamera(new THREE.Vector2(nx, ny), this.camera);
    const out = new THREE.Vector3();
    ray.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), out);
    return out;
  }

  private fit(recenter: boolean): void {
    if (!this.bench) return;
    const box = new THREE.Box3().setFromObject(this.bench.root);
    const center = box.getCenter(new THREE.Vector3());
    // extents in camera space for the home yaw
    const right = new THREE.Vector3(Math.cos(BASE_YAW), 0, -Math.sin(BASE_YAW));
    const dir = new THREE.Vector3(Math.sin(BASE_YAW) * Math.cos(PITCH), Math.sin(PITCH), Math.cos(BASE_YAW) * Math.cos(PITCH));
    const up = new THREE.Vector3().crossVectors(dir, right).normalize().negate();
    let maxR = 0, maxU = 0;
    for (const x of [box.min.x, box.max.x]) for (const y of [box.min.y, box.max.y]) for (const z of [box.min.z, box.max.z]) {
      const v = new THREE.Vector3(x, y, z).sub(center);
      maxR = Math.max(maxR, Math.abs(v.dot(right)));
      maxU = Math.max(maxU, Math.abs(v.dot(up)));
    }
    const aspect = this.width / this.height;
    const viewH = Math.max(maxU * 2 * 1.38, ((maxR * 2) / aspect) * (aspect < 1.1 ? 1.04 : 1.22), 7);
    this.home = { target: new THREE.Vector3(center.x, 0, center.z), viewH };
    this.viewH = viewH;
    if (recenter) {
      this.targetTo.copy(this.home.target);
      this.target.copy(this.home.target);
      this.zoomTo = 1;
      if (this.intro < 1) this.zoom = 0.86;
    }
  }

  private loop(now: number): void {
    this.raf = requestAnimationFrame(this.loop);
    const dt = Math.min(0.05, (now - this.last) / 1000);
    this.last = now;
    if (document.hidden) return;
    const instant = !!this.settings?.reducedMotion;
    const k = instant ? 1 : 1 - Math.pow(0.0008, dt);

    // turntable when idle
    if (this.settings?.autoRotate && !this.drag && now - this.lastInput > 5000) {
      if (!this.nextAutoTurn) this.nextAutoTurn = now + 400;
      if (now > this.nextAutoTurn) { this.yawTo += Math.PI / 2; this.nextAutoTurn = now + 5000; }
    }

    this.yaw += (this.yawTo - this.yaw) * k;
    this.zoom += (this.zoomTo - this.zoom) * k;
    this.target.lerp(this.targetTo, k);
    this.intro = Math.min(1, this.intro + dt * 2.2);

    const aspect = this.width / this.height;
    const h = this.viewH / this.zoom;
    this.camera.left = (-h * aspect) / 2; this.camera.right = (h * aspect) / 2;
    this.camera.top = h / 2; this.camera.bottom = -h / 2;
    const dir = new THREE.Vector3(Math.sin(this.yaw) * Math.cos(PITCH), Math.sin(PITCH), Math.cos(this.yaw) * Math.cos(PITCH));
    this.camera.position.copy(this.target).addScaledVector(dir, 60);
    this.camera.lookAt(this.target);
    this.camera.updateProjectionMatrix();

    this.grid.visible = this.settings?.grid ?? true;
    this.sim.tick(dt);
    if (this.bench) {
      const e = this.intro < 1 ? easeOutBack(this.intro) : 1;
      this.bench.root.scale.setScalar(0.92 + 0.08 * e);
      this.bench.root.position.y = (1 - Math.min(1, this.intro * 1.4)) * 0.6;
      this.bench.update(this.sim, now / 1000, dt);
      this.animateFlow(now / 1000);
    }
    this.renderer.render(this.scene, this.camera);
    this.onFrame();
  }

  private animateFlow(t: number): void {
    const on = !!this.settings?.flow && this.sim.state() === 'running';
    for (const w of this.bench!.wires) {
      let level = 0;
      if (on) level = w.pin >= 0 && w.pin < 14 ? this.sim.pins[w.pin] : 0.7;
      w.dots.forEach((d, i) => {
        const dirSign = w.pin === -1 ? -1 : 1;
        let u = (t * (0.25 + level * 0.35) + i / w.dots.length) % 1;
        if (dirSign < 0) u = 1 - u;
        d.position.copy(w.curve.getPoint(u));
        (d.material as THREE.MeshBasicMaterial).opacity = level > 0.02 ? 0.95 : 0;
      });
    }
  }

  // ───────── input ─────────
  private listeners: [EventTarget, string, EventListener, AddEventListenerOptions?][] = [];
  private on<T extends Event>(t: EventTarget, type: string, fn: (e: T) => void, opts?: AddEventListenerOptions): void {
    const f = fn as unknown as EventListener;
    t.addEventListener(type, f, opts);
    this.listeners.push([t, type, f, opts]);
  }
  private unbind(): void { for (const [t, type, f, o] of this.listeners) t.removeEventListener(type, f, o); this.listeners = []; }

  private pick(clientX: number, clientY: number): { part: string; interact?: string } | null {
    if (!this.bench) return null;
    const rect = this.canvas.getBoundingClientRect();
    const ndc = new THREE.Vector2(((clientX - rect.left) / rect.width) * 2 - 1, -((clientY - rect.top) / rect.height) * 2 + 1);
    this.raycaster.setFromCamera(ndc, this.camera);
    const hits = this.raycaster.intersectObject(this.bench.root, true);
    for (const h of hits) {
      let o: THREE.Object3D | null = h.object;
      while (o) {
        if (o.userData['part']) return { part: o.userData['part'], interact: o.userData['interact'] };
        o = o.parent;
      }
    }
    return null;
  }

  private bindInput(): void {
    const c = this.canvas;
    this.on<PointerEvent>(c, 'pointerdown', (e) => {
      c.setPointerCapture(e.pointerId);
      this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      this.touch();
      if (this.pointers.size === 2) {
        const [a, b] = [...this.pointers.values()];
        this.pinchDist = Math.hypot(a.x - b.x, a.y - b.y);
        if (this.drag?.mode === 'part') this.endInteraction();
        this.drag = null;
        return;
      }
      const hit = this.pick(e.clientX, e.clientY);
      const interact = hit?.interact && hit.interact !== 'inspect' ? hit.interact : undefined;
      if (interact) {
        this.drag = { mode: 'part', x: e.clientX, y: e.clientY, moved: false, interact, part: hit!.part, startValue: interact === 'knob' ? this.sim.inputs.pot : this.sim.inputs.distance };
        this.beginInteraction(interact);
      } else {
        this.drag = { mode: e.button === 2 || e.shiftKey ? 'rotate' : 'pan', x: e.clientX, y: e.clientY, moved: false, part: hit?.part };
      }
      c.dataset['drag'] = this.drag.mode;
    });
    this.on<PointerEvent>(c, 'pointermove', (e) => {
      const p = this.pointers.get(e.pointerId);
      if (p) { p.x = e.clientX; p.y = e.clientY; }
      if (this.pointers.size === 2) {
        const [a, b] = [...this.pointers.values()];
        const d = Math.hypot(a.x - b.x, a.y - b.y);
        if (this.pinchDist) this.zoomTo = THREE.MathUtils.clamp(this.zoomTo * (d / this.pinchDist), 0.55, 3.2);
        this.pinchDist = d;
        return;
      }
      if (!this.drag) {
        const hit = this.pick(e.clientX, e.clientY);
        this.onHover(hit ? hit.interact ?? 'inspect' : null);
        return;
      }
      const dx = e.clientX - this.drag.x, dy = e.clientY - this.drag.y;
      if (Math.abs(dx) + Math.abs(dy) > 3) this.drag.moved = true;
      if (this.drag.mode === 'pan') {
        this.panScreen(-(e.movementX || 0), -(e.movementY || 0));
        this.target.copy(this.targetTo);
      } else if (this.drag.mode === 'rotate') {
        this.yawTo -= (e.movementX || 0) * 0.008;
        this.yaw = this.yawTo;
      } else if (this.drag.interact === 'knob') {
        this.sim.inputs.pot = THREE.MathUtils.clamp((this.drag.startValue ?? 0) + (dx - dy) / 260, 0, 1);
      } else if (this.drag.interact === 'slide:distance' && this.bench?.slide) {
        const { right } = this.groundAxes();
        const per = this.viewH / this.zoom / this.height;
        const along = (dx * right.dot(this.bench.slide.axis) + dy * 0.5) * per;
        this.sim.inputs.distance = THREE.MathUtils.clamp((this.drag.startValue ?? 80) + along / this.bench.slide.perUnit, 4, 120);
      }
    });
    const up = (e: PointerEvent) => {
      this.pointers.delete(e.pointerId);
      if (this.pointers.size < 2) this.pinchDist = 0;
      const d = this.drag;
      if (!d) return;
      this.drag = null;
      delete c.dataset['drag'];
      if (d.mode === 'part') { this.endInteraction(); if (!d.moved) this.onPick(d.part ?? null); return; }
      if (!d.moved) this.onPick(d.part ?? null);
    };
    this.on<PointerEvent>(c, 'pointerup', up);
    this.on<PointerEvent>(c, 'pointercancel', up);
    this.on<Event>(c, 'contextmenu', (e) => e.preventDefault());
    this.on<WheelEvent>(c, 'wheel', (e) => { e.preventDefault(); this.zoomBy(Math.exp(-e.deltaY * 0.0015)); }, { passive: false });
  }

  private activeInteraction = '';
  private beginInteraction(kind: string): void {
    const i = this.sim.inputs;
    this.activeInteraction = kind;
    if (kind.startsWith('press:')) i.buttons[+kind.slice(6)] = true;
    else if (kind === 'hold:covered') i.covered = true;
    else if (kind === 'hold:warming') i.warming = true;
    else if (kind === 'hold:pressing') i.pressing = true;
    else if (kind === 'tap:motion') i.motionUntil = performance.now() + 2600;
    else if (kind === 'tap:water') i.moisture = Math.min(0.95, i.moisture + 0.4);
  }
  private endInteraction(): void {
    const i = this.sim.inputs;
    const kind = this.activeInteraction;
    if (kind.startsWith('press:')) i.buttons[+kind.slice(6)] = false;
    else if (kind === 'hold:covered') i.covered = false;
    else if (kind === 'hold:warming') i.warming = false;
    else if (kind === 'hold:pressing') i.pressing = false;
    this.activeInteraction = '';
  }
}

function easeOutBack(x: number): number {
  const c1 = 1.4, c3 = c1 + 1;
  return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2);
}

function disposeTree(root: THREE.Object3D): void {
  root.traverse((o) => {
    const m = o as THREE.Mesh;
    if (m.geometry && !(o instanceof THREE.LineSegments)) m.geometry.dispose();
  });
}
