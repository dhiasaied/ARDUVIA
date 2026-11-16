import { gsap } from 'gsap';

/**
 * GSAP motion helpers. Everything is skipped (or made instant) when the
 * learner asked for reduced motion, in the app settings or in the OS.
 */
let reduced = false;
export function setReducedMotion(value: boolean): void { reduced = value; }
export function motionReduced(): boolean {
  return reduced || (typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches);
}

export function animateIn(el: Element, from: { x?: number; y?: number; scale?: number } = {}): void {
  if (motionReduced()) return;
  gsap.fromTo(el, { autoAlpha: 0, x: from.x ?? 0, y: from.y ?? 12, scale: from.scale ?? 1 },
    { autoAlpha: 1, x: 0, y: 0, scale: 1, duration: 0.5, ease: 'power3.out', clearProps: 'transform,opacity,visibility' });
}

export function stagger(targets: Element[] | NodeListOf<Element>, opts: { y?: number; delay?: number; each?: number } = {}): void {
  if (motionReduced() || !targets.length) return;
  gsap.fromTo(targets, { autoAlpha: 0, y: opts.y ?? 16 },
    { autoAlpha: 1, y: 0, duration: 0.55, ease: 'power3.out', delay: opts.delay ?? 0, stagger: opts.each ?? 0.06, clearProps: 'transform,opacity,visibility' });
}

/** Count a number up inside an element. */
export function countUp(el: HTMLElement, to: number, from = 0): void {
  if (motionReduced()) { el.textContent = String(to); return; }
  const o = { v: from };
  gsap.to(o, { v: to, duration: 1.1, ease: 'power2.out', onUpdate: () => { el.textContent = String(Math.round(o.v)); } });
}

/** A short burst of confetti inside a positioned container. */
export function confetti(container: HTMLElement, origin?: { x: number; y: number }): void {
  if (motionReduced()) return;
  const colors = ['#52796f', '#a8b9a1', '#c58b55', '#668c70', '#e5e9df', '#bd6862'];
  const rect = container.getBoundingClientRect();
  const ox = origin?.x ?? rect.width / 2;
  const oy = origin?.y ?? rect.height / 3;
  for (let i = 0; i < 46; i++) {
    const p = document.createElement('i');
    p.className = 'confetti';
    p.style.background = colors[i % colors.length];
    p.style.left = `${ox}px`;
    p.style.top = `${oy}px`;
    container.appendChild(p);
    const angle = Math.random() * Math.PI * 2;
    const dist = 90 + Math.random() * 190;
    gsap.timeline({ onComplete: () => p.remove() })
      .to(p, { x: Math.cos(angle) * dist, y: Math.sin(angle) * dist - 60, rotation: Math.random() * 540, duration: 0.9, ease: 'power3.out' })
      .to(p, { y: `+=${120 + Math.random() * 120}`, autoAlpha: 0, duration: 1.1, ease: 'power1.in' }, '-=0.15');
  }
}

/** Gentle highlight pulse (e.g. when a value changes). */
export function pulse(el: Element): void {
  if (motionReduced()) return;
  gsap.fromTo(el, { scale: 1 }, { scale: 1.06, duration: 0.18, yoyo: true, repeat: 1, ease: 'power2.out' });
}

/** Cross-fade content when a lesson changes. */
export function lessonSwap(targets: Element[]): void {
  if (motionReduced() || !targets.length) return;
  gsap.fromTo(targets, { autoAlpha: 0.35, y: 8 }, { autoAlpha: 1, y: 0, duration: 0.45, ease: 'power2.out', stagger: 0.05, clearProps: 'transform,opacity,visibility' });
}
