// Scene runtime: draws a scene from plain data and runs its states, scroll, timeline and glow.
// The editor, the live page and embeds all use this one module.
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { TextGeometry } from 'three/addons/geometries/TextGeometry.js';
import { FontLoader } from 'three/addons/loaders/FontLoader.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
// Righteous (SIL Open Font License) as outlines, for extruded 3D text.
import FONT_RIGHTEOUS from './righteous.json';

export function usesScroll(data) {
  return (data.sections || []).length > 1 || !!(data.scrollCam && data.scrollCam.on) || (data.timeline && data.timeline.trigger === 'scroll')
    || data.objects.some((o) => o.scroll && o.scroll.on);
}

export function createSceneRuntime(canvas, data, opts) {
  opts = opts || {};
  const reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const rad = THREE.MathUtils.degToRad;
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;

  const scene = new THREE.Scene();
  const bg = new THREE.Color();
  scene.background = bg;
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;

  const camera = new THREE.PerspectiveCamera(data.fov || 35, 1, 0.1, 200);
  camera.position.fromArray(data.camera.pos);
  const controls = new OrbitControls(camera, canvas);
  controls.target.fromArray(data.camera.target);
  controls.enableDamping = true;
  controls.maxPolarAngle = Math.PI * 0.495;
  controls.minDistance = 1.5; controls.maxDistance = 40;

  const key = new THREE.DirectionalLight('#fff4e6', 2);
  key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048);
  key.shadow.camera.left = -7; key.shadow.camera.right = 7; key.shadow.camera.top = 7; key.shadow.camera.bottom = -7;
  key.shadow.camera.near = 1; key.shadow.camera.far = 30;
  key.shadow.bias = -0.0004; key.shadow.normalBias = 0.03;
  scene.add(key);
  const floorMat = new THREE.ShadowMaterial({ opacity: 0.25 });
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(60, 60), floorMat);
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  scene.add(floor);

  // Bloom: only objects with Glow are drawn into the bloom pass, so the halo keeps their color.
  let bloomComposer = null, finalComposer = null, bloomPass = null;
  const darkMat = new THREE.MeshBasicMaterial({ color: '#000000' }), black = new THREE.Color('#000000');
  function ensureComposer() {
    if (finalComposer) return;
    const w = canvas.clientWidth || 1, h = canvas.clientHeight || 1, pr = renderer.getPixelRatio();
    bloomComposer = new EffectComposer(renderer, new THREE.WebGLRenderTarget(w * pr, h * pr, { type: THREE.HalfFloatType }));
    bloomComposer.renderToScreen = false;
    bloomComposer.setPixelRatio(pr * 0.5); // the glow is blurry anyway, so half resolution saves work
    bloomComposer.addPass(new RenderPass(scene, camera));
    bloomPass = new UnrealBloomPass(new THREE.Vector2(w, h), 1, 0.3, 0);
    bloomComposer.addPass(bloomPass);
    const mixPass = new ShaderPass(new THREE.ShaderMaterial({
      uniforms: { baseTexture: { value: null }, bloomTexture: { value: bloomComposer.renderTarget2.texture } },
      vertexShader: 'varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
      fragmentShader: 'uniform sampler2D baseTexture; uniform sampler2D bloomTexture; varying vec2 vUv; void main() { gl_FragColor = texture2D(baseTexture, vUv) + texture2D(bloomTexture, vUv); }'
    }), 'baseTexture');
    mixPass.needsSwap = true;
    finalComposer = new EffectComposer(renderer, new THREE.WebGLRenderTarget(w * pr, h * pr, { type: THREE.HalfFloatType, samples: 4 }));
    finalComposer.addPass(new RenderPass(scene, camera));
    finalComposer.addPass(mixPass);
    finalComposer.addPass(new OutputPass());
  }
  const swapped = [], hidden = [];
  function renderBloom() {
    ensureComposer();
    bloomPass.strength = data.bloom;
    const envI = scene.environmentIntensity, keyI = key.intensity;
    scene.environmentIntensity = 0; key.intensity = 0; scene.background = black; floor.visible = false;
    data.objects.forEach((o) => {
      const it = items.get(o.id);
      if (!it || (it.mat && o.mat && o.mat.glow > 0)) return;
      it.root.traverse((n) => {
        if (!n.isMesh && !n.isPoints) return;
        if (n.isPoints || (n.material && n.material.alphaTest > 0)) { if (n.visible) { n.visible = false; hidden.push(n); } }
        else { swapped.push(n, n.material); n.material = darkMat; }
      });
    });
    bloomComposer.render();
    for (let i = 0; i < swapped.length; i += 2) swapped[i].material = swapped[i + 1];
    hidden.forEach((n) => { n.visible = true; });
    swapped.length = 0; hidden.length = 0;
    scene.environmentIntensity = envI; key.intensity = keyI; scene.background = bg; floor.visible = true;
    finalComposer.render();
  }

  // Surface textures, drawn once per kind.
  const surfCanvas = {};
  function surfaceCanvas(kind) {
    if (surfCanvas[kind]) return surfCanvas[kind];
    const c = document.createElement('canvas'), g = c.getContext('2d');
    let sd = 7;
    const rnd = () => { sd = (sd * 16807) % 2147483647; return (sd - 1) / 2147483646; };
    const speck = (n, w, h, a) => { for (let i = 0; i < n; i++) { g.fillStyle = 'rgba(' + (rnd() > 0.5 ? '255,255,255' : '0,0,0') + ',' + (rnd() * a).toFixed(3) + ')'; g.fillRect(rnd() * w, rnd() * h, 2, 2); } };
    if (kind === 'brick') {
      c.width = 512; c.height = 384;
      g.fillStyle = '#8c8c8c'; g.fillRect(0, 0, 512, 384);
      for (let r = 0; r < 8; r++) for (let col = -1; col < 4; col++) {
        const v = 212 + Math.floor(rnd() * 40);
        g.fillStyle = 'rgb(' + v + ',' + v + ',' + v + ')';
        g.fillRect(col * 128 + (r % 2 ? 64 : 0) + 3, r * 48 + 3, 122, 42);
      }
      speck(5000, 512, 384, 0.07);
    } else if (kind === 'ribbed') {
      c.width = 64; c.height = 64;
      for (let x = 0; x < 64; x += 16) { const gr = g.createLinearGradient(x, 0, x + 16, 0); gr.addColorStop(0, '#9a9a9a'); gr.addColorStop(0.5, '#f4f4f4'); gr.addColorStop(1, '#9a9a9a'); g.fillStyle = gr; g.fillRect(x, 0, 16, 64); }
    } else {
      c.width = 256; c.height = 256;
      g.fillStyle = '#e6e6e6'; g.fillRect(0, 0, 256, 256);
      speck(9000, 256, 256, 0.16);
    }
    surfCanvas[kind] = c;
    return c;
  }
  function applySurface(it, o) {
    const kind = o.mat && o.mat.surface;
    if (!kind || kind === 'none') return;
    const make = (srgb) => {
      const tx = new THREE.CanvasTexture(surfaceCanvas(kind));
      tx.wrapS = tx.wrapT = THREE.RepeatWrapping;
      tx.anisotropy = renderer.capabilities.getMaxAnisotropy();
      if (srgb) tx.colorSpace = THREE.SRGBColorSpace;
      return tx;
    };
    it.mat.map = make(true); it.mat.bumpMap = make(false);
    it.mat.bumpScale = kind === 'brick' ? 2.5 : 1.2;
    it.surf = kind;
  }

  const items = new Map();
  const loader = new GLTFLoader();
  const api = { lock: false };
  let play = !opts.edit, hovered = null, count = 0, sp = 0, tlClock = 0;
  const clamp = (v) => Math.max(0, Math.min(1, v));

  let dotTexture = null;
  function dotTex() {
    if (dotTexture) return dotTexture;
    const c = document.createElement('canvas'); c.width = c.height = 64;
    const g = c.getContext('2d'), grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    grad.addColorStop(0, 'rgba(255,255,255,1)'); grad.addColorStop(0.5, 'rgba(255,255,255,0.7)'); grad.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = grad; g.fillRect(0, 0, 64, 64);
    dotTexture = new THREE.CanvasTexture(c);
    return dotTexture;
  }

  let fontCache = null;
  function geometryFor(o) {
    switch (o.type) {
      case 'cord': {
        const to = o.to || [1, -1.5, 0], end = new THREE.Vector3(to[0], to[1], to[2]);
        const mid = end.clone().multiplyScalar(0.5);
        mid.y -= (o.slack == null ? 0.4 : o.slack) * end.length() * 0.6;
        return new THREE.TubeGeometry(new THREE.QuadraticBezierCurve3(new THREE.Vector3(), mid, end), 48, o.thick || 0.02, 8, false);
      }
      case 'text3d': {
        if (!fontCache) fontCache = new FontLoader().parse(FONT_RIGHTEOUS);
        const bevel = o.bevel || 0;
        const g = new TextGeometry((o.text || ' ').slice(0, 28), {
          font: fontCache, size: 0.8, depth: o.depth == null ? 0.25 : o.depth, curveSegments: 6,
          bevelEnabled: bevel > 0, bevelThickness: bevel, bevelSize: bevel * 0.6, bevelSegments: 3
        });
        g.center();
        return g;
      }
      case 'sphere': return new THREE.SphereGeometry(0.6, 48, 32);
      case 'cylinder': return new THREE.CylinderGeometry(0.5, 0.5, 1, 48);
      case 'cone': return new THREE.ConeGeometry(0.6, 1.1, 48);
      case 'torus': return new THREE.TorusGeometry(0.5, 0.2, 32, 80);
      case 'capsule': return new THREE.CapsuleGeometry(0.35, 0.7, 12, 32);
      case 'knot': return new THREE.TorusKnotGeometry(0.42, 0.15, 160, 24);
      default: return new RoundedBoxGeometry(1, 1, 1, 6, 0.12);
    }
  }

  function drawText(it, o) {
    const g = it.canvas.getContext('2d');
    const label = (o.text || ' ').slice(0, 28);
    let size = 150;
    const font = (s) => '400 ' + s + 'px "Righteous", "Arial Rounded MT Bold", system-ui, sans-serif';
    g.font = font(size);
    const w = g.measureText(label).width;
    if (w > 980) { size = Math.floor(size * 980 / w); g.font = font(size); }
    g.clearRect(0, 0, 1024, 256);
    g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = '#fff';
    g.fillText(label, 512, 134);
    it.mat.map.needsUpdate = true;
  }

  function build(o) {
    const root = new THREE.Group();
    root.userData.id = o.id;
    const it = { root, mat: null, h: 0, c: 0, on: false, mixer: null, phase: (count++) * 1.7, canvas: null, flags: '' };
    if (o.type === 'model') {
      const ph = new THREE.Mesh(new THREE.BoxGeometry(1, 1.6, 1), new THREE.MeshBasicMaterial({ color: '#8a8f8b', wireframe: true }));
      ph.position.y = 0.8;
      root.add(ph);
      const done = (gltf) => {
        if (!items.has(o.id) || items.get(o.id) !== it) return;
        const m = gltf.scene;
        const box = new THREE.Box3().setFromObject(m), size = box.getSize(new THREE.Vector3());
        m.scale.setScalar(1.8 / Math.max(size.x, size.y, size.z, 0.001));
        const b2 = new THREE.Box3().setFromObject(m), c = b2.getCenter(new THREE.Vector3());
        m.position.x -= c.x; m.position.z -= c.z; m.position.y -= b2.min.y;
        m.traverse((n) => { if (n.isMesh) { n.castShadow = true; n.receiveShadow = true; if (n.isSkinnedMesh) n.frustumCulled = false; } });
        root.remove(ph); ph.geometry.dispose(); ph.material.dispose();
        root.add(m);
        if (gltf.animations && gltf.animations.length) { it.mixer = new THREE.AnimationMixer(m); it.mixer.clipAction(gltf.animations[0]).play(); }
        if (opts.onLoad) opts.onLoad(o.id);
      };
      const buf = opts.buffers && opts.buffers.get(o.file);
      try {
        if (buf) loader.parse(buf.slice(0), '', done, () => {});
        else if (!opts.noFetch) loader.load((data.modelBase || '/models/') + o.file, done, undefined, () => {});
      } catch (e) {}
    } else if (o.type === 'particles') {
      const n = Math.max(1, Math.min(1500, Math.round(o.count || 200)));
      const pos = new Float32Array(n * 3), seeds = new Float32Array(n * 4);
      let sd = 11 + n;
      for (let i = 0; i < n * 4; i++) { sd = (sd * 16807) % 2147483647; seeds[i] = (sd - 1) / 2147483646; }
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      it.mat = new THREE.PointsMaterial({ map: dotTex(), size: 0.06, transparent: true, depthWrite: false, sizeAttenuation: true });
      const pts = new THREE.Points(geo, it.mat);
      pts.frustumCulled = false;
      root.add(pts);
      it.points = { pos, seeds, n, geo };
    } else if (o.type === 'text') {
      it.canvas = document.createElement('canvas'); it.canvas.width = 1024; it.canvas.height = 256;
      const tex = new THREE.CanvasTexture(it.canvas);
      tex.colorSpace = THREE.SRGBColorSpace;
      tex.anisotropy = renderer.capabilities.getMaxAnisotropy();
      it.mat = new THREE.MeshStandardMaterial({ map: tex, emissiveMap: tex, alphaTest: 0.5, alphaToCoverage: true, side: THREE.DoubleSide });
      const mesh = new THREE.Mesh(new THREE.PlaneGeometry(3.2, 0.8), it.mat);
      mesh.castShadow = true;
      root.add(mesh);
      drawText(it, o);
      if (document.fonts && document.fonts.load) document.fonts.load('400 100px "Righteous"').then(() => { if (items.get(o.id) === it) drawText(it, o); }).catch(() => {});
    } else {
      it.mat = new THREE.MeshPhysicalMaterial({ thickness: 1, ior: 1.45 });
      applySurface(it, o);
      const mesh = new THREE.Mesh(geometryFor(o), it.mat);
      mesh.castShadow = true; mesh.receiveShadow = true;
      root.add(mesh);
    }
    scene.add(root);
    items.set(o.id, it);
    return root;
  }

  function unbuild(id) {
    const it = items.get(id);
    if (!it) return;
    scene.remove(it.root);
    it.root.traverse((n) => {
      if (n.geometry) n.geometry.dispose();
      if (n.material) { const ms = Array.isArray(n.material) ? n.material : [n.material]; ms.forEach((m) => { if (m.map) m.map.dispose(); if (m.bumpMap) m.bumpMap.dispose(); m.dispose(); }); }
    });
    items.delete(id);
  }

  // Flicker loop: the glow stutters on after play starts, then hums.
  function flick(an, since, t) {
    if (!play || reduce || an.kind !== 'flicker') return 1;
    const ft = since * (an.speed || 1), seq = [[0, 0], [0.35, 0.85], [0.42, 0.05], [0.7, 0.6], [0.76, 0], [1.05, 1], [1.12, 0.35], [1.2, 1]];
    let v = 0;
    for (let i = 0; i < seq.length; i++) if (ft >= seq[i][0]) v = seq[i][1];
    return v * (1 - (an.amount == null ? 0.5 : an.amount) * 0.12 * (0.5 + 0.5 * Math.sin(t * 47) * Math.sin(t * 13.7)));
  }

  // Keyframes: eased blend between the two keys around time t.
  function evalKeys(keys, t) {
    if (t <= keys[0].t) return keys[0];
    const last = keys[keys.length - 1];
    if (t >= last.t) return last;
    let i = 0;
    while (keys[i + 1].t < t) i++;
    const a = keys[i], b = keys[i + 1];
    let u = (t - a.t) / Math.max(b.t - a.t, 1e-6);
    u = u * u * (3 - 2 * u);
    const out = {};
    Object.keys(a).forEach((k) => { if (Array.isArray(a[k]) && Array.isArray(b[k])) out[k] = a[k].map((v, n) => v + (b[k][n] - v) * u); });
    return out;
  }

  // Scroll progress, 0 to 1: through the nearest [data-scroll-section], or through the whole page.
  function pageProgress() {
    const vh = window.innerHeight, sec = canvas.closest('[data-scroll-section]');
    if (sec) { const r = sec.getBoundingClientRect(), span = r.height - vh; return span > 0 ? clamp(-r.top / span) : 0; }
    const max = document.documentElement.scrollHeight - vh;
    return max > 0 ? clamp(window.scrollY / max) : 0;
  }

  // Page sections: real HTML laid over the scene, faded in and out by scroll position.
  let secKey = '', secEls = [];
  function sectionEl(s, i, page) {
    const wrap = document.createElement('section');
    const jc = { left: 'flex-start', center: 'center', right: 'flex-end' }[s.align] || 'center';
    const ai = { top: 'flex-start', middle: 'center', bottom: 'flex-end' }[s.vertical] || 'flex-end';
    wrap.style.cssText = 'position:absolute;inset:0;display:flex;justify-content:' + jc + ';align-items:' + ai
      + ';padding:clamp(56px,9vh,96px) clamp(18px,6vw,80px);box-sizing:border-box;will-change:opacity,transform;';
    const box = document.createElement('div');
    box.style.cssText = 'max-width:560px;text-align:' + (s.align || 'center') + ';color:' + (page.color || '#f1ede2')
      + ';font-family:"Hanken Grotesk",system-ui,sans-serif;text-shadow:0 1px 18px rgba(0,0,0,.45);';
    if (s.heading) {
      const h = document.createElement(i === 0 ? 'h1' : 'h2');
      h.textContent = s.heading;
      h.style.cssText = 'margin:0 0 10px;font-family:"Righteous","Arial Rounded MT Bold",system-ui,sans-serif;font-weight:400;line-height:1.08;font-size:clamp(26px,5.2vw,54px);text-wrap:balance;';
      box.appendChild(h);
    }
    if (s.body) {
      const p = document.createElement('p');
      p.textContent = s.body;
      p.style.cssText = 'margin:0;font-size:clamp(15px,1.9vw,19px);line-height:1.45;text-wrap:pretty;';
      box.appendChild(p);
    }
    if (s.cta && s.url && /^(https?:\/\/|\/|#|mailto:)/.test(s.url)) {
      const a = document.createElement('a');
      a.textContent = s.cta; a.href = s.url;
      a.style.cssText = 'display:inline-block;margin-top:16px;padding:11px 20px;border-radius:999px;font-weight:600;text-decoration:none;text-shadow:none;color:#1a0d08;background:' + (page.accent || '#ff5a36') + ';';
      box.appendChild(a);
    }
    wrap.appendChild(box);
    return wrap;
  }
  function updateSections() {
    const host = opts.overlay;
    if (!host) return;
    const list = play ? (data.sections || []) : [], page = data.page || {};
    const key = JSON.stringify([list, page]);
    if (key !== secKey) {
      secKey = key;
      host.style.cssText = 'position:absolute;inset:0;overflow:hidden;pointer-events:none;';
      host.textContent = '';
      secEls = list.map((s, i) => host.appendChild(sectionEl(s, i, page)));
    }
    list.forEach((s, i) => {
      const a = s.start || 0, b = s.end == null ? 1 : s.end, fade = 0.06;
      const op = Math.min(a <= 0 ? 1 : clamp((sp - a) / fade), b >= 1 ? 1 : clamp((b - sp) / fade));
      const node = secEls[i], link = node.querySelector('a');
      node.style.opacity = op.toFixed(3);
      node.style.transform = 'translateY(' + ((1 - op) * 18).toFixed(1) + 'px)';
      node.style.visibility = op < 0.01 ? 'hidden' : 'visible';
      if (link) link.style.pointerEvents = op > 0.5 ? 'auto' : 'none';
    });
  }

  const ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
  ray.params.Points.threshold = 0.08;
  function pick(e) {
    const r = canvas.getBoundingClientRect();
    ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(ndc, camera);
    const roots = []; items.forEach((it) => roots.push(it.root));
    const hit = ray.intersectObjects(roots, true)[0];
    if (!hit) return null;
    let n = hit.object;
    while (n && !n.userData.id) n = n.parent;
    return n ? n.userData.id : null;
  }

  let px = 0, py = 0, tx = 0, ty = 0, downX = 0, downY = 0;
  function onMove(e) {
    const r = canvas.getBoundingClientRect();
    tx = ((e.clientX - r.left) / r.width) * 2 - 1;
    ty = ((e.clientY - r.top) / r.height) * 2 - 1;
    if (play && e.pointerType !== 'touch') {
      hovered = pick(e);
      const o = hovered && data.objects.find((x) => x.id === hovered);
      canvas.style.cursor = o && ((o.hover && o.hover.on) || (o.click && o.click.on)) ? 'pointer' : '';
    }
  }
  function onDown(e) { downX = e.clientX; downY = e.clientY; if (play && e.pointerType === 'touch') hovered = pick(e); }
  function onUp(e) {
    const moved = Math.hypot(e.clientX - downX, e.clientY - downY) > 6;
    if (!moved) {
      const id = pick(e);
      if (!play) { if (opts.onPick) opts.onPick(id); }
      else if (id) {
        const o = data.objects.find((x) => x.id === id), it = items.get(id);
        if (o && o.click && o.click.on) {
          if (o.click.action === 'link') { if (o.click.url) (opts.onLink || ((u) => { window.location.href = u; }))(o.click.url); }
          else { const target = items.get(o.click.target) || it; target.on = !target.on; }
        }
      }
    }
    if (e.pointerType === 'touch') hovered = null;
  }
  function onLeave() { hovered = null; tx = 0; ty = 0; }
  canvas.addEventListener('pointermove', onMove);
  canvas.addEventListener('pointerdown', onDown);
  canvas.addEventListener('pointerup', onUp);
  canvas.addEventListener('pointerleave', onLeave);
  controls.addEventListener('end', () => {
    if (play) return;
    data.camera = { pos: camera.position.toArray().map((v) => +v.toFixed(3)), target: controls.target.toArray().map((v) => +v.toFixed(3)) };
    if (opts.onChange) opts.onChange();
  });

  function resize() {
    const w = canvas.clientWidth || 1, h = canvas.clientHeight || 1;
    renderer.setSize(w, h, false);
    if (finalComposer) { bloomComposer.setSize(w, h); finalComposer.setSize(w, h); }
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }
  const ro = new ResizeObserver(resize);
  ro.observe(canvas);
  resize();

  let last = performance.now(), elapsed = 0;
  const cA = new THREE.Color(), cB = new THREE.Color(), saved = new THREE.Vector3(), right = new THREE.Vector3(), up = new THREE.Vector3(), off = new THREE.Vector3(), yAxis = new THREE.Vector3(0, 1, 0), tgt = new THREE.Vector3();
  const mix = (a, b, t) => a + (b - a) * t;
  let raf = 0;

  function frame() {
    raf = requestAnimationFrame(frame);
    const now = performance.now(), dt = Math.min((now - last) / 1000, 0.05), ease = 1 - Math.exp(-dt * 9);
    last = now; elapsed += dt;
    const t = elapsed;
    bg.set(data.bg || '#e9dfc9');
    scene.environmentIntensity = data.env == null ? 0.7 : data.env;
    key.intensity = data.key == null ? 2.2 : data.key;
    const ka = rad(data.keyAngle == null ? -35 : data.keyAngle);
    key.position.set(Math.sin(ka) * 7, 8, Math.cos(ka) * 7);
    floorMat.opacity = data.shadow == null ? 0.25 : data.shadow;
    // Narrow screens widen the lens so the scene keeps its side-to-side framing.
    const vf = 2 * THREE.MathUtils.radToDeg(Math.atan(Math.tan(rad((data.fov || 35) / 2)) * Math.max(1, 1.5 / camera.aspect)));
    if (Math.abs(camera.fov - vf) > 0.01) { camera.fov = vf; camera.updateProjectionMatrix(); }
    px += (tx - px) * 0.06; py += (ty - py) * 0.06;
    const spT = opts.progress ? opts.progress() : pageProgress();
    sp = reduce ? spT : sp + (spT - sp) * (1 - Math.exp(-dt * 6));
    const T = data.timeline || {}, dur = T.duration || 4;
    if (play) tlClock += dt;
    let tlT = 0;
    if (T.trigger === 'scroll') tlT = sp * dur;
    else if (!reduce) {
      if (T.mode === 'once') tlT = Math.min(tlClock, dur);
      else if (T.mode === 'pingpong') { const m = tlClock % (2 * dur); tlT = m > dur ? 2 * dur - m : m; }
      else tlT = tlClock % dur;
    }

    data.objects.forEach((o) => {
      const it = items.get(o.id);
      if (!it) return;
      const hv = o.hover || {}, ck = o.click || {}, an = o.anim || {};
      it.h += ((play && hv.on && hovered === o.id ? 1 : 0) - it.h) * ease;
      const sr = o.scroll || {};
      const kf = play && o.keys && o.keys.length > 1 ? evalKeys(o.keys, tlT) : o;
      let s = 0;
      if (play && sr.on) {
        const a = sr.start || 0, b = sr.end == null ? 1 : sr.end;
        s = b > a ? clamp((sp - a) / (b - a)) : (sp >= a ? 1 : 0);
        s = s * s * (3 - 2 * s);
      }
      const active = it.on !== !!(sr.on && sr.activate && s > 0.5);
      it.c += ((play && active ? 1 : 0) - it.c) * ease;
      let x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, sc = 1;
      if (play && !reduce && an.kind && an.kind !== 'none') {
        const tt = t * (an.speed || 1) + it.phase, a = an.amount == null ? 0.5 : an.amount;
        if (an.kind === 'float') y += Math.sin(tt * 1.6) * 0.25 * a;
        if (an.kind === 'spin') ry += t * (an.speed || 1) * 1.2 * a;
        if (an.kind === 'wobble') rz += Math.sin(tt * 2) * 0.35 * a;
        if (an.kind === 'pulse') sc *= 1 + Math.sin(tt * 2.4) * 0.12 * a;
      }
      y += (hv.lift || 0) * it.h + (ck.lift || 0) * it.c;
      ry += rad(hv.spin || 0) * it.h + rad(ck.spin || 0) * it.c;
      sc *= mix(1, hv.scale || 1, it.h) * mix(1, ck.scale || 1, it.c);
      if (s) { const mv = sr.move || [0, 0, 0]; x += mv[0] * s; y += mv[1] * s; z += mv[2] * s; ry += rad(sr.spin || 0) * s; sc *= mix(1, sr.scale || 1, s); }
      if (play && o.follow) { ry += px * o.follow * 0.7; rx += py * o.follow * 0.45; }
      it.root.position.set(kf.pos[0] + x, kf.pos[1] + y, kf.pos[2] + z);
      it.root.rotation.set(rad(kf.rot[0]) + rx, rad(kf.rot[1]) + ry, rad(kf.rot[2]) + rz);
      it.root.scale.set(kf.scale[0] * sc, kf.scale[1] * sc, kf.scale[2] * sc);
      if (it.mixer && (play || !opts.edit)) it.mixer.update(dt);
      if (it.points) {
        const P = it.points, spread = o.spread || 3, speed = o.speed == null ? 0.4 : o.speed, tp = play && !reduce ? t : 0;
        for (let i = 0; i < P.n; i++) {
          const a = i * 4, rise = (P.seeds[a + 1] + tp * speed * (0.05 + P.seeds[a + 3] * 0.1)) % 1;
          P.pos[i * 3] = (P.seeds[a] - 0.5) * spread + Math.sin(tp * 0.6 + P.seeds[a + 3] * 40) * 0.08;
          P.pos[i * 3 + 1] = (rise - 0.5) * spread * 0.7;
          P.pos[i * 3 + 2] = (P.seeds[a + 2] - 0.5) * spread;
        }
        P.geo.attributes.position.needsUpdate = true;
      }
      const m = it.mat, d = o.mat || {};
      if (m) {
        cA.set(d.color || '#ffffff');
        if (hv.tint) cA.lerp(cB.set(hv.color || '#ffffff'), it.h);
        if (ck.tint) cA.lerp(cB.set(ck.color || '#ffffff'), it.c);
        if (m.isPointsMaterial) {
          m.color.copy(cA).multiplyScalar(1 + (d.glow || 0));
          m.opacity = d.opacity == null ? 1 : d.opacity;
          m.size = o.psize || 0.06;
          return;
        }
        if (it.surf) { const ts = d.texScale || 1, ay = it.surf === 'brick' ? 4 / 3 : 1; m.map.repeat.set(ts * o.scale[0], ts * o.scale[1] * ay); m.bumpMap.repeat.copy(m.map.repeat); }
        m.color.copy(cA);
        m.roughness = d.roughness == null ? 0.4 : d.roughness;
        m.metalness = d.metalness || 0;
                m.emissive.copy(cA); m.emissiveIntensity = (d.glow || 0) * flick(an, tlClock, t);
        m.opacity = d.opacity == null ? 1 : d.opacity;
        if (m.isMeshPhysicalMaterial) m.transmission = d.glass || 0;
        const flags = (m.opacity < 1) + '|' + ((d.glass || 0) > 0);
        if (flags !== it.flags) { it.flags = flags; m.transparent = m.opacity < 1; m.needsUpdate = true; }
      }
    });

    const camKeyed = play && data.camKeys && data.camKeys.length > 1;
    controls.enabled = !api.lock && (!play || (!!data.orbit && !camKeyed));
    canvas.style.touchAction = controls.enabled ? 'none' : 'pan-y';
    controls.update();
    const drift = play && !reduce ? (data.drift || 0) : 0;
    const cs = data.scrollCam || {}, camS = play && cs.on ? sp * sp * (3 - 2 * sp) : 0;
    saved.copy(camera.position);
    tgt.copy(controls.target);
    if (camKeyed) {
      const ck2 = evalKeys(data.camKeys, tlT);
      camera.position.fromArray(ck2.pos); tgt.fromArray(ck2.target);
      camera.lookAt(tgt); camera.updateMatrixWorld();
    }
    const pz = play && camera.aspect < 1 ? (data.phoneZoom || 1) : 1;
    if (pz !== 1) { off.copy(camera.position).sub(tgt).multiplyScalar(pz); camera.position.copy(tgt).add(off); camera.updateMatrixWorld(); }
    if (camS) {
      off.copy(camera.position).sub(tgt).applyAxisAngle(yAxis, rad(cs.orbit || 0) * camS).multiplyScalar(mix(1, cs.zoom || 1, camS));
      camera.position.copy(tgt).add(off);
      camera.position.y += (cs.rise || 0) * camS;
      camera.lookAt(tgt); camera.updateMatrixWorld();
    }
    if (drift) {
      right.setFromMatrixColumn(camera.matrixWorld, 0); up.setFromMatrixColumn(camera.matrixWorld, 1);
      camera.position.addScaledVector(right, px * drift * 0.6).addScaledVector(up, -py * drift * 0.35);
      camera.lookAt(tgt);
    }
    if ((data.bloom || 0) > 0) renderBloom(); else renderer.render(scene, camera);
    updateSections();
    if (drift || camS || camKeyed || pz !== 1) { camera.position.copy(saved); camera.lookAt(controls.target); }
  }

  data.objects.forEach(build);
  frame();

  return Object.assign(api, {
    scene, camera, controls, pick, evalKeys,
    get(id) { const it = items.get(id); return it ? it.root : null; },
    add(o) { return build(o); },
    remove(id) { unbuild(id); },
    rebuild(o) { unbuild(o.id); return build(o); },
    redraw(o) { const it = items.get(o.id); if (it && it.canvas) drawText(it, o); },
    setPlay(v) { play = v; tlClock = 0; hovered = null; items.forEach((it) => { it.on = false; }); canvas.style.cursor = ''; },
    setView(c) { camera.position.fromArray(c.pos); controls.target.fromArray(c.target); },
    snapshot() { renderer.render(scene, camera); return canvas.toDataURL('image/jpeg', 0.6); },
    dispose() {
      cancelAnimationFrame(raf); ro.disconnect(); controls.dispose();
      canvas.removeEventListener('pointermove', onMove); canvas.removeEventListener('pointerdown', onDown);
      canvas.removeEventListener('pointerup', onUp); canvas.removeEventListener('pointerleave', onLeave);
      Array.from(items.keys()).forEach(unbuild);
      floor.geometry.dispose(); floorMat.dispose(); pmrem.dispose(); if (finalComposer) { bloomComposer.dispose(); finalComposer.dispose(); } darkMat.dispose(); renderer.dispose();
    }
  });
}
