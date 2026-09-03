/* main.js — script thường. Sinh từ main.mjs. Chờ SH.boot() từ inline module
   cuối index.html (sau khi thử nạp three.js). */
(() => {
'use strict';
const { PullApartScene, INTRO_COPY, NEXT_COPY, PROBLEM_LABELS, getPointerTarget, getResponsiveMode, mapSceneState } = window.SH;

if (window.gsap && window.ScrollTrigger) gsap.registerPlugin(ScrollTrigger);
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
const finePointer = window.matchMedia('(pointer: fine)');
const cleanups = [];

function canUseWebGL() {
  try {
    const canvas = document.createElement('canvas');
    return Boolean(window.THREE) && Boolean(canvas.getContext('webgl2') || canvas.getContext('webgl'));
  } catch { return false; }
}

function initShell() {
  window.lucide?.createIcons({ attrs: { 'stroke-width': 1.6 } });
  document.querySelectorAll('[data-disabled-link]').forEach((link) => {
    link.addEventListener('click', (event) => event.preventDefault());
  });

  const header = document.querySelector('.site-header');
  const menu = document.querySelector('.menu-toggle');
  const drawer = document.querySelector('#mobile-drawer');
  const close = document.querySelector('.drawer-close');
  const scrim = document.querySelector('.drawer-scrim');
  const top = document.querySelector('#back-to-top-button');
  let returnFocus = null;
  const toggleDrawer = (open) => {
    drawer.dataset.state = open ? 'open' : 'closed';
    drawer.setAttribute('aria-hidden', String(!open));
    menu.setAttribute('aria-expanded', String(open));
    scrim.hidden = !open;
    document.body.classList.toggle('drawer-open', open);
    if (open) { returnFocus = document.activeElement; close.focus(); }
    else if (returnFocus instanceof HTMLElement) returnFocus.focus();
  };
  menu.addEventListener('click', () => toggleDrawer(true));
  close.addEventListener('click', () => toggleDrawer(false));
  drawer.querySelectorAll('a[href^="#"]:not([data-disabled-link])').forEach((link) => {
    link.addEventListener('click', () => toggleDrawer(false));
  });
  scrim.addEventListener('click', () => toggleDrawer(false));
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && drawer.dataset.state === 'open') toggleDrawer(false);
  });
  top.addEventListener('click', () => window.scrollTo({ top: 0, behavior: reducedMotion.matches ? 'auto' : 'smooth' }));
  const headerTrigger = ScrollTrigger.create({
    start: 16, end: 'max',
    onUpdate: ({ scroll }) => header.dataset.scrolled = String(scroll() > 16),
  });
  const topTrigger = ScrollTrigger.create({
    start: 580, end: 'max',
    onEnter: () => document.body.classList.add('back-to-top-visible'),
    onLeaveBack: () => document.body.classList.remove('back-to-top-visible'),
  });
  cleanups.push(() => { headerTrigger.kill(); topTrigger.kill(); });
}

function initWhoTilt() {
  // Same damped pointer tilt as the pull-apart canvas, applied to the SVG.
  const visual = document.querySelector('.who__visual');
  const diagram = document.querySelector('.who__diagram');
  if (!visual || !diagram || reducedMotion.matches || !finePointer.matches) return;
  let targetX = 0; let targetY = 0; let currentX = 0; let currentY = 0; let raf = 0;
  const tick = () => {
    raf = 0;
    currentX += (targetX - currentX) * 0.085;
    currentY += (targetY - currentY) * 0.085;
    diagram.style.transform = `rotateX(${currentX.toFixed(3)}deg) rotateY(${currentY.toFixed(3)}deg)`;
    if (Math.abs(currentX - targetX) > 0.01 || Math.abs(currentY - targetY) > 0.01) {
      raf = requestAnimationFrame(tick);
    }
  };
  const move = (event) => {
    const rect = visual.getBoundingClientRect();
    const nx = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    const ny = ((event.clientY - rect.top) / rect.height) * 2 - 1;
    targetY = nx * 7;
    targetX = -ny * 4.5;
    if (!raf) raf = requestAnimationFrame(tick);
  };
  const leave = () => {
    targetX = 0; targetY = 0;
    if (!raf) raf = requestAnimationFrame(tick);
  };
  // Pointer-follow disabled by request.
  void move; void leave;
  cleanups.push(() => {
    visual.removeEventListener('pointermove', move);
    visual.removeEventListener('pointerleave', leave);
    if (raf) cancelAnimationFrame(raf);
  });
}

function initStackTilt() {
  // Mouseover rotates the WHOLE stack diagram (damped pointer tilt, same
  // recipe as the Who section). Per-card hover lift was removed.
  const visual = document.querySelector('#your-stack .stack__main');
  const diagram = document.querySelector('.stack__diagram');
  if (!visual || !diagram || reducedMotion.matches || !finePointer.matches) return;
  let targetX = 0; let targetY = 0; let currentX = 0; let currentY = 0; let raf = 0;
  const tick = () => {
    raf = 0;
    currentX += (targetX - currentX) * 0.085;
    currentY += (targetY - currentY) * 0.085;
    diagram.style.transform = `rotateX(${currentX.toFixed(3)}deg) rotateY(${currentY.toFixed(3)}deg)`;
    if (Math.abs(currentX - targetX) > 0.01 || Math.abs(currentY - targetY) > 0.01) {
      raf = requestAnimationFrame(tick);
    }
  };
  const move = (event) => {
    const rect = visual.getBoundingClientRect();
    const nx = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    const ny = ((event.clientY - rect.top) / rect.height) * 2 - 1;
    targetY = nx * 8;
    targetX = -ny * 5;
    if (!raf) raf = requestAnimationFrame(tick);
  };
  const leave = () => {
    targetX = 0; targetY = 0;
    if (!raf) raf = requestAnimationFrame(tick);
  };
  // Pointer-follow disabled by request.
  void move; void leave;
  cleanups.push(() => {
    visual.removeEventListener('pointermove', move);
    visual.removeEventListener('pointerleave', leave);
    if (raf) cancelAnimationFrame(raf);
  });
}


function initStackLoopReveal() {
  // Vòng đáy (line + courier) ẩn lúc đầu; khi các dot trên chuỗi chạy về
  // tới logo (sau ~1 chu kỳ chuỗi) thì mới xuất hiện.
  const section = document.querySelector('#your-stack');
  const parts = document.querySelectorAll('.stack-loop-piece');
  if (!section || !parts.length) return;
  let done = false;
  const observer = new IntersectionObserver(([entry]) => {
    if (!entry.isIntersecting || done) return;
    done = true;
    setTimeout(() => {
      // line VẼ LAN dần từ phía logo về card 1 (draw-on), xong mới thả courier
      const path = document.querySelector('path.stack-loop-piece');
      if (path && path.getTotalLength) {
        const len = path.getTotalLength();
        path.classList.remove('stack-loop-hidden');
        path.style.strokeDasharray = String(len);
        path.style.strokeDashoffset = String(-len);
        path.getBoundingClientRect();
        path.style.transition = 'stroke-dashoffset 1.1s ease-out';
        path.style.strokeDashoffset = '0';
        setTimeout(() => {
          path.style.transition = '';
          path.style.strokeDasharray = '';
          path.style.strokeDashoffset = '';
        }, 1200);
      }
      setTimeout(() => parts.forEach((el) => el.classList.remove('stack-loop-hidden')), 1150);
    }, 2300);
    observer.disconnect();
  }, { threshold: 0.3 });
  observer.observe(section);
}

