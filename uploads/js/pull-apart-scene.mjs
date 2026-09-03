import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.181.0/build/three.module.js';
import { SCENE_LIMITS, PROBLEM_LABELS } from './scene-model.mjs?v=6';
import { clamp01, smoothstep } from './scene-math.mjs?v=5';

const CARD_WIDTH = 1.45;

const SPHERE_RADIUS = 2.75;
const NODE_COLORS = ['#2979ff', '#535bff', '#6a49ff', '#7c4dff'];
const INTRO_LINK_SLOTS = 10;

function seededRandom(seedValue) {
  let seed = seedValue >>> 0;
  return () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 4294967296;
  };
}

/** Evenly spread points on a sphere (fibonacci lattice). */
function fibonacciSphere(count, radius) {
  const points = [];
  const golden = Math.PI * (3 - Math.sqrt(5));
  for (let i = 0; i < count; i += 1) {
    const y = 1 - (i / (count - 1)) * 2;
    const clampedY = y * 0.92; // keep labels away from the exact poles
    const r = Math.sqrt(1 - clampedY * clampedY);
    const theta = golden * i;
    points.push(new THREE.Vector3(
      Math.cos(theta) * r * radius,
      clampedY * radius,
      Math.sin(theta) * r * radius,
    ));
  }
  return points;
}

/**
 * Scattered intro positions: a jittered grid so nodes cover the whole stage
 * evenly (top, middle and bottom included), avoiding only the logo strip.
 */
function scatterPositions(count) {
  const random = seededRandom(0x5ca1e);
  const cols = 6;
  const rows = 4;
  const spanX = 5.0;
  const spanY = 2.35;
  const offsetY = -0.28;
  const cells = [];
  for (let row = 0; row < rows; row += 1) {
    for (let col = 0; col < cols; col += 1) {
      const cx = -spanX / 2 + (col + 0.5) * (spanX / cols);
      const cy = offsetY - spanY / 2 + (row + 0.5) * (spanY / rows);
      // Skip only cells that sit on the logo strip at centre
      if (Math.abs(cx) < 1.0 && Math.abs(cy + 0.1) < 0.42) continue;
      cells.push([cx, cy]);
    }
  }
  // Shuffle deterministically, then take one cell per node
  for (let i = cells.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    [cells[i], cells[j]] = [cells[j], cells[i]];
  }
  const points = [];
  for (let i = 0; i < count; i += 1) {
    const [cx, cy] = cells[i % cells.length];
    points.push(new THREE.Vector3(
      cx + (random() - 0.5) * 0.42,
      cy + (random() - 0.5) * 0.3,
      0.15 + random() * 0.4,
    ));
  }
  return points;
}

function makeDotTexture(hex) {
  const size = 128;
  const canvas = document.createElement('canvas');
  canvas.width = size; canvas.height = size;
  const ctx = canvas.getContext('2d');
  const half = size / 2;
  const glow = ctx.createRadialGradient(half, half, 0, half, half, half);
  glow.addColorStop(0, 'rgba(255,255,255,0.95)');
  glow.addColorStop(0.24, hex);
  glow.addColorStop(0.44, `${hex}33`);
  glow.addColorStop(0.62, `${hex}00`);
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, size, size);
  ctx.beginPath();
  ctx.arc(half, half, size * 0.13, 0, Math.PI * 2);
  ctx.fillStyle = '#ffffff';
  ctx.fill();
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function makeLabel(text, accentHex) {
  const font = '600 34px Inter, Arial, sans-serif';
  const measure = document.createElement('canvas').getContext('2d');
  measure.font = font;
  const textWidth = Math.ceil(measure.measureText(text).width);
  const padX = 34;
  const height = 84;
  const width = textWidth + padX * 2;
  const canvas = document.createElement('canvas');
  canvas.width = width; canvas.height = height;
  const ctx = canvas.getContext('2d');
  const radius = 22;
  const pill = new Path2D();
  pill.roundRect(4, 4, width - 8, height - 8, radius);
  const perimeter = 2 * ((width - 8) + (height - 8));
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;

  /** Redraw the pill; sweepT in [0,1) runs a bright segment around the border. */
  const draw = (sweepT) => {
    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = 'rgba(11, 17, 32, 0.78)';
    ctx.fill(pill);
    ctx.lineWidth = 2.5;
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.34)';
    ctx.setLineDash([]);
    ctx.stroke(pill);
    if (sweepT >= 0) {
      ctx.save();
      ctx.lineWidth = 2.5;
      ctx.strokeStyle = accentHex;
      ctx.globalAlpha = 0.5;
      ctx.shadowColor = accentHex;
      ctx.shadowBlur = 3;
      ctx.setLineDash([perimeter * 0.13, perimeter]);
      ctx.lineDashOffset = -sweepT * perimeter;
      ctx.stroke(pill);
      ctx.restore();
    }
    ctx.font = font;
    ctx.fillStyle = 'rgba(245, 247, 250, 0.96)';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, width / 2, height / 2 + 2);
    texture.needsUpdate = true;
  };
  draw(0);
  return { texture, aspect: width / height, draw };
}

