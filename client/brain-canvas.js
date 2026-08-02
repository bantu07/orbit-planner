/* "Neuron brain" login background — a glowing low-poly wireframe brain seen in
   side profile (frontal lobe, occipital, cerebellum, brainstem), built from a
   triangulated mesh of neuron nodes. Cyan/blue mesh with hot magenta synapse
   flares firing near the centre, pulses travelling the connections, cursor
   reactivity and a gentle 3D sway. Pure Canvas 2D — no external library. */

class NeuronBrain {
  constructor(canvas, opts = {}) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.opts = Object.assign({
      colors: ['#3DF5FF', '#3DF5FF', '#5FB8FF', '#A97BFF', '#FF4FCB'],
      lineColor: 'rgba(120,180,255,0.55)',
      starCount: 170,
      a: 165,              // overall scale
      dome: 70,            // depth spread (z) for subtle 3D
      interior: 320,       // (legacy) not used with the grid fill
      gridGap: 16,         // spacing of the interior fill grid (even coverage)
      neighbors: 6,        // mesh links per node
      linkDist: 42,        // max link length
      focus: { x: -10, y: 60 },  // where the hot synapses cluster (upper-centre)
      heatRadius: 195,
    }, opts);

    this.nodes = [];
    this.edges = [];
    this.pulses = [];
    this.stars = [];
    this.angleY = 0;
    this.angleX = 0.06;
    this.targetTiltX = 0.06;
    this.targetTiltY = 0;
    this.running = true;
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.mouseScreen = null;
    this.burstUntil = 0;