function initStackLabelHover() {
  // Hover a card cluster -> its floating label brightens to white
  const svg = document.querySelector('.stack__diagram');
  if (!svg) return;
  svg.querySelectorAll('[data-cluster]').forEach((group) => {
    const label = svg.querySelector(`[data-cluster-label="${group.dataset.cluster}"]`);
    if (!label) return;
    const on = () => label.classList.add('is-lit');
    const off = () => label.classList.remove('is-lit');
    group.addEventListener('pointerenter', on);
    group.addEventListener('pointerleave', off);
    cleanups.push(() => {
      group.removeEventListener('pointerenter', on);
      group.removeEventListener('pointerleave', off);
    });
  });
}

function initWhoDotRoulette() {
  // Layer 1 (front card of Who-we-are): dots toggle on/off at random spots on
  // the card — roulette like the positioning scene but faster. The links form
  // TWO FUNNELS (ref Scale hero): layer-1 curves bundle INTO the core from
  // the lower-left, and the core fans OUT to layer-3 toward the upper-right.
  // Couriers ride every curve, several per line, fast.
  const svg = document.querySelector('.who__diagram');
  if (!svg || reducedMotion.matches) return;
  const dotsGroup = svg.querySelector('#who-l1-dots');
  const linesGroup = svg.querySelector('.who-lines');
  if (!dotsGroup || !linesGroup) return;
  const seeded = (seedValue) => {
    let seed = seedValue >>> 0;
    return () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
  };
  const colors = ['#2979FF', '#535BFF', '#6A49FF', '#7C4DFF'];
  const CORE = { x: 322, y: 298 };
  const FUNNEL1 = { x: 273, y: 348 }; // bundle point of the layer-1 -> core funnel
  const FUNNEL2 = { x: 373, y: 250 }; // bundle point of the core -> layer-3 funnel
  const TAN14 = Math.tan(14 * Math.PI / 180);
  const SVG_NS = 'http://www.w3.org/2000/svg';
  const quadAt = (a, c, b, t, out) => {
    const s = 1 - t;
    out.x = s * s * a.x + 2 * s * t * c.x + t * t * b.x;
    out.y = s * s * a.y + 2 * s * t * c.y + t * t * b.y;
  };
  const courierGroup = document.createElementNS(SVG_NS, 'g');
  linesGroup.after(courierGroup);
  const rnd0 = seeded(0xfa2ce);
  const makeCouriers = (count, speedBase) => {
    const list = [];
    for (let k = 0; k < count; k += 1) {
      const el = document.createElementNS(SVG_NS, 'circle');
      el.setAttribute('r', '2.1');
      el.setAttribute('fill', '#4f7fe0');
      courierGroup.appendChild(el);
      list.push({ el, phase: (k / count + rnd0() * 0.4) % 1, speed: speedBase + rnd0() * 0.5 });
    }
    return list;
  };
  // layer-3: swap the 10 static core->dot lines for funnel curves + couriers
  const funnelOut = [];
  linesGroup.querySelectorAll('line').forEach((line) => {
    const from = { x: Number(line.getAttribute('x1')), y: Number(line.getAttribute('y1')) };
    const to = { x: Number(line.getAttribute('x2')), y: Number(line.getAttribute('y2')) };
    if (from.x === CORE.x && from.y === CORE.y) {
      const ctrl = { x: FUNNEL2.x + (rnd0() - 0.5) * 20, y: FUNNEL2.y + (rnd0() - 0.5) * 20 };
      const path = document.createElementNS(SVG_NS, 'path');
      path.setAttribute('d', `M ${CORE.x} ${CORE.y} Q ${ctrl.x.toFixed(1)} ${ctrl.y.toFixed(1)} ${to.x} ${to.y}`);
      linesGroup.appendChild(path);
      funnelOut.push({ ctrl, to, couriers: makeCouriers(2, 0.38) });
    }
    line.remove();
  });
  // layer-1 roulette slots (funnel-in curves, redrawn on every reroll)
  dotsGroup.innerHTML = '';
  const slots = [];
  for (let i = 0; i < 20; i += 1) {
    const color = colors[i % colors.length];
    const path = document.createElementNS(SVG_NS, 'path');
    linesGroup.appendChild(path);
    const group = document.createElementNS(SVG_NS, 'g');
    const wave = document.createElementNS(SVG_NS, 'circle');
    wave.setAttribute('class', 'who-wave');
    wave.setAttribute('r', '8'); wave.setAttribute('stroke', color);
    const dot = document.createElementNS(SVG_NS, 'circle');
    dot.setAttribute('class', 'who-dot');
    dot.setAttribute('r', String(5.5 + (i % 3) * 0.7));
    dot.setAttribute('fill', color);
    group.appendChild(wave); group.appendChild(dot);
    dotsGroup.appendChild(group);
    slots.push({
      group, path, wave, dot,
      at: { x: 0, y: 0 }, ctrl: { x: 0, y: 0 },
      couriers: makeCouriers(2, 0.6),
      cycle: 1.7 + (i % 5) * 0.22, // chậm lại xíu
      offset: (i * 0.37) % 1,
      epoch: -1, on: false,
    });
  }
  const sample = { x: 0, y: 0 };
  let raf = 0; let visible = false;
  const tick = (now) => {
    raf = 0;
    const t = now / 1000;
    slots.forEach((slot, i) => {
      const c = (t + slot.offset * slot.cycle) / slot.cycle;
      const epoch = Math.floor(c);
      const local = c - epoch;
      if (epoch !== slot.epoch) {
        // new cycle: reroll on/off + a fresh random spot on the layer-1 card
        slot.epoch = epoch;
        const rnd = seeded(0x5eed + i * 7919 + epoch * 104729);
        slot.on = rnd() < 0.85;
        const u = 18 + rnd() * 262; // local coords in the 298x290 card
        const v = 20 + rnd() * 250;
        slot.at.x = 32 + 0.82 * u; // translate(32 330) scale(.82 1) skewY(-14)
        slot.at.y = 330 + v - TAN14 * u;
        slot.ctrl.x = FUNNEL1.x + (rnd() - 0.5) * 22;
        slot.ctrl.y = FUNNEL1.y + (rnd() - 0.5) * 22;
        slot.wave.setAttribute('cx', slot.at.x.toFixed(1)); slot.wave.setAttribute('cy', slot.at.y.toFixed(1));
        slot.dot.setAttribute('cx', slot.at.x.toFixed(1)); slot.dot.setAttribute('cy', slot.at.y.toFixed(1));
        slot.path.setAttribute('d',
          `M ${slot.at.x.toFixed(1)} ${slot.at.y.toFixed(1)} Q ${slot.ctrl.x.toFixed(1)} ${slot.ctrl.y.toFixed(1)} ${CORE.x} ${CORE.y}`);
      }
      const show = slot.on && local < 0.72; // hard toggle, no fade
      slot.group.style.display = show ? '' : 'none';
      slot.path.style.display = show ? '' : 'none';
      slot.couriers.forEach((courier) => {
        if (!show) { courier.el.style.display = 'none'; return; }
        courier.el.style.display = '';
        const ct = (t * courier.speed + courier.phase) % 1;
        quadAt(slot.at, slot.ctrl, CORE, ct, sample);
        courier.el.setAttribute('cx', sample.x.toFixed(1));
        courier.el.setAttribute('cy', sample.y.toFixed(1));
        courier.el.setAttribute('opacity', (Math.sin(ct * Math.PI) * 0.9).toFixed(2));
      });
    });
    funnelOut.forEach((entry) => {
      entry.couriers.forEach((courier) => {
        const ct = (t * courier.speed + courier.phase) % 1;
        quadAt(CORE, entry.ctrl, entry.to, ct, sample);
        courier.el.setAttribute('cx', sample.x.toFixed(1));
        courier.el.setAttribute('cy', sample.y.toFixed(1));
        courier.el.setAttribute('opacity', (Math.sin(ct * Math.PI) * 0.9).toFixed(2));
      });
    });
    if (visible) raf = requestAnimationFrame(tick);
  };
  const observer = new IntersectionObserver(([entry]) => {
    visible = entry.isIntersecting;
    if (visible && !raf) raf = requestAnimationFrame(tick);
  }, { threshold: 0.05 });
  observer.observe(svg);
  cleanups.push(() => { observer.disconnect(); if (raf) cancelAnimationFrame(raf); });
}

