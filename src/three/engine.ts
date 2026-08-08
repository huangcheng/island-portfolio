import * as THREE from 'three';
import { buildIsland, type InteractPoint, type IslandBuild } from './island';
import { buildInterior, type InteriorBuild } from './interiors';
import { Villager } from './villager';
import { Controls } from './controls';
import { Interactions } from './interactions';
import { UiPanels } from './uiPanels';

type Handler = (payload?: any) => void;

// ── Storybook-afternoon palette ─────────────────────────────────────────────
// Sky gradient stops (sRGB hex; THREE.Color converts them to linear for us).
const SKY_HORIZON = new THREE.Color(0xffe9c9); // warm cream
const SKY_MID = new THREE.Color(0xa8dcf0); // soft cyan
const SKY_ZENITH = new THREE.Color(0x6ec3f0); // clear blue
const SUN_GLOW = new THREE.Color(0xfff1c9); // warm radial highlight
// Sun lives in the same direction the key light shines FROM, so the visible
// glow matches the shadow-casting light.
const SUN_OFFSET = new THREE.Vector3(13, 15, 9);
const SUN_DIR = SUN_OFFSET.clone().normalize();
// Fog tuned to a soft warm-neutral haze so the island edge melts into the
// sky. Leaning slightly off-pure-cyan bridges the cream horizon and the blue
// sea, killing the hard seam where fogged water meets the sky dome.
const FOG_COLOR = 0xdfe8e6;
const HAZE_COLOR = new THREE.Color(FOG_COLOR);

// ── Procedural sky shader ────────────────────────────────────────────────────
// Big inverted sphere centred on the camera. A three-stop vertical gradient
// (cream → cyan → blue) plus a soft, slowly breathing warm sun glow. Rendered
// first with depth writes off so every other object draws over it.
const SKY_VERT = /* glsl */ `
  varying vec3 vDir;
  void main() {
    // The dome is only translated (never rotated/scaled), so the normalised
    // local position == world-space direction from camera to that sky point.
    vDir = normalize(position);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const SKY_FRAG = /* glsl */ `
  uniform vec3 uHorizon;
  uniform vec3 uMid;
  uniform vec3 uZenith;
  uniform vec3 uSunDir;
  uniform vec3 uSunColor;
  uniform vec3 uHaze;
  uniform float uTime;
  varying vec3 vDir;

  void main() {
    vec3 dir = normalize(vDir);
    float y = dir.y;

    // Three-stop vertical gradient with overlapping smoothsteps for a soft,
    // film-like roll-off between bands.
    float t1 = smoothstep(0.0, 0.30, y);
    vec3 col = mix(uHorizon, uMid, t1);
    float t2 = smoothstep(0.22, 0.95, y);
    col = mix(col, uZenith, t2);

    // Just below the horizon, settle on a slightly dimmer cream so the seam
    // against the fogged sea reads as warm haze rather than a hard line.
    col = mix(col, uHorizon * 0.94, smoothstep(0.0, -0.18, y));

    // Soft haze band straddling the visible horizon: pulls the lower sky
    // toward the same tone the distant sea fogs out to, so the silhouette
    // edge reads as atmosphere instead of a hard sky/sea seam.
    float haze = (1.0 - smoothstep(-0.04, 0.14, y)) * 0.85;
    col = mix(col, uHaze, haze);

    // Warm sun glow — layered falloffs, gently breathing.
    float d = max(dot(dir, normalize(uSunDir)), 0.0);
    float breath = 0.82 + 0.18 * sin(uTime * 0.22);
    float core = pow(d, 7.0) * 0.55;
    float halo = pow(d, 2.4) * 0.20;
    col += uSunColor * (core + halo) * breath;

    // Colours live in linear space (uniforms were converted on set); encode to
    // the renderer's sRGB output ourselves. toneMapped is false on this
    // material so three won't touch the values again.
    col = pow(max(col, vec3(0.0)), vec3(0.4545));
    gl_FragColor = vec4(col, 1.0);
  }