    this._buildBrain();
    this._buildStars();
    this._bindEvents();
    this.resize();
    this._loop = this._loop.bind(this);
    requestAnimationFrame(this._loop);
  }


  // colour by "heat": hot magenta/pink synapses near the focus, cool cyan at the rim
  _heat(x, y) {
    const fx = this.opts.focus.x, fy = this.opts.focus.y;
    const d = Math.hypot(x - fx, y - fy);
    return clamp(1 - d / this.opts.heatRadius, 0, 1);
  }

  _pushNode(x, y, z, opts = {}) {
    const C = this.opts.colors;
    const heat = this._heat(x, y);
    let color, sparkle = false;
    if (opts.rim) {
      color = C[0];                                   // cyan silhouette
    } else if (Math.random() < 0.14 + heat * 0.55) {
      color = C[C.length - 1]; sparkle = true;        // firing pink synapse
    } else if (Math.random() < heat) {
      color = C[3];                                   // purple mid glow
    } else {
      color = Math.random() < 0.5 ? C[1] : C[2];      // cyan / blue mesh
    }
    const idx = this.nodes.length;
    this.nodes.push({ x, y, z, color, sparkle, heat, pulsePhase: Math.random() * Math.PI * 2 });
    return idx;
  }

  // add a chain of nodes along a curve (a sulcus / gyrus fold) with links
  _addPolyline(fn, samples, spacing = 20) {
    let prev = null, prevPt = null;
    for (let i = 0; i <= samples; i++) {
      const t = i / samples;
      const [x, y] = fn(t);
      if (prevPt && Math.hypot(x - prevPt[0], y - prevPt[1]) < spacing * 0.6) continue;
      const z = (Math.random() - 0.5) * this.opts.dome * 0.6;
      const idx = this._pushNode(x, y, z);
      if (prev !== null) this.edges.push({ a: prev, b: idx });
      prev = idx; prevPt = [x, y];
    }
  }

  // ---- Geometry: side-profile wireframe brain (matches the reference image) ----
  _buildBrain() {
    const s = this.opts.a; // overall scale
    // refined side-profile outline (x right, y up) — frontal lobe left,
    // occipital right, cerebellum + brainstem lower-right
    const outline = [
      [-0.35, 0.92], [0.05, 1.00], [0.45, 0.95], [0.75, 0.78], [0.95, 0.52],
      [1.05, 0.22], [1.06, -0.02], [0.98, -0.22], [0.90, -0.32], [0.95, -0.50],
      [0.86, -0.64], [0.70, -0.66], [0.60, -0.55], [0.57, -0.42], [0.50, -0.52],
      [0.46, -0.84], [0.37, -0.84], [0.40, -0.52], [0.33, -0.42], [0.10, -0.46],
      [-0.20, -0.52], [-0.45, -0.50], [-0.68, -0.42], [-0.85, -0.22], [-0.98, 0.02],
      [-1.02, 0.32], [-0.92, 0.60], [-0.72, 0.80],
    ].map(([x, y]) => [x * s, y * s]);
    this.outlinePoly = outline;

    // 1) boundary nodes — subdivide each edge for a crisp glowing silhouette
    const rimIdx = [];
    for (let i = 0; i < outline.length; i++) {
      const [x1, y1] = outline[i];
      const [x2, y2] = outline[(i + 1) % outline.length];
      const segLen = Math.hypot(x2 - x1, y2 - y1);
      const steps = Math.max(1, Math.round(segLen / 22));
      for (let k = 0; k < steps; k++) {
        const t = k / steps;
        rimIdx.push(this._pushNode(x1 + (x2 - x1) * t, y1 + (y2 - y1) * t, 0, { rim: true }));
      }
    }
    for (let i = 0; i < rimIdx.length; i++) {
      this.edges.push({ a: rimIdx[i], b: rimIdx[(i + 1) % rimIdx.length] });
    }

    // 2) sulci / gyri fold-lines — the cues that make it read as a brain
    this._addPolyline((t) => [                     // sylvian (lateral) fissure
      (-0.70 + 1.28 * t) * s,
      (-0.10 + 0.42 * t + 0.14 * Math.sin(t * Math.PI)) * s], 16);
    this._addPolyline((t) => [                     // central sulcus
      (0.12 - 0.26 * t + 0.04 * Math.sin(t * Math.PI * 2)) * s,
      (0.80 - 0.92 * t) * s], 15);
    this._addPolyline((t) => [                     // frontal gyrus arc
      (-0.66 + 0.42 * t) * s,
      (0.30 + 0.30 * Math.sin(t * Math.PI)) * s], 12);
    this._addPolyline((t) => [                     // parietal / occipital arc
      (0.30 + 0.55 * t) * s,
      (0.55 - 0.55 * t + 0.10 * Math.sin(t * Math.PI)) * s], 12);
    this._addPolyline((t) => [                     // temporal-lobe arc
      (-0.30 + 0.55 * t) * s,
      (-0.18 - 0.14 * Math.sin(t * Math.PI)) * s], 12);

    // 3) interior fill — jittered grid gives EVEN coverage (no empty pockets)
    const g = this.opts.gridGap;
    const minX = -1.0 * s, maxX = 1.05 * s, minY = -0.86 * s, maxY = 1.0 * s;
    for (let gx = minX; gx <= maxX; gx += g) {
      for (let gy = minY; gy <= maxY; gy += g) {
        const x = gx + (Math.random() - 0.5) * g * 0.7;
        const y = gy + (Math.random() - 0.5) * g * 0.7;
        if (!pointInPolygon(x, y, outline)) continue;
        this._pushNode(x, y, (Math.random() - 0.5) * this.opts.dome);
      }
    }

    // 4) mesh — link every node to its nearest neighbours
    const n = this.nodes.length;
    const maxD = this.opts.linkDist;
    const seen = new Set();
    const degree = new Array(n).fill(0);
    for (let i = 0; i < n; i++) {
      const a = this.nodes[i];
      const near = [];
      for (let j = 0; j < n; j++) {
        if (i === j) continue;
        const d = Math.hypot(a.x - this.nodes[j].x, a.y - this.nodes[j].y);
        if (d <= maxD) near.push({ j, d });
      }
      near.sort((p, q) => p.d - q.d);
      for (let k = 0; k < Math.min(this.opts.neighbors, near.length); k++) {
        const j = near[k].j;
        const key = i < j ? i + '_' + j : j + '_' + i;
        if (seen.has(key)) continue;
        seen.add(key);
        this.edges.push({ a: i, b: j });
        degree[i]++; degree[j]++;
      }
    }

    // 5) connectivity guard — hook up any lonely node to its nearest neighbour
    for (let i = 0; i < n; i++) {
      if (degree[i] > 0) continue;
      let best = -1, bestD = Infinity;
      for (let j = 0; j < n; j++) {
        if (i === j) continue;
        const d = Math.hypot(this.nodes[i].x - this.nodes[j].x, this.nodes[i].y - this.nodes[j].y);
        if (d < bestD) { bestD = d; best = j; }
      }
      if (best >= 0) { this.edges.push({ a: i, b: best }); degree[i]++; degree[best]++; }
    }
  }

  _buildStars() {
    for (let i = 0; i < this.opts.starCount; i++) {
      this.stars.push({
        x: Math.random(),
        y: Math.random(),
        r: Math.random() * 1.4 + 0.3,
        phase: Math.random() * Math.PI * 2,
        speed: 0.5 + Math.random(),
      });
    }
  }

  _bindEvents() {
    window.addEventListener('resize', () => this.resize());
    this.canvas.parentElement.addEventListener('mousemove', (e) => {
      const rect = this.canvas.getBoundingClientRect();
      const px = e.clientX - rect.left;
      const py = e.clientY - rect.top;
      const nx = px / rect.width - 0.5;
      const ny = py / rect.height - 0.5;
      this.targetTiltY = nx * 0.28;
      this.targetTiltX = 0.06 - ny * 0.22;
      this.mouseScreen = { x: px, y: py };
    });
    this.canvas.parentElement.addEventListener('mouseleave', () => { this.mouseScreen = null; });
    document.addEventListener('visibilitychange', () => {
      this.running = !document.hidden;
      if (this.running) requestAnimationFrame(this._loop);
    });
  }

  resize() {
    const rect = this.canvas.parentElement.getBoundingClientRect();
    this.canvas.width = rect.width * this.dpr;
    this.canvas.height = rect.height * this.dpr;
    this.canvas.style.width = rect.width + 'px';
    this.canvas.style.height = rect.height + 'px';
    this.w = rect.width;
    this.h = rect.height;
  }

  pause() { this.running = false; }
  resume() { if (!this.running) { this.running = true; requestAnimationFrame(this._loop); } }

  _maybeSpawnPulse() {
    if (Math.random() < 0.16 && this.edges.length) {
      const edgeIndex = Math.floor(Math.random() * this.edges.length);
      this.pulses.push({ edgeIndex, t: 0, speed: 0.012 + Math.random() * 0.02 });
    }
  }

  // public: intensify the synapse firing briefly (e.g. on a successful login)
  fireBurst(duration = 950) {
    this.burstUntil = performance.now() + duration;
    // light up the hot filaments with a wave of pulses
    const hot = [];
    for (let i = 0; i < this.edges.length; i++) {
      const e = this.edges[i];
      if ((this.nodes[e.a].heat + this.nodes[e.b].heat) / 2 > 0.4) hot.push(i);
    }
    const pool = hot.length ? hot : this.edges.map((_, i) => i);
    for (let k = 0; k < 60; k++) {
      const edgeIndex = pool[(Math.random() * pool.length) | 0];
      this.pulses.push({ edgeIndex, t: Math.random() * 0.2, speed: 0.02 + Math.random() * 0.03 });
    }
  }

  _drawSparkle(ctx, x, y, size, color) {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.strokeStyle = color;
    ctx.lineWidth = Math.max(0.6, size * 0.14);
    ctx.lineCap = 'round';
    ctx.shadowColor = color;
    ctx.shadowBlur = size * 3.2;
    ctx.beginPath();
    ctx.moveTo(x - size, y);
    ctx.lineTo(x + size, y);
    ctx.moveTo(x, y - size);
    ctx.lineTo(x, y + size);
    ctx.stroke();
    ctx.beginPath();
    ctx.fillStyle = '#ffffff';
    ctx.arc(x, y, size * 0.28, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  _loop(time) {
    if (!this.running) return;
    const { ctx, w, h, dpr } = this;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);

    // stars
    this.stars.forEach((s) => {
      const tw = 0.5 + 0.5 * Math.sin(time * 0.001 * s.speed + s.phase);
      ctx.beginPath();
      ctx.fillStyle = `rgba(210,225,255,${0.15 + tw * 0.55})`;
      ctx.arc(s.x * w, s.y * h, s.r, 0, Math.PI * 2);
      ctx.fill();
    });

    // gentle 3D sway + mouse parallax (keeps the side-profile readable)
    const sway = Math.sin(time * 0.00022) * 0.14;
    this.angleY += ((this.targetTiltY + sway) - this.angleY) * 0.04;
    this.angleX += (this.targetTiltX - this.angleX) * 0.05;

    // login "firing" burst intensity (0..1), eases out over its duration
    const burst = clamp((this.burstUntil - time) / 950, 0, 1);

    const cosY = Math.cos(this.angleY), sinY = Math.sin(this.angleY);
    const cosX = Math.cos(this.angleX), sinX = Math.sin(this.angleX);
    const focal = 520;
    const cx = w / 2, cy = h / 2 + h * 0.02;
    const scaleFit = Math.min(w, h) / 420;

    const projected = this.nodes.map((n) => {
      let x = n.x * cosY - n.z * sinY;
      let z = n.x * sinY + n.z * cosY;
      let y = n.y * cosX - z * sinX;
      z = n.y * sinX + z * cosX;
      const scale = (focal / (focal + z)) * scaleFit;
      return { sx: cx - x * scale, sy: cy - y * scale, z, scale };
    });

    // wireframe mesh — pass 1: cool cyan/blue links (cheap, no glow)
    ctx.lineWidth = 1;
    const hotEdges = [];
    this.edges.forEach((e) => {
      const heat = (this.nodes[e.a].heat + this.nodes[e.b].heat) / 2;
      if (heat > 0.4) { hotEdges.push({ e, heat }); return; }
      const a = projected[e.a], b = projected[e.b];
      const depthFade = clamp((a.scale + b.scale) / 2, 0.5, 1.35);
      ctx.strokeStyle = this.opts.lineColor.replace('0.55', String(0.18 * depthFade));
      ctx.beginPath();
      ctx.moveTo(a.sx, a.sy);
      ctx.lineTo(b.sx, b.sy);
      ctx.stroke();
    });
    // pass 2: hot synapse filaments glowing pink (grouped -> one state change)
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.shadowColor = '#FF4FCB';
    ctx.shadowBlur = 5 + burst * 10;
    hotEdges.forEach(({ e, heat }) => {
      const a = projected[e.a], b = projected[e.b];
      ctx.strokeStyle = `rgba(255,90,205,${clamp(0.12 + heat * 0.5 + burst * 0.4, 0, 1)})`;
      ctx.beginPath();
      ctx.moveTo(a.sx, a.sy);
      ctx.lineTo(b.sx, b.sy);
      ctx.stroke();
    });
    ctx.restore();

    // pulses traveling along the folds (more frequent during a burst)
    this._maybeSpawnPulse();
    if (burst > 0 && Math.random() < burst * 0.7) this._maybeSpawnPulse();
    this.pulses = this.pulses.filter((p) => p.t < 1);
    this.pulses.forEach((p) => {
      p.t += p.speed;
      const edge = this.edges[p.edgeIndex];
      if (!edge) return;
      const a = projected[edge.a], b = projected[edge.b];
      const px = a.sx + (b.sx - a.sx) * p.t;
      const py = a.sy + (b.sy - a.sy) * p.t;
      const grad = ctx.createRadialGradient(px, py, 0, px, py, 7);
      grad.addColorStop(0, 'rgba(255,255,255,0.95)');
      grad.addColorStop(1, 'rgba(160,200,255,0)');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(px, py, 6, 0, Math.PI * 2);
      ctx.fill();
    });

    // nodes — glow, sparkle flares, cursor-proximity reactivity
    this.nodes.forEach((n, i) => {
      const p = projected[i];
      const pulse = 0.65 + 0.35 * Math.sin(time * 0.0022 + n.pulsePhase);

      let proximityBoost = 1;
      if (this.mouseScreen) {
        const dx = p.sx - this.mouseScreen.x, dy = p.sy - this.mouseScreen.y;
        const d = Math.sqrt(dx * dx + dy * dy);
        if (d < 110) proximityBoost = 1 + (1 - d / 110) * 1.8;
      }

      // hot synapse nodes flare up during a login burst
      const boost = proximityBoost + (n.sparkle ? burst * 1.6 : burst * 0.4);
      const r = clamp(1.7 * p.scale, 0.7, 3.0) * pulse * boost;

      if (n.sparkle && boost > 1.3) {
        this._drawSparkle(ctx, p.sx, p.sy, r * 3.2, n.color);
      } else if (n.sparkle) {
        this._drawSparkle(ctx, p.sx, p.sy, r * 1.9, n.color);
      } else {
        ctx.beginPath();
        ctx.fillStyle = n.color;
        ctx.shadowColor = n.color;
        ctx.shadowBlur = (9 + 6 * (boost - 1)) * pulse;
        ctx.arc(p.sx, p.sy, r, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;
      }
    });

    requestAnimationFrame(this._loop);
  }
}

function clamp(v, min, max) { return Math.max(min, Math.min(max, v)); }

function pointInPolygon(px, py, poly) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const xi = poly[i][0], yi = poly[i][1];
    const xj = poly[j][0], yj = poly[j][1];
    const intersect = ((yi > py) !== (yj > py)) &&
      (px < ((xj - xi) * (py - yi)) / (yj - yi) + xi);
    if (intersect) inside = !inside;
  }
  return inside;
}

window.NeuronBrain = NeuronBrain;