function initCardTilt() {
  // Pointer-follow tilt disabled by request.
  return;
  /* eslint-disable no-unreachable */
  if (reducedMotion.matches || !finePointer.matches) return;
  document.querySelectorAll('.stack-card').forEach((cardElement) => {
    const move = (event) => {
      const rect = cardElement.getBoundingClientRect();
      const nx = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      const ny = ((event.clientY - rect.top) / rect.height) * 2 - 1;
      cardElement.style.transform =
        `perspective(700px) rotateX(${(-ny * 3.2).toFixed(2)}deg) rotateY(${(nx * 4.2).toFixed(2)}deg) translateX(-4px)`;
    };
    const leave = () => { cardElement.style.transform = ''; };
    cardElement.addEventListener('pointermove', move, { passive: true });
    cardElement.addEventListener('pointerleave', leave);
    cleanups.push(() => {
      cardElement.removeEventListener('pointermove', move);
      cardElement.removeEventListener('pointerleave', leave);
    });
  });
}

function initSpotlights() {
  // Cursor-following spotlight disabled by request — the --mx/--my vars keep
  // their static 50% defaults, so the hover glows no longer track the pointer.
  return;
  /* eslint-disable no-unreachable */
  if (!finePointer.matches) return;
  document.querySelectorAll('.who, .how-slider__layout, .trust-card, .stack-card, .own-card, .security, .final-cta, .why').forEach((element) => {
    const move = (event) => {
      const rect = element.getBoundingClientRect();
      element.style.setProperty('--mx', `${(event.clientX - rect.left).toFixed(1)}px`);
      element.style.setProperty('--mxv', `${event.clientX.toFixed(1)}px`);
      element.style.setProperty('--my', `${(event.clientY - rect.top).toFixed(1)}px`);
    };
    element.addEventListener('pointermove', move, { passive: true });
    cleanups.push(() => element.removeEventListener('pointermove', move));
  });
}

function initFallbackOrbit() {
  // Static-mode stand-in: all 22 problem labels on a draggable 3D carousel.
  const shell = document.querySelector('#pf-orbit');
  if (!shell || shell.dataset.ready) return;
  shell.dataset.ready = '1';
  const colors = ['#2979FF', '#535BFF', '#6A49FF', '#7C4DFF'];
  // dashed spokes + travelling couriers live in an SVG layer under the labels
  const SVG_NS = 'http://www.w3.org/2000/svg';
  const spokesSvg = document.createElementNS(SVG_NS, 'svg');
  spokesSvg.setAttribute('class', 'pf-orbit__spokes');
  spokesSvg.setAttribute('aria-hidden', 'true');
  const spokeGroup = document.createElementNS(SVG_NS, 'g');
  spokeGroup.setAttribute('class', 'who-lines');
  spokeGroup.setAttribute('stroke-dasharray', '3 6');
  spokesSvg.appendChild(spokeGroup);
  shell.appendChild(spokesSvg);
  const orbitLabels = [...PROBLEM_LABELS]
    .sort(() => Math.random() - 0.5)
    .slice(0, 14 + Math.floor(Math.random() * 5));
  const nodes = orbitLabels.map((label, index) => {
    const el = document.createElement('span');
    el.className = 'pf-node';
    el.innerHTML = `<i style="background:${colors[index % colors.length]}"></i>${label}`;
    shell.appendChild(el);
    const line = document.createElementNS(SVG_NS, 'line');
    spokeGroup.appendChild(line);
    const courier = document.createElementNS(SVG_NS, 'circle');
    courier.setAttribute('r', '2.2');
    courier.setAttribute('fill', '#4f7fe0');
    spokesSvg.appendChild(courier);
    // labels circle the logo on staggered elliptical rings inside the rim
    const count = orbitLabels.length;
    return {
      el, line, courier,
      offset: (index / count) * Math.PI * 2,
      ring: 0.55 + (((index * 7) % count) / count) * 0.45,
      courierPhase: (index * 0.37) % 1,
      courierSpeed: 0.16 + (index % 4) * 0.035,
    };
  });

  const state = { angle: 0, velocity: 0, dragging: false, lastX: 0, raf: 0 };
  const radiusX = () => Math.min(shell.clientWidth * 0.42, 330);
  const radiusY = () => Math.min(shell.clientHeight * 0.36, 200);
  const render = () => {
    state.raf = 0;
    if (!state.dragging) {
      state.angle += 0.0012 + state.velocity;
      state.velocity *= 0.95;
    }
    const rx = radiusX();
    const ry = radiusY();
    const cw = shell.clientWidth / 2;
    const ch = shell.clientHeight / 2;
    spokesSvg.setAttribute('viewBox', `0 0 ${shell.clientWidth} ${shell.clientHeight}`);
    const now = performance.now() / 1000;
    nodes.forEach((node) => {
      const a = state.angle + node.offset;
      const depth = (1 - Math.cos(a)) / 2; // 0 back (top) .. 1 front (bottom)
      const x = Math.sin(a) * rx * node.ring;
      const ny = -Math.cos(a) * ry * node.ring;
      const scale = 0.58 + 0.52 * depth;
      node.el.style.transform = `translate(-50%, -50%) translate(${x.toFixed(1)}px, ${ny.toFixed(1)}px) scale(${scale.toFixed(3)})`;
      node.el.style.opacity = (0.35 + 0.65 * depth).toFixed(3);
      node.el.style.zIndex = String(depth > 0.6 ? 20 : 4);
      // dashed spoke logo -> label, dimmed toward the back
      const tx = cw + x; const ty = ch + ny;
      node.line.setAttribute('x1', cw); node.line.setAttribute('y1', ch);
      node.line.setAttribute('x2', tx.toFixed(1)); node.line.setAttribute('y2', ty.toFixed(1));
      node.line.setAttribute('stroke', `rgba(245,247,250,${(0.08 + 0.2 * depth).toFixed(3)})`);
      // courier dot riding the spoke outward
      const t = (now * node.courierSpeed + node.courierPhase) % 1;
      node.courier.setAttribute('cx', (cw + (tx - cw) * t).toFixed(1));
      node.courier.setAttribute('cy', (ch + (ty - ch) * t).toFixed(1));
      node.courier.setAttribute('opacity', (Math.sin(t * Math.PI) * (0.3 + 0.6 * depth)).toFixed(3));
    });
    if (!reducedMotion.matches) state.raf = requestAnimationFrame(render);
  };
  const down = (event) => {
    state.dragging = true; state.lastX = event.clientX;
    shell.classList.add('is-dragging'); shell.setPointerCapture?.(event.pointerId);
  };
  const move = (event) => {
    if (!state.dragging) return;
    const dx = event.clientX - state.lastX; state.lastX = event.clientX;
    state.angle += dx * 0.006; state.velocity = dx * 0.0011;
  };
  const up = () => { state.dragging = false; shell.classList.remove('is-dragging'); };
  shell.addEventListener('pointerdown', down);
  shell.addEventListener('pointermove', move, { passive: true });
  shell.addEventListener('pointerup', up);
  shell.addEventListener('pointercancel', up);
  cleanups.push(() => { if (state.raf) cancelAnimationFrame(state.raf); });
  render();
  if (reducedMotion.matches) nodes.forEach(({ el }) => { el.style.opacity = '0.85'; });
}