`;

// ── Drifting petals / leaves ────────────────────────────────────────────────
interface Petal {
  bx: number;
  bz: number;
  phase: number;
  sway: number;
  swaySpd: number;
  fall: number;
  tumble: number;
  tumbleSpd: number;
}

const PETAL_COUNT = 34;
// Vertical band the petals recycle through (top -> bottom -> wrap to top).
const PETAL_TOP = 8.5;
const PETAL_BOTTOM = -0.5;
const PETAL_RANGE = PETAL_TOP - PETAL_BOTTOM;
const PETAL_PALETTE = [0xff9ec4, 0xffd98a, 0xfff3c0, 0xffb380, 0xc9a3ff, 0xffffff];

/** Soft round sprite drawn at runtime — no texture file needed. */
function makePetalTexture(): THREE.Texture {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const ctx = c.getContext('2d')!;
  const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 30);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.45, 'rgba(255,255,255,0.85)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 64, 64);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/**
 * Owns the renderer, scenes (island + interiors), loop and every world system.
 * All UI is WebGL-native (troika text + mesh panels) — zero DOM.
 */
export class Engine {
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene(); // the ISLAND scene
  private activeScene: THREE.Scene;
  private activeKind: 'island' | 'house' | 'museum' = 'island';
  private interiors = new Map<'house' | 'museum', InteriorBuild>();
  private islandReturnPos = new THREE.Vector3();
  private camera: THREE.PerspectiveCamera;
  private lastTime = 0;
  private started = false;
  private disposed = false;
  private frames = 0;
  private time = 0;

  private villager = new Villager();
  private controls: Controls;
  private interactions: Interactions;
  private ui: UiPanels;
  private island: IslandBuild;
  /** Cached PointLight co-located with each flame, for flicker modulation. */
  private flameLights: ({ light: THREE.PointLight; base: number } | null)[] = [];
  private dirLight: THREE.DirectionalLight;

  // Iris-wipe transition state (AC door animation)
  private iris: THREE.Mesh;
  private irisMat: THREE.ShaderMaterial;
  private irisAspect = 16 / 9;
  private transition: { phase: 'close' | 'open'; t: number; swap: () => void } | null = null;

  dialogOpen = false;
  exhibitOpen = false;

  // Atmosphere
  private sky: THREE.Mesh;
  private skyMat: THREE.ShaderMaterial;
  private petals: THREE.InstancedMesh;
  private petalMat: THREE.MeshBasicMaterial;
  private petalTex: THREE.Texture;
  private petalData: Petal[] = [];

  // Reusable temporaries (avoid per-frame allocation in the petal update).
  private _m4 = new THREE.Matrix4();
  private _q = new THREE.Quaternion();
  private _v3 = new THREE.Vector3();
  private _scale = new THREE.Vector3(1, 1, 1);
  private _euler = new THREE.Euler();

  private listeners = new Map<string, Set<Handler>>();

  constructor(private canvas: HTMLCanvasElement) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(canvas.clientWidth || window.innerWidth, canvas.clientHeight || window.innerHeight, false);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.renderer.toneMapping = THREE.NeutralToneMapping;
    this.renderer.toneMappingExposure = 1.12;

    // The sky dome fills the frame, so no flat background colour is needed.
    this.scene.background = null;
    this.scene.fog = new THREE.Fog(FOG_COLOR, 46, 132);

    this.camera = new THREE.PerspectiveCamera(36, 1, 0.1, 260);
    this.scene.add(this.camera); // required: UI planes are camera children

    // ── Procedural sky dome ──────────────────────────────────────────────────
    this.skyMat = new THREE.ShaderMaterial({
      uniforms: {
        uHorizon: { value: SKY_HORIZON },
        uMid: { value: SKY_MID },
        uZenith: { value: SKY_ZENITH },
        uSunDir: { value: SUN_DIR },
        uSunColor: { value: SUN_GLOW },
        uHaze: { value: HAZE_COLOR },
        uTime: { value: 0 },
      },
      vertexShader: SKY_VERT,
      fragmentShader: SKY_FRAG,
      side: THREE.BackSide,
      depthWrite: false,
      depthTest: false,
      fog: false,
      toneMapped: false,
    });
    this.sky = new THREE.Mesh(new THREE.SphereGeometry(200, 32, 16), this.skyMat);
    this.sky.renderOrder = -1000;
    this.sky.frustumCulled = false;
    this.scene.add(this.sky);

    // ── Lighting rig: warm afternoon on a pastel island ──────────────────────
    // Pastel sky/ground bounce — softer than before for a creamy fill.
    const hemi = new THREE.HemisphereLight(0xbfe3ff, 0x7ab84a, 0.92);

    // Warm key light from a low-ish afternoon angle; shadow box follows the
    // villager. normalBias lifts samples along the surface normal to kill
    // acne on the chunky props without the peter-panning a large depth bias
    // would introduce.
    this.dirLight = new THREE.DirectionalLight(0xfff2d9, 2.0);
    this.dirLight.position.copy(SUN_OFFSET);
    this.dirLight.castShadow = true;
    this.dirLight.shadow.mapSize.set(2048, 2048);
    this.dirLight.shadow.camera.left = -22;
    this.dirLight.shadow.camera.right = 22;
    this.dirLight.shadow.camera.top = 22;
    this.dirLight.shadow.camera.bottom = -22;
    this.dirLight.shadow.camera.near = 0.5;
    this.dirLight.shadow.camera.far = 70;
    this.dirLight.shadow.bias = -0.0002;
    this.dirLight.shadow.normalBias = 0.6;

    // Faint cool fill from the opposite side to open up shadowed faces.
    const fill = new THREE.DirectionalLight(0xbfd9ff, 0.35);
    fill.position.set(-13, 9, -7);

    this.scene.add(hemi, this.dirLight, this.dirLight.target, fill);

    // ── World ────────────────────────────────────────────────────────────────
    this.island = buildIsland();
    this.scene.add(this.island.group);

    // Cache each flame's co-located PointLight (sibling in its parent group)
    // so the flicker loop can modulate it without re-traversing per frame.
    this.flameLights = this.island.flames.map((f) => {
      const siblings = f.parent ? f.parent.children : [];
      const light = siblings.find((c) => c instanceof THREE.PointLight);
      return light ? { light, base: light.intensity } : null;
    });

    this.villager.position.set(0, 0, 3.2);
    this.scene.add(this.villager.group);

    // ── Floating petals / leaves ─────────────────────────────────────────────
    this.petalTex = makePetalTexture();
    this.petalMat = new THREE.MeshBasicMaterial({
      map: this.petalTex,
      transparent: true,
      opacity: 0.92,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    this.petals = new THREE.InstancedMesh(new THREE.PlaneGeometry(0.16, 0.11), this.petalMat, PETAL_COUNT);
    this.petals.frustumCulled = false;
    this.petals.renderOrder = 5;
    this.buildPetals();

    this.scene.add(this.petals);

    this.controls = new Controls(this.canvas, this.camera, this.villager, {
      walkSurface: this.island.walkSurface,
      colliders: this.island.colliders,
      bounds: { type: 'circle', r: 16.8 },
    });
    this.controls.snapCamera();

    this.interactions = new Interactions(this.island.points);
    this.interactions.onPrompt = (text) => this.ui.setPrompt(text);
    this.interactions.onInteract = (point) => this.handleInteract(point);

    this.ui = new UiPanels(this.renderer, this.camera);
    this.ui.onNavigate = (to) => this.emit('interact', to);
    this.ui.onExhibitClose = () => {
      this.exhibitOpen = false;
      this.controls.inputEnabled = !this.dialogOpen;
    };
    // UI raycast gets first claim on every click, even while a dialog is open
    this.controls.pickUi = (ndc) => this.ui.tryClick(ndc);

    // ── Iris wipe (AC door transition) — camera-child fullscreen shader quad ──
    this.irisMat = new THREE.ShaderMaterial({
      uniforms: { uRadius: { value: 2.0 }, uAspect: { value: 16 / 9 } },
      vertexShader: /* glsl */ `
        varying vec2 vUv;
        void main() {
          vUv = position.xy;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: /* glsl */ `
        uniform float uRadius;
        uniform float uAspect;
        varying vec2 vUv;
        void main() {
          float d = length(vec2(vUv.x * uAspect, vUv.y));
          if (d < uRadius) discard;
          gl_FragColor = vec4(0.015, 0.01, 0.02, 1.0);
        }
      `,
      depthTest: false,
      depthWrite: false,
    });
    this.iris = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.irisMat);
    this.iris.renderOrder = 2000;
    this.iris.frustumCulled = false;
    this.iris.visible = false;
    this.camera.add(this.iris);
    this.activeScene = this.scene;

    // Centre the sky on the camera before the first frame so there's no flash.
    this.sky.position.copy(this.camera.position);

    window.addEventListener('resize', this.onResize);
    window.addEventListener('keydown', this.onKeyDown);
    this.onResize();
  }

  /** Seed petal instances with random positions/phase within a ~30 unit box. */
  private buildPetals() {
    const col = new THREE.Color();
    for (let i = 0; i < PETAL_COUNT; i++) {
      const data: Petal = {
        bx: (Math.random() - 0.5) * 30,
        bz: (Math.random() - 0.5) * 30,
        phase: Math.random() * Math.PI * 2,
        sway: 1.1 + Math.random() * 2.3,
        swaySpd: 0.18 + Math.random() * 0.26,
        fall: 0.35 + Math.random() * 0.4,
        tumble: Math.random() * Math.PI * 2,
        tumbleSpd: (Math.random() - 0.5) * 1.3,
      };
      this.petalData.push(data);
      col.setHex(PETAL_PALETTE[i % PETAL_PALETTE.length]);
      this.petals.setColorAt(i, col);
      // Place at a spread altitude straight away.
      const y = PETAL_TOP - ((data.phase / (Math.PI * 2)) * PETAL_RANGE) % PETAL_RANGE;
      this._v3.set(data.bx, y, data.bz);
      this._euler.set(data.tumble, data.phase, 0, 'XYZ');
      this._q.setFromEuler(this._euler);
      // Two size groups: smaller blossom petals vs larger leaf-ish ones.
      const sc = i % 2 === 0 ? 1.0 : 1.35;
      this._scale.set(sc, sc, sc);
      this._m4.compose(this._v3, this._q, this._scale);
      this.petals.setMatrixAt(i, this._m4);
    }
    this.petals.instanceMatrix.needsUpdate = true;
    if (this.petals.instanceColor) this.petals.instanceColor.needsUpdate = true;
  }

  on(event: 'ready' | 'prompt' | 'interact', cb: Handler): () => void {
    let set = this.listeners.get(event);
    if (!set) {
      set = new Set();
      this.listeners.set(event, set);
    }
    set.add(cb);
    return () => set.delete(cb);
  }

  private emit(event: string, payload?: unknown) {
    this.listeners.get(event)?.forEach((cb) => (cb as (p?: unknown) => void)(payload));
  }

  setRoute(path: string) {
    this.dialogOpen = path !== '/';
    this.controls.inputEnabled = !this.dialogOpen && !this.exhibitOpen && !this.transition;
    this.ui.showRoute(path);
  }

  /** Route an interact point: exit / enter / exhibit / route-navigate. */
  private handleInteract(point: InteractPoint) {
    if (this.transition) return;
    if (point.exit) {
      this.exitInterior();
      return;
    }
    if (point.enterTo) {
      this.enterInterior(point.enterTo);
      return;
    }
    if (point.exhibit) {
      this.exhibitOpen = true;
      this.controls.inputEnabled = false;
      this.ui.showExhibit(point.exhibit);
      return;
    }
    if (point.route) this.emit('interact', point.route);
  }

  /** Escape key: close exhibit → close route dialog → nothing. */
  onEscape() {
    if (this.transition) return;
    if (this.exhibitOpen) {
      this.ui.showExhibit(null);
      this.exhibitOpen = false;
      this.controls.inputEnabled = !this.dialogOpen;
      return;
    }
    if (this.dialogOpen) this.emit('interact', '/');
  }

  private startSceneTransition(swap: () => void) {
    if (this.transition) return;
    this.transition = { phase: 'close', t: 0, swap };
    this.iris.visible = true;
    this.controls.inputEnabled = false;
  }

  private enterInterior(kind: 'house' | 'museum') {
    this.islandReturnPos.copy(this.villager.position);
    this.startSceneTransition(() => this.applyInterior(kind));
  }

  private exitInterior() {
    if (this.activeKind === 'island') return;
    this.startSceneTransition(() => {
      this.scene.add(this.villager.group);
      this.scene.add(this.camera);
      this.activeScene = this.scene;
      this.activeKind = 'island';
      this.villager.position.set(this.islandReturnPos.x, 0, this.islandReturnPos.z);
      // Face back toward the island centre
      this.villager.heading = Math.atan2(-this.islandReturnPos.x, -this.islandReturnPos.z);
      this.villager.group.rotation.y = this.villager.heading;
      this.controls.setEnvironment({
        walkSurface: this.island.walkSurface,
        colliders: this.island.colliders,
        bounds: { type: 'circle', r: 16.8 },
      });
      this.controls.snapCamera();
      this.interactions.setPoints(this.island.points);
    });
  }

  private applyInterior(kind: 'house' | 'museum') {
    let build = this.interiors.get(kind);
    if (!build) {
      build = buildInterior(kind);
      this.interiors.set(kind, build);
    }
    // Scenes own objects — add() reparents the villager + camera (which
    // carries the UI panels + iris) into the interior scene.
    build.scene.add(this.villager.group);
    build.scene.add(this.camera);
    this.activeScene = build.scene;
    this.activeKind = kind;
    this.villager.position.copy(build.spawn);
    this.villager.position.y = 0;
    this.villager.heading = Math.PI; // face into the room
    this.villager.group.rotation.y = Math.PI;
    this.controls.setEnvironment({
      walkSurface: build.walkSurface,
      colliders: build.colliders,
      bounds: { type: 'box', ...build.bounds },
    });
    this.controls.snapCamera();
    this.interactions.setPoints(build.points);
  }

  start() {
    if (this.started) return;
    this.started = true;
    this.lastTime = performance.now();
    this.renderer.setAnimationLoop(this.tick);
  }

  private onKeyDown = (e: KeyboardEvent) => {
    if (e.code === 'KeyE' && !this.dialogOpen && !this.exhibitOpen && !this.transition) {
      this.interactions.interactNearest();
    }
  };

  private onResize = () => {
    const w = this.canvas.clientWidth || window.innerWidth;
    const h = this.canvas.clientHeight || window.innerHeight;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h, false);
    this.ui.layout();
    // Keep the iris quad covering the viewport
    const halfH = 6 * Math.tan(THREE.MathUtils.degToRad(this.camera.fov / 2));
    const halfW = halfH * this.camera.aspect;
    this.iris.scale.set(halfW, halfH, 1);
    this.iris.position.z = -6;
    this.irisAspect = this.camera.aspect;
    this.irisMat.uniforms.uAspect.value = this.camera.aspect;
  };

  private tick = () => {
    if (this.disposed) return;
    const now = performance.now();
    const dt = Math.min((now - this.lastTime) / 1000, 0.05);
    this.lastTime = now;
    this.time += dt;

    const moving = this.controls.update(dt, false);
    this.villager.update(dt, moving);
    this.interactions.update(this.villager.position, this.time);

    // Iris-wipe transition animation (closes → swaps scene → opens)
    if (this.transition) {
      const tr = this.transition;
      tr.t += dt * 2.6;
      const maxR = Math.hypot(this.irisAspect, 1) * 1.06;
      const k = Math.min(1, tr.t);
      const e = k * k * (3 - 2 * k); // smoothstep
      if (tr.phase === 'close') {
        this.irisMat.uniforms.uRadius.value = maxR * (1 - e);
        if (k >= 1) {
          tr.swap();
          tr.phase = 'open';
          tr.t = 0;
        }
      } else {
        this.irisMat.uniforms.uRadius.value = maxR * e;
        if (k >= 1) {
          this.iris.visible = false;
          this.transition = null;
          this.controls.inputEnabled = !this.dialogOpen && !this.exhibitOpen;
        }
      }
    }

    // Island-only world systems (frozen while inside interiors)
    if (this.activeKind === 'island') {
      // Keep the sky centred on the camera so it reads as infinitely far away.
      this.sky.position.copy(this.camera.position);
      this.skyMat.uniforms.uTime.value = this.time;

      // Clouds drift around the island
      for (const c of this.island.clouds) {
        const u = c.userData as { angle: number; radius: number; speed: number; y: number };
        u.angle += u.speed * dt;
        c.position.set(Math.cos(u.angle) * u.radius, u.y, Math.sin(u.angle) * u.radius);
      }

      // Seagulls orbit the island and flap
      for (const g of ((this.island as { gulls?: THREE.Group[] }).gulls ?? [])) {
        const u = g.userData as {
          angle: number;
          radius: number;
          speed: number;
          y: number;
          wingL?: THREE.Group;
          wingR?: THREE.Group;
          phase?: number;
        };
        u.angle += u.speed * dt;
        const ph = u.phase ?? u.angle;
        g.position.set(
          Math.cos(u.angle) * u.radius,
          u.y + Math.sin(this.time * 1.3 + ph) * 0.3,
          Math.sin(u.angle) * u.radius,
        );
        g.rotation.y = -u.angle;
        const flap = Math.sin(this.time * 6 + ph) * 0.5;
        if (u.wingL) u.wingL.rotation.z = flap;
        if (u.wingR) u.wingR.rotation.z = -flap;
      }
      // Sea foam breathing
      this.island.foam.forEach((ring, i) => {
        const s = 1 + Math.sin(this.time * 0.7 + i * 1.7) * 0.022;
        ring.scale.set(s, s, 1);
        (ring.material as THREE.MeshBasicMaterial).opacity = 0.4 + Math.sin(this.time * 0.7 + i * 1.7) * 0.18;
      });

      // Campfire / torch flames flicker
      this.island.flames.forEach((f, i) => {
        const s = 1 + Math.sin(this.time * 11 + i * 1.9) * 0.16 + Math.sin(this.time * 23 + i) * 0.06;
        f.scale.set(1 / Math.sqrt(s), s, 1 / Math.sqrt(s)); // volume-ish preserving lick
        f.rotation.y += dt * (2 + i * 0.3);
        const fl = this.flameLights[i];
        if (fl) {
          const flick = Math.sin(this.time * 11 + i * 1.9) * 0.14 + Math.sin(this.time * 23 + i) * 0.06;
          fl.light.intensity = fl.base * (1 + flick);
        }
      });

      // Wave crests bob + shimmer on the water
      this.island.waves.forEach((w, i) => {
        const ph = i * 1.37;
        w.position.y = -1.06 + Math.sin(this.time * 1.3 + ph) * 0.045;
        (w.material as THREE.MeshBasicMaterial).opacity = 0.26 + 0.2 * (0.5 + 0.5 * Math.sin(this.time * 0.8 + ph * 2.3));
      });

      // Water shader time
      (this.island.sea.material as THREE.ShaderMaterial).uniforms.uTime.value = this.time;

      // Butterflies: lissajous wander around their flower bed + wing flap
      this.island.butterflies.forEach((b) => {
        const t = this.time * 1 + b.phase;
        const vx = Math.cos(t * 0.5) * 0.65;
        const vz = -Math.sin(t * 0.37) * 0.48;
        b.group.position.set(
          b.anchor.x + Math.sin(t * 0.5) * 1.3,
          0.95 + Math.sin(t * 1.4) * 0.28,
          b.anchor.z + Math.cos(t * 0.37) * 1.3,
        );
        b.group.rotation.y = Math.atan2(vx, vz);
        const flap = Math.sin(t * 15) * 0.95;
        b.wingL.rotation.z = flap;
        b.wingR.rotation.z = -flap;
      });

      // Floating petals: sinusoidal sway + slow downward drift that wraps
      const t = this.time;
      for (let i = 0; i < this.petalData.length; i++) {
        const d = this.petalData[i];
        const x = d.bx + Math.sin(t * d.swaySpd + d.phase) * d.sway;
        const z = d.bz + Math.cos(t * d.swaySpd * 0.9 + d.phase * 1.3) * d.sway;
        const progress = (t * d.fall + d.phase * 2.1) % PETAL_RANGE;
        const y = PETAL_TOP - progress;
        this._v3.set(x, y, z);
        this._euler.set(d.tumble + t * d.tumbleSpd, d.phase + t * d.tumbleSpd * 0.6, Math.sin(t * 0.8 + d.phase) * 0.5, 'XYZ');
        this._q.setFromEuler(this._euler);
        const sc = i % 2 === 0 ? 1.0 : 1.35;
        this._scale.set(sc, sc, sc);
        this._m4.compose(this._v3, this._q, this._scale);
        this.petals.setMatrixAt(i, this._m4);
      }
      this.petals.instanceMatrix.needsUpdate = true;

      // Keep the shadow box centred on the villager
      this.dirLight.position.set(this.villager.position.x + SUN_OFFSET.x, SUN_OFFSET.y, this.villager.position.z + SUN_OFFSET.z);
      this.dirLight.target.position.copy(this.villager.position);
    }

    this.ui.update(dt);
    this.renderer.render(this.activeScene, this.camera);

    this.frames++;
    if (this.frames === 3) this.emit('ready');
  };

  dispose() {
    this.disposed = true;
    this.renderer.setAnimationLoop(null);
    window.removeEventListener('resize', this.onResize);
    window.removeEventListener('keydown', this.onKeyDown);
    this.controls.dispose();
    this.interactions.dispose();
    this.ui.dispose();

    // Atmosphere resources
    this.sky.geometry.dispose();
    this.skyMat.dispose();
    this.petals.geometry.dispose();
    this.petalMat.dispose();
    this.petalTex.dispose();

    this.renderer.dispose();
  }
}
