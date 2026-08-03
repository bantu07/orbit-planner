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
      interior: 320,       // scattered mesh nodes inside the silhouette (legacy; superseded by interiorSpacing)
      interiorSpacing: 24, // grid cell size for jittered interior coverage — smaller = denser mesh
      neighbors: 5,        // mesh links per node
      linkDist: 58,        // max link length
      focus: { x: -10, y: 60 },  // where the hot synapses cluster (upper-centre)
      heatRadius: 190,
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
    this._explicitlyPaused = false;
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.mouseScreen = null;

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

  // ---- Geometry: side-profile wireframe brain (matches the reference image) ----
  _buildBrain() {
    const s = this.opts.a; // overall scale
    // hand-authored side-profile outline (x right, y up), clockwise from top-left
    const outline = [
      // frontal lobe (left) up over the parietal crown to the occipital point (right)
      [-1.00, 0.55], [-0.95, 0.82], [-0.65, 0.98], [-0.30, 1.05], [0.05, 1.02],
      [0.40, 0.90], [0.68, 0.68], [0.85, 0.42], [0.95, 0.15], [0.90, -0.05],
      // scalloped cerebellum bulge (bottom-right) — small in/out steps for its ridged texture
      [0.98, -0.20], [0.90, -0.32], [0.98, -0.42], [0.88, -0.52], [0.94, -0.62],
      [0.78, -0.68], [0.60, -0.62],
      // brainstem stalk
      [0.50, -0.70], [0.42, -0.95], [0.32, -0.95], [0.38, -0.68],
      [0.15, -0.60], [-0.05, -0.55],
      // temporal lobe hook, curling down and back up into the Sylvian notch
      [-0.25, -0.62], [-0.45, -0.78], [-0.68, -0.85], [-0.85, -0.72], [-0.92, -0.52],
      [-0.80, -0.40], [-0.90, -0.25], [-1.02, -0.05], [-1.05, 0.20], [-1.00, 0.40],
    ].map(([x, y]) => [x * s, y * s]);
    this.outlinePoly = outline;

    // 1) boundary nodes — subdivide each edge for a crisp glowing silhouette
    const rimIdx = [];
    for (let i = 0; i < outline.length; i++) {
      const [x1, y1] = outline[i];
      const [x2, y2] = outline[(i + 1) % outline.length];
      const segLen = Math.hypot(x2 - x1, y2 - y1);
      const steps = Math.max(1, Math.round(segLen / 26));
      for (let k = 0; k < steps; k++) {
        const t = k / steps;
        rimIdx.push(this._pushNode(x1 + (x2 - x1) * t, y1 + (y2 - y1) * t, 0, { rim: true }));
      }
    }
    for (let i = 0; i < rimIdx.length; i++) {
      this.edges.push({ a: rimIdx[i], b: rimIdx[(i + 1) % rimIdx.length] });
    }

    // 2) hand-drawn fold/gyri lines — a few sweeping internal curves that read as the brain's
    // characteristic folds, rather than leaving the interior as a featureless scatter.
    const folds = [
      [[-0.75, 0.55], [-0.45, 0.62], [-0.10, 0.58], [0.25, 0.60], [0.55, 0.48], [0.75, 0.30]],
      [[-0.70, 0.20], [-0.35, 0.28], [0.05, 0.22], [0.40, 0.18], [0.68, 0.02]],
      [[-0.65, -0.10], [-0.30, -0.02], [0.10, -0.08], [0.45, -0.16], [0.65, -0.30]],
      [[-0.50, 0.75], [-0.15, 0.80], [0.20, 0.76], [0.48, 0.66]],
      [[-0.80, -0.05], [-0.55, -0.18], [-0.35, -0.30]],
      [[0.55, -0.50], [0.68, -0.38], [0.78, -0.22]],
    ];
    folds.forEach((pts) => {
      const scaled = pts.map(([x, y]) => [x * s, y * s]);
      let prevIdx = null;
      for (let i = 0; i < scaled.length - 1; i++) {
        const [x1, y1] = scaled[i];
        const [x2, y2] = scaled[i + 1];
        const segLen = Math.hypot(x2 - x1, y2 - y1);
        const steps = Math.max(1, Math.round(segLen / 22));
        for (let k = (i === 0 ? 0 : 1); k <= steps; k++) {
          const t = k / steps;
          const x = x1 + (x2 - x1) * t, y = y1 + (y2 - y1) * t;
          if (!pointInPolygon(x, y, outline)) continue;
          const z = (Math.random() - 0.5) * this.opts.dome * 0.5;
          const idx = this._pushNode(x, y, z);
          if (prevIdx !== null) this.edges.push({ a: prevIdx, b: idx });
          prevIdx = idx;
        }
      }
    });

    // 3) interior nodes — even jittered-grid coverage (not pure random scatter, which can
    // leave real low-density gaps purely by chance) so there are no visibly empty patches.
    const minX = -1.08 * s, maxX = 1.02 * s, minY = -1.0 * s, maxY = 1.08 * s;
    const spacing = this.opts.interiorSpacing;
    for (let gx = minX; gx <= maxX; gx += spacing) {
      for (let gy = minY; gy <= maxY; gy += spacing) {
        const x = gx + (Math.random() - 0.5) * spacing * 0.8;
        const y = gy + (Math.random() - 0.5) * spacing * 0.8;
        if (!pointInPolygon(x, y, outline)) continue;
        const z = (Math.random() - 0.5) * this.opts.dome;
        this._pushNode(x, y, z);
      }
    }

    // 4) triangulated mesh — link each node to its nearest neighbours
    const n = this.nodes.length;
    const maxD = this.opts.linkDist;
    const seen = new Set();
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
      }
    }

    // 5) guarantee the whole mesh is a single connected graph — don't just hope the spacing
    // above was tight enough. Any node/cluster left isolated gets explicitly bridged to its
    // nearest neighbour in the main mass, so a pulse can genuinely reach every neuron.
    this._connectAllComponents();
  }

  _connectAllComponents() {
    const n = this.nodes.length;
    const adj = Array.from({ length: n }, () => []);
    this.edges.forEach(({ a, b }) => { adj[a].push(b); adj[b].push(a); });

    const compId = new Array(n).fill(-1);
    let numComps = 0;
    for (let start = 0; start < n; start++) {
      if (compId[start] !== -1) continue;
      const stack = [start];
      compId[start] = numComps;
      while (stack.length) {
        const cur = stack.pop();
        for (const nb of adj[cur]) {
          if (compId[nb] === -1) { compId[nb] = numComps; stack.push(nb); }
        }
      }
      numComps++;
    }
    if (numComps <= 1) return;

    // repeatedly fuse the smallest component into its nearest other component
    const groups = Array.from({ length: numComps }, () => []);
    compId.forEach((c, idx) => groups[c].push(idx));

    let mainComp = 0;
    for (let c = 1; c < numComps; c++) if (groups[c].length > groups[mainComp].length) mainComp = c;

    for (let c = 0; c < numComps; c++) {
      if (c === mainComp) continue;
      let bestA = -1, bestB = -1, bestD = Infinity;
      for (const i of groups[c]) {
        const ni = this.nodes[i];
        for (const j of groups[mainComp]) {
          const nj = this.nodes[j];
          const d = Math.hypot(ni.x - nj.x, ni.y - nj.y, ni.z - nj.z);
          if (d < bestD) { bestD = d; bestA = i; bestB = j; }
        }
      }
      if (bestA !== -1) this.edges.push({ a: bestA, b: bestB });
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
      // If the app explicitly paused this (e.g. after login), tab-visibility changes must not
      // override that — otherwise every tab-switch/app-switch silently restarts the animation
      // loop even while the user is on the Dashboard, and repeated switches stack up multiple
      // concurrent loops redrawing the same canvas, which is what was causing the lag/RAM growth.
      if (this._explicitlyPaused) return;
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

  pause() { this.running = false; this._explicitlyPaused = true; }
  resume() {
    this._explicitlyPaused = false;
    if (!this.running) { this.running = true; requestAnimationFrame(this._loop); }
  }

  _maybeSpawnPulse() {
    if (Math.random() < 0.16 && this.edges.length) {
      const edgeIndex = Math.floor(Math.random() * this.edges.length);
      this.pulses.push({ edgeIndex, t: 0, speed: 0.012 + Math.random() * 0.02 });
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
      return { sx: cx + x * scale, sy: cy - y * scale, z, scale };
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
    ctx.shadowBlur = 5;
    hotEdges.forEach(({ e, heat }) => {
      const a = projected[e.a], b = projected[e.b];
      ctx.strokeStyle = `rgba(255,90,205,${0.12 + heat * 0.5})`;
      ctx.beginPath();
      ctx.moveTo(a.sx, a.sy);
      ctx.lineTo(b.sx, b.sy);
      ctx.stroke();
    });
    ctx.restore();

    // pulses traveling along the folds
    this._maybeSpawnPulse();
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

      const r = clamp(1.7 * p.scale, 0.7, 3.0) * pulse * proximityBoost;

      if (n.sparkle && proximityBoost > 1.3) {
        this._drawSparkle(ctx, p.sx, p.sy, r * 3.2, n.color);
      } else if (n.sparkle) {
        this._drawSparkle(ctx, p.sx, p.sy, r * 1.9, n.color);
      } else {
        ctx.beginPath();
        ctx.fillStyle = n.color;
        ctx.shadowColor = n.color;
        ctx.shadowBlur = (9 + 6 * (proximityBoost - 1)) * pulse;
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
