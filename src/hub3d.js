// hub3d.js — assembles the living main-menu scene: the 1cm-voxel fighter
// on his podium, the chunky-block tavern, animated fire, rising embers,
// warm candlelit lighting and a soft parallax camera.
//
// World unit = 1 centimetre.

import * as THREE from 'three';
import { buildFighter } from './fighter.js';
import { buildTavern, PODIUM_TOP } from './tavern.js';
import { buildFire } from './fire.js';

function srgb(r, g, b) {
  const c = new THREE.Color();
  c.setRGB(r / 255, g / 255, b / 255, THREE.SRGBColorSpace);
  return c;
}

function instancedVoxels(surface, size, material) {
  const geo = new THREE.BoxGeometry(size, size, size);
  const mesh = new THREE.InstancedMesh(geo, material, surface.length);
  const m = new THREE.Matrix4();
  const half = size / 2;
  surface.forEach((v, i) => {
    m.makeTranslation(v.x + half, v.y + half, v.z + half);
    mesh.setMatrixAt(i, m);
    mesh.setColorAt(i, srgb(v.c[0], v.c[1], v.c[2]));
  });
  mesh.instanceMatrix.needsUpdate = true;
  if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  return mesh;
}

export class Hub3D {
  constructor(canvas) {
    this.canvas = canvas;
    this.reducedMotion = false;
    this.invertY = false;
    this.quality = 'high';
    this._mouse = { x: 0, y: 0 };
    this._camOff = { x: 0, y: 0 };
    this._blinkAt = 2.6;
    this._blinkUntil = 0;
    this._time = 0;

    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.12;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer = renderer;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0d0a08);
    scene.fog = new THREE.FogExp2(0x0d0a08, 0.00105);
    this.scene = scene;

    this.camera = new THREE.PerspectiveCamera(38, 1, 1, 6000);
    this.camera.position.set(0, 172, 470);
    this._lookAt = new THREE.Vector3(0, 108, 0);

    this._buildLights();
    this._buildTavern();
    this._buildHero();
    this._buildFlames();
    this._buildEmbers();