async function initPullApart() {
  const section = document.querySelector('#positioning');
  const stage = document.querySelector('#pull-apart-stage');
  const canvas = document.querySelector('#pull-apart-canvas');
  const copy = document.querySelector('#pull-apart-copy');
  const nextCopy = document.querySelector('#pull-apart-next-copy');
  const fallback = document.querySelector('#pull-apart-fallback');
  const status = document.querySelector('.pull-apart__status');
  copy.querySelector('h1').textContent = INTRO_COPY.heading;
  copy.querySelector('p').textContent = INTRO_COPY.supporting;
  copy.dataset.contentSource = INTRO_COPY.label;
  nextCopy.querySelector('h2').textContent = NEXT_COPY.heading;
  nextCopy.querySelector('p').textContent = NEXT_COPY.supporting;

  // Page-open entrance for the first section's copy. Animates the inner
  // elements only: the outer container's opacity/transform stay owned by the
  // scroll-driven apply() below, so the two never fight.
  if (!reducedMotion.matches) {
    gsap.from(copy.querySelectorAll('h1, p'), {
      opacity: 0, y: 24, duration: 0.7, ease: 'power2.out',
      stagger: 0.12, delay: 0.15, clearProps: 'opacity,transform',
    });
  }

  const mode = getResponsiveMode(window.innerWidth, reducedMotion.matches, canUseWebGL());
  if (mode === 'static') {
    section.dataset.mode = 'static';
    fallback.setAttribute('aria-hidden', 'false');
    nextCopy.setAttribute('aria-hidden', 'false');
    initFallbackOrbit();
    status.textContent = reducedMotion.matches ? 'Motion reduced. Static system view shown.' : '';
    return;
  }
  const scene = new PullApartScene({ canvas, textureUrl: window.SH.LOGO_DARK_URI });
  try { await scene.init(); }
  catch (error) {
    console.error('Pull-apart scene could not start.', error);
    section.dataset.mode = 'static'; fallback.setAttribute('aria-hidden', 'false'); initFallbackOrbit(); return;
  }
  section.dataset.mode = 'animated'; status.textContent = '';
  const apply = (progress) => {
    scene.setProgress(progress);
    stage.classList.toggle('is-globe', progress > 0.6);
    const state = mapSceneState(progress, window.innerWidth);
    copy.style.opacity = String(state.copyOpacity);
    copy.style.transform = `translate3d(-50%, ${state.copyY}px, 0)`;
    nextCopy.style.opacity = String(state.nextCopyOpacity);
    nextCopy.style.transform = `translate3d(-50%, ${state.nextCopyY}px, 0)`;
    nextCopy.setAttribute('aria-hidden', String(state.nextCopyOpacity < .5));
  };
  const resize = () => {
    const rect = stage.getBoundingClientRect();
    scene.resize(rect.width, rect.height, Math.min(window.devicePixelRatio || 1, 2));
  };
  resize(); apply(0);
  const trigger = ScrollTrigger.create({
    trigger: section, start: 'top top', end: 'bottom bottom', pin: stage,
    pinSpacing: false, scrub: true, invalidateOnRefresh: true,
    onUpdate: ({ progress }) => apply(progress),
  });
  const observer = new IntersectionObserver(([entry]) => scene.setActive(entry.isIntersecting), { threshold: .01 });
  const resizer = new ResizeObserver(resize);
  observer.observe(section); resizer.observe(stage);
  const pointerMove = (event) => scene.setPointerTarget(getPointerTarget(event.clientX, event.clientY, stage.getBoundingClientRect()));
  const pointerLeave = () => scene.setPointerTarget({ x: 0, y: 0 });
  // Pointer parallax on the hero scene disabled by request (drag still works).
  if (false) {
    stage.addEventListener('pointermove', pointerMove, { passive: true });
    stage.addEventListener('pointerleave', pointerLeave, { passive: true });
  }
  // Drag the formed globe to spin it, mobile-orbit style
  const drag = { on: false, lastX: 0 };
  const dragDown = (event) => {
    drag.on = true; drag.lastX = event.clientX;
    stage.classList.add('is-grabbing');
  };
  const dragMove = (event) => {
    if (!drag.on) return;
    scene.addSpin((event.clientX - drag.lastX) * 0.005);
    drag.lastX = event.clientX;
  };
  const dragUp = () => { drag.on = false; stage.classList.remove('is-grabbing'); };
  stage.addEventListener('pointerdown', dragDown, { passive: true });
  stage.addEventListener('pointermove', dragMove, { passive: true });
  stage.addEventListener('pointerup', dragUp, { passive: true });
  stage.addEventListener('pointercancel', dragUp, { passive: true });
  cleanups.push(() => {
    trigger.kill(); observer.disconnect(); resizer.disconnect();
    stage.removeEventListener('pointermove', pointerMove); stage.removeEventListener('pointerleave', pointerLeave);
    scene.destroy();
  });
}

