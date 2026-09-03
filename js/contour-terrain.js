/* js/contour-terrain.js — real-time procedural topographic contour terrain.
 *
 * No pre-rendered asset: a heightfield is evaluated every frame from layered
 * value noise + domain warping + animated gaussian peaks, and the contour lines
 * are extracted with marching squares into ONE LineSegments buffer (one draw
 * call). A colour-less depth-only mesh of the same surface (plus its side skirt)
 * gives real occlusion, so the lines read as a solid 3D block.
 *
 * Usage: window.SHContour.mount(containerEl)  — needs window.THREE.
 */
(() => {
  const BG = '#ffffff';
  const INK = 0x1b1b1b;

  /* ---------- procedural height field ---------- */

  function hash(i, j) {
    let n = (i * 374761393 + j * 668265263) | 0;
    n = (n ^ (n >> 13)) * 1274126177;
    return ((n ^ (n >> 16)) & 0x7fffffff) / 0x7fffffff;
  }

  function smoother(t) { return t * t * t * (t * (t * 6 - 15) + 10); }

  function noise2(x, y) {
    const xi = Math.floor(x), yi = Math.floor(y);
    const xf = x - xi, yf = y - yi;
    const u = smoother(xf), v = smoother(yf);
    const a = hash(xi, yi), b = hash(xi + 1, yi);
    const c = hash(xi, yi + 1), d = hash(xi + 1, yi + 1);
    return (a + (b - a) * u) * (1 - v) + (c + (d - c) * u) * v;
  }

  function fbm(x, y) {
    let sum = 0, amp = 0.5, f = 1;
    for (let o = 0; o < 3; o++) {
      sum += amp * noise2(x * f, y * f);
      f *= 2.07;
      amp *= 0.5;
    }
    return sum * 1.14;
  }

  // Asymmetric ridge/basin set — each formation breathes on its own clock.
  const FORMS = [
    { x: -0.30, z: -0.26, sx: 0.42, sz: 0.32, amp: 0.30, rate: 0.055, phase: 0.0 },
    { x: 0.28, z: -0.08, sx: 0.32, sz: 0.46, amp: 0.25, rate: 0.041, phase: 1.7 },
    { x: -0.04, z: 0.32, sx: 0.48, sz: 0.30, amp: 0.21, rate: 0.033, phase: 3.4 },
    { x: 0.38, z: 0.34, sx: 0.26, sz: 0.26, amp: 0.17, rate: 0.067, phase: 2.1 },
    { x: -0.42, z: 0.16, sx: 0.24, sz: 0.36, amp: -0.19, rate: 0.048, phase: 0.8 },
    { x: 0.06, z: -0.40, sx: 0.36, sz: 0.22, amp: -0.15, rate: 0.037, phase: 4.6 },
  ];

  // Noise part only — smooth and low frequency, so it is evaluated on a coarse
  // grid and bilinearly upsampled (the expensive part of the field by far).
  function noisePart(x, z, t) {
    const wx = x + 0.42 * fbm(x * 1.6 + t * 0.021, z * 1.6);
    const wz = z + 0.42 * fbm(x * 1.6, z * 1.6 - t * 0.017);
    const f1 = fbm(wx * 1.75 + 1.7, wz * 1.75 - t * 0.030);
    const f2 = fbm(wx * 1.75 - 4.3, wz * 1.75 + 2.9 + t * 0.024);
    const blend = 0.5 + 0.5 * Math.sin(t * 0.043);
    let h = (f1 * (1 - blend) + f2 * blend - 0.5) * 1.35;
    h += 0.12 * (fbm(wx * 3.6 + 8.1, wz * 3.6 + t * 0.05) - 0.5);
    h += 0.05 * (fbm(wx * 6.9, wz * 6.9 - t * 0.04) - 0.5);
    return h;
  }

  function edgeFalloff(x, z) {
    const edge = Math.max(Math.abs(x), Math.abs(z));
    const fall = 1 - smoother(Math.min(1, Math.max(0, (edge - 0.40) / 0.10)));
    return 0.55 + 0.45 * fall;
  }

  /* ---------- instance ---------- */

  class Terrain {
    constructor(container) {
      const THREE = window.THREE;
      this.THREE = THREE;
      this.el = container;
      this.reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

      const w = container.clientWidth || 480;
      const h = container.clientHeight || 360;
      const small = Math.min(window.innerWidth, w) < 620;

      this.N = small ? 88 : 128;          // heightfield resolution
      this.levels = small ? 34 : 54;      // contour count
      this.span = 1.0;                    // world footprint (-0.5..0.5)
      this.baseY = -0.34;
      this.field = new Float32Array(this.N * this.N);
      this.M = small ? 25 : 33;                     // coarse noise grid
      this.coarse = new Float32Array(this.M * this.M);
      this.forms = FORMS.map((f) => Object.assign({}, f));
      this.t = 0;
      this.fieldFrame = 0;

      this.scene = new THREE.Scene();
      this.scene.background = new THREE.Color(BG);

      this.camera = new THREE.PerspectiveCamera(30, w / h, 0.1, 20);
      this.camBase = new THREE.Vector3(1.62, 1.16, 1.96);
      this.camera.position.copy(this.camBase);
      this.camera.lookAt(0, -0.02, 0);

      this.renderer = new THREE.WebGLRenderer({
        antialias: true, alpha: false, powerPreference: 'high-performance',
        preserveDrawingBuffer: true, // lets the frame be captured/screenshotted
      });
      this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
      this.renderer.setSize(w, h, false);
      const cv = this.renderer.domElement;
      cv.style.width = '100%';
      cv.style.height = '100%';
      cv.style.display = 'block';
      container.appendChild(cv);

      // Two WebGL contexts live on this page (hero scene + terrain); if the
      // browser drops ours, keep the frame and recover when it comes back.
      cv.addEventListener('webglcontextlost', (e) => { e.preventDefault(); this.lost = true; }, false);
      cv.addEventListener('webglcontextrestored', () => {
        this.lost = false;
        this.renderer.resetState?.();
        this.resize();
        this.updateField(this.t);
        this.rebuild();
      }, false);

      this.buildOccluder();
      this.buildLines();

      this.pointer = { x: 0, y: 0, tx: 0, ty: 0 };
      this.onPointer = (e) => {
        const r = container.getBoundingClientRect();
        this.pointer.tx = ((e.clientX - r.left) / r.width - 0.5) * 2;
        this.pointer.ty = ((e.clientY - r.top) / r.height - 0.5) * 2;
      };
      // Pointer parallax removed by request — the terrain keeps its own drift.

      this.ro = new ResizeObserver(() => this.resize());
      this.ro.observe(container);

      this.visible = true;
      this.io = new IntersectionObserver(([entry]) => { this.visible = entry.isIntersecting; }, { threshold: 0.01 });
      this.io.observe(container);

      this.tick = this.tick.bind(this);
      this.last = performance.now();
      this.updateField(0);
      this.rebuild();
      this.raf = requestAnimationFrame(this.tick);
    }

    /* depth-only surface + skirt: hides the lines that fall behind the block */
    buildOccluder() {
      const THREE = this.THREE, N = this.N;
      const mat = new THREE.MeshBasicMaterial({
        colorWrite: false, depthWrite: true, side: THREE.DoubleSide,
        polygonOffset: true, polygonOffsetFactor: 1.6, polygonOffsetUnits: 1.6,
      });

      const surf = new THREE.PlaneGeometry(this.span, this.span, N - 1, N - 1);
      surf.rotateX(-Math.PI / 2);
      this.surfGeo = surf;
      this.scene.add(new THREE.Mesh(surf, mat));

      // side walls: 4 edges, each a quad strip from terrain edge down to base
      this.skirtGeo = new THREE.BufferGeometry();
      this.skirtPos = new Float32Array(4 * (N - 1) * 6 * 3);
      this.skirtGeo.setAttribute('position', new THREE.BufferAttribute(this.skirtPos, 3));
      this.scene.add(new THREE.Mesh(this.skirtGeo, mat));

      const base = new THREE.PlaneGeometry(this.span, this.span, 1, 1);
      base.rotateX(Math.PI / 2);
      base.translate(0, this.baseY, 0);
      this.scene.add(new THREE.Mesh(base, mat));
    }

    buildLines() {
      const THREE = this.THREE, N = this.N;
      this.maxSeg = (N - 1) * (N - 1) * 2 + 8 * N;
      this.linePos = new Float32Array(this.maxSeg * 6);
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.BufferAttribute(this.linePos, 3));
      g.setDrawRange(0, 0);
      this.lineGeo = g;
      this.lines = new THREE.LineSegments(g, new THREE.LineBasicMaterial({ color: INK, transparent: true, opacity: 0.88 }));
      this.lines.frustumCulled = false;
      this.scene.add(this.lines);
    }

    updateField(t) {
      const N = this.N, M = this.M, f = this.field, cs = this.coarse, s = this.span;

      // 1. coarse noise field
      for (let j = 0; j < M; j++) {
        const z = (j / (M - 1) - 0.5) * s;
        for (let i = 0; i < M; i++) {
          cs[j * M + i] = noisePart((i / (M - 1) - 0.5) * s, z, t);
        }
      }

      // 2. per-frame form constants + bounds (skip vertices outside 3 sigma)
      const forms = this.forms;
      for (let k = 0; k < forms.length; k++) {
        const o = FORMS[k], d = forms[k];
        d.cx = o.x + 0.05 * Math.sin(t * o.rate * 1.3 + o.phase);
        d.cz = o.z + 0.05 * Math.cos(t * o.rate * 0.9 + o.phase);
        d.a = o.amp * (0.68 + 0.32 * Math.sin(t * o.rate * 6.2 + o.phase));
        d.ix = 1 / o.sx; d.iz = 1 / o.sz;
        d.rx = o.sx * 2.6; d.rz = o.sz * 2.6;
      }

      const scale = (M - 1) / (N - 1);
      let min = Infinity, max = -Infinity;

      for (let j = 0; j < N; j++) {
        const z = (j / (N - 1) - 0.5) * s;
        const cj = j * scale;
        const j0 = Math.min(M - 2, cj | 0);
        const tz = cj - j0;
        const row0 = j0 * M, row1 = row0 + M;

        for (let i = 0; i < N; i++) {
          const x = (i / (N - 1) - 0.5) * s;
          const ci = i * scale;
          const i0 = Math.min(M - 2, ci | 0);
          const tx = ci - i0;

          const a = cs[row0 + i0], b = cs[row0 + i0 + 1];
          const c = cs[row1 + i0], d2 = cs[row1 + i0 + 1];
          let h = (a + (b - a) * tx) * (1 - tz) + (c + (d2 - c) * tx) * tz;

          for (let k = 0; k < forms.length; k++) {
            const d = forms[k];
            const dx = x - d.cx;
            if (dx > d.rx || dx < -d.rx) continue;
            const dz = z - d.cz;
            if (dz > d.rz || dz < -d.rz) continue;
            const ax = dx * d.ix, az = dz * d.iz;
            h += d.a * Math.exp(-(ax * ax + az * az));
          }

          h *= edgeFalloff(x, z);
          f[j * N + i] = h;
          if (h < min) min = h;
          if (h > max) max = h;
        }
      }

      this.min = min;
      this.max = max;
    }

    /* marching squares over the field, all levels into one segment buffer */
    rebuild() {
      const N = this.N, f = this.field, s = this.span, pos = this.linePos;
      const lo = this.min, hi = this.max;
      const step = (hi - lo) / (this.levels + 1);
      let p = 0;
      const cap = this.maxSeg * 6 - 24;

      const px = (i) => (i / (N - 1) - 0.5) * s;

      for (let j = 0; j < N - 1; j++) {
        const z0 = px(j), z1 = px(j + 1);
        for (let i = 0; i < N - 1; i++) {
          const i0 = j * N + i;
          const h00 = f[i0], h10 = f[i0 + 1], h01 = f[i0 + N], h11 = f[i0 + N + 1];
          let cmin = h00, cmax = h00;
          if (h10 < cmin) cmin = h10; else if (h10 > cmax) cmax = h10;
          if (h01 < cmin) cmin = h01; else if (h01 > cmax) cmax = h01;
          if (h11 < cmin) cmin = h11; else if (h11 > cmax) cmax = h11;

          let k = Math.ceil((cmin - lo) / step);
          if (k < 1) k = 1;
          const x0 = px(i), x1 = px(i + 1);

          for (; k <= this.levels; k++) {
            const L = lo + k * step;
            if (L > cmax) break;
            if (p > cap) return this.flush(p);

            const b0 = h00 > L ? 1 : 0, b1 = h10 > L ? 2 : 0;
            const b2 = h11 > L ? 4 : 0, b3 = h01 > L ? 8 : 0;
            const code = b0 | b1 | b2 | b3;
            if (code === 0 || code === 15) continue;

            // edge crossings: bottom, right, top, left
            const eb = x0 + (x1 - x0) * ((L - h00) / (h10 - h00 || 1e-9));
            const er = z0 + (z1 - z0) * ((L - h10) / (h11 - h10 || 1e-9));
            const et = x0 + (x1 - x0) * ((L - h01) / (h11 - h01 || 1e-9));
            const el = z0 + (z1 - z0) * ((L - h00) / (h01 - h00 || 1e-9));

            const seg = (ax, az, bx, bz) => {
              pos[p++] = ax; pos[p++] = L; pos[p++] = az;
              pos[p++] = bx; pos[p++] = L; pos[p++] = bz;
            };

            switch (code) {
              case 1: case 14: seg(eb, z0, x0, el); break;
              case 2: case 13: seg(eb, z0, x1, er); break;
              case 3: case 12: seg(x0, el, x1, er); break;
              case 4: case 11: seg(x1, er, et, z1); break;
              case 6: case 9: seg(eb, z0, et, z1); break;
              case 7: case 8: seg(x0, el, et, z1); break;
              case 5: seg(eb, z0, x0, el); seg(x1, er, et, z1); break;
              case 10: seg(eb, z0, x1, er); seg(x0, el, et, z1); break;
            }
          }
        }
      }

      p = this.addBlockOutline(p);
      this.flush(p);
      this.updateOccluder();
    }

    /* slab silhouette: terrain rim, corner verticals, base rectangle */
    addBlockOutline(p) {
      const N = this.N, f = this.field, s = this.span, pos = this.linePos, y = this.baseY;
      const px = (i) => (i / (N - 1) - 0.5) * s;
      const put = (ax, ay, az, bx, by, bz) => {
        pos[p++] = ax; pos[p++] = ay; pos[p++] = az;
        pos[p++] = bx; pos[p++] = by; pos[p++] = bz;
      };

      for (let i = 0; i < N - 1; i++) {
        put(px(i), f[i], px(0), px(i + 1), f[i + 1], px(0));
        const rowB = (N - 1) * N;
        put(px(i), f[rowB + i], px(N - 1), px(i + 1), f[rowB + i + 1], px(N - 1));
        put(px(0), f[i * N], px(i), px(0), f[(i + 1) * N], px(i + 1));
        put(px(N - 1), f[i * N + N - 1], px(i), px(N - 1), f[(i + 1) * N + N - 1], px(i + 1));
      }

      const c = [[0, 0], [N - 1, 0], [0, N - 1], [N - 1, N - 1]];
      for (const [i, j] of c) put(px(i), f[j * N + i], px(j), px(i), y, px(j));

      const a = -s / 2, b = s / 2;
      put(a, y, a, b, y, a); put(b, y, a, b, y, b);
      put(b, y, b, a, y, b); put(a, y, b, a, y, a);
      return p;
    }

    flush(p) {
      this.lineGeo.attributes.position.needsUpdate = true;
      this.lineGeo.setDrawRange(0, p / 3);
      this.lineGeo.attributes.position.updateRange = { offset: 0, count: p };
    }

    updateOccluder() {
      const N = this.N, f = this.field, s = this.span;
      const sp = this.surfGeo.attributes.position;
      const arr = sp.array;
      // After rotateX(-90°) row iy=0 sits at z = -span/2, matching field row j=0.
      for (let k = 0, n = N * N; k < n; k++) arr[k * 3 + 1] = f[k];
      sp.needsUpdate = true;

      const px = (i) => (i / (N - 1) - 0.5) * s;
      const sk = this.skirtPos;
      const y = this.baseY;
      let q = 0;
      const quad = (ax, az, ah, bx, bz, bh) => {
        sk[q++] = ax; sk[q++] = ah; sk[q++] = az;
        sk[q++] = bx; sk[q++] = bh; sk[q++] = bz;
        sk[q++] = bx; sk[q++] = y; sk[q++] = bz;
        sk[q++] = ax; sk[q++] = ah; sk[q++] = az;
        sk[q++] = bx; sk[q++] = y; sk[q++] = bz;
        sk[q++] = ax; sk[q++] = y; sk[q++] = az;
      };
      const rowB = (N - 1) * N;
      for (let i = 0; i < N - 1; i++) {
        quad(px(i), px(0), f[i], px(i + 1), px(0), f[i + 1]);
        quad(px(i), px(N - 1), f[rowB + i], px(i + 1), px(N - 1), f[rowB + i + 1]);
        quad(px(0), px(i), f[i * N], px(0), px(i + 1), f[(i + 1) * N]);
        quad(px(N - 1), px(i), f[i * N + N - 1], px(N - 1), px(i + 1), f[(i + 1) * N + N - 1]);
      }
      this.skirtGeo.attributes.position.needsUpdate = true;
    }

    resize() {
      const w = this.el.clientWidth, h = this.el.clientHeight;
      if (!w || !h) return;
      this.camera.aspect = w / h;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(w, h, false);
    }

    tick(now) {
      this.raf = requestAnimationFrame(this.tick);
      const dt = Math.min(0.05, (now - this.last) / 1000);
      this.last = now;
      if (!this.visible || this.lost) return;

      if (!this.reduced) {
        this.t += dt;
        // field at ~30Hz, render at display rate — the motion is slow enough
        this.fieldFrame++;
        if (this.fieldFrame % 2 === 0) {
          this.updateField(this.t);
          this.rebuild();
        }
      }

      // whisper-quiet drift + pointer parallax
      this.pointer.x += (this.pointer.tx - this.pointer.x) * 0.04;
      this.pointer.y += (this.pointer.ty - this.pointer.y) * 0.04;
      const dx = Math.sin(this.t * 0.06) * 0.05;
      const dy = Math.sin(this.t * 0.045 + 1.2) * 0.03;
      this.camera.position.set(this.camBase.x + dx, this.camBase.y + dy, this.camBase.z - dx * 0.35);
      this.camera.lookAt(0, -0.02, 0);

      this.renderer.render(this.scene, this.camera);
    }

    destroy() {
      cancelAnimationFrame(this.raf);
      this.ro?.disconnect();
      this.io?.disconnect();
      this.renderer?.dispose();
      if (this.renderer?.domElement?.parentNode) this.renderer.domElement.parentNode.removeChild(this.renderer.domElement);
    }
  }

  function create(container) {
    if (container.__contour) return container.__contour;
    try {
      container.__contour = new Terrain(container);
    } catch (e) {
      console.warn('Contour terrain could not start.', e);
    }
    return container.__contour;
  }

  const api = {
    mount(container) {
      if (!container || container.__contour || container.__contourPending) return container?.__contour;
      if (!window.THREE) return null;
      const near = () => {
        const r = container.getBoundingClientRect();
        return r.top < window.innerHeight * 2.5 && r.bottom > -window.innerHeight * 1.5;
      };
      if (near()) return create(container);
      // Defer the WebGL context until the section is in reach. IntersectionObserver
      // is unreliable in a hidden/throttled frame, so watch scroll directly.
      container.__contourPending = true;
      const stop = () => {
        window.removeEventListener('scroll', onScroll);
        clearInterval(timer);
      };
      const onScroll = () => {
        if (!near()) return;
        stop();
        container.__contourPending = false;
        create(container);
      };
      const timer = setInterval(onScroll, 500);
      window.addEventListener('scroll', onScroll, { passive: true });
      return null;
    },
    mountAll(root) {
      (root || document).querySelectorAll('[data-contour-terrain]').forEach((el) => api.mount(el));
    },
  };

  window.SHContour = api;
})();
