/* pull-apart-scene.js — script thường. THREE là global (window.THREE, nạp bằng
   inline module ở cuối index.html); mọi dùng THREE đều nằm trong hàm nên chỉ
   cần THREE có mặt trước khi scene.init() chạy. */
(() => {
'use strict';
const { SCENE_LIMITS, PROBLEM_LABELS, clamp01, smoothstep } = window.SH;
const THREE = new Proxy({}, { get: (_, key) => window.THREE[key] });

const CARD_WIDTH = 1.45;

const SPHERE_RADIUS = 2.75;
const NODE_COLORS = ['#2979ff', '#535bff', '#6a49ff', '#7c4dff'];
const INTRO_LINK_SLOTS = 5;

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
  const cols = 8;
  const rows = 5;
  const spanX = 5.8;
  const spanY = 2.6;
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

function makeSolidDotTexture(hex) {
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

function makeDotTexture(hex) {
  const size = 128;
  const canvas = document.createElement('canvas');
  canvas.width = size; canvas.height = size;
  const ctx = canvas.getContext('2d');
  const half = size / 2;
  // outlined circle: soft halo + stroked ring + tiny bright core
  const glow = ctx.createRadialGradient(half, half, 0, half, half, half);
  glow.addColorStop(0, `${hex}55`);
  glow.addColorStop(0.34, `${hex}22`);
  glow.addColorStop(0.6, `${hex}00`);
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, size, size);
  ctx.beginPath();
  ctx.arc(half, half, size * 0.2, 0, Math.PI * 2);
  ctx.lineWidth = size * 0.045;
  ctx.strokeStyle = hex;
  ctx.shadowColor = hex;
  ctx.shadowBlur = size * 0.07;
  ctx.stroke();
  ctx.shadowBlur = 0;
  ctx.beginPath();
  ctx.arc(half, half, size * 0.055, 0, Math.PI * 2);
  ctx.fillStyle = '#ffffff';
  ctx.fill();
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function makeLabel(text, accentHex) {
  const font = '600 34px Manrope, Arial, sans-serif';
  const measure = document.createElement('canvas').getContext('2d');
  measure.font = font;
  const textWidth = Math.ceil(measure.measureText(text).width);
  const padX = 48;
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

class PullApartScene {
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
    this.createBoxInnerWeb();
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
    // Four dotted rays growing out of the logo centre (top, left, bottom,
    // then a short right one) — scroll 3-5
    const rayMaterial = () => new THREE.LineDashedMaterial({
      color: 0xffffff, transparent: true, opacity: 0,
      dashSize: 0.07, gapSize: 0.06, depthWrite: false, // same dash as the box frame
    });
    // White dot style: solid core + thin white border ring around it
    const makeBorderedDotTexture = () => {
      const dotCanvas = document.createElement('canvas');
      dotCanvas.width = 128; dotCanvas.height = 128;
      const dotCtx = dotCanvas.getContext('2d');
      dotCtx.beginPath();
      dotCtx.arc(64, 64, 32, 0, Math.PI * 2);
      dotCtx.fillStyle = '#ffffff';
      dotCtx.shadowColor = '#ffffff';
      dotCtx.shadowBlur = 10;
      dotCtx.fill();
      dotCtx.shadowBlur = 0;
      dotCtx.beginPath();
      dotCtx.arc(64, 64, 52, 0, Math.PI * 2);
      dotCtx.lineWidth = 6;
      dotCtx.strokeStyle = 'rgba(255,255,255,0.9)';
      dotCtx.stroke();
      const dotTexture = new THREE.CanvasTexture(dotCanvas);
      dotTexture.colorSpace = THREE.SRGBColorSpace;
      return dotTexture;
    };
    const tipTexture = makeBorderedDotTexture();
    const makeRay = (dx, dy, length, startP, insideLength) => {
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute('position', new THREE.BufferAttribute(
        new Float32Array([0, 0, 0, dx * length, dy * length, 0]), 3,
      ));
      const line = new THREE.Line(geometry, rayMaterial());
      line.computeLineDistances();
      line.position.copy(this.card.position);
      line.renderOrder = 1;
      this.network.add(line);
      // white solid dot riding the tip of the ray
      const tipMaterial = new THREE.SpriteMaterial({
        map: tipTexture, transparent: true, opacity: 0, depthWrite: false,
      });
      const tip = new THREE.Sprite(tipMaterial);
      tip.scale.setScalar(0.15);
      tip.renderOrder = 3;
      this.network.add(tip);
      // second white dot at the ray midpoint
      const midMaterial = new THREE.SpriteMaterial({
        map: tipTexture, transparent: true, opacity: 0, depthWrite: false,
      });
      const mid = new THREE.Sprite(midMaterial);
      mid.scale.setScalar(0.15);
      mid.renderOrder = 3;
      this.network.add(mid);
      return { line, startP, insideScale: insideLength / length, dx, dy, length, tip, tipMaterial, mid, midMaterial };
    };
    // insideLength keeps each ray within the box (HH 1.55 / HW 2.9) once it forms
    this.centerRays = [
      makeRay(0, 1, 2.4, 0.2, 1.35),
      makeRay(-1, 0, 3.2, 0.2, 2.7),
      makeRay(0, -1, 2.4, 0.2, 1.35),
      Object.assign(makeRay(1, 0, 1.3, 0.3, 1.25), { lateTo: 2.16 }),
    ];
    // Wireframe box (12 dotted edges) that assembles in scroll 6-10;
    // lives in the network group so dragging spins box + contents together
    const HW = 4.6; const HH = 1.7; const HD = 2.1; // 1/9: rộng, nhưng thấp lại để không đè text
    const corners = [];
    for (let zi = -1; zi <= 1; zi += 2) {
      for (let yi = -1; yi <= 1; yi += 2) {
        for (let xi = -1; xi <= 1; xi += 2) corners.push([xi * HW, yi * HH, zi * HD]);
      }
    }
    const edgePairs = [
      [0, 1], [2, 3], [4, 5], [6, 7],
      [0, 2], [1, 3], [4, 6], [5, 7],
      [0, 4], [1, 5], [2, 6], [3, 7],
    ];
    // Stroke-draw spec: the box is DRAWN like pen strokes, not faded in —
    // front rectangle first (pen order), then the 4 depth strokes together,
    // then the back rectangle. s/e are spans in normalized draw time.
    const drawSpec = [
      [4, 5], [5, 7], [7, 6], [6, 4],
      [4, 0], [5, 1], [7, 3], [6, 2],
      [0, 1], [1, 3], [3, 2], [2, 0],
    ];
    const drawSpans = [
      [0, 0.1], [0.1, 0.2], [0.2, 0.3], [0.3, 0.4],
      [0.4, 0.58], [0.4, 0.58], [0.4, 0.58], [0.4, 0.58],
      [0.58, 0.68], [0.68, 0.78], [0.78, 0.88], [0.88, 0.98],
    ];
    this.boxEdgeDraw = drawSpec.map(([ai, bi], k) => ({
      a: corners[ai], b: corners[bi], s: drawSpans[k][0], e: drawSpans[k][1],
    }));
    const edgeArray = new Float32Array(drawSpec.length * 6);
    drawSpec.forEach(([ai, bi], k) => {
      edgeArray.set([...corners[ai], ...corners[bi]], k * 6);
    });
    const edgeGeometry = new THREE.BufferGeometry();
    edgeGeometry.setAttribute('position', new THREE.BufferAttribute(edgeArray, 3));
    this.boxEdges = new THREE.LineSegments(edgeGeometry, new THREE.LineDashedMaterial({
      color: 0xffffff, transparent: true, opacity: 0,
      dashSize: 0.07, gapSize: 0.06, depthWrite: false,
    }));
    this.boxEdges.computeLineDistances();
    this.boxEdges.renderOrder = 1;
    this.network.add(this.boxEdges);
    // Anchor dots pinned to the frame: 8 corners + 12 edge midpoints
    const anchorPts = corners.map(([x, y, z]) => [x, y, z]);
    edgePairs.forEach(([ai, bi]) => {
      anchorPts.push([
        (corners[ai][0] + corners[bi][0]) / 2,
        (corners[ai][1] + corners[bi][1]) / 2,
        (corners[ai][2] + corners[bi][2]) / 2,
      ]);
    });
    const anchorTexture = makeBorderedDotTexture();
    // sprites (not Points) so every anchor renders the EXACT same size as
    // the ray-tip dots regardless of renderer point-size quirks
    this.boxAnchors = new THREE.Group();
    this.boxAnchorMaterials = [];
    anchorPts.forEach((pt) => {
      const material = new THREE.SpriteMaterial({
        map: anchorTexture, transparent: true, opacity: 0, depthWrite: false,
      });
      const sprite = new THREE.Sprite(material);
      sprite.scale.setScalar(0.15);
      sprite.position.set(pt[0], pt[1], pt[2]);
      sprite.renderOrder = 3;
      this.boxAnchors.add(sprite);
      this.boxAnchorMaterials.push(material);
    });
    this.network.add(this.boxAnchors);
    // Face grids: 9 white dots on the front face (z=+HD), the same 9 spots
    // mirrored on the back face (z=-HD) at 0.1 opacity — viewer looks in
    // from the front of the screen. Same size/style as every white dot.
    const faceGrid = [
      [-0.6, -0.6], [0, -0.6], [0.6, -0.6],
      [-0.6, 0], [0.6, 0],
      [-0.6, 0.6], [0, 0.6], [0.6, 0.6],
      [0, 0.3],
    ];
    this.faceDotMaterials = [];
    faceGrid.forEach(([u, v]) => {
      [HD, -HD].forEach((z) => {
        const material = new THREE.SpriteMaterial({
          map: anchorTexture, transparent: true, opacity: 0, depthWrite: false,
        });
        const sprite = new THREE.Sprite(material);
        sprite.scale.setScalar(0.15);
        sprite.position.set(u * HW, v * HH, z);
        sprite.renderOrder = 3;
        this.boxAnchors.add(sprite);
        this.faceDotMaterials.push({ material, normalZ: Math.sign(z) });
      });
    });
    // Solid hairline spokes radiating from the logo centre out to every white
    // dot (20 frame anchors + 18 face dots) — line solid, mỏng, lan tỏa dần
    const spokePts = anchorPts.map((pt) => [pt[0], pt[1], pt[2]]);
    faceGrid.forEach(([u, v]) => {
      [HD, -HD].forEach((z) => spokePts.push([u * HW, v * HH, z]));
    });
    // Circuit-trace routing (ref: Scale hero): each trace runs axis by axis
    // (Manhattan) with rounded 90° bends — NOT a straight firework spoke.
    const roundCorners = (waypts, radius) => {
      const pts = [waypts[0].clone()];
      for (let i = 1; i < waypts.length - 1; i += 1) {
        const prev = waypts[i - 1]; const cur = waypts[i]; const next = waypts[i + 1];
        const dIn = cur.clone().sub(prev); const lenIn = dIn.length();
        const dOut = next.clone().sub(cur); const lenOut = dOut.length();
        const r = Math.min(radius, lenIn * 0.4, lenOut * 0.4);
        if (r < 0.01 || lenIn < 0.01 || lenOut < 0.01) { pts.push(cur.clone()); continue; }
        dIn.normalize(); dOut.normalize();
        const a = cur.clone().addScaledVector(dIn, -r);
        const b = cur.clone().addScaledVector(dOut, r);
        pts.push(a);
        for (let k = 1; k < 5; k += 1) {
          const t = k / 5; // quadratic bezier a -> cur -> b
          pts.push(a.clone().multiplyScalar((1 - t) ** 2)
            .addScaledVector(cur, 2 * (1 - t) * t)
            .addScaledVector(b, t * t));
        }
        pts.push(b);
      }
      pts.push(waypts[waypts.length - 1].clone());
      return pts;
    };
    const spokeRandom = seededRandom(0x77ace);
    const axisOrders = [
      ['x', 'y', 'z'], ['x', 'z', 'y'], ['y', 'x', 'z'], ['z', 'x', 'y'],
    ];
    const center = this.card.position;
    const segCoords = [];
    this.spokePaths = [];
    const addTrace = (from, to) => {
      const start = new THREE.Vector3(from[0], from[1], from[2]);
      const target = new THREE.Vector3(to[0], to[1], to[2]);
      const order = axisOrders[Math.floor(spokeRandom() * axisOrders.length)];
      const waypts = [start.clone()];
      const cursor = start.clone();
      order.forEach((axis) => {
        if (Math.abs(target[axis] - cursor[axis]) > 0.01) {
          cursor[axis] = target[axis];
          waypts.push(cursor.clone());
        }
      });
      const path = roundCorners(waypts, 0.16);
      // arc-length table so couriers can ride the trace at constant speed
      const cum = [0];
      for (let k = 1; k < path.length; k += 1) {
        cum.push(cum[k - 1] + path[k].distanceTo(path[k - 1]));
      }
      this.spokePaths.push({ pts: path, cum, total: cum[cum.length - 1] });
      for (let k = 0; k < path.length - 1; k += 1) segCoords.push(path[k], path[k + 1]);
    };
    const centerPt = [center.x, center.y, center.z];
    spokePts.forEach((pt) => addTrace(centerPt, pt));
    // Denser web: extra dot-to-dot traces (same circuit routing) — every
    // face dot hooks to a random frame anchor, plus assorted cross links
    for (let i = 20; i < spokePts.length; i += 1) {
      addTrace(spokePts[i], spokePts[Math.floor(spokeRandom() * 20)]);
      addTrace(spokePts[i], spokePts[Math.floor(spokeRandom() * 20)]);
    }
    for (let k = 0; k < 72; k += 1) {
      const i = Math.floor(spokeRandom() * spokePts.length);
      let j = Math.floor(spokeRandom() * spokePts.length);
      if (j === i) j = (j + 7) % spokePts.length;
      addTrace(spokePts[i], spokePts[j]);
    }
    // Extra white "problem" dots pinned ALONG the traces — the runners flow
    // from the logo through them, problem to problem
    const sampleAt = (tracePath, t) => {
      const dTarget = t * tracePath.total;
      let k = 1;
      while (k < tracePath.cum.length - 1 && tracePath.cum[k] < dTarget) k += 1;
      const seg = (dTarget - tracePath.cum[k - 1]) / Math.max(tracePath.cum[k] - tracePath.cum[k - 1], 1e-6);
      return new THREE.Vector3().lerpVectors(tracePath.pts[k - 1], tracePath.pts[k], seg);
    };
    // giữ khoảng cách tối thiểu giữa mọi chấm trắng — không cho dính chùm
    const placedDots = spokePts.map((pt) => new THREE.Vector3(pt[0], pt[1], pt[2]));
    const MIN_DOT_GAP2 = 0.55 * 0.55;
    for (let i = 0; i < 60; i += 1) {
      let pos = null;
      for (let attempt = 0; attempt < 30 && !pos; attempt += 1) {
        const tracePath = this.spokePaths[Math.floor(spokeRandom() * this.spokePaths.length)];
        const cand = sampleAt(tracePath, 0.2 + spokeRandom() * 0.7);
        let clear = true;
        for (let q = 0; q < placedDots.length; q += 1) {
          if (cand.distanceToSquared(placedDots[q]) < MIN_DOT_GAP2) { clear = false; break; }
        }
        if (clear) pos = cand;
      }
      if (!pos) continue;
      placedDots.push(pos);
      const material = new THREE.SpriteMaterial({
        map: anchorTexture, transparent: true, opacity: 0, depthWrite: false,
      });
      const sprite = new THREE.Sprite(material);
      sprite.scale.setScalar(0.15);
      sprite.position.copy(pos);
      sprite.renderOrder = 3;
      this.boxAnchors.add(sprite);
      this.boxAnchorMaterials.push(material);
    }
    const spokeArray = new Float32Array(segCoords.length * 3);
    segCoords.forEach((v, i) => spokeArray.set([v.x, v.y, v.z], i * 3));
    const spokeGeometry = new THREE.BufferGeometry();
    spokeGeometry.setAttribute('position', new THREE.BufferAttribute(spokeArray, 3));
    this.centerSpokes = new THREE.LineSegments(spokeGeometry, new THREE.LineBasicMaterial({
      color: 0xffffff, transparent: true, opacity: 0, depthWrite: false,
    }));
    this.centerSpokes.renderOrder = 1;
    this.network.add(this.centerSpokes);
    // Small couriers racing from the logo centre out along the traces to the
    // white dots — same look/speed as the scroll-1 chain couriers
    this.spokeRunnerTexture = makeSolidDotTexture('#8fb4ff');
    this.spokeRunners = [];
    for (let slot = 0; slot < 84; slot += 1) {
      const material = new THREE.SpriteMaterial({
        map: this.spokeRunnerTexture, transparent: true, opacity: 0, depthWrite: false,
      });
      const sprite = new THREE.Sprite(material);
      sprite.scale.setScalar(0.06);
      sprite.renderOrder = 4;
      this.network.add(sprite);
      this.spokeRunners.push({ sprite, material, slot, cycleSeconds: 1.35, offset: slot * 0.23 });
    }
    // Fixed constellation STUCK TO the six faces of the box: every dot sits
    // on a face plane, and connectors only run between dots on the same face
    // so the web reads as circuitry etched onto the surfaces.
    const netRandom = seededRandom(0xcafe);
    const NET_COUNT = 110;
    const netPts = [];
    const netFaces = [];
    const netPositions = new Float32Array(NET_COUNT * 3);
    const netColors = new Float32Array(NET_COUNT * 3);
    const brand = NODE_COLORS.map((hex) => new THREE.Color(hex));
    const faint = new THREE.Color('#c3cff0');
    for (let i = 0; i < NET_COUNT; i += 1) {
      const face = Math.floor(netRandom() * 6);
      const u = (netRandom() - 0.5) * 2;
      const v = (netRandom() - 0.5) * 2;
      let x; let y; let z;
      if (face === 0) { x = HW; y = u * HH * 0.9; z = v * HD * 0.9; }
      else if (face === 1) { x = -HW; y = u * HH * 0.9; z = v * HD * 0.9; }
      else if (face === 2) { y = HH; x = u * HW * 0.94; z = v * HD * 0.9; }
      else if (face === 3) { y = -HH; x = u * HW * 0.94; z = v * HD * 0.9; }
      else if (face === 4) { z = HD; x = u * HW * 0.94; y = v * HH * 0.9; }
      else { z = -HD; x = u * HW * 0.94; y = v * HH * 0.9; }
      netPts.push(new THREE.Vector3(x, y, z));
      netFaces.push(face);
      netPositions.set([x, y, z], i * 3);
      const color = netRandom() < 0.22 ? faint : brand[i % brand.length];
      netColors.set([color.r, color.g, color.b], i * 3);
    }
    const netGeometry = new THREE.BufferGeometry();
    netGeometry.setAttribute('position', new THREE.BufferAttribute(netPositions, 3));
    netGeometry.setAttribute('color', new THREE.BufferAttribute(netColors, 3));
    this.boxNetPoints = new THREE.Points(netGeometry, new THREE.PointsMaterial({
      size: 0.22, map: makeSolidDotTexture('#ffffff'), transparent: true, opacity: 0,
      vertexColors: true, depthWrite: false, sizeAttenuation: true,
    }));
    this.boxNetPoints.renderOrder = 2;
    this.network.add(this.boxNetPoints);
    // nearest same-face neighbour per dot + a few extra short same-face links
    const edgeCoords = [];
    netPts.forEach((pt, i) => {
      let best = -1; let bestDist = Infinity;
      netPts.forEach((other, j) => {
        if (j === i || netFaces[j] !== netFaces[i]) return;
        const d = pt.distanceToSquared(other);
        if (d < bestDist) { bestDist = d; best = j; }
      });
      if (best >= 0) edgeCoords.push(pt, netPts[best]);
    });
    for (let k = 0; k < 60; k += 1) {
      const a = Math.floor(netRandom() * NET_COUNT);
      const b = Math.floor(netRandom() * NET_COUNT);
      if (a !== b && netFaces[a] === netFaces[b] && netPts[a].distanceTo(netPts[b]) < 2.2) {
        edgeCoords.push(netPts[a], netPts[b]);
      }
    }
    const netLineArray = new Float32Array(edgeCoords.length * 3);
    edgeCoords.forEach((pt, i) => netLineArray.set([pt.x, pt.y, pt.z], i * 3));
    const netLineGeometry = new THREE.BufferGeometry();
    netLineGeometry.setAttribute('position', new THREE.BufferAttribute(netLineArray, 3));
    this.boxNetLines = new THREE.LineSegments(netLineGeometry, new THREE.LineDashedMaterial({
      color: 0x8fa8e8, transparent: true, opacity: 0,
      dashSize: 0.045, gapSize: 0.04, depthWrite: false,
    }));
    this.boxNetLines.computeLineDistances();
    this.boxNetLines.renderOrder = 1;
    this.network.add(this.boxNetLines);
  }

  createNodes() {
    const scatter = scatterPositions(PROBLEM_LABELS.length);
    const sphere = fibonacciSphere(PROBLEM_LABELS.length, SPHERE_RADIUS);
    this.dotTextures = NODE_COLORS.map((hex) => makeDotTexture(hex));
    this.solidDotTextures = NODE_COLORS.map((hex) => makeSolidDotTexture(hex));
    this.pingTextures = NODE_COLORS.map((hex) => makePingTexture(hex));
    const random = seededRandom(0xb10b);

    this.nodes = PROBLEM_LABELS.map((label, index) => {
      const group = new THREE.Group();
      const dotMaterial = new THREE.SpriteMaterial({
        map: this.dotTextures[index % NODE_COLORS.length], // swapped to solid in the finale
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
        texIndex: index % NODE_COLORS.length,
        boxPos: new THREE.Vector3(
          (random() - 0.5) * 5.2,
          (random() - 0.5) * 2.7,
          (random() - 0.5) * 2.7,
        ),
        label: labelHandle, ping, pingMaterial,
        labelWidth: labelHeight * labelHandle.aspect, labelHeight,
        scatter: scatter[index], sphere: sphere[index],
        blinkPhase: random() * Math.PI * 2,
        blinkSpeed: 1.6 + random() * 1.7,
        driftPhase: random() * Math.PI * 2,
        driftSpeed: 0.55 + random() * 0.5,
        driftAmp: 0.13 + random() * 0.12,
        sweepPhase: random(),
        sweepSpeed: 0.14 + random() * 0.1,
        pingPhase: random(),
      };
    });
  }

  createBoxInnerWeb() {
    // Box phase layout: NOTHING floats in mid-air. The 31 items are pinned
    // either onto the four centre rays (on the XY plane) or onto one of the
    // six box faces; the fixed web only links points that share a ray/face.
    const HW = 2.9; const HH = 1.55; const HD = 1.55;
    const rand = seededRandom(0xbead);
    const coords = [];
    const axes = [
      { dx: 0, dy: 1, len: 1.35, count: 3 },
      { dx: -1, dy: 0, len: 2.65, count: 4 },
      { dx: 0, dy: -1, len: 1.3, count: 3 },
      { dx: 1, dy: 0, len: 2.55, count: 4 },
    ];
    let index = 0;
    axes.forEach((axis) => {
      let prev = null;
      for (let k = 1; k <= axis.count; k += 1) {
        const node = this.nodes[index]; index += 1;
        if (!node) return;
        const t = k / (axis.count + 0.25);
        node.boxPos.set(axis.dx * axis.len * t, axis.dy * axis.len * t, 0);
        if (prev) coords.push(prev.clone(), node.boxPos.clone());
        prev = node.boxPos;
      }
    });
    // the rest stick to the six faces
    const faceNodes = [];
    while (index < this.nodes.length) {
      const node = this.nodes[index]; index += 1;
      const face = Math.floor(rand() * 6);
      const u = (rand() - 0.5) * 2;
      const v = (rand() - 0.5) * 2;
      if (face === 0) node.boxPos.set(HW, u * HH * 0.85, v * HD * 0.85);
      else if (face === 1) node.boxPos.set(-HW, u * HH * 0.85, v * HD * 0.85);
      else if (face === 2) node.boxPos.set(u * HW * 0.9, HH, v * HD * 0.85);
      else if (face === 3) node.boxPos.set(u * HW * 0.9, -HH, v * HD * 0.85);
      else if (face === 4) node.boxPos.set(u * HW * 0.9, v * HH * 0.85, HD);
      else node.boxPos.set(u * HW * 0.9, v * HH * 0.85, -HD);
      faceNodes.push({ node, face });
    }
    faceNodes.forEach((entry) => {
      let best = null; let bestDist = Infinity;
      faceNodes.forEach((other) => {
        if (other === entry || other.face !== entry.face) return;
        const d = entry.node.boxPos.distanceToSquared(other.node.boxPos);
        if (d < bestDist) { bestDist = d; best = other; }
      });
      if (best) coords.push(entry.node.boxPos.clone(), best.node.boxPos.clone());
    });
    const array = new Float32Array(coords.length * 3);
    coords.forEach((pt, i) => array.set([pt.x, pt.y, pt.z], i * 3));
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(array, 3));
    this.boxInnerLines = new THREE.LineSegments(geometry, new THREE.LineDashedMaterial({
      color: 0xa9c4ff, transparent: true, opacity: 0,
      dashSize: 0.045, gapSize: 0.04, depthWrite: false,
    }));
    this.boxInnerLines.computeLineDistances();
    this.boxInnerLines.renderOrder = 1;
    this.network.add(this.boxInnerLines);
  }

  createIntroLinks() {
    this.travelTexture = makeSolidDotTexture('#8fb4ff');
    const material = () => new THREE.LineBasicMaterial({
      color: 0xffffff, transparent: true, opacity: 0, depthWrite: false,
    });
    for (let slot = 0; slot < INTRO_LINK_SLOTS; slot += 1) {
      const geometry = new THREE.BufferGeometry();
      // 2 chained segments x 16 samples: enough vertices to bow like a rope
      geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(99), 3));
      const line = new THREE.Line(geometry, material());
      line.renderOrder = 1;
      this.network.add(line);
      // Travel pulse riding the line from A to B (reference SVG "travel-dot")
      const travelMaterial = new THREE.SpriteMaterial({
        map: this.travelTexture, transparent: true, opacity: 0, depthWrite: false, depthTest: false,
      });
      const travel = new THREE.Sprite(travelMaterial);
      travel.scale.setScalar(0.06);
      const travelMaterial2 = new THREE.SpriteMaterial({
        map: this.travelTexture, transparent: true, opacity: 0, depthWrite: false, depthTest: false,
      });
      const travel2 = new THREE.Sprite(travelMaterial2);
      travel2.scale.setScalar(0.052);
      const travelMaterial3 = new THREE.SpriteMaterial({
        map: this.travelTexture, transparent: true, opacity: 0, depthWrite: false, depthTest: false,
      });
      const travel3 = new THREE.Sprite(travelMaterial3);
      travel3.scale.setScalar(0.055);
      const travelMaterial4 = new THREE.SpriteMaterial({
        map: this.travelTexture, transparent: true, opacity: 0, depthWrite: false, depthTest: false,
      });
      const travel4 = new THREE.Sprite(travelMaterial4);
      travel4.scale.setScalar(0.05);
      travel.renderOrder = 4;
      this.network.add(travel);
      this.network.add(travel2);
      this.network.add(travel3);
      this.network.add(travel4);
      this.introLinks.push({ line, travel, travelMaterial, travel2, travelMaterial2, travel3, travelMaterial3, travel4, travelMaterial4, slot, cycleSeconds: 3.6, offset: slot * 0.72 });
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
    const dt = Math.min(0.05, (now - (this.lastFrameAt || now)) / 1000);
    this.lastFrameAt = now;
    const p = this.progress;

    const pull = smoothstep(0.12, 0.45, p);
    // Storyboard (28/8): s1 items toggle close to the logo; s2 logo shrinks,
    // labels drop, circles remain; s3-5 four dotted rays grow from the centre
    // (top/left/bottom, then a short right); s6-10 a wireframe box forms and
    // the items + chain lines + couriers live inside it.
    const logoShrink = smoothstep(0.1, 0.2, p);
    const labelFade = smoothstep(0.1, 0.18, p);
    const boxForm = smoothstep(0.52, 0.68, p);
    const absorb = 0;
    const burst = 0;
    const nodeVis = 1;
    const sphereMix = boxForm;
    const chordReveal = 0;
    const ringReveal = 0;
    const silhouetteReveal = 0;
    const introLinkMix = 1 - smoothstep(0.12, 0.2, p);
    // once the circuit traces spread out, every dashed line fades to 0
    const dashFade = smoothstep(0.56, 0.64, p);
    const boxLinkMix = 0; // box phase uses the fixed interior web instead

    // Camera + root drift — on narrow (mobile) viewports the camera backs off
    // so the label field and the box always fit the screen width
    const aspectFit = Math.max(1, Math.min(2, 1.7 / (this.camera.aspect || 1)));
    this.camera.position.z = (7.2 + (13.8 - 7.2) * pull) * aspectFit;
    this.root.position.y = -0.32 + (0.42 - -0.32) * boxForm; // nhấc khối lên khỏi text

    // Scroll 2: logo steps down to ~55%; in the box phase it swells back up
    const cardScale = (1 - 0.45 * logoShrink) * (1 + 1.6 * boxForm);
    this.card.scale.setScalar(cardScale);

    // Scroll 3-5: dotted rays draw out of the logo centre, each on its cue
    if (this.centerRays) {
      this.centerRays.forEach((ray, rayIndex) => {
        const reveal = smoothstep(ray.startP, 0.56, p);
        const on = smoothstep(ray.startP, ray.startP + 0.03, p) * 0.1; // same opacity as the frame
        // once the box forms, the ray retracts so its tip stays inside
        // retract BEFORE the box becomes visible (p .5-.6) so no ray ever
        // pokes through a face while the box is assembling
        const boxClamp = smoothstep(0.48, 0.58, p);
        const clampMix = 1 - boxClamp * (1 - ray.insideScale);
        // scroll 7-8: the short right ray catches up to the others
        const late = ray.lateTo ? 1 + (ray.lateTo - 1) * smoothstep(0.68, 0.8, p) : 1;
        const rayScale = Math.max(reveal * clampMix * late, 0.0001);
        ray.line.scale.setScalar(rayScale);
        ray.line.material.dashSize = 0.07 / rayScale;
        ray.line.material.gapSize = 0.06 / rayScale;
        ray.tip.position.set(
          this.card.position.x + ray.dx * ray.length * rayScale,
          this.card.position.y + ray.dy * ray.length * rayScale,
          this.card.position.z,
        );
        // 29/8: line XY + chấm trắng trên tia TẠM ẨN theo yêu cầu (opacity 0,
        // giữ code — chờ prompt mới)
        ray.tipMaterial.opacity = 0;
        ray.tip.visible = ray.tipMaterial.opacity > 0.01;
        ray.mid.position.set(
          this.card.position.x + ray.dx * ray.length * rayScale * 0.5,
          this.card.position.y + ray.dy * ray.length * rayScale * 0.5,
          this.card.position.z,
        );
        ray.midMaterial.opacity = ray.tipMaterial.opacity;
        ray.mid.visible = ray.tip.visible;
        ray.line.material.opacity = 0; // 29/8: tạm ẩn line XY
        ray.line.visible = false;
        const ld = ray.line.geometry.attributes.lineDistance;
        if (ld) {
          ray.line.computeLineDistances();
          const march = elapsed * (rayIndex % 2 ? -0.5 : 0.5);
          for (let k = 0; k < ld.count; k += 1) ld.array[k] -= march;
          ld.needsUpdate = true;
        }
      });
    }
    // Scroll 6-10: the wireframe box assembles around the network
    if (this.boxEdges) {
      const edgePhase = smoothstep(0.52, 0.68, p); // chấm trắng hiện dần theo khung
      // The frame draws itself stroke by stroke (continuing the XY-line
      // drawing feel) instead of fading in
      const boxDraw = smoothstep(0.46, 0.58, p);
      const edgePos = this.boxEdges.geometry.attributes.position;
      this.boxEdgeDraw.forEach((edge, k) => {
        const g = clamp01((boxDraw - edge.s) / (edge.e - edge.s));
        edgePos.setXYZ(k * 2, edge.a[0], edge.a[1], edge.a[2]);
        edgePos.setXYZ(
          k * 2 + 1,
          edge.a[0] + (edge.b[0] - edge.a[0]) * g,
          edge.a[1] + (edge.b[1] - edge.a[1]) * g,
          edge.a[2] + (edge.b[2] - edge.a[2]) * g,
        );
      });
      edgePos.needsUpdate = true;
      this.boxEdges.computeLineDistances();
      this.boxEdges.scale.setScalar(1);
      this.boxEdges.material.opacity = (boxDraw > 0.001 ? 0.1 : 0) * (1 - dashFade);
      this.boxEdges.visible = this.boxEdges.material.opacity > 0.001;
      if (this.boxAnchors) {
        const es = this.boxEdges.scale.x;
        this.boxAnchors.children.forEach((sprite) => {
          sprite.position.setLength(Math.max(sprite.userData.baseLength ??= sprite.position.length(), 0.0001) * es);
          sprite.scale.setScalar(0.15);
        });
        this.boxAnchorMaterials.forEach((material) => { material.opacity = edgePhase; });
        if (this.faceDotMaterials) {
          const n = this.tmpNormal || (this.tmpNormal = new THREE.Vector3());
          this.faceDotMaterials.forEach(({ material, normalZ }) => {
            n.set(0, 0, normalZ).applyEuler(this.network.rotation);
            const facing = clamp01((n.z - 0.05) / 0.4);
            material.opacity = edgePhase * (0.1 + 0.9 * facing);
          });
        }
        this.boxAnchors.visible = edgePhase > 0.01;
      }
      if (this.centerSpokes) {
        // spokes grow outward from the centre (lan tỏa) until they touch the
        // dots; scaled by es so endpoints track the assembling frame exactly
        const es = this.boxEdges.scale.x;
        const spread = smoothstep(0.56, 0.72, p);
        this.centerSpokes.scale.setScalar(Math.max(es * spread, 0.0001));
        this.centerSpokes.material.opacity = 0.08 * smoothstep(0.56, 0.6, p); // 1/9: nhạt bớt
        this.centerSpokes.visible = spread > 0.001;
        if (this.spokeRunners && this.spokePaths.length) {
          // couriers: each slot repicks a random trace every cycle and rides
          // it centre -> dot at constant speed (arc-length sampled)
          const sc = this.centerSpokes.scale.x;
          const runnerVis = smoothstep(0.56, 0.6, p);
          this.spokeRunners.forEach((runner) => {
            const cycle = (elapsed + runner.offset) / runner.cycleSeconds;
            const epoch = Math.floor(cycle);
            const t = cycle - epoch;
            const pick = seededRandom(0x5b0de + runner.slot * 131 + epoch * 977)();
            const path = this.spokePaths[Math.floor(pick * this.spokePaths.length)];
            const d = t * path.total;
            let k = 1;
            while (k < path.cum.length - 1 && path.cum[k] < d) k += 1;
            const seg = (d - path.cum[k - 1]) / Math.max(path.cum[k] - path.cum[k - 1], 1e-6);
            runner.sprite.position.lerpVectors(path.pts[k - 1], path.pts[k], seg).multiplyScalar(sc);
            runner.material.opacity = runnerVis;
            runner.sprite.visible = runnerVis > 0.01;
          });
        }
      }
    }
    if (this.boxNetPoints) {
      // 28/8: chấm nhỏ trên mặt tạm TẮT theo yêu cầu — chờ prompt mới.
      this.boxNetPoints.visible = false;
      // 28/8: mọi line nối dot tạm TẮT theo yêu cầu — chờ prompt mới.
      this.boxNetLines.visible = false;
      if (this.boxInnerLines) this.boxInnerLines.visible = false;
    }
    this.burstRingMaterial.opacity = 0;
    this.burstRing.visible = false;

    // Pointer tilt (damped) + slow sphere spin once formed
    this.root.rotation.x += (this.pointerTarget.x - this.root.rotation.x) * SCENE_LIMITS.damping;
    this.root.rotation.y += (this.pointerTarget.y - this.root.rotation.y) * SCENE_LIMITS.damping;
    this.spinVelocity = (this.spinVelocity || 0) * 0.94;
    this.spinOffset = (this.spinOffset || 0) + this.spinVelocity;
    this.network.rotation.x = 0.3 * boxForm;
    this.network.rotation.y = (0.6 + elapsed * 0.02 + this.spinOffset) * boxForm;

    // Nodes: scatter -> sphere; dots blink softly, labels always shown
    const spin = this.network.rotation.y;
    const cosSpin = Math.cos(spin);
    const sinSpin = Math.sin(spin);
    // Random toggle roulette: each label lives on its own ~3.2s cycle — ON at
    // a freshly rolled random position for ~55% of the cycle, then OFF, then
    // it reappears somewhere else. ~15-20 of the 31 are lit at any moment.
    const INTRO_CYCLE = 3.2;
    // Label nào lỡ chạm nhau thì TRƯỢT tách ra êm (nhích scatter mỗi frame
    // một chút) thay vì nẩy/bật chỗ khác
    if (p < 0.44) {
      // Lần đầu vào: GIẢI TỎA chồng lấn ngay lập tức (positional relax ~240
      // vòng, chạy 1 lần trước khi render) — hết cảnh mới vô giật giật vì
      // cả đám cùng xô đẩy nhau
      if (!this.introRelaxed) {
        this.introRelaxed = true;
        this.nodes.forEach((node, nodeIndex) => {
          const roll = seededRandom(0xab1e + nodeIndex * 7919);
          let px; let py; let guard = 0;
          do {
            px = (roll() - 0.5) * 5.4;
            py = -0.28 + (roll() - 0.5) * 2.4;
            guard += 1;
          } while (Math.abs(px) < 1.35 && Math.abs(py + 0.1) < 0.6 && guard < 12);
          node.scatter.set(px, py, 0.3);
          node.flatInit = true;
        });
        for (let iter = 0; iter < 240; iter += 1) {
          let moved = false;
          for (let i = 0; i < this.nodes.length; i += 1) {
            const a = this.nodes[i];
            for (let j = i + 1; j < this.nodes.length; j += 1) {
              const b = this.nodes[j];
              const dx = b.scatter.x - a.scatter.x;
              const dy = b.scatter.y - a.scatter.y;
              const minX = (a.labelWidth + b.labelWidth) / 2 + 0.34;
              const minY = 0.56;
              const ox = minX - Math.abs(dx);
              const oy = minY - Math.abs(dy);
              if (ox > 0 && oy > 0) {
                moved = true;
                const dirX = dx >= 0 ? 1 : -1;
                const dirY = dy >= 0 ? 1 : -1;
                a.scatter.x -= ox * 0.25 * dirX; b.scatter.x += ox * 0.25 * dirX;
                a.scatter.y -= oy * 0.12 * dirY; b.scatter.y += oy * 0.12 * dirY;
              }
            }
            a.scatter.x = Math.max(-2.7, Math.min(2.7, a.scatter.x));
            a.scatter.y = Math.max(-1.62, Math.min(1.06, a.scatter.y));
            if (Math.abs(a.scatter.x) < 1.35 && Math.abs(a.scatter.y + 0.1) < 0.6) {
              a.scatter.x += a.scatter.x >= 0 ? 0.06 : -0.06;
            }
          }
          if (!moved) break;
        }
      }
      for (let i = 0; i < this.nodes.length; i += 1) {
        const a = this.nodes[i];
        if (!a.introOn) continue;
        for (let j = i + 1; j < this.nodes.length; j += 1) {
          const b = this.nodes[j];
          if (!b.introOn) continue;
          const dx = b.group.position.x - a.group.position.x;
          const dy = b.group.position.y - a.group.position.y;
          const minX = (a.labelWidth + b.labelWidth) / 2 + 0.02;
          const minY = 0.34;
          const overlapX = minX - Math.abs(dx);
          const overlapY = minY - Math.abs(dy);
          if (overlapX > 0 && overlapY > 0) {
            // đụng nhau -> nhận XUNG LỰC như bi-a: văng ra có đà rồi
            // chậm dần (damping bên dưới)
            // hướng đẩy mượt qua 0 (không lật dấu đột ngột) + lực tỉ lệ
            const dirX = dx / Math.max(Math.abs(dx), 0.06);
            const dirY = dy / Math.max(Math.abs(dy), 0.06);
            const kick = Math.min(0.01, overlapX * 0.012);
            a.vx = (a.vx || 0) - kick * dirX; b.vx = (b.vx || 0) + kick * dirX;
            a.vy = (a.vy || 0) - kick * 0.5 * dirY; b.vy = (b.vy || 0) + kick * 0.5 * dirY;
          }
        }
      }
      for (let i = 0; i < this.nodes.length; i += 1) {
        const n = this.nodes[i];
        if (Math.abs(n.scatter.x) < 1.35 && Math.abs(n.scatter.y + 0.1) < 0.6) {
          const depth = (1.35 - Math.abs(n.scatter.x)) / 1.35; // càng sâu đẩy càng rõ, êm dần khi ra
          n.vx = (n.vx || 0) + (n.scatter.x >= 0 ? 1 : -1) * 0.006 * depth;
        }
        if (!n.vx && !n.vy) continue;
        n.scatter.x = Math.max(-2.7, Math.min(2.7, n.scatter.x + (n.vx || 0)));
        n.scatter.y = Math.max(-1.62, Math.min(1.06, n.scatter.y + (n.vy || 0)));
        n.vx = Math.max(-0.012, Math.min(0.012, (n.vx || 0) * 0.93));
        n.vy = Math.max(-0.008, Math.min(0.008, (n.vy || 0) * 0.93));
        if (Math.abs(n.vx) < 0.0004) n.vx = 0;
        if (Math.abs(n.vy) < 0.0004) n.vy = 0;
      }
    }
    const visibleIdx = [];
    this.nodes.forEach((node, nodeIndex) => {
      // 31 label hiện HẾT, nằm cùng mặt phẳng, tự trôi; va nhau thì vật lý
      // bi-a phía trên đẩy văng nhẹ ra — không toggle ẩn/hiện nữa
      if (!node.flatInit) {
        node.flatInit = true;
        const roll = seededRandom(0xab1e + nodeIndex * 7919);
        let px; let py; let guard = 0;
        do {
          px = (roll() - 0.5) * 5.4;
          py = -0.28 + (roll() - 0.5) * 2.4;
          guard += 1;
        } while (Math.abs(px) < 1.35 && Math.abs(py + 0.1) < 0.6 && guard < 12);
        node.scatter.set(px, py, 0.3);
      }
      node.introOn = 1;
      const wantSolid = boxForm > 0.01;
      if (node.isSolid !== wantSolid) {
        node.isSolid = wantSolid;
        node.dotMaterial.map = wantSolid
          ? this.solidDotTextures[node.texIndex]
          : this.dotTextures[node.texIndex];
        node.dotMaterial.needsUpdate = true;
      }
      // hover near the logo, then glide to a slot inside the box
      // (đi qua lớp smoothing nên không bao giờ giật)
      if (node.sx === undefined) { node.sx = node.scatter.x; node.sy = node.scatter.y; }
      node.sx += (node.scatter.x - node.sx) * 0.03;
      node.sy += (node.scatter.y - node.sy) * 0.03;
      node.group.position.set(node.sx, node.sy, node.scatter.z);
      if (boxForm > 0) node.group.position.lerp(node.boxPos, boxForm);
      const bN = boxForm;
      const launchPop = 1;
      const introVis = node.introOn;
      if (introVis > 0.5) visibleIdx.push(nodeIndex);
      const nodeVisN = introVis * (1 - smoothstep(0.3, 0.44, p)); // tan sớm, nhường sân cho hộp
      node.burstT = bN;
      const driftT = elapsed * node.driftSpeed + node.driftPhase;
      const driftAmp = node.driftAmp * 0.5 * (1 - boxForm) * nodeVisN;
      node.group.position.x += Math.sin(driftT) * driftAmp;
      node.group.position.y += Math.sin(driftT * 1.37 + 1.1) * driftAmp * 0.8;
      node.group.position.z += Math.cos(driftT * 0.81) * driftAmp * 0.6;
      if (boxForm > 0.5) {
        node.group.position.x = Math.max(-2.75, Math.min(2.75, node.group.position.x));
        node.group.position.y = Math.max(-1.45, Math.min(1.45, node.group.position.y));
        node.group.position.z = Math.max(-1.45, Math.min(1.45, node.group.position.z));
      }
      const blink = 0.5 + 0.5 * Math.sin(elapsed * node.blinkSpeed + node.blinkPhase) ** 2;
      // Depth cue once the sphere forms: rear nodes shrink and dim so front
      // and rear labels stop stacking into an unreadable pile.
      const spunZ = node.group.position.z * cosSpin - node.group.position.x * sinSpin;
      const frontness = clamp01((spunZ / SPHERE_RADIUS + 1) / 2);
      const depthScale = 1 - sphereMix * (1 - (0.6 + 0.4 * frontness));
      const depthFade = 1 - sphereMix * (1 - (0.35 + 0.65 * frontness));
      const vis = depthFade * nodeVisN;
      node.dotMaterial.opacity = (0.74 + 0.26 * blink) * vis * labelFade;
      node.dot.scale.setScalar((0.145 + 0.02 * blink) * (1 + 0.9 * boxForm) * depthScale * Math.max(nodeVisN * launchPop, 0.0001));
      // scroll 2: pill THU HẸP bề ngang dần về cỡ circle, hạ xuống đúng chỗ
      // circle, rồi mới mờ đi — morph thay vì crossfade
      const collapse = labelFade;
      node.labelMaterial.opacity = 0.95 * vis * (1 - smoothstep(0.55, 1, labelFade));
      const wMul = 1 + (0.22 / node.labelWidth - 1) * collapse;
      const labelScale = depthScale * Math.max(nodeVisN * launchPop, 0.0001) * (1 + 0.5 * sphereMix);
      node.labelSprite.scale.set(node.labelWidth * labelScale * wMul, node.labelHeight * labelScale, 1);
      node.labelSprite.position.y = 0.125 * labelScale * (1 - collapse);
      // Radar ping: expanding, fading ring on a per-node cycle
      const pingU = ((elapsed / 4.4) + node.pingPhase) % 1;
      node.ping.scale.setScalar((0.13 + 0.18 * pingU) * depthScale * Math.max(nodeVisN, 0.0001));
      node.pingMaterial.opacity = ((1 - pingU) ** 1.6) * 0.32 * vis * labelFade;
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
    const linkVis = Math.max(introLinkMix, boxLinkMix);
    this.introLinks.forEach(({ line, travel, travelMaterial, travel2, travelMaterial2, travel3, travelMaterial3, travel4, travelMaterial4, slot, cycleSeconds, offset }) => {
      const cycle = (elapsed + offset) / cycleSeconds;
      const phase = cycle % 1;
      // hard toggle: the line snaps on at the start of the cycle and snaps
      // off near the end — no fade in/out
      const active = phase < 0.75 ? 1 : 0; // ON ~2.7s, nghỉ ~0.9s rồi nối cặp mới
      const cycleIndex = Math.floor(cycle);
      // Chained hops: the node picked for step k is shared with step k+1, so
      // each slot walks a continuous path A -> B -> C -> ... across cycles.
      const pickNode = (step) => {
        const random = seededRandom(0xf00d + slot * 131 + step * 977);
        if (visibleIdx.length > 2) return visibleIdx[Math.floor(random() * visibleIdx.length)];
        return Math.floor(random() * this.nodes.length);
      };
      let a; let b; let c;
      if (chordReveal > 0.5 && this.chordPairs.length) {
        const random = seededRandom(0xf00d + slot * 131 + cycleIndex * 977);
        [a, b] = this.chordPairs[Math.floor(random() * this.chordPairs.length)];
        c = b;
      } else {
        a = pickNode(cycleIndex);
        b = pickNode(cycleIndex + 1);
        c = pickNode(cycleIndex + 2);
        if (b === a) b = (b + 7) % this.nodes.length;
        if (c === b) c = (c + 5) % this.nodes.length;
      }
      const positions = line.geometry.attributes.position;
      const LINE_LIFT = 0.125; // dot ẩn rồi — neo line vào giữa label
      this.tmpA.copy(this.nodes[a].group.position); this.tmpA.y += LINE_LIFT;
      this.tmpB.copy(this.nodes[b].group.position); this.tmpB.y += LINE_LIFT;
      const pc = (this.tmpC || (this.tmpC = new THREE.Vector3())).copy(this.nodes[c].group.position);
      pc.y += LINE_LIFT;
      // Jump-rope bow: each segment swings around its chord like a skipping
      // rope — sin(t*PI) pins the ends, the time term swings the belly.
      const SEG = 16;
      const swing = 0; // line thẳng, không uốn
      const bendInto = (out, P, Q, t) => {
        out.lerpVectors(P, Q, t);
        const dx = Q.x - P.x; const dy = Q.y - P.y;
        const len = Math.hypot(dx, dy) || 1;
        const amp = Math.min(0.24, len * 0.17) * Math.sin(t * Math.PI) * swing;
        out.x += (-dy / len) * amp;
        out.y += (dx / len) * amp;
        return out;
      };
      const sample = this.tmpSample || (this.tmpSample = new THREE.Vector3());
      for (let i = 0; i <= SEG; i += 1) {
        bendInto(sample, this.tmpA, this.tmpB, i / SEG);
        positions.setXYZ(i, sample.x, sample.y, sample.z);
      }
      for (let i = 1; i <= SEG; i += 1) {
        bendInto(sample, this.tmpB, pc, i / SEG);
        positions.setXYZ(SEG + i, sample.x, sample.y, sample.z);
      }
      positions.needsUpdate = true;
      line.computeLineDistances();
      line.material.opacity = active > 0 ? 0.42 * linkVis : 0; // hard toggle, không fade
      line.visible = line.material.opacity > 0.01;
      // couriers ride the same bowed rope A -> B -> C
      const ride = (sprite, material, t, dim) => {
        if (t <= 0) { material.opacity = 0; sprite.visible = false; return; }
        if (t < 0.5) bendInto(sprite.position, this.tmpA, this.tmpB, t * 2);
        else bendInto(sprite.position, this.tmpB, pc, t * 2 - 1);
        material.opacity = active * linkVis * dim;
        sprite.visible = material.opacity > 0.01;
      };
      ride(travel, travelMaterial, clamp01((phase - 0.03) / 0.62), 1);
      ride(travel2, travelMaterial2, clamp01((phase - 0.03) / 0.62 - 0.14), 0.9);
      ride(travel3, travelMaterial3, clamp01((phase - 0.03) / 0.62 - 0.27), 0.85);
      ride(travel4, travelMaterial4, clamp01((phase - 0.03) / 0.62 - 0.4), 0.8);
    });

    if (this.burstRays) this.burstRays.visible = false;

    if (this.spokeCouriers && !this.spokeCouriersHidden) {
      this.spokeCouriersHidden = true;
      this.spokeCouriers.forEach(({ sprite, material }) => { material.opacity = 0; sprite.visible = false; });
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

window.SH.PullApartScene = PullApartScene;
})();