function initHow() {
  const section = document.querySelector('#how-it-works');
  if (!section) return;
  const slides = [...section.querySelectorAll('[data-how-slide]')];
  const progress = [...section.querySelectorAll('[data-how-go]')];
  const current = section.querySelector('[data-how-current]');
  const previous = section.querySelector('[data-how-prev]');
  const next = section.querySelector('[data-how-next]');
  const badge = section.querySelector('.how-slider__badge');
  const slidesWrap = section.querySelector('.how-slider__slides');
  const visual = section.querySelector('.how-slider__visual');
  const diagramEl = section.querySelector('#stack-diagram');
  const diagramBox = diagramEl.querySelector('.how-box');
  // Orbit-carousel behaviour: the ring eases to the active step, follows the
  // cursor slightly on hover, spins on drag with inertia, then springs home.
  const orbit = {
    angle: 0, target: 0, drag: 0, velocity: 0,
    hoverX: 0, hoverY: 0, hoverTX: 0, hoverTY: 0,
    dragging: false, lastX: 0, raf: 0,
  };
  const orbitTick = () => {
    orbit.raf = 0;
    orbit.angle += (orbit.target - orbit.angle) * 0.08;
    if (!orbit.dragging) {
      orbit.drag += orbit.velocity;
      orbit.velocity *= 0.94;
      orbit.drag *= 0.93; // spring back so the active wall realigns
    }
    orbit.hoverX += (orbit.hoverTX - orbit.hoverX) * 0.09;
    orbit.hoverY += (orbit.hoverTY - orbit.hoverY) * 0.09;
    diagramBox.style.transform =
      `rotateX(${(-14 + orbit.hoverX).toFixed(3)}deg) rotateY(${(orbit.angle + orbit.drag + orbit.hoverY).toFixed(3)}deg)`;
    const settled = !orbit.dragging
      && Math.abs(orbit.target - orbit.angle) < 0.02 && Math.abs(orbit.drag) < 0.02
      && Math.abs(orbit.velocity) < 0.02 && Math.abs(orbit.hoverTX - orbit.hoverX) < 0.02
      && Math.abs(orbit.hoverTY - orbit.hoverY) < 0.02;
    if (!settled) orbit.raf = requestAnimationFrame(orbitTick);
  };
  const orbitKick = () => { if (!orbit.raf) orbit.raf = requestAnimationFrame(orbitTick); };
  if (!reducedMotion.matches) {
    const onDown = (event) => {
      orbit.dragging = true; orbit.lastX = event.clientX; orbit.velocity = 0;
      diagramEl.classList.add('is-dragging');
      diagramEl.setPointerCapture?.(event.pointerId);
      orbitKick();
    };
    const onMove = (event) => {
      if (orbit.dragging) {
        const delta = (event.clientX - orbit.lastX) * 0.45;
        orbit.drag += delta; orbit.velocity = delta; orbit.lastX = event.clientX;
      }
      // Hover-follow tilt removed by request; dragging still rotates the diagram.
      orbitKick();
    };
    const onUp = () => { orbit.dragging = false; diagramEl.classList.remove('is-dragging'); orbitKick(); };
    const onLeave = () => { orbit.hoverTX = 0; orbit.hoverTY = 0; orbitKick(); };
    diagramEl.addEventListener('pointerdown', onDown);
    diagramEl.addEventListener('pointermove', onMove, { passive: true });
    diagramEl.addEventListener('pointerup', onUp);
    diagramEl.addEventListener('pointercancel', onUp);
    diagramEl.addEventListener('pointerleave', onLeave);
    cleanups.push(() => {
      diagramEl.removeEventListener('pointerdown', onDown);
      diagramEl.removeEventListener('pointermove', onMove);
      diagramEl.removeEventListener('pointerup', onUp);
      diagramEl.removeEventListener('pointercancel', onUp);
      diagramEl.removeEventListener('pointerleave', onLeave);
      if (orbit.raf) cancelAnimationFrame(orbit.raf);
    });
  }
  const diagram = {
    setStep(step) {
      diagramEl.dataset.step = String(step);
      orbit.target = -90 * step;
      if (reducedMotion.matches) {
        orbit.angle = orbit.target;
        diagramBox.style.transform = `rotateX(-14deg) rotateY(${orbit.target}deg)`;
      } else {
        orbitKick();
      }
    },
    setIntroProgress(value) { diagramEl.style.opacity = String(0.2 + 0.8 * value); },
    setActive() {}, resize() {}, destroy() {},
  };
  const accents = ['#2979ff', '#535bff', '#6a49ff', '#7c4dff'];
  let active = 0;
  let introActive = true;
  let scrollTrigger = null;
  const phaseCount = slides.length;
  const clamp01 = (value) => Math.max(0, Math.min(1, value));

  const setProgressBars = (activeIndex, localProgress = 0) => {
    progress.forEach((button, index) => {
      const isPast = activeIndex >= 0 && index < activeIndex;
      const isActive = index === activeIndex;
      const width = isPast ? 100 : isActive ? clamp01(localProgress) * 100 : 0;
      button.setAttribute('aria-selected', String(isActive));
      button.classList.toggle('is-complete', isPast);
      button.querySelector('span').style.width = `${width}%`;
    });
  };

  const setIntroPhase = (progressValue) => {
    const phase = clamp01(progressValue);
    const eased = phase * phase * (3 - 2 * phase);
    const reveal = clamp01((phase - .7) / .3);
    introActive = phase < .999;
    gsap.set(badge, { autoAlpha: reveal, y: (1 - reveal) * 16 });
    gsap.set(slidesWrap, { autoAlpha: reveal, y: (1 - reveal) * 30 });
    gsap.set(visual, { xPercent: -8 * (1 - eased), scale: 1 + .1 * (1 - eased), transformOrigin: '55% 50%' });
    diagram.setIntroProgress(eased);
  };

  const goTo = (requested, immediate = false) => {
    const target = Math.max(0, Math.min(slides.length - 1, requested));
    const incoming = slides[target]; const direction = target >= active ? 1 : -1;
    gsap.killTweensOf(slides);
    slides.forEach((slide, index) => {
      slide.classList.remove('is-leaving');
      const selected = index === target;
      slide.classList.toggle('is-active', selected);
      slide.setAttribute('aria-hidden', String(!selected));
      if (!selected) gsap.set(slide, { autoAlpha: 0, x: 0, visibility: 'hidden' });
    });
    if (!immediate && !reducedMotion.matches && target !== active) {
      gsap.fromTo(incoming,
        { autoAlpha: 0, x: 28 * direction, visibility: 'visible' },
        { autoAlpha: 1, x: 0, visibility: 'visible', duration: .45, ease: 'power3.out' });
    } else {
      gsap.set(incoming, { autoAlpha: 1, x: 0, visibility: 'visible' });
    }
    active = target;
    current.textContent = String(target + 1);
    section.style.setProperty('--slide-accent', accents[target]);
    diagram.setStep(target);
  };

  const scrollToStep = (requested) => {
    const target = Math.max(0, Math.min(slides.length - 1, requested));
    if (reducedMotion.matches) {
      goTo(target);
      setProgressBars(target, 1);
      previous.disabled = target === 0;
      next.disabled = target === slides.length - 1;
      return;
    }
    const distance = Math.max(1, section.offsetHeight - window.innerHeight);
    const progressTarget = Math.min(.995, (target + .08) / phaseCount);
    window.scrollTo({ top: section.offsetTop + distance * progressTarget, behavior: 'smooth' });
  };
  const onPrevious = () => scrollToStep(active - 1);
  const onNext = () => scrollToStep(active + 1);
  const onKeydown = (event) => {
    if (event.key === 'ArrowLeft') { event.preventDefault(); onPrevious(); }
    if (event.key === 'ArrowRight') { event.preventDefault(); onNext(); }
  };
  previous.addEventListener('click', onPrevious);
  next.addEventListener('click', onNext);
  section.addEventListener('keydown', onKeydown);
  progress.forEach((button) => button.addEventListener('click', () => scrollToStep(Number(button.dataset.howGo))));
  const resizer = new ResizeObserver(() => diagram.resize()); resizer.observe(visual);
  const observer = new IntersectionObserver(([entry]) => diagram.setActive(entry.isIntersecting && !reducedMotion.matches), { threshold: .05 });
  observer.observe(visual);
  goTo(0, true);
  setIntroPhase(1);
  setProgressBars(0, 0);
  previous.disabled = true;
  if (!reducedMotion.matches) {
    scrollTrigger = ScrollTrigger.create({
      trigger: section,
      start: 'top top',
      end: 'bottom bottom',
      scrub: .18,
      invalidateOnRefresh: true,
      onUpdate: ({ progress: scrollProgress }) => {
        const slideTimeline = Math.min(slides.length, clamp01(scrollProgress) * phaseCount);
        const target = Math.min(slides.length - 1, Math.floor(Math.min(slides.length - .0001, slideTimeline)));
        const localProgress = target === slides.length - 1 && slideTimeline >= slides.length
          ? 1
          : clamp01(slideTimeline - target);
        if (target !== active) goTo(target);
        setProgressBars(target, localProgress);
        previous.disabled = target === 0;
        next.disabled = target === slides.length - 1;
      },
    });
  } else {
    setProgressBars(0, 1);
    previous.disabled = true;
    next.disabled = false;
  }
  cleanups.push(() => {
    resizer.disconnect(); observer.disconnect(); scrollTrigger?.kill(); diagram.destroy(); gsap.killTweensOf(slides);
    previous.removeEventListener('click', onPrevious); next.removeEventListener('click', onNext); section.removeEventListener('keydown', onKeydown);
  });
}

