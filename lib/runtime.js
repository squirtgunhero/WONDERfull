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
import { GTAOPass } from 'three/addons/postprocessing/GTAOPass.js';
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

  // Sky: a two-color dome that sits behind everything and follows the camera.
  const skyMat = new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false, toneMapped: false,
    uniforms: { top: { value: new THREE.Color() }, bottom: { value: new THREE.Color() } },
    vertexShader: 'varying vec3 vDir; void main() { vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: 'uniform vec3 top; uniform vec3 bottom; varying vec3 vDir; void main() { gl_FragColor = vec4(mix(bottom, top, smoothstep(-0.12, 0.7, vDir.y)), 1.0);\n#include <colorspace_fragment>\n}'
  });
  const sky = new THREE.Mesh(new THREE.SphereGeometry(90, 32, 16), skyMat);
  sky.renderOrder = -10; sky.visible = false;
  scene.add(sky);
  const fog = new THREE.Fog('#ffffff', 6, 30);
  const srgb = (hex) => { const n = parseInt((hex || '#ffffff').slice(1), 16); return new THREE.Vector3((n >> 16 & 255) / 255, (n >> 8 & 255) / 255, (n & 255) / 255); };

  // Bloom: only objects with Glow are drawn into the bloom pass, so the halo keeps their color.
  let bloomComposer = null, finalComposer = null, bloomPass = null, mixPass = null, aoPass = null, gradePass = null;
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
    mixPass = new ShaderPass(new THREE.ShaderMaterial({
      uniforms: { baseTexture: { value: null }, bloomTexture: { value: bloomComposer.renderTarget2.texture }, amount: { value: 1 } },
      vertexShader: 'varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
      fragmentShader: 'uniform sampler2D baseTexture; uniform sampler2D bloomTexture; uniform float amount; varying vec2 vUv; void main() { gl_FragColor = texture2D(baseTexture, vUv) + texture2D(bloomTexture, vUv) * amount; }'
    }), 'baseTexture');
    mixPass.needsSwap = true;
    finalComposer = new EffectComposer(renderer, new THREE.WebGLRenderTarget(w * pr, h * pr, { type: THREE.HalfFloatType, samples: 4 }));
    finalComposer.addPass(new RenderPass(scene, camera));
    // Ambient shadows: soft darkening where surfaces meet.
    aoPass = new GTAOPass(scene, camera, w, h);
    aoPass.enabled = false;
    finalComposer.addPass(aoPass);
    finalComposer.addPass(mixPass);
    finalComposer.addPass(new OutputPass());
    // Color: contrast, saturation, tint and vignette, applied to the finished picture.
    gradePass = new ShaderPass(new THREE.ShaderMaterial({
      uniforms: { tDiffuse: { value: null }, contrast: { value: 1 }, saturation: { value: 1 }, vignette: { value: 0 }, tint: { value: new THREE.Vector3(1, 1, 1) } },
      vertexShader: 'varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
      fragmentShader: 'uniform sampler2D tDiffuse; uniform float contrast; uniform float saturation; uniform float vignette; uniform vec3 tint; varying vec2 vUv; void main() { vec4 c = texture2D(tDiffuse, vUv); float l = dot(c.rgb, vec3(0.2126, 0.7152, 0.0722)); c.rgb = mix(vec3(l), c.rgb, saturation); c.rgb = (c.rgb - 0.5) * contrast + 0.5; c.rgb *= tint; c.rgb *= 1.0 - vignette * smoothstep(0.3, 0.85, distance(vUv, vec2(0.5))); gl_FragColor = vec4(clamp(c.rgb, 0.0, 1.0), c.a); }'
    }));
    finalComposer.addPass(gradePass);
  }
  const swapped = [], hidden = [];
  function renderPost() {
    ensureComposer();
    const G = data.grade || {}, glow = (data.bloom || 0) > 0;
    mixPass.uniforms.amount.value = glow ? 1 : 0;
    if (glow) {
      bloomPass.strength = data.bloom;
      const envI = scene.environmentIntensity, keyI = key.intensity, fogWas = scene.fog, skyWas = sky.visible;
      scene.environmentIntensity = 0; key.intensity = 0; scene.background = black; floor.visible = false; scene.fog = null; sky.visible = false;
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
      scene.environmentIntensity = envI; key.intensity = keyI; scene.background = bg; floor.visible = true; scene.fog = fogWas; sky.visible = skyWas;
    }
    aoPass.enabled = (data.ao || 0) > 0;
    aoPass.blendIntensity = data.ao || 0;
    const u = gradePass.uniforms;
    u.contrast.value = G.contrast == null ? 1 : G.contrast; u.saturation.value = G.saturation == null ? 1 : G.saturation;
    u.vignette.value = G.vignette || 0; u.tint.value.copy(srgb(G.tint));
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
  // Physics: objects marked as falling or solid get rigid bodies while the scene plays.
  let world = null, CANNON = null, bodies = new Map(), physAsked = false;
  const usesPhysics = () => !reduce && data.objects.some((o) => o.body && o.body !== 'none');
  function startPhysics() {
    world = null; bodies = new Map();
    if (!usesPhysics()) return;
    const make = () => {
      if (!play || !usesPhysics()) return;
      world = new CANNON.World({ gravity: new CANNON.Vec3(0, -(data.gravity == null ? 9.8 : data.gravity), 0) });
      world.allowSleep = true;
      const ground = new CANNON.Body({ mass: 0, shape: new CANNON.Plane() });
      ground.quaternion.setFromEuler(-Math.PI / 2, 0, 0);
      world.addBody(ground);
      const size = new THREE.Vector3(), box = new THREE.Box3();
      data.objects.forEach((o) => {
        const it = items.get(o.id);
        if (!it || !o.body || o.body === 'none' || o.cutter || o.type === 'particles' || o.type === 'light' || o.type === 'cord') return;
        const sc = o.scale;
        let shape;
        if (o.type === 'sphere') shape = new CANNON.Sphere(0.6 * Math.max(sc[0], sc[1], sc[2]));
        else if (o.type === 'cylinder') shape = new CANNON.Cylinder(0.5 * Math.max(sc[0], sc[2]), 0.5 * Math.max(sc[0], sc[2]), sc[1], 16);
        else {
          // Everything else collides as the box that encloses it.
          box.makeEmpty();
          it.root.children.forEach((c) => { if (c.geometry) { c.geometry.computeBoundingBox(); box.union(c.geometry.boundingBox); } });
          if (box.isEmpty()) box.set(new THREE.Vector3(-0.5, -0.5, -0.5), new THREE.Vector3(0.5, 0.5, 0.5));
          box.getSize(size);
          shape = new CANNON.Box(new CANNON.Vec3(Math.max(0.01, size.x * sc[0] / 2), Math.max(0.01, size.y * sc[1] / 2), Math.max(0.01, size.z * sc[2] / 2)));
        }
        const mat = new CANNON.Material({ friction: 0.4, restitution: o.bounce == null ? 0.3 : o.bounce });
        const b = new CANNON.Body({ mass: o.body === 'falls' ? (o.weight || 1) : 0, shape, material: mat, linearDamping: 0.02, angularDamping: 0.05 });
        b.position.set(o.pos[0], o.pos[1], o.pos[2]);
        b.quaternion.setFromEuler(rad(o.rot[0]), rad(o.rot[1]), rad(o.rot[2]), 'XYZ');
        world.addBody(b);
        bodies.set(o.id, b);
      });
      world.defaultContactMaterial.restitution = 0.3; world.defaultContactMaterial.friction = 0.4;
    };
    if (CANNON) make();
    else if (!physAsked) { physAsked = true; import('cannon-es').then((m) => { CANNON = m; make(); }).catch(() => {}); }
  }

  // Game controls: arrow keys, WASD or an on-screen pad move an object. Space makes a falling object jump.
  const keysDown = new Set(), pad = { x: 0, y: 0, el: null }, moveDir = new THREE.Vector3(), fwd = new THREE.Vector3(), side = new THREE.Vector3(), lastFollow = new THREE.Vector3();
  let followHas = false, jumpAsked = false;
  const typing = () => { const t = document.activeElement && document.activeElement.tagName; return t === 'INPUT' || t === 'TEXTAREA' || t === 'SELECT'; };
  const controlled = () => data.objects.some((o) => o.control === 'walk');
  function onKey(e) {
    if (!play || typing() || !controlled()) return;
    const k = e.key.toLowerCase();
    if (!['arrowup', 'arrowdown', 'arrowleft', 'arrowright', 'w', 'a', 's', 'd', ' '].includes(k)) return;
    e.preventDefault();
    if (e.type === 'keydown') { keysDown.add(k); if (k === ' ') jumpAsked = true; } else keysDown.delete(k);
  }
  window.addEventListener('keydown', onKey); window.addEventListener('keyup', onKey);
  function showPad(on) {
    if (on && !pad.el && canvas.parentElement) {
      const el = document.createElement('div');
      el.setAttribute('aria-label', 'Move');
      el.style.cssText = 'position:absolute;left:18px;bottom:64px;width:104px;height:104px;border-radius:50%;background:rgba(255,255,255,.55);border:2px solid rgba(20,22,26,.25);touch-action:none;z-index:4;';
      const set = (e) => { const r = el.getBoundingClientRect(); pad.x = Math.max(-1, Math.min(1, ((e.clientX - r.left) / r.width - 0.5) * 2.4)); pad.y = Math.max(-1, Math.min(1, ((e.clientY - r.top) / r.height - 0.5) * 2.4)); };
      el.addEventListener('pointerdown', (e) => { el.setPointerCapture(e.pointerId); set(e); });
      el.addEventListener('pointermove', (e) => { if (e.buttons || e.pointerType === 'touch') set(e); });
      const stop = () => { pad.x = 0; pad.y = 0; };
      el.addEventListener('pointerup', stop); el.addEventListener('pointercancel', stop);
      canvas.parentElement.appendChild(el);
      pad.el = el;
    }
    if (pad.el) pad.el.style.display = on ? 'block' : 'none';
  }
  const coarse = window.matchMedia && window.matchMedia('(pointer: coarse)').matches;

  // Live values: a variable can read a number or text from a web address while the scene plays.
  let feeds = [];
  function startVars() {
    feeds.forEach(clearInterval); feeds = [];
    vars = {};
    (data.vars || []).forEach((v) => {
      vars[v.name] = v.kind === 'number' ? Number(v.value) || 0 : v.kind === 'toggle' ? !!v.value : String(v.value == null ? '' : v.value);
      const src = v.src || {};
      if (!play || !/^https:\/\//i.test(src.url || '')) return;
      const pull = () => fetch(src.url, { credentials: 'omit' }).then((r) => r.json()).then((j) => {
        let at = j;
        String(src.path || '').split('.').filter(Boolean).forEach((k) => { at = at == null ? at : at[k]; });
        if (at != null && typeof at !== 'object') vars[v.name] = v.kind === 'number' ? Number(at) || 0 : v.kind === 'toggle' ? !!at : String(at).slice(0, 80);
      }).catch(() => {});
      pull();
      feeds.push(setInterval(pull, Math.max(5, Number(src.every) || 30) * 1000));
    });
  }
  function changeVar(ck) {
    if (!(ck.var in vars)) return;
    const cur = vars[ck.var], val = ck.val;
    if (ck.op === 'toggle') vars[ck.var] = !cur;
    else if (ck.op === 'add') vars[ck.var] = (Number(cur) || 0) + (Number(val) || 0);
    else vars[ck.var] = typeof cur === 'number' ? Number(val) || 0 : typeof cur === 'boolean' ? (val === true || val === 'true' || val === 'yes' || val === 1 || val === '1') : String(val == null ? '' : val);
  }

  // Saved cameras: a click can send the view to one, and Play can start on one.
  let camTween = null, editView = null;
  function goCam(id, instant) {
    const c = (data.cameras || []).find((x) => x.id === id);
    if (!c) return;
    const p1 = new THREE.Vector3().fromArray(c.pos), t1 = new THREE.Vector3().fromArray(c.target);
    if (instant || reduce) { camera.position.copy(p1); controls.target.copy(t1); camTween = null; }
    else camTween = { at: 0, p0: camera.position.clone(), t0: controls.target.clone(), p1, t1 };
  }
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

  // Typefaces for 3D text. Righteous ships with the player; the others load the first time they are used.
  const fonts = {}, fontLoads = {
    anton: () => import('./fonts/anton.json'), playfair: () => import('./fonts/playfair.json'), spacemono: () => import('./fonts/spacemono.json'),
    pacifico: () => import('./fonts/pacifico.json'), inter: () => import('./fonts/inter.json'),
  };
  function fontFor(o) {
    if (!fonts.righteous) fonts.righteous = new FontLoader().parse(FONT_RIGHTEOUS);
    const name = o.font && fontLoads[o.font] ? o.font : 'righteous';
    if (fonts[name]) return fonts[name];
    if (fontLoads[name] !== 'loading') {
      const load = fontLoads[name];
      fontLoads[name] = 'loading';
      load().then((m) => {
        fonts[name] = new FontLoader().parse(m.default || m);
        data.objects.forEach((x) => { const it = items.get(x.id); if (x.type === 'text3d' && x.font === name && it && it.mesh) { it.mesh.geometry.dispose(); it.mesh.geometry = geometryFor(x); it.cutKey = ''; } });
      }).catch(() => {});
    }
    return fonts.righteous;
  }
  // Variables: named values a scene keeps while it plays. Text can show them and clicks can change them.
  let vars = {};
  const showVar = (v) => (typeof v === 'number' ? String(Math.round(v * 100) / 100) : v === true ? 'yes' : v === false ? 'no' : String(v == null ? '' : v));
  const fill = (text) => (text && text.indexOf('{') >= 0 ? text.replace(/\{([A-Za-z][A-Za-z0-9_]*)\}/g, (m, k) => (k in vars ? showVar(vars[k]) : m)) : text);
  const shown = (o) => (play ? fill(o.text || ' ') : (o.text || ' ')).slice(0, 28);
  function geometryFor(o) {
    switch (o.type) {
      case 'cord': {
        const to = o.to || [1, -1.5, 0], end = new THREE.Vector3(to[0], to[1], to[2]);
        const mid = end.clone().multiplyScalar(0.5);
        mid.y -= (o.slack == null ? 0.4 : o.slack) * end.length() * 0.6;
        return new THREE.TubeGeometry(new THREE.QuadraticBezierCurve3(new THREE.Vector3(), mid, end), 48, o.thick || 0.02, 8, false);
      }
      case 'text3d': {
        const bevel = o.bevel || 0;
        const g = new TextGeometry(shown(o), {
          font: fontFor(o), size: 0.8, depth: o.depth == null ? 0.25 : o.depth, curveSegments: 6,
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
      case 'shape': {
        // A flat outline drawn by hand, given thickness.
        let pts = (o.pts && o.pts.length >= 3 ? o.pts : [[0, 0.7], [0.66, 0.22], [0.41, -0.57], [-0.41, -0.57], [-0.66, 0.22]]).map((p) => new THREE.Vector2(p[0], p[1]));
        if (o.smooth) pts = new THREE.CatmullRomCurve3(pts.map((p) => new THREE.Vector3(p.x, p.y, 0)), true, 'catmullrom', 0.5).getPoints(Math.max(32, pts.length * 10)).map((p) => new THREE.Vector2(p.x, p.y));
        if (THREE.ShapeUtils.isClockWise(pts)) pts.reverse();
        const g = new THREE.ExtrudeGeometry(new THREE.Shape(pts), { depth: o.depth == null ? 0.25 : o.depth, bevelEnabled: true, bevelThickness: 0.02, bevelSize: 0.02, bevelSegments: 2 });
        g.translate(0, 0, -(o.depth == null ? 0.25 : o.depth) / 2);
        return g;
      }
      case 'pyramid': { const g = new THREE.ConeGeometry(0.71, 1, 4); g.rotateY(Math.PI / 4); return g; }
      case 'dome': { const g = new THREE.SphereGeometry(0.6, 48, 24, 0, Math.PI * 2, 0, Math.PI / 2); g.translate(0, -0.3, 0); return g; }
      case 'arch': { const g = new THREE.TorusGeometry(0.5, 0.11, 24, 64, Math.PI); g.translate(0, -0.25, 0); return g; }
      case 'star': case 'heart': {
        const sh = new THREE.Shape();
        if (o.type === 'star') {
          for (let i = 0; i < 10; i++) { const a = Math.PI / 2 + i * Math.PI / 5, r = i % 2 ? 0.26 : 0.6; if (i) sh.lineTo(Math.cos(a) * r, Math.sin(a) * r); else sh.moveTo(Math.cos(a) * r, Math.sin(a) * r); }
          sh.closePath();
        } else {
          sh.moveTo(0, -0.55); sh.bezierCurveTo(-0.2, -0.3, -0.62, -0.05, -0.62, 0.25); sh.bezierCurveTo(-0.62, 0.62, -0.12, 0.66, 0, 0.32);
          sh.bezierCurveTo(0.12, 0.66, 0.62, 0.62, 0.62, 0.25); sh.bezierCurveTo(0.62, -0.05, 0.2, -0.3, 0, -0.55);
        }
        const g = new THREE.ExtrudeGeometry(sh, { depth: 0.2, bevelEnabled: true, bevelThickness: 0.04, bevelSize: 0.04, bevelSegments: 3, curveSegments: 24 });
        g.center();
        return g;
      }
      default: return new RoundedBoxGeometry(1, 1, 1, 6, 0.12);
    }
  }

  let ramp = null;
  function toonRamp() {
    if (ramp) return ramp;
    ramp = new THREE.DataTexture(new Uint8Array([90, 90, 90, 255, 170, 170, 170, 255, 255, 255, 255, 255]), 3, 1, THREE.RGBAFormat);
    ramp.minFilter = ramp.magFilter = THREE.NearestFilter; ramp.needsUpdate = true;
    return ramp;
  }

  // Cutting: an object can have other objects carved out of it. The carving reruns when any of them moves.
  let CSG = null, csgAsked = false, lastCut = 0;
  const CUTTABLE = ['box', 'sphere', 'cylinder', 'cone', 'torus', 'capsule', 'knot', 'pyramid', 'dome', 'arch', 'star', 'heart', 'shape', 'text3d'];
  const poseOf = (o) => new THREE.Matrix4().compose(new THREE.Vector3().fromArray(o.pos), new THREE.Quaternion().setFromEuler(new THREE.Euler(rad(o.rot[0]), rad(o.rot[1]), rad(o.rot[2]))), new THREE.Vector3().fromArray(o.scale));
  function carve(o, it, now) {
    const cutters = (o.cuts || []).map((id) => data.objects.find((x) => x.id === id)).filter((c) => c && c.id !== o.id && CUTTABLE.includes(c.type));
    const key = cutters.map((c) => [c.id, c.type, c.pos, c.rot, c.scale, c.text, c.depth, (c.pts || []).join(';')].join('/')).join('|') + '#' + [o.pos, o.rot, o.scale].join('/');
    if (key === it.cutKey) return;
    if (!cutters.length) { if (it.cutKey) { it.mesh.geometry.dispose(); it.mesh.geometry = geometryFor(o); } it.cutKey = key; return; }
    if (!CSG) { if (!csgAsked) { csgAsked = true; import('three-bvh-csg').then((m) => { CSG = m; }).catch(() => {}); } return; }
    if (now - lastCut < 90) return;
    lastCut = now;
    it.cutKey = key;
    try {
      const ev = new CSG.Evaluator();
      ev.attributes = ['position', 'normal', 'uv'];
      let a = new CSG.Brush(geometryFor(o));
      a.updateMatrixWorld();
      const inv = poseOf(o).invert();
      cutters.forEach((c) => {
        const b = new CSG.Brush(geometryFor(c));
        inv.clone().multiply(poseOf(c)).decompose(b.position, b.quaternion, b.scale);
        b.updateMatrixWorld();
        const next = ev.evaluate(a, b, CSG.SUBTRACTION);
        a.geometry.dispose(); b.geometry.dispose();
        a = next;
      });
      it.mesh.geometry.dispose();
      it.mesh.geometry = a.geometry;
    } catch (e) { /* leave the shape whole if the cut fails */ }
  }

  function drawText(it, o) {
    const g = it.canvas.getContext('2d');
    const label = shown(o);
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
    } else if (o.type === 'video') {
      // A looping, silent video on a flat card.
      it.mat = new THREE.MeshStandardMaterial({ side: THREE.DoubleSide });
      const mesh = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 0.9), it.mat);
      mesh.castShadow = true;
      root.add(mesh);
      const buf = opts.buffers && opts.buffers.get(o.file);
      if (buf) {
        const ext = (o.file.split('.').pop() || '').toLowerCase();
        const v = document.createElement('video');
        v.muted = true; v.loop = true; v.playsInline = true; v.setAttribute('playsinline', ''); v.crossOrigin = 'anonymous';
        it.video = v; it.videoUrl = URL.createObjectURL(new Blob([buf], { type: ext === 'mov' ? 'video/quicktime' : 'video/' + ext }));
        v.addEventListener('loadedmetadata', () => {
          if (items.get(o.id) !== it) return;
          const w = v.videoWidth || 16, h = v.videoHeight || 9, k = 1.6 / Math.max(w, h);
          mesh.geometry.dispose(); mesh.geometry = new THREE.PlaneGeometry(w * k, h * k);
          const tex = new THREE.VideoTexture(v);
          tex.colorSpace = THREE.SRGBColorSpace;
          it.mat.map = tex; it.mat.needsUpdate = true;
        });
        v.src = it.videoUrl;
        v.play().catch(() => {});
      } else if (opts.edit) { it.mat.wireframe = true; } else { mesh.visible = false; }
    } else if (o.type === 'image') {
      // A picture on a flat card. The card takes the picture's proportions once it has loaded.
      it.mat = new THREE.MeshStandardMaterial({ side: THREE.DoubleSide, alphaTest: 0.3 });
      const mesh = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 1.6), it.mat);
      mesh.castShadow = true;
      root.add(mesh);
      const buf = opts.buffers && opts.buffers.get(o.file);
      if (buf) {
        const ext = (o.file.split('.').pop() || '').toLowerCase();
        const url = URL.createObjectURL(new Blob([buf], { type: ext === 'svg' ? 'image/svg+xml' : 'image/' + (ext === 'jpg' ? 'jpeg' : ext) }));
        const img = new Image();
        img.onload = () => {
          URL.revokeObjectURL(url);
          if (items.get(o.id) !== it) return;
          const tex = new THREE.Texture(img);
          tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = renderer.capabilities.getMaxAnisotropy(); tex.needsUpdate = true;
          it.mat.map = tex; it.mat.needsUpdate = true;
          const w = img.naturalWidth || 1, h = img.naturalHeight || 1, k = 1.6 / Math.max(w, h);
          mesh.geometry.dispose(); mesh.geometry = new THREE.PlaneGeometry(w * k, h * k);
        };
        img.onerror = () => URL.revokeObjectURL(url);
        img.src = url;
      } else if (opts.edit) { it.mat.wireframe = true; } else { mesh.visible = false; }
    } else if (o.type === 'light') {
      // A lamp that lights what is near it. The small marker only shows while editing, so it can be picked.
      it.light = new THREE.PointLight('#ffffff', 0, 0, 2);
      it.marker = new THREE.Mesh(new THREE.SphereGeometry(0.13, 16, 12), new THREE.MeshBasicMaterial({ color: '#ffffff' }));
      root.add(it.light, it.marker);
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
      it.mat = (o.mat && o.mat.style === 'toon') ? new THREE.MeshToonMaterial({ gradientMap: toonRamp() }) : new THREE.MeshPhysicalMaterial({ thickness: 1, ior: 1.45 });
      applySurface(it, o);
      if (o.type === 'dome' || o.type === 'arch') it.mat.side = THREE.DoubleSide;
      const geo = geometryFor(o), cl = o.clone || {};
      let mesh;
      if (cl.kind === 'grid' || cl.kind === 'ring') {
        // Copies: one object drawn many times, in a grid or around a ring.
        // Spacing is in scene units, so it is divided by the object's own size.
        const spots = [], m4 = new THREE.Matrix4(), sx = 1 / (o.scale[0] || 1), sy = 1 / (o.scale[1] || 1), sz = 1 / (o.scale[2] || 1);
        if (cl.kind === 'grid') {
          const nx = Math.max(1, Math.round(cl.nx || 1)), ny = Math.max(1, Math.round(cl.ny || 1)), nz = Math.max(1, Math.round(cl.nz || 1)), gap = cl.gap == null ? 1.4 : cl.gap;
          for (let x = 0; x < nx; x++) for (let y = 0; y < ny; y++) for (let z = 0; z < nz; z++) if (spots.length < 600) spots.push(new THREE.Matrix4().makeTranslation((x - (nx - 1) / 2) * gap * sx, (y - (ny - 1) / 2) * gap * sy, (z - (nz - 1) / 2) * gap * sz));
        } else {
          const n = Math.max(2, Math.min(200, Math.round(cl.count || 8))), r = cl.radius == null ? 2 : cl.radius;
          for (let i = 0; i < n; i++) { const a = (i / n) * Math.PI * 2; spots.push(new THREE.Matrix4().makeRotationY(-a).setPosition(Math.cos(a) * r * sx, 0, Math.sin(a) * r * sz)); }
        }
        mesh = new THREE.InstancedMesh(geo, it.mat, spots.length);
        spots.forEach((mx, i) => mesh.setMatrixAt(i, m4.copy(mx)));
        mesh.instanceMatrix.needsUpdate = true;
        mesh.computeBoundingSphere();
        mesh.frustumCulled = false;
        it.cloned = true;
      } else mesh = new THREE.Mesh(geo, it.mat);
      mesh.castShadow = true; mesh.receiveShadow = true;
      root.add(mesh);
      it.mesh = mesh;
    }
    scene.add(root);
    items.set(o.id, it);
    return root;
  }

  function unbuild(id) {
    const it = items.get(id);
    if (!it) return;
    scene.remove(it.root);
    if (it.video) { it.video.pause(); it.video.removeAttribute('src'); it.video.load(); URL.revokeObjectURL(it.videoUrl); }
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
      + ';font-family:"Onest Variable","Onest",system-ui,sans-serif;text-shadow:0 1px 18px rgba(0,0,0,.45);';
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
        // Tapping something that falls gives it a shove.
        const hit = bodies.get(id);
        if (hit && hit.mass > 0) { hit.wakeUp(); hit.applyImpulse(new CANNON.Vec3((Math.random() - 0.5) * 2 * hit.mass, 4.5 * hit.mass, (Math.random() - 0.5) * 2 * hit.mass)); }
        if (o && o.click && o.click.on) {
          if (o.click.action === 'var') changeVar(o.click);
          else if (o.click.action === 'hook') {
            // A webhook tells another service that this object was tapped.
            if (/^https:\/\//i.test(o.click.url || '')) {
              if (opts.edit) { if (opts.onLink) opts.onLink(o.click.url + ' (as a webhook)'); }
              else fetch(o.click.url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ object: o.name || o.id, variables: vars }), keepalive: true, credentials: 'omit' }).catch(() => {});
            }
          }
          else if (o.click.action === 'camera') goCam(o.click.cam);
          else if (o.click.action === 'link') { if (o.click.url && /^(https?:\/\/|\/|#|mailto:)/i.test(o.click.url)) (opts.onLink || ((u) => { window.location.href = u; }))(o.click.url); }
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
    const F = data.fog || {}, S = data.sky || {}, G = data.grade || {};
    scene.fog = F.on ? fog : null;
    if (F.on) { fog.color.set(F.color || '#ffffff'); fog.near = F.near == null ? 6 : F.near; fog.far = Math.max(fog.near + 0.5, F.far == null ? 30 : F.far); }
    sky.visible = !!S.on;
    if (S.on) { skyMat.uniforms.top.value.set(S.top || '#4a7fe0'); skyMat.uniforms.bottom.value.set(S.bottom || '#e6eeff'); }
    renderer.toneMappingExposure = G.exposure == null ? 1 : G.exposure;
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

    // Where the player is steering, relative to the camera.
    const steer = play && controlled();
    if (steer) {
      const kx = (keysDown.has('arrowright') || keysDown.has('d') ? 1 : 0) - (keysDown.has('arrowleft') || keysDown.has('a') ? 1 : 0) + pad.x;
      const kz = (keysDown.has('arrowup') || keysDown.has('w') ? 1 : 0) - (keysDown.has('arrowdown') || keysDown.has('s') ? 1 : 0) - pad.y;
      camera.getWorldDirection(fwd); fwd.y = 0; fwd.normalize(); side.crossVectors(fwd, yAxis);
      moveDir.set(0, 0, 0).addScaledVector(fwd, kz).addScaledVector(side, kx);
      if (moveDir.lengthSq() > 1) moveDir.normalize();
    }
    showPad(steer && coarse);
    if (world && play) world.step(1 / 60, dt, 3);
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
      const pb = world && play ? bodies.get(o.id) : null;
      if (steer && o.control === 'walk') {
        const sp2 = o.speed == null ? 3 : o.speed;
        if (pb && pb.mass > 0) {
          pb.wakeUp(); pb.velocity.x = moveDir.x * sp2; pb.velocity.z = moveDir.z * sp2;
          if (jumpAsked && Math.abs(pb.velocity.y) < 0.2) pb.velocity.y = 5.5;
        } else {
          if (!it.ctrl) it.ctrl = new THREE.Vector3();
          it.ctrl.addScaledVector(moveDir, sp2 * dt);
          it.root.position.add(it.ctrl);
          if (moveDir.lengthSq() > 0.01) it.root.rotation.y = Math.atan2(moveDir.x, moveDir.z);
        }
      }
      // Hidden until a variable says otherwise, a carving tool while editing, or simply shown.
      it.root.visible = o.cutter ? !play : !(play && o.showIf && o.showIf in vars && !vars[o.showIf]);
      if (it.mesh && !it.cloned && ((o.cuts && o.cuts.length) || it.cutKey)) carve(o, it, now);
      if (play && (o.type === 'text' || o.type === 'text3d') && o.text && o.text.indexOf('{') >= 0) {
        const label = shown(o);
        if (label !== it.label) { it.label = label; if (o.type === 'text') drawText(it, o); else if (it.mesh) { it.mesh.geometry.dispose(); it.mesh.geometry = geometryFor(o); } }
      } else if (it.label != null && !play) { it.label = null; if (o.type === 'text') drawText(it, o); else if (it.mesh) { it.mesh.geometry.dispose(); it.mesh.geometry = geometryFor(o); } }
      if (pb) {
        if (pb.mass > 0) { it.root.position.set(pb.position.x, pb.position.y, pb.position.z); it.root.quaternion.set(pb.quaternion.x, pb.quaternion.y, pb.quaternion.z, pb.quaternion.w); }
        else { pb.position.set(it.root.position.x, it.root.position.y, it.root.position.z); pb.quaternion.set(it.root.quaternion.x, it.root.quaternion.y, it.root.quaternion.z, it.root.quaternion.w); }
      }
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
      if (it.light) {
        cA.set(d.color || '#ffffff');
        if (hv.tint) cA.lerp(cB.set(hv.color || '#ffffff'), it.h);
        if (ck.tint) cA.lerp(cB.set(ck.color || '#ffffff'), it.c);
        it.light.color.copy(cA);
        it.light.intensity = (o.power == null ? 8 : o.power) * flick(an, tlClock, t);
        it.light.distance = o.reach || 0;
        it.marker.visible = !play;
        it.marker.material.color.copy(cA);
        return;
      }
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
        m.wireframe = !!o.cutter;
        // Outline: a slightly larger dark shell drawn inside out behind the object.
        const line = d.outline || 0;
        if (line > 0 && it.mesh && !it.cloned && !it.shell) { it.shell = new THREE.Mesh(it.mesh.geometry, new THREE.MeshBasicMaterial({ side: THREE.BackSide })); it.shell.userData.shell = true; it.root.add(it.shell); }
        if (it.shell) { it.shell.visible = line > 0 && !o.cutter; it.shell.geometry = it.mesh.geometry; it.shell.scale.setScalar(1 + line * 0.09); it.shell.material.color.set(d.line || '#14161a'); }
        if (it.surf) { const ts = d.texScale || 1, ay = it.surf === 'brick' ? 4 / 3 : 1; m.map.repeat.set(ts * o.scale[0], ts * o.scale[1] * ay); m.bumpMap.repeat.copy(m.map.repeat); }
        m.color.copy(cA);
        m.roughness = d.roughness == null ? 0.4 : d.roughness;
        m.metalness = d.metalness || 0;
                m.emissive.copy(cA); m.emissiveIntensity = (d.glow || 0) * flick(an, tlClock, t);
        m.opacity = d.opacity == null ? 1 : d.opacity;
        if (m.isMeshPhysicalMaterial) { m.transmission = d.glass || 0; m.thickness = d.bend == null ? 1 : d.bend; m.iridescence = d.rainbow || 0; }
        const flags = (m.opacity < 1) + '|' + ((d.glass || 0) > 0);
        if (flags !== it.flags) { it.flags = flags; m.transparent = m.opacity < 1; m.needsUpdate = true; }
      }
    });

    jumpAsked = false;
    // The camera keeps its distance from the object it follows.
    const fo = play && data.followCam ? items.get(data.followCam) : null;
    if (fo) {
      if (followHas) { off.copy(fo.root.position).sub(lastFollow); camera.position.add(off); controls.target.add(off); }
      lastFollow.copy(fo.root.position); followHas = true;
    }
    if (camTween) {
      camTween.at = Math.min(1, camTween.at + dt / 1.2);
      const e = camTween.at * camTween.at * (3 - 2 * camTween.at);
      camera.position.lerpVectors(camTween.p0, camTween.p1, e); controls.target.lerpVectors(camTween.t0, camTween.t1, e);
      if (camTween.at >= 1) camTween = null;
    }
    const camKeyed = play && data.camKeys && data.camKeys.length > 1;
    controls.enabled = !api.lock && !camTween && (!play || (!!data.orbit && !camKeyed));
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
    sky.position.copy(camera.position);
    const post = (data.bloom || 0) > 0 || (data.ao || 0) > 0 || (G.contrast != null && G.contrast !== 1) || (G.saturation != null && G.saturation !== 1) || (G.vignette || 0) > 0 || (!!G.tint && G.tint !== '#ffffff');
    if (post) renderPost(); else renderer.render(scene, camera);
    updateSections();
    if (drift || camS || camKeyed || pz !== 1) { camera.position.copy(saved); camera.lookAt(controls.target); }
  }

  data.objects.forEach(build);
  if (play && data.playCam) goCam(data.playCam, true);
  if (play) startPhysics();
  startVars();
  frame();

  return Object.assign(api, {
    scene, camera, controls, pick, evalKeys,
    get(id) { const it = items.get(id); return it ? it.root : null; },
    add(o) { return build(o); },
    remove(id) { unbuild(id); },
    rebuild(o) { unbuild(o.id); return build(o); },
    redraw(o) { const it = items.get(o.id); if (it && it.canvas) drawText(it, o); },
    setPlay(v) {
      play = v; tlClock = 0; hovered = null; items.forEach((it) => { it.on = false; }); canvas.style.cursor = ''; camTween = null;
      if (v) startPhysics(); else { world = null; bodies = new Map(); }
      startVars(); keysDown.clear(); followHas = false; items.forEach((it) => { if (it.ctrl) it.ctrl.set(0, 0, 0); });
      if (v) { editView = { pos: camera.position.clone(), target: controls.target.clone() }; if (data.playCam) goCam(data.playCam, true); }
      else if (editView) { camera.position.copy(editView.pos); controls.target.copy(editView.target); editView = null; }
    },
    setView(c) { camera.position.fromArray(c.pos); controls.target.fromArray(c.target); },
    snapshot() { renderer.render(scene, camera); return canvas.toDataURL('image/jpeg', 0.6); },
    dispose() {
      cancelAnimationFrame(raf); ro.disconnect(); controls.dispose();
      canvas.removeEventListener('pointermove', onMove); canvas.removeEventListener('pointerdown', onDown);
      canvas.removeEventListener('pointerup', onUp); canvas.removeEventListener('pointerleave', onLeave);
      window.removeEventListener('keydown', onKey); window.removeEventListener('keyup', onKey); feeds.forEach(clearInterval); if (pad.el) pad.el.remove();
      Array.from(items.keys()).forEach(unbuild);
      floor.geometry.dispose(); floorMat.dispose(); sky.geometry.dispose(); skyMat.dispose(); pmrem.dispose(); if (finalComposer) { bloomComposer.dispose(); finalComposer.dispose(); } darkMat.dispose(); renderer.dispose();
    }
  });
}