    window.addEventListener('resize', () => this._resize());
    window.addEventListener('pointermove', (e) => {
      this._mouse.x = (e.clientX / window.innerWidth) * 2 - 1;
      this._mouse.y = (e.clientY / window.innerHeight) * 2 - 1;
    });
    this._resize();
  }

  // ------------------------------------------------------------------ setup
  _buildLights() {
    const s = this.scene;

    const hemi = new THREE.HemisphereLight(0x5a4632, 0x14100d, 0.55);
    s.add(hemi);

    // warm key light from front-top-right, casts the podium shadow
    const key = new THREE.DirectionalLight(0xffd9a8, 2.4);
    key.position.set(260, 430, 330);
    key.target.position.set(0, 80, 0);
    key.castShadow = true;
    key.shadow.mapSize.set(2048, 2048);
    const sc = key.shadow.camera;
    sc.left = -300; sc.right = 300; sc.top = 320; sc.bottom = -60;
    sc.near = 100; sc.far = 1500;
    key.shadow.bias = -0.35;
    key.shadow.normalBias = 2.2;
    s.add(key, key.target);
    this.keyLight = key;

    // cool faint fill from the left so shapes separate from the dark
    const fill = new THREE.DirectionalLight(0x33456b, 0.5);
    fill.position.set(-320, 240, 260);
    s.add(fill);

    // firelight: one flickering point in the hearth
    const fire = new THREE.PointLight(0xff7a22, 160000, 2200, 2);
    fire.position.set(0, 95, -345);
    s.add(fire);
    this.fireLight = fire;

    // mantel candlelight + wall sconces + table candle
    const points = [
      [0xffc36a, 26000, [-100, 245, -350]],
      [0xffc36a, 26000, [108, 245, -350]],
      [0xff9440, 30000, [-600, 235, -113]],
      [0xff9440, 30000, [600, 235, -113]],
      [0xffc36a, 12000, [352, 118, -144]],
      [0xffc36a, 12000, [-268, 88, -48]],
    ];
    this._accentLights = [];
    for (const [color, intensity, pos] of points) {
      const l = new THREE.PointLight(color, intensity, 900, 2);
      l.position.set(...pos);
      s.add(l);
      this._accentLights.push(l);
    }
  }

  _buildTavern() {
    const t0 = performance.now();
    const { surface, candleSpots, torchSpots } = buildTavern();
    this._candleSpots = candleSpots;
    this._torchSpots = torchSpots;
    const mat = new THREE.MeshLambertMaterial();
    const mesh = instancedVoxels(surface, 10, mat);
    mesh.receiveShadow = true;
    mesh.castShadow = false; // walls behind don't need to cast; saves fill
    this.scene.add(mesh);
    this.tavernMesh = mesh;
    console.debug(`tavern: ${surface.length} blocks in ${(performance.now() - t0).toFixed(0)}ms`);
  }

  _buildHero() {
    const { grid, eyes } = buildFighter();
    const surface = grid.surfaceList();
    const mat = new THREE.MeshLambertMaterial();
    const mesh = instancedVoxels(surface, 1, mat);
    mesh.castShadow = true;
    mesh.receiveShadow = true;

    // find eye voxel instance indices for blinking
    const idx = new Map();
    surface.forEach((v, i) => idx.set(v.x + ',' + v.y + ',' + v.z, i));
    this._eyeIndices = eyes.map(e => idx.get(e.x + ',' + e.y + ',' + e.z)).filter(i => i !== undefined);
    this._eyeColors = this._eyeIndices.map(i => {
      const c = new THREE.Color();
      mesh.getColorAt(i, c);
      return c;
    });
    this._heroMesh = mesh;

    const group = new THREE.Group();
    group.add(mesh);
    group.position.y = PODIUM_TOP;
    this.scene.add(group);
    this.hero = group;
  }

  _buildFlames() {
    const fire = buildFire({
      candleSpots: this._candleSpots,
      torchSpots: this._torchSpots,
    });
    this._fire = fire;
    const list = fire.flames;
    const geo = new THREE.BoxGeometry(1, 1, 1);
    const mat = new THREE.MeshBasicMaterial({ toneMapped: true, fog: false });
    const mesh = new THREE.InstancedMesh(geo, mat, list.length);
    mesh.frustumCulled = false;
    const m = new THREE.Matrix4();
    for (let i = 0; i < list.length; i++) {
      const f = list[i];
      m.makeScale(f.size, f.size, f.size);
      m.setPosition(f.x, f.y, f.z);
      mesh.setMatrixAt(i, m);
      mesh.setColorAt(i, new THREE.Color(0xff8020));
    }
    mesh.instanceMatrix.needsUpdate = true;
    mesh.instanceColor.needsUpdate = true;
    this.scene.add(mesh);
    this._flameMesh = mesh;
  }

  _buildEmbers() {
    const e = this._fire.embers;
    const n = e.count;
    const pos = new Float32Array(n * 3);
    this._emberState = [];
    for (let i = 0; i < n; i++) {
      const st = this._spawnEmber({});
      // scatter initial ages so they don't all rise in lockstep
      st.y = e.y[0] + Math.random() * (e.maxY - e.y[0]);
      this._emberState.push(st);
      pos[i * 3] = st.x; pos[i * 3 + 1] = st.y; pos[i * 3 + 2] = st.z;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));

    // soft round glow sprite drawn on a canvas
    const cv = document.createElement('canvas');
    cv.width = cv.height = 32;
    const ctx = cv.getContext('2d');
    const grad = ctx.createRadialGradient(16, 16, 0, 16, 16, 16);
    grad.addColorStop(0, 'rgba(255,200,120,1)');
    grad.addColorStop(0.4, 'rgba(255,150,60,0.7)');
    grad.addColorStop(1, 'rgba(255,120,40,0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 32, 32);
    const tex = new THREE.CanvasTexture(cv);

    const mat = new THREE.PointsMaterial({
      size: 7, map: tex, transparent: true, depthWrite: false,
      blending: THREE.AdditiveBlending, color: srgb(...this._fire.embers.tint),
      sizeAttenuation: true, fog: false,
    });
    const points = new THREE.Points(geo, mat);
    points.frustumCulled = false;
    this.scene.add(points);
    this._emberPoints = points;
  }

  _spawnEmber(st) {
    const e = this._fire.embers;
    st.x = e.x[0] + Math.random() * (e.x[1] - e.x[0]);
    st.y = e.y[0] + Math.random() * (e.y[1] - e.y[0]);
    st.z = e.z[0] + Math.random() * (e.z[1] - e.z[0]);
    st.speed = e.rise[0] + Math.random() * (e.rise[1] - e.rise[0]);
    st.seed = Math.random() * 100;
    st.life = e.life[0] + Math.random() * (e.life[1] - e.life[0]);
    st.age = 0;
    return st;
  }

  // ------------------------------------------------------------------ frame
  start() {
    let last = performance.now();
    const loop = (now) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      this._time += dt;
      this._tick(dt, this._time);
      this.renderer.render(this.scene, this.camera);
      this._raf = requestAnimationFrame(loop);
    };
    this._raf = requestAnimationFrame(loop);
  }

  stop() { cancelAnimationFrame(this._raf); }

  _tick(dt, t) {
    const rm = this.reducedMotion;

    // --- camera parallax + breathing drift --------------------------------
    const targetX = rm ? 0 : this._mouse.x * 26;
    const targetY = rm ? 0 : (this.invertY ? 1 : -1) * this._mouse.y * 12;
    this._camOff.x += (targetX - this._camOff.x) * Math.min(1, dt * 3.2);
    this._camOff.y += (targetY - this._camOff.y) * Math.min(1, dt * 3.2);
    const bob = rm ? 0 : Math.sin(t * 0.45) * 2.2;
    this.camera.position.set(this._camOff.x, 172 + this._camOff.y + bob, 470);
    this.camera.lookAt(this._lookAt);

    // --- hero idle: breathing + gentle sway + blink -------------------------
    const breathe = rm ? 1 : 1 + 0.005 * Math.sin(t * 1.7);
    this.hero.scale.y = breathe; // origin at the feet, so they stay planted
    this.hero.rotation.y = rm ? 0 : 0.055 * Math.sin(t * 0.34);

    if (!rm && this._eyeIndices.length) {
      if (this._blinkUntil > 0) {
        const closing = t < this._blinkUntil;
        const skin = srgb(217, 160, 119);
        for (let k = 0; k < this._eyeIndices.length; k++) {
          this._heroMesh.setColorAt(this._eyeIndices[k], closing ? skin : this._eyeColors[k]);
        }
        this._heroMesh.instanceColor.needsUpdate = true;
        if (!closing) {
          this._blinkUntil = 0;
          this._blinkAt = t + 3.2 + Math.random() * 2.6;
        }
      } else if (t > this._blinkAt) {
        this._blinkUntil = t + 0.13;
      }
    }

    // --- flames: per-voxel scale + color shimmer ----------------------------
    const fm = this._flameMesh;
    const flames = this._fire.flames;
    const ramp = this._fire.ramp;
    const M = this._tickM || (this._tickM = new THREE.Matrix4());
    const col = this._tickC || (this._tickC = new THREE.Color());
    for (let i = 0; i < flames.length; i++) {
      const f = flames[i];
      const w = Math.sin(t * 6.5 + f.seed * 12.9) * 0.5 + Math.sin(t * 11.3 + f.seed * 7.1) * 0.5;
      const s = f.size * (rm ? 1 : (0.86 + 0.16 * w + 0.08 * Math.sin(t * 3.1 + f.seed)));
      const stretch = rm ? 1 : 1 + 0.22 * Math.sin(t * 5.3 + f.seed * 9.7);
      M.makeScale(s, s * stretch, s);
      M.setPosition(f.x, f.y, f.z);
      fm.setMatrixAt(i, M);
      // color: ramp by tier, brightened/darkened by flicker
      const band = Math.min(2.999, Math.max(0, f.t01 * 2.2 + w * 0.35 + 0.4));
      const i0 = Math.floor(band), f0 = band - i0;
      const a = ramp[i0], b = ramp[Math.min(3, i0 + 1)];
      col.setRGB(
        (a[0] + (b[0] - a[0]) * f0) / 255,
        (a[1] + (b[1] - a[1]) * f0) / 255,
        (a[2] + (b[2] - a[2]) * f0) / 255,
        THREE.SRGBColorSpace
      );
      const hot = 1.25 - f.t01 * 0.35;
      col.multiplyScalar(hot);
      fm.setColorAt(i, col);
    }
    fm.instanceMatrix.needsUpdate = true;
    fm.instanceColor.needsUpdate = true;

    // --- firelight flicker --------------------------------------------------
    const n = Math.sin(t * 7.3) * 0.5 + Math.sin(t * 13.7) * 0.3 + Math.sin(t * 2.1) * 0.2;
    this.fireLight.intensity = 160000 * (rm ? 1 : 1 + 0.16 * n);
    for (let i = 0; i < this._accentLights.length; i++) {
      const l = this._accentLights[i];
      const base = l.userData.base || (l.userData.base = l.intensity);
      l.intensity = base * (rm ? 1 : 1 + 0.12 * Math.sin(t * 9.1 + i * 2.7));
    }

    // --- embers rise ---------------------------------------------------------
    if (!rm) {
      const ep = this._fire.embers;
      const attr = this._emberPoints.geometry.getAttribute('position');
      for (let i = 0; i < this._emberState.length; i++) {
        const st = this._emberState[i];
        st.age += dt;
        st.y += st.speed * dt;
        if (st.y > ep.maxY || st.age > st.life) this._spawnEmber(st);
        attr.setXYZ(
          i,
          st.x + Math.sin(t * 1.9 + st.seed) * ep.sway * Math.min(1, st.age),
          st.y,
          st.z + Math.cos(t * 1.3 + st.seed) * 3
        );
      }
      attr.needsUpdate = true;
    }
  }

  // ------------------------------------------------------------------ extras
  _resize() {
    const w = window.innerWidth, h = window.innerHeight;
    const cap = this.quality === 'low' ? 1 : this.quality === 'medium' ? 1.5 : 2;
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, cap));
    this.renderer.setSize(w, h);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  setQuality(q) {
    this.quality = q;
    const shadows = q !== 'low';
    this.renderer.shadowMap.enabled = shadows;
    this.keyLight.castShadow = shadows;
    this.keyLight.shadow.mapSize.set(q === 'high' ? 2048 : 1024, q === 'high' ? 2048 : 1024);
    if (this.keyLight.shadow.map) { this.keyLight.shadow.map.dispose(); this.keyLight.shadow.map = null; }
    this.tavernMesh.receiveShadow = shadows;
    this._heroMesh.castShadow = shadows;
    this._heroMesh.receiveShadow = shadows;
    // force material recompile for shadow toggling
    this.scene.traverse(o => { if (o.material) o.material.needsUpdate = true; });
    this._emberPoints.visible = q !== 'low';
    this._resize();
  }

  setReducedMotion(on) {
    this.reducedMotion = !!on;
    if (!on) { this._blinkAt = this._time + 1.5; }
  }

  // capture a head-and-shoulders portrait for the HUD avatar
  capturePortrait(size = 240) {
    const r2 = new THREE.WebGLRenderer({ alpha: true, antialias: true });
    r2.setSize(size, size);
    r2.outputColorSpace = THREE.SRGBColorSpace;
    r2.toneMapping = THREE.ACESFilmicToneMapping;
    r2.toneMappingExposure = 1.15;
    const cam = new THREE.PerspectiveCamera(24, 1, 1, 800);
    const headY = PODIUM_TOP + 168;
    cam.position.set(6, headY + 4, 118);
    cam.lookAt(0, headY - 6, 0);

    const fog = this.scene.fog, bg = this.scene.background;
    this.scene.fog = null; this.scene.background = null;
    r2.render(this.scene, cam);
    const url = r2.domElement.toDataURL('image/png');
    this.scene.fog = fog; this.scene.background = bg;
    r2.dispose();
    return url;
  }
}

export default Hub3D;