function initHowPanelNet() {
  // How-it-works: only the ACTIVE card grows a roulette of dots (the other
  // cards keep their single default dot). From each lit dot an ARCED line
  // (vòng cung — same funnel recipe as Who-we-are) travels across to the
  // NEXT card's dot, with couriers riding every arc.
  if (reducedMotion.matches) return;
  const section = document.querySelector('#how-it-works');
  const visual = section?.querySelector('.how-slider__visual');
  const diagram = section?.querySelector('#stack-diagram');
  const panels = section ? [...section.querySelectorAll('.how-panel')] : [];
  if (!visual || !diagram || panels.length < 2) return;
  const SVG_NS = 'http://www.w3.org/2000/svg';
  const seeded = (seedValue) => {
    let seed = seedValue >>> 0;
    return () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
  };
  const colors = ['#2979FF', '#535BFF', '#6A49FF', '#7C4DFF'];
  // screen-space overlay: the cross-card arcs live here so they can bridge
  // two differently-rotated 3D planes
  const overlay = document.createElementNS(SVG_NS, 'svg');
  overlay.setAttribute('class', 'how-net-overlay');
  overlay.setAttribute('aria-hidden', 'true');
  visual.appendChild(overlay);
  const arcGroup = document.createElementNS(SVG_NS, 'g');
  arcGroup.setAttribute('fill', 'none');
  arcGroup.setAttribute('stroke', 'rgba(245,247,250,0.3)');
  arcGroup.setAttribute('stroke-width', '1');
  overlay.appendChild(arcGroup);
  const DOTS = 16;
  const arcs = [];
  for (let i = 0; i < DOTS; i += 1) {
    const path = document.createElementNS(SVG_NS, 'path');
    arcGroup.appendChild(path);
    const couriers = [0, 1].map((k) => {
      const courier = document.createElementNS(SVG_NS, 'circle');
      courier.setAttribute('r', '2.2');
      courier.setAttribute('fill', '#4f7fe0');
      overlay.appendChild(courier);
      return { el: courier, phase: ((i * 0.37) + k * 0.5) % 1, speed: 0.6 + ((i + k) % 4) * 0.09 };
    });
    arcs.push({ path, couriers });
  }
  // per-panel roulette dots (live on the panel's plane, only shown when the
  // panel is the active step)
  const nets = panels.map((panel, panelIndex) => {
    const svg = document.createElementNS(SVG_NS, 'svg');
    svg.setAttribute('class', 'how-panel__net');
    svg.setAttribute('aria-hidden', 'true');
    panel.appendChild(svg);
    const dots = [];
    for (let i = 0; i < DOTS; i += 1) {
      const dot = document.createElementNS(SVG_NS, 'circle');
      dot.setAttribute('r', '3');
      dot.setAttribute('fill', colors[i % colors.length]);
      svg.appendChild(dot);
      dots.push({
        el: dot, fx: 0.5, fy: 0.5, on: false, epoch: -1, shown: false,
        cycle: 1.4 + (i % 4) * 0.18, // chậm lại xíu
        offset: (i * 0.41) % 1,
      });
    }
    const size = { w: 100, h: 100 };
    const applySize = () => {
      size.w = Math.max(1, panel.clientWidth);
      size.h = Math.max(1, panel.clientHeight);
      svg.setAttribute('viewBox', `0 0 ${size.w} ${size.h}`);
    };
    applySize();
    return { panel, dots, size, applySize, panelIndex, centerDot: panel.querySelector('.how-panel__dot') };
  });
  let raf = 0; let visible = false;
  const tick = (now) => {
    raf = 0;
    const t = now / 1000;
    const active = Math.min(nets.length - 1, Math.max(0, Number(diagram.dataset.step) || 0));
    const nextNet = nets[(active + 1) % nets.length];
    nets.forEach((net, ni) => {
      const isActive = ni === active;
      net.dots.forEach((dot, i) => {
        if (!isActive) { dot.shown = false; dot.el.style.display = 'none'; return; }
        const c = (t + dot.offset * dot.cycle) / dot.cycle;
        const epoch = Math.floor(c);
        const local = c - epoch;
        if (epoch !== dot.epoch) {
          dot.epoch = epoch;
          const rnd = seeded(0xa0b0 + ni * 8887 + i * 7919 + epoch * 104729);
          dot.on = rnd() < 0.85;
          dot.fx = 0.08 + rnd() * 0.84;
          dot.fy = 0.14 + rnd() * 0.74;
          dot.el.setAttribute('cx', (dot.fx * net.size.w).toFixed(1));
          dot.el.setAttribute('cy', (dot.fy * net.size.h).toFixed(1));
        }
        dot.shown = dot.on && local < 0.72; // hard toggle
        dot.el.style.display = dot.shown ? '' : 'none';
      });
    });
    // arcs: active card's lit dots -> the next card's centre dot
    const overlayRect = overlay.getBoundingClientRect();
    const targetRect = (nextNet.centerDot || nextNet.panel).getBoundingClientRect();
    const target = {
      x: targetRect.left + targetRect.width / 2 - overlayRect.left,
      y: targetRect.top + targetRect.height / 2 - overlayRect.top,
    };
    const activeNet = nets[active];
    arcs.forEach((arc, i) => {
      const dot = activeNet.dots[i];
      if (!dot.shown) {
        arc.path.style.display = 'none';
        arc.couriers.forEach((courier) => { courier.el.style.display = 'none'; });
        return;
      }
      const dotRect = dot.el.getBoundingClientRect();
      const A = {
        x: dotRect.left + dotRect.width / 2 - overlayRect.left,
        y: dotRect.top + dotRect.height / 2 - overlayRect.top,
      };
      const dx = target.x - A.x; const dy = target.y - A.y;
      const len = Math.hypot(dx, dy) || 1;
      // alternate the bow: half the arcs curve up, half curve down, with
      // slightly different depths so the bundle reads organic
      const bowSign = i % 2 ? 1 : -1;
      const bow = Math.min(70, len * (0.14 + (i % 3) * 0.06)) * bowSign;
      const C = {
        x: (A.x + target.x) / 2 - (dy / len) * bow,
        y: (A.y + target.y) / 2 + (dx / len) * bow,
      };
      arc.path.setAttribute('d',
        `M ${A.x.toFixed(1)} ${A.y.toFixed(1)} Q ${C.x.toFixed(1)} ${C.y.toFixed(1)} ${target.x.toFixed(1)} ${target.y.toFixed(1)}`);
      arc.path.style.display = '';
      arc.couriers.forEach((courier) => {
        courier.el.style.display = '';
        const ct = (t * courier.speed + courier.phase) % 1;
        const s = 1 - ct;
        courier.el.setAttribute('cx', (s * s * A.x + 2 * s * ct * C.x + ct * ct * target.x).toFixed(1));
        courier.el.setAttribute('cy', (s * s * A.y + 2 * s * ct * C.y + ct * ct * target.y).toFixed(1));
        courier.el.setAttribute('opacity', (Math.sin(ct * Math.PI) * 0.9).toFixed(2));
      });
    });
    if (visible) raf = requestAnimationFrame(tick);
  };
  const observer = new IntersectionObserver(([entry]) => {
    visible = entry.isIntersecting;
    if (visible && !raf) raf = requestAnimationFrame(tick);
  }, { threshold: 0.05 });
  observer.observe(section);
  const resizer = new ResizeObserver(() => nets.forEach((net) => net.applySize()));
  nets.forEach((net) => resizer.observe(net.panel));
  cleanups.push(() => { observer.disconnect(); resizer.disconnect(); if (raf) cancelAnimationFrame(raf); });
}