/** Thin outline circle used for the radar-ping rings around dots. */
function makePingTexture(hex) {
  const size = 128;
  const canvas = document.createElement('canvas');
  canvas.width = size; canvas.height = size;
  const ctx = canvas.getContext('2d');
  ctx.beginPath();
  ctx.arc(size / 2, size / 2, size * 0.42, 0, Math.PI * 2);
  ctx.lineWidth = 5;
  ctx.strokeStyle = hex;
  ctx.shadowColor = hex;
  ctx.shadowBlur = 10;
  ctx.stroke();
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

async function makeCardTexture(logoUrl) {
  const image = await new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Card logo failed to load: ${logoUrl}`));
    img.src = logoUrl;
  });
  // Logo only, on a transparent canvas — no card background, border, or glow.
  const width = 1600;
  const aspect = image.naturalHeight / image.naturalWidth;
  const height = Math.max(2, Math.round(width * aspect));
  const canvas = document.createElement('canvas');
  canvas.width = width; canvas.height = height;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(image, 0, 0, width, height);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  return { texture, aspect };
}

export class PullApartScene {
  constructor({ canvas, textureUrl }) {
    if (!(canvas instanceof HTMLCanvasElement)) {
      throw new TypeError('PullApartScene requires a canvas element');
    }
    this.canvas = canvas;
    this.textureUrl = textureUrl;
    this.renderer = null;
    this.scene = null;
    this.camera = null;
    this.root = null;
    this.network = null;
    this.card = null;
    this.cardMaterial = null;
    this.cardTexture = null;
    this.nodes = [];
    this.dotTextures = [];
    this.pingTextures = [];
    this.travelTexture = null;
    this.introLinks = [];
    this.chordLine = null;
    this.chordPairs = [];
    this.rings = [];
    this.silhouette = null;
    this.progress = 0;
    this.active = false;
    this.destroyed = false;
    this.rafId = 0;
    this.startedAt = performance.now();
    this.pointerTarget = new THREE.Vector2();
    this.tmpA = new THREE.Vector3();
    this.tmpB = new THREE.Vector3();
    this.renderFrame = this.renderFrame.bind(this);
  }

  async init() {
    this.renderer = new THREE.WebGLRenderer({
      canvas: this.canvas, alpha: false, antialias: true, powerPreference: 'high-performance',
    });
    this.renderer.setClearColor(0x000000, 1);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(38, 1, 0.1, 100);
    this.camera.position.set(0, -0.1, 7.2);

    this.root = new THREE.Group();
    this.root.position.y = -0.32;
    this.scene.add(this.root);

    this.network = new THREE.Group();
    this.root.add(this.network);

    if (document.fonts?.ready) {
      try { await document.fonts.ready; } catch { /* fonts optional */ }
    }
    await this.createCard();
    this.createNodes();
    this.createIntroLinks();
    this.createChords();
    this.createRings();
    this.createSilhouette();
    this.setProgress(0);
    this.setActive(true);
    return this;
  }

  async createCard() {
    const { texture, aspect } = await makeCardTexture(this.textureUrl);
    this.cardTexture = texture;
    this.cardMaterial = new THREE.MeshBasicMaterial({
      map: this.cardTexture, transparent: true, depthWrite: false,
    });
    this.card = new THREE.Mesh(
      new THREE.PlaneGeometry(CARD_WIDTH, CARD_WIDTH * aspect, 1, 1),
      this.cardMaterial,
    );
    this.card.position.set(0, -0.1, 0);
    this.card.renderOrder = 2;
    this.root.add(this.card);
    // Shockwave ring that fires when the network bursts back out of the logo
    this.burstRingMaterial = new THREE.SpriteMaterial({
      map: makePingTexture('#8fb4ff'), transparent: true, opacity: 0, depthWrite: false,
    });
    this.burstRing = new THREE.Sprite(this.burstRingMaterial);
    this.burstRing.position.copy(this.card.position);
    this.burstRing.renderOrder = 1;
    this.root.add(this.burstRing);
  }

  createNodes() {
    const scatter = scatterPositions(PROBLEM_LABELS.length);
    const sphere = fibonacciSphere(PROBLEM_LABELS.length, SPHERE_RADIUS);
    this.dotTextures = NODE_COLORS.map((hex) => makeDotTexture(hex));
    this.pingTextures = NODE_COLORS.map((hex) => makePingTexture(hex));
    const random = seededRandom(0xb10b);

    this.nodes = PROBLEM_LABELS.map((label, index) => {
      const group = new THREE.Group();
      const dotMaterial = new THREE.SpriteMaterial({
        map: this.dotTextures[index % NODE_COLORS.length],
        transparent: true, depthWrite: false, depthTest: false,
      });
      const dot = new THREE.Sprite(dotMaterial);
      dot.scale.setScalar(0.16);
      dot.renderOrder = 4;
      group.add(dot);

      const colorHex = NODE_COLORS[index % NODE_COLORS.length];
      const labelHandle = makeLabel(label, colorHex);
      const labelMaterial = new THREE.SpriteMaterial({
        map: labelHandle.texture, transparent: true, opacity: 0.95, depthWrite: false, depthTest: false,
      });
      const labelSprite = new THREE.Sprite(labelMaterial);
      const labelHeight = 0.16;
      labelSprite.scale.set(labelHeight * labelHandle.aspect, labelHeight, 1);
      labelSprite.position.set(0, 0.125, 0);
      labelSprite.renderOrder = 5;
      group.add(labelSprite);

      // Radar ping ring expanding out of the dot (reference SVG "ping-outer")
      const pingMaterial = new THREE.SpriteMaterial({
        map: this.pingTextures[index % NODE_COLORS.length],
        transparent: true, opacity: 0, depthWrite: false, depthTest: false,
      });
      const ping = new THREE.Sprite(pingMaterial);
      ping.renderOrder = 3;
      group.add(ping);

      this.network.add(group);
      return {
        group, dot, dotMaterial, labelSprite, labelMaterial,
        label: labelHandle, ping, pingMaterial,
        labelWidth: labelHeight * labelHandle.aspect, labelHeight,
        scatter: scatter[index], sphere: sphere[index],
        blinkPhase: random() * Math.PI * 2,
        blinkSpeed: 1.6 + random() * 1.7,
        driftPhase: random() * Math.PI * 2,
        driftSpeed: 0.16 + random() * 0.22,
        driftAmp: 0.09 + random() * 0.09,
        sweepPhase: random(),
        sweepSpeed: 0.14 + random() * 0.1,
        pingPhase: random(),
      };
    });
  }

  createIntroLinks() {
    this.travelTexture = makeDotTexture('#8fb4ff');
    const material = () => new THREE.LineDashedMaterial({
      color: 0xffffff, transparent: true, opacity: 0,
      dashSize: 0.065, gapSize: 0.05, depthWrite: false,
    });
    for (let slot = 0; slot < INTRO_LINK_SLOTS; slot += 1) {
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(6), 3));
      const line = new THREE.Line(geometry, material());
      line.renderOrder = 1;
      this.network.add(line);
      // Travel pulse riding the line from A to B (reference SVG "travel-dot")
      const travelMaterial = new THREE.SpriteMaterial({
        map: this.travelTexture, transparent: true, opacity: 0, depthWrite: false, depthTest: false,
      });
      const travel = new THREE.Sprite(travelMaterial);
      travel.scale.setScalar(0.11);
      travel.renderOrder = 4;
      this.network.add(travel);
      this.introLinks.push({ line, travel, travelMaterial, slot, cycleSeconds: 5.6, offset: slot * 1.17 });
    }
  }

  createChords() {
    // Straight chords: each node connects to its two nearest sphere neighbours.
    const pairs = new Set();
    this.nodes.forEach((node, index) => {
      const distances = this.nodes
        .map((other, otherIndex) => ({ otherIndex, d: node.sphere.distanceTo(other.sphere) }))
        .filter(({ otherIndex }) => otherIndex !== index)
        .sort((a, b) => a.d - b.d)
        .slice(0, 2);
      distances.forEach(({ otherIndex }) => {
        pairs.add([index, otherIndex].sort((a, b) => a - b).join(':'));
      });
    });
    this.chordPairs = [...pairs].map((key) => key.split(':').map(Number));
    const positions = new Float32Array(this.chordPairs.length * 6);
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    this.chordLine = new THREE.LineSegments(geometry, new THREE.LineDashedMaterial({
      color: 0x9fb6ff, transparent: true, opacity: 0,
      dashSize: 0.065, gapSize: 0.05, depthWrite: false,
    }));
    this.chordLine.computeLineDistances();
    this.chordLine.renderOrder = 1;
    this.network.add(this.chordLine);

    // Dashed rays that stab outward from the logo toward each node while it
    // launches; each segment collapses to zero length before and after its
    // node's flight, so no per-segment opacity juggling is needed.
    const rayPositions = new Float32Array(this.nodes.length * 6);
    const rayGeometry = new THREE.BufferGeometry();
    rayGeometry.setAttribute('position', new THREE.BufferAttribute(rayPositions, 3));
    this.burstRays = new THREE.LineSegments(rayGeometry, new THREE.LineDashedMaterial({
      color: 0x8fa8e8, transparent: true, opacity: 0,
      dashSize: 0.028, gapSize: 0.085, linewidth: 1, depthWrite: false,
    }));
    this.burstRays.renderOrder = 1;
    this.network.add(this.burstRays);

    // Couriers that ride the spokes (logo -> label) once the globe settles
    this.spokeCouriers = this.nodes.map((node, index) => {
      const material = new THREE.SpriteMaterial({
        map: this.travelTexture, transparent: true, opacity: 0, depthWrite: false,
      });
      const sprite = new THREE.Sprite(material);
      sprite.scale.setScalar(0.07);
      sprite.renderOrder = 2;
      this.network.add(sprite);
      return { sprite, material, phase: (index * 0.37) % 1, speed: 0.1 + (index % 4) * 0.022 };
    });
  }

  createRings() {
    // Dashed latitude orbits, like the reference sphere.
    const latitudes = [0, 0.42, -0.42];
    latitudes.forEach((lat) => {
      const radius = Math.sqrt(1 - lat * lat) * SPHERE_RADIUS;
      const points = [];
      for (let i = 0; i <= 96; i += 1) {
        const angle = (i / 96) * Math.PI * 2;
        points.push(new THREE.Vector3(Math.cos(angle) * radius, lat * SPHERE_RADIUS, Math.sin(angle) * radius));
      }
      const geometry = new THREE.BufferGeometry().setFromPoints(points);
      const ring = new THREE.Line(geometry, new THREE.LineDashedMaterial({
        color: 0x6a8fff, transparent: true, opacity: 0,
        dashSize: 0.09, gapSize: 0.07, depthWrite: false,
      }));
      ring.computeLineDistances();
      ring.renderOrder = 1;
      this.network.add(ring);
      this.rings.push(ring);
    });
  }

  createSilhouette() {
    // Camera-facing outline circle: the sphere's glassy rim.
    const points = [];
    for (let i = 0; i <= 128; i += 1) {
      const angle = (i / 128) * Math.PI * 2;
      points.push(new THREE.Vector3(Math.cos(angle) * (SPHERE_RADIUS + 0.22), Math.sin(angle) * (SPHERE_RADIUS + 0.22), 0));
    }
    const geometry = new THREE.BufferGeometry().setFromPoints(points);
    this.silhouette = new THREE.Line(geometry, new THREE.LineBasicMaterial({
      color: 0x7fa5ff, transparent: true, opacity: 0, depthWrite: false,
    }));
    this.silhouette.renderOrder = 0;
    this.root.add(this.silhouette);
  }

  setProgress(progress) {
    this.progress = clamp01(progress);
  }

  addSpin(delta) {
    this.spinVelocity = (this.spinVelocity || 0) + delta;
  }

  setPointerTarget({ x, y }) {
    this.pointerTarget.set(
      THREE.MathUtils.clamp(x, -SCENE_LIMITS.maxTiltX, SCENE_LIMITS.maxTiltX),
      THREE.MathUtils.clamp(y, -SCENE_LIMITS.maxTiltY, SCENE_LIMITS.maxTiltY),
    );
  }

  setActive(active) {
    if (this.destroyed) return;
    this.active = active;
    if (active && !this.rafId) this.rafId = requestAnimationFrame(this.renderFrame);
    if (!active && this.rafId) { cancelAnimationFrame(this.rafId); this.rafId = 0; }
  }

  resize(width, height, dpr = window.devicePixelRatio || 1) {
    if (!this.renderer || !width || !height) return;
    this.renderer.setPixelRatio(Math.min(dpr, 2));
    this.renderer.setSize(width, height, false);
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
  }

  renderFrame(now) {
    this.rafId = 0;
    if (!this.active || this.destroyed) return;
    const elapsed = (now - this.startedAt) / 1000;
    const p = this.progress;

    const pull = smoothstep(0.12, 0.45, p);
    // New beat structure: the scattered problems are sucked hard into the
    // logo (absorb), vanish completely inside it, then burst back out of it
    // to form the globe (burst -> sphereMix).
    const absorb = smoothstep(0.32, 0.62, p);
    const burst = smoothstep(0.7, 0.92, p);
    const nodeVis = clamp01(1 - absorb + burst);
    const sphereMix = burst;
    const chordReveal = smoothstep(0.86, 0.96, p);
    const ringReveal = smoothstep(0.9, 0.98, p);
    const silhouetteReveal = smoothstep(0.93, 1, p);
    const introLinkMix = 1 - smoothstep(0.25, 0.4, p);
    const logoGrow = smoothstep(0.5, 0.72, p);

    // Camera + root drift
    this.camera.position.z = 7.2 + (15.6 - 7.2) * pull;
    this.root.position.y = -0.32 + (0.78 - -0.32) * sphereMix;

    // Logo shrinks gently while the cards pull apart, swells hard as it
    // swallows the network (~2.4x its pulled-back size), then eases back a
    // little while the globe forms so it doesn't drown the sphere
    const cardScale = (1 - 0.38 * pull) * (1 + 2.2 * logoGrow) * (1 - 0.3 * burst);
    this.card.scale.setScalar(cardScale);

    // Shockwave: one bright ring races out of the logo as the burst starts
    const shock = clamp01(burst / 0.45);
    this.burstRing.scale.setScalar(0.6 + shock * 7);
    this.burstRingMaterial.opacity = burst > 0 ? ((1 - shock) ** 1.7) * 0.22 : 0;

    // Pointer tilt (damped) + slow sphere spin once formed
    this.root.rotation.x += (this.pointerTarget.x - this.root.rotation.x) * SCENE_LIMITS.damping;
    this.root.rotation.y += (this.pointerTarget.y - this.root.rotation.y) * SCENE_LIMITS.damping;
    this.spinVelocity = (this.spinVelocity || 0) * 0.94;
    this.spinOffset = (this.spinOffset || 0) + this.spinVelocity;
    this.network.rotation.y = (elapsed * 0.06 + this.spinOffset) * sphereMix;

    // Nodes: scatter -> sphere; dots blink softly, labels always shown
    const spin = this.network.rotation.y;
    const cosSpin = Math.cos(spin);
    const sinSpin = Math.sin(spin);
    this.nodes.forEach((node) => {
      // scatter -> logo core (absorb) -> eject back out to the sphere.
      // Each node launches on its own tick (stagger) and overshoots its
      // sphere slot slightly (ease-out-back) so the burst reads as an
      // eruption from inside the logo, not a crossfade.
      const stagger = node.pingPhase * 0.28;
      const bN = clamp01((burst - stagger) / (1 - 0.28));
      const eb = 1 + 2.70158 * ((bN - 1) ** 3) + 1.70158 * ((bN - 1) ** 2);
      node.group.position.lerpVectors(node.scatter, this.card.position, absorb);
      node.group.position.lerp(node.sphere, eb * clamp01(bN * 60));
      const launchPop = 1 + 0.5 * Math.sin(bN * Math.PI);
      const nodeVisN = clamp01(1 - absorb + bN);
      node.burstT = bN;
      const driftT = elapsed * node.driftSpeed + node.driftPhase;
      const driftAmp = node.driftAmp * (1 - sphereMix * 0.65) * nodeVisN;
      node.group.position.x += Math.sin(driftT) * driftAmp;
      node.group.position.y += Math.sin(driftT * 1.37 + 1.1) * driftAmp * 0.8;
      node.group.position.z += Math.cos(driftT * 0.81) * driftAmp * 0.6;
      const blink = 0.5 + 0.5 * Math.sin(elapsed * node.blinkSpeed + node.blinkPhase) ** 2;
      // Depth cue once the sphere forms: rear nodes shrink and dim so front
      // and rear labels stop stacking into an unreadable pile.
      const spunZ = node.group.position.z * cosSpin - node.group.position.x * sinSpin;
      const frontness = clamp01((spunZ / SPHERE_RADIUS + 1) / 2);
      const depthScale = 1 - sphereMix * (1 - (0.6 + 0.4 * frontness));
      const depthFade = 1 - sphereMix * (1 - (0.35 + 0.65 * frontness));
      const vis = depthFade * nodeVisN;
      node.dotMaterial.opacity = (0.74 + 0.26 * blink) * vis;
      node.dot.scale.setScalar((0.145 + 0.02 * blink) * depthScale * Math.max(nodeVisN * launchPop, 0.0001));
      node.labelMaterial.opacity = 0.95 * vis;
      // labels swell once the globe forms so the text is readable
      const labelScale = depthScale * Math.max(nodeVisN * launchPop, 0.0001) * (1 + 0.5 * sphereMix);
      node.labelSprite.scale.set(node.labelWidth * labelScale, node.labelHeight * labelScale, 1);
      node.labelSprite.position.y = 0.125 * labelScale;
      // Radar ping: expanding, fading ring on a per-node cycle
      const pingU = ((elapsed / 4.4) + node.pingPhase) % 1;
      node.ping.scale.setScalar((0.13 + 0.18 * pingU) * depthScale * Math.max(nodeVisN, 0.0001));
      node.pingMaterial.opacity = ((1 - pingU) ** 1.6) * 0.32 * vis;
    });

    // Border sweep on the label pills — half the labels redraw each frame
    this.frameIndex = (this.frameIndex || 0) + 1;
    this.nodes.forEach((node, index) => {
      if (index % 2 !== this.frameIndex % 2) return;
      node.label.draw((elapsed * node.sweepSpeed + node.sweepPhase) % 1);
    });

    // Link slots: a pair lights up, a pulse travels A -> B, then it fades and
    // repicks. During the intro pairs are random; on the sphere they follow
    // the chords, flashing active routes across the globe.
    const linkVis = Math.max(introLinkMix, chordReveal * 0.9) * Math.max(nodeVis, introLinkMix);
    this.introLinks.forEach(({ line, travel, travelMaterial, slot, cycleSeconds, offset }) => {
      const cycle = (elapsed + offset) / cycleSeconds;
      const phase = cycle % 1;
      const envelope = Math.min(1, phase / 0.12, (1 - phase) / 0.18);
      const cycleIndex = Math.floor(cycle);
      const random = seededRandom(0xf00d + slot * 131 + cycleIndex * 977);
      let a; let b;
      if (chordReveal > 0.5 && this.chordPairs.length) {
        [a, b] = this.chordPairs[Math.floor(random() * this.chordPairs.length)];
      } else {
        a = Math.floor(random() * this.nodes.length);
        b = Math.floor(random() * this.nodes.length);
        if (b === a) b = (b + 7) % this.nodes.length;
      }
      const positions = line.geometry.attributes.position;
      this.tmpA.copy(this.nodes[a].group.position);
      this.tmpB.copy(this.nodes[b].group.position);
      positions.setXYZ(0, this.tmpA.x, this.tmpA.y, this.tmpA.z);
      positions.setXYZ(1, this.tmpB.x, this.tmpB.y, this.tmpB.z);
      positions.needsUpdate = true;
      line.computeLineDistances();
      line.material.opacity = 0.45 * Math.max(0, envelope) * linkVis;
      line.visible = line.material.opacity > 0.01;
      // Pulse rides the line during the hold window
      const travelT = clamp01((phase - 0.14) / 0.68);
      travel.position.lerpVectors(this.tmpA, this.tmpB, travelT);
      travelMaterial.opacity = Math.max(0, envelope) * linkVis;
      travel.visible = travelMaterial.opacity > 0.01;
    });

    // Dashed launch rays: centre -> node while that node is in flight
    if (this.burstRays) {
      const rp = this.burstRays.geometry.attributes.position;
      const cx = this.card.position.x; const cy = this.card.position.y; const cz = this.card.position.z;
      const settled = smoothstep(0.9, 0.98, p);
      this.nodes.forEach((node, index) => {
        const t = node.burstT ?? 0;
        const tail = clamp01(t * 1.5 - 0.5) * (1 - settled);
        const px = node.group.position.x; const py = node.group.position.y; const pz = node.group.position.z;
        rp.setXYZ(index * 2, cx + (px - cx) * tail, cy + (py - cy) * tail, cz + (pz - cz) * tail);
        rp.setXYZ(index * 2 + 1, px, py, pz);
      });
      rp.needsUpdate = true;
      this.burstRays.computeLineDistances();
      // dashes march outward (centre -> node): LineDashedMaterial has no dash
      // offset, so shift the lineDistance attribute by time instead
      const ld = this.burstRays.geometry.attributes.lineDistance;
      const march = elapsed * 0.9;
      for (let k = 0; k < ld.count; k += 1) ld.array[k] -= march;
      ld.needsUpdate = true;
      this.burstRays.material.opacity = burst > 0.001 ? 0.3 : 0;
      this.burstRays.visible = this.burstRays.material.opacity > 0.01;
    }

    // Spoke couriers: dots streaming logo -> label on the settled globe
    if (this.spokeCouriers) {
      const settledVis = smoothstep(0.9, 0.98, p);
      const cx = this.card.position.x; const cy = this.card.position.y; const cz = this.card.position.z;
      this.spokeCouriers.forEach(({ sprite, material, phase, speed }, index) => {
        const t = (elapsed * speed + phase) % 1;
        const target = this.nodes[index].group.position;
        sprite.position.set(
          cx + (target.x - cx) * t,
          cy + (target.y - cy) * t,
          cz + (target.z - cz) * t,
        );
        material.opacity = settledVis * Math.sin(t * Math.PI) * 0.9;
      });
    }

    // Sphere chords follow the nodes while they travel
    if (chordReveal > 0.001) {
      const positions = this.chordLine.geometry.attributes.position;
      this.chordPairs.forEach(([a, b], index) => {
        const pa = this.nodes[a].group.position;
        const pb = this.nodes[b].group.position;
        positions.setXYZ(index * 2, pa.x, pa.y, pa.z);
        positions.setXYZ(index * 2 + 1, pb.x, pb.y, pb.z);
      });
      positions.needsUpdate = true;
      this.chordLine.computeLineDistances();
    }
    this.chordLine.material.opacity = 0.3 * chordReveal;
    this.chordLine.visible = chordReveal > 0.001;

    this.rings.forEach((ring, index) => {
      ring.material.opacity = 0.34 * ringReveal;
      ring.visible = ringReveal > 0.001;
      ring.rotation.y = elapsed * (0.02 + index * 0.012);
    });

    this.silhouette.material.opacity = 0.4 * silhouetteReveal;
    this.silhouette.visible = silhouetteReveal > 0.001;
    this.silhouette.quaternion.copy(this.camera.quaternion);

    this.renderer.render(this.scene, this.camera);
    this.rafId = requestAnimationFrame(this.renderFrame);
  }

  destroy() {
    this.destroyed = true;
    if (this.rafId) { cancelAnimationFrame(this.rafId); this.rafId = 0; }
    this.scene?.traverse((object) => {
      object.geometry?.dispose();
      const materials = Array.isArray(object.material) ? object.material : [object.material];
      materials.forEach((material) => {
        if (!material) return;
        material.map?.dispose();
        material.dispose();
      });
    });
    this.cardTexture?.dispose();
    this.dotTextures.forEach((texture) => texture.dispose());
    this.pingTextures.forEach((texture) => texture.dispose());
    this.travelTexture?.dispose();
    this.renderer?.dispose();
  }
}