function initGrowingLines() {
  // growing-lines: chạy sau khi DOM mount xong (inline script bị cơ chế
  // mount của trang nuốt mất nên chuyển vào đây)
  if (!document.getElementById('growing-lines')) return;

  // ---------- CẤU HÌNH — chỉnh ở đây ----------
  const CONFIG = {
    lineColor:   '#e8e8e8',   // màu nét
    bgColor:     '#000000',   // màu nền
    lineWidth:   1.2,         // độ dày nét
    tipRadius:   4.5,         // bán kính hình tròn ở đầu nhánh
    tipFilled:   false,       // true = tròn đặc, false = tròn rỗng
    duration:    11,          // tổng thời gian mọc (giây) — nhanh hơn
    maxNodes:    195,         // dài hơn, phủ ngang -> tự cân giữa
    seed:        { x: 0.07, y: 0.66 },  // dịch vào để tổng thể cân giữa band
    loop:        true,        // tự chạy lại sau khi mọc xong
    pauseAfter:  1.5,         // dừng bao lâu trước khi chạy lại (giây)
    randomSeed:  7            // đổi số này để ra hình khác; null = ngẫu nhiên mỗi lần
  };
  // --------------------------------------------

  const canvas = document.getElementById('growing-lines');
  const ctx = canvas.getContext('2d');
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // Bộ sinh số ngẫu nhiên có seed để hình lặp lại giống nhau khi loop
  function makeRng(seed) {
    let s = seed == null ? (Math.random() * 1e9) | 0 : seed;
    return function () {
      s = (s * 1664525 + 1013904223) >>> 0;
      return s / 4294967296;
    };
  }

  let W = 0, H = 0, dpr = 1;
  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    const r = canvas.getBoundingClientRect();
    W = r.width; H = r.height;
    canvas.width = W * dpr; canvas.height = H * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  // Mỗi nhánh là một đường cong bezier bậc 2 võng xuống, từ p0 tới p1.
  // start/end: thời điểm (giây) nhánh bắt đầu và kết thúc mọc.
  let branches = [];
  let seedPt = null;

  function build() {
    const rng = makeRng(CONFIG.randomSeed);
    const scale = Math.min(W, H * 1.5) / 1000;
    branches = [];
    const seed = { x: W * CONFIG.seed.x, y: H * CONFIG.seed.y };
    seedPt = seed;
    const queue = [{ p: seed, depth: 0, t: 0, dir: 0 }];

    while (queue.length && branches.length < CONFIG.maxNodes) {
      // lấy nhánh có thời điểm nhỏ nhất trước (mọc theo thời gian)
      queue.sort((a, b) => a.t - b.t);
      const node = queue.shift();
      const kids = node.depth === 0 ? 3
                   : (rng() < 0.8 ? 1 : 2); // dây leo: chủ yếu nối tiếp 1 đầu

      for (let i = 0; i < kids; i++) {
        if (branches.length >= CONFIG.maxNodes) break;
        // hướng chung: sang phải, hơi chếch lên; càng sâu càng ngắn
        const len = (40 + rng() * rng() * 95) * scale;
        const angle = -0.5 + rng() * 0.45 + node.dir * 0.12;        // tip sau cao hơn tip trước một nấc
        const p1 = {
          x: node.p.x + Math.cos(angle) * len,
          y: node.p.y + Math.sin(angle) * len
        };
        // giữ trong khung hình
        p1.x = Math.min(W - 30, Math.max(30, p1.x));
        p1.y = Math.min(H - 30, Math.max(30, p1.y));

        // điểm điều khiển nằm dưới đoạn nối → đường võng như dây treo
        const mx = (node.p.x + p1.x) / 2, my = (node.p.y + p1.y) / 2;
        const sag = ((16 + rng() * rng() * 55) * (rng() < 0.12 ? 3.5 : 1)) * scale;
        const c = { x: mx + (rng() - 0.5) * 40 * scale, y: my + sag };

        const grow = 0.35 + rng() * 0.7;              // thời gian mọc của nhánh này
        const start = node.t + rng() * 0.08;
        const b = { p0: node.p, c, p1, start, end: start + grow, depth: node.depth + 1, sag, phase: rng() * 6.283 };
        branches.push(b);
        queue.push({ p: p1, depth: node.depth + 1, t: b.end, dir: (rng() - 0.5) * 2 });
      }
    }

    // chuẩn hoá thời gian để toàn bộ mọc xong đúng CONFIG.duration
    const total = Math.max(...branches.map(b => b.end));
    const k = CONFIG.duration / total;
    branches.forEach(b => { b.start *= k; b.end *= k; });
  }

  function bezierPoint(b, t, c) {
    const k = c || b.c;
    const u = 1 - t;
    return {
      x: u * u * b.p0.x + 2 * u * t * k.x + t * t * b.p1.x,
      y: u * u * b.p0.y + 2 * u * t * k.y + t * t * b.p1.y
    };
  }

  function drawBranch(b, progress, wall) {
    // vẽ phần đường cong từ 0 → progress bằng cách chia nhỏ
    const steps = Math.max(2, Math.ceil(40 * progress));
    const swayAmp = 4 + (b.sag || 0) * 0.16;
    const c = {
      x: b.c.x + Math.sin(wall * 1.1 + b.phase) * swayAmp * 0.55,
      y: b.c.y + Math.cos(wall * 0.8 + b.phase) * swayAmp,
    };
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(b.p0.x, b.p0.y);
    for (let i = 1; i <= steps; i++) {
      const pt = bezierPoint(b, (i / steps) * progress, c);
      ctx.lineTo(pt.x, pt.y);
    }
    ctx.stroke();

    // hình tròn ở đầu nhánh, theo đầu đường đang mọc
    const tip = bezierPoint(b, progress, c);
    ctx.beginPath();
    ctx.arc(tip.x, tip.y, CONFIG.tipRadius, 0, Math.PI * 2);
    if (CONFIG.tipFilled) ctx.fill(); else ctx.stroke();
  }

  const easeOut = t => 1 - Math.pow(1 - t, 2.2);

  function render(time, wall) {
    ctx.fillStyle = CONFIG.bgColor;
    ctx.fillRect(0, 0, W, H);
    ctx.strokeStyle = CONFIG.lineColor;
    ctx.fillStyle = CONFIG.lineColor;
    ctx.lineWidth = CONFIG.lineWidth;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    for (const b of branches) {
      if (time < b.start) continue;
      const raw = Math.min(1, (time - b.start) / (b.end - b.start));
      drawBranch(b, easeOut(raw), wall || 0);
    }
    if (seedPt) {
      ctx.beginPath();
      ctx.arc(seedPt.x, seedPt.y, CONFIG.tipRadius, 0, Math.PI * 2);
      if (CONFIG.tipFilled) ctx.fill(); else ctx.stroke();
    }
  }

  let t0 = null;
  let raf = null;
  let inView = false;
  function frame(now) {
    if (t0 === null) t0 = now;
    let t = (now - t0) / 1000;
    const cycle = CONFIG.duration + CONFIG.pauseAfter;
    if (CONFIG.loop && t > cycle) { t0 = now; t = 0; }
    // cong nhẹ thời gian để phần đầu mọc nhanh hơn
    const u = Math.min(t, CONFIG.duration) / CONFIG.duration;
    render(Math.pow(u, 0.8) * CONFIG.duration, now / 1000); // wall clock cho sway, không reset khi loop
    raf = requestAnimationFrame(frame);
  }

  // Chỉ chạy khi section cuộn vào tầm nhìn; mỗi lần vào lại → chạy lại từ đầu.
  function start() {
    if (raf) cancelAnimationFrame(raf);
    t0 = null;
    raf = requestAnimationFrame(frame);
  }
  function stop() {
    if (raf) cancelAnimationFrame(raf);
    raf = null;
    render(0, 0); // về khung đầu (chỉ hạt giống) để lần vào sau mọc lại từ 0
  }

  function init() {
    resize();
    build();
    if (reduceMotion) { render(CONFIG.duration, 0); return; }  // người dùng tắt animation → hiện hình hoàn chỉnh
    render(0, 0);
    const io = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) { if (!inView) { inView = true; start(); } }
        else if (inView) { inView = false; stop(); }
      });
    }, { threshold: 0.35 });
    io.observe(canvas);
    cleanups.push(() => { io.disconnect(); if (raf) cancelAnimationFrame(raf); });
  }

  let resizeTimer;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      resize(); build();
      if (reduceMotion) { render(CONFIG.duration, 0); return; }
      if (inView) start(); else render(0, 0);
    }, 150);
  });

  init();

}

function initDeferredLoops() {
  // CSS keyframe loops that should start from frame 0 when they scroll into
  // view, not run invisibly from page load.
  document.querySelectorAll('.why__media').forEach((element) => {
    if (reducedMotion.matches) { element.classList.add('is-playing'); return; }
    // Restart from frame 0 on every entry (from either direction): kill the
    // animations with .is-resetting, force a reflow so the browser drops them,
    // then re-add .is-playing so they recreate at 0s.
    const restart = () => {
      element.classList.remove('is-playing');
      element.classList.add('is-resetting');
      void element.offsetWidth;
      element.classList.remove('is-resetting');
      element.classList.add('is-playing');
    };
    ScrollTrigger.create({
      trigger: element, start: 'top 80%', end: 'bottom 20%',
      onEnter: restart, onEnterBack: restart,
      onLeave: () => element.classList.remove('is-playing'),
      onLeaveBack: () => element.classList.remove('is-playing'),
    });
  });
}

function initReveals() {
  if (reducedMotion.matches) {
    document.querySelectorAll('.reveal, .reveal-stagger').forEach((element) => element.classList.add('is-revealed')); return;
  }
  document.querySelectorAll('.reveal').forEach((element) => gsap.fromTo(element, { autoAlpha: 0, y: 34 }, {
    autoAlpha: 1, y: 0, duration: .9, ease: 'power3.out',
    scrollTrigger: { trigger: element, start: 'top 88%', once: true },
  }));
  // Children fade-in-up one after another instead of as a single block
  document.querySelectorAll('.reveal-stagger').forEach((element) => gsap.fromTo(element.children, { autoAlpha: 0, y: 34 }, {
    autoAlpha: 1, y: 0, duration: .8, ease: 'power3.out', stagger: 0.18,
    scrollTrigger: { trigger: element, start: 'top 88%', once: true },
  }));
}

async function init() {
  initShell(); initWhoTilt(); initStackTilt(); initStackLabelHover(); initStackLoopReveal(); initWhoDotRoulette(); initCardTilt(); initSpotlights(); await initPullApart(); initHow(); initHowPanelNet(); initReveals(); initDeferredLoops(); initGrowingLines();
  requestAnimationFrame(() => ScrollTrigger.refresh());
}
window.addEventListener('pagehide', () => cleanups.forEach((cleanup) => cleanup()), { once: true });
window.SH = window.SH || {};
window.SH.boot = () => init().catch((error) => console.error('Secondhuman page initialization failed.', error));

})();
