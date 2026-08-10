import * as THREE from 'three';
import { ACTIVE } from './islands';
import { makeSeaplane } from './kit/props';
import type { InteractPoint, IslandBuild } from './kit/types';
import { buildInterior, type InteriorBuild } from './interiors';
import { Villager } from './villager';
import { Controls } from './controls';
import { Interactions } from './interactions';
import { UiPanels } from './uiPanels';
import { setUiTheme } from './uiKit';
import { DESTINATIONS } from '../site';
import type { IslandTheme, SkyState } from './theme';

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

// ── Real-time day/night (AC-style time sync) ───────────────────────────────
interface DayStop {
  h: number;
  horizon: number;
  mid: number;
  zenith: number;
  fog: number;
  sun: number; // key light colour
  sunI: number;
  hemiI: number;
  exposure: number;
  night: number; // 0 day → 1 full night
}
/** Sky stops per time slot, colours pulled from the active island's theme. */
function buildDayStops(sky: IslandTheme['sky']): DayStop[] {
  const s = (state: SkyState) => ({ horizon: state.horizon, mid: state.mid, zenith: state.zenith, fog: state.fog });
  return [
    { h: 0.0, ...s(sky.night), sun: 0xb8c8f0, sunI: 0.22, hemiI: 0.22, exposure: 0.9, night: 1.0 },
    { h: 4.5, ...s(sky.night), sun: 0xb8c8f0, sunI: 0.22, hemiI: 0.22, exposure: 0.9, night: 1.0 },
    { h: 6.0, ...s(sky.dawn), sun: 0xffb56b, sunI: 1.3, hemiI: 0.65, exposure: 1.06, night: 0.3 },
    { h: 8.0, ...s(sky.day), sun: 0xfff2d9, sunI: 2.0, hemiI: 0.92, exposure: 1.12, night: 0.0 },
    { h: 16.5, ...s(sky.day), sun: 0xfff2d9, sunI: 2.0, hemiI: 0.92, exposure: 1.12, night: 0.0 },
    { h: 18.0, ...s(sky.sunset), sun: 0xff9a4a, sunI: 1.7, hemiI: 0.6, exposure: 1.08, night: 0.15 },
    { h: 19.5, ...s(sky.dusk), sun: 0xd8908a, sunI: 0.8, hemiI: 0.45, exposure: 1.0, night: 0.65 },
    { h: 20.5, ...s(sky.night), sun: 0xb8c8f0, sunI: 0.22, hemiI: 0.22, exposure: 0.9, night: 1.0 },
    { h: 24.0, ...s(sky.night), sun: 0xb8c8f0, sunI: 0.22, hemiI: 0.22, exposure: 0.9, night: 1.0 },
  ];
}

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
  uniform vec3 uMoonDir;
  uniform float uNight;
  uniform float uTime;
  varying vec3 vDir;

  float hash21(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }

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

    // Soft haze band straddling the visible horizon.
    float haze = (1.0 - smoothstep(-0.04, 0.14, y)) * 0.85;
    col = mix(col, uHaze, haze);

    // Warm sun glow — layered falloffs, gently breathing.
    float d = max(dot(dir, normalize(uSunDir)), 0.0);
    float breath = 0.82 + 0.18 * sin(uTime * 0.22);
    float core = pow(d, 7.0) * 0.55;
    float halo = pow(d, 2.4) * 0.20;
    col += uSunColor * (core + halo) * breath * (1.0 - uNight);

    // Moon — soft bright disc + cool halo, night only
    float md = max(dot(dir, normalize(uMoonDir)), 0.0);
    float moonDisc = smoothstep(0.9991, 0.9996, md);
    float moonGlow = pow(md, 55.0) * 0.32;
    col += (vec3(0.99, 0.97, 0.88) * moonDisc + vec3(0.72, 0.78, 0.95) * moonGlow) * uNight;

    // Stars — twinkling points jittered inside sky cells, night only
    vec2 sp = vec2(atan(dir.x, dir.z) * 57.2958 * 2.2, y * 90.0);
    vec2 cell = floor(sp);
    float h = hash21(cell);
    if (h > 0.62) {
      vec2 fp = fract(sp);
      vec2 starPos = vec2(hash21(cell + 1.7), hash21(cell + 4.3)) * 0.6 + 0.2;
      float sd = length(fp - starPos);
      float twinkle = 0.5 + 0.5 * sin(uTime * 2.4 + h * 61.0);
      float star = smoothstep(0.09, 0.02, sd) * twinkle;
      col += vec3(1.0, 0.98, 0.92) * star * uNight * smoothstep(0.02, 0.18, y);
    }

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

// Vertical band the petals recycle through (top -> bottom -> wrap to top).
const PETAL_TOP = 8.5;
const PETAL_BOTTOM = -0.5;
const PETAL_RANGE = PETAL_TOP - PETAL_BOTTOM;

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
  private hemi: THREE.HemisphereLight;
  /** Current key-light offset (sun by day, moon by night) — set by updateDayNight. */
  private lightOffset = SUN_OFFSET.clone();
  private nightFactor = 0;
  private _cB = new THREE.Color();

  // Iris-wipe transition state (AC door animation)
  private iris: THREE.Mesh;
  private irisMat: THREE.ShaderMaterial;
  private irisAspect = 16 / 9;
  private transition: {
    phase: 'close' | 'open';
    t: number;
    swap: () => void;
    onClosed?: () => void;
    flyGroup?: THREE.Group;
  } | null = null;

  dialogOpen = false;
  exhibitOpen = false;
  boardOpen = false;

  // Atmosphere
  private sky: THREE.Mesh;
  private skyMat: THREE.ShaderMaterial;
  private petals: THREE.InstancedMesh;
  private petalMat: THREE.MeshBasicMaterial;
  private petalTex: THREE.Texture;
  private petalData: Petal[] = [];
  private petalPalette: number[];
  /** Day/night stops, colours from the active island's theme. */
  private dayStops = buildDayStops(ACTIVE.theme.sky);

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
        uMoonDir: { value: new THREE.Vector3(-0.5, 0.55, -0.65).normalize() },
        uNight: { value: 0 },
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

    // ── Lighting rig: time-of-day driven (real-time sync, AC style) ─────────
    this.hemi = new THREE.HemisphereLight(0xbfe3ff, 0x7ab84a, 0.92);

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

    this.scene.add(this.hemi, this.dirLight, this.dirLight.target, fill);

    // ── World ────────────────────────────────────────────────────────────────
    setUiTheme(ACTIVE.theme.ui);
    this.island = ACTIVE.build();
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
    const pc = ACTIVE.theme.particles;
    this.petalPalette = pc.palette;
    this.petalTex = makePetalTexture();
    this.petalMat = new THREE.MeshBasicMaterial({
      map: this.petalTex,
      transparent: true,
      opacity: 0.92,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    this.petals = new THREE.InstancedMesh(new THREE.PlaneGeometry(0.16, 0.11), this.petalMat, pc.count);
    this.petals.frustumCulled = false;
    this.petals.renderOrder = 5;
    this.buildPetals();

    this.scene.add(this.petals);

    this.controls = new Controls(this.canvas, this.camera, this.villager, {
      walkSurface: this.island.walkSurface,
      extraWalkSurfaces: this.island.extraWalkSurfaces,
      colliders: this.island.colliders,
      bounds: { type: 'circle', r: 16.8 },
      walkZones: this.island.walkZones,
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
    this.ui.onBoardClose = () => {
      this.boardOpen = false;
      this.controls.inputEnabled = !this.dialogOpen && !this.exhibitOpen;
    };
    this.ui.onDepart = (url) => this.flyAway(url);
    // UI raycast gets first claim on every click, even while a dialog is open
    this.controls.pickUi = (ndc) => this.ui.tryClick(ndc);

    // ── Iris wipe (AC door transition) — camera-child fullscreen shader quad ──
    this.irisMat = new THREE.ShaderMaterial({
      uniforms: {
        uRadius: { value: 2.0 },
        uAspect: { value: 16 / 9 },
        uTint: { value: new THREE.Color(0.015, 0.01, 0.02) },
      },
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
        uniform vec3 uTint;
        varying vec2 vUv;
        void main() {
          float d = length(vec2(vUv.x * uAspect, vUv.y));
          if (d < uRadius) discard;
          gl_FragColor = vec4(uTint, 1.0);
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
    this.updateDayNight();

    window.addEventListener('resize', this.onResize);
    window.addEventListener('keydown', this.onKeyDown);
    this.onResize();
  }

  /** Seed petal instances with random positions/phase within a ~30 unit box. */
  private buildPetals() {
    const col = new THREE.Color();
    for (let i = 0; i < this.petals.count; i++) {
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
      col.setHex(this.petalPalette[i % this.petalPalette.length]);
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

  /** Route an interact point: exit / enter / exhibit / airport / route. */
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
    if (point.airport) {
      this.boardOpen = true;
      this.controls.inputEnabled = false;
      this.ui.showFlightBoard(DESTINATIONS);
      return;
    }
    if (point.route) this.emit('interact', point.route);
  }

  /** Escape key: close board → close exhibit → close route dialog → nothing. */
  onEscape() {
    if (this.transition) return;
    if (this.boardOpen) {
      this.ui.showFlightBoard(null);
      this.boardOpen = false;
      this.controls.inputEnabled = true;
      return;
    }
    if (this.exhibitOpen) {
      this.ui.showExhibit(null);
      this.exhibitOpen = false;
      this.controls.inputEnabled = !this.dialogOpen;
      return;
    }
    if (this.dialogOpen) this.emit('interact', '/');
  }

  /** Dodo Airlines departure: seaplane sweeps across while the iris closes. */
  private flyAway(url: string) {
    if (this.transition) return;
    // Tint the iris toward the destination's palette chip (kept dark).
    const dest = DESTINATIONS.find((d) => d.url === url);
    if (dest) (this.irisMat.uniforms.uTint.value as THREE.Color).setHex(dest.chip).multiplyScalar(0.35);
    const plane = makeSeaplane();
    plane.scale.setScalar(0.85);
    plane.rotation.y = -Math.PI / 2; // nose left
    const halfW = 6 * Math.tan(THREE.MathUtils.degToRad(this.camera.fov / 2)) * this.irisAspect;
    plane.position.set(halfW + 3, -0.55, -6);
    this.camera.add(plane);
    this.startSceneTransition(() => {
      // page navigation happens in onClosed; if it fails, reopen cleanly
      this.camera.remove(plane);
    }, url, plane);
  }

  private startSceneTransition(swap: () => void, navigateTo?: string, flyGroup?: THREE.Group) {
    if (this.transition) return;
    this.transition = {
      phase: 'close',
      t: 0,
      swap,
      onClosed: navigateTo ? () => (window.location.href = navigateTo) : undefined,
      flyGroup,
    };
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
        extraWalkSurfaces: this.island.extraWalkSurfaces,
        colliders: this.island.colliders,
        bounds: { type: 'circle', r: 16.8 },
        walkZones: this.island.walkZones,
      });
      this.controls.snapCamera();
      this.interactions.setPoints(this.island.points);
    });
  }

  private applyInterior(kind: 'house' | 'museum') {
    let build = this.interiors.get(kind);
    if (!build) {
      build = buildInterior(kind, ACTIVE.theme.interior);
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

  /** Real-time day/night sync: lerp the sky/light palette by local clock. */
  private updateDayNight() {
    const now = new Date();
    const h = now.getHours() + now.getMinutes() / 60 + now.getSeconds() / 3600;

    let i = 0;
    while (i < this.dayStops.length - 2 && this.dayStops[i + 1].h < h) i++;
    const a = this.dayStops[i];
    const b = this.dayStops[i + 1];
    const k = THREE.MathUtils.smoothstep((h - a.h) / (b.h - a.h), 0, 1);
    const u = this.skyMat.uniforms;
    const lc = (ca: number, cb: number, target: THREE.Color) => {
      target.set(ca).lerp(this._cB.set(cb), k);
    };
    lc(a.horizon, b.horizon, u.uHorizon.value as THREE.Color);
    lc(a.mid, b.mid, u.uMid.value as THREE.Color);
    lc(a.zenith, b.zenith, u.uZenith.value as THREE.Color);
    lc(a.fog, b.fog, u.uHaze.value as THREE.Color);
    lc(a.fog, b.fog, (this.scene.fog as THREE.Fog).color);
    lc(a.sun, b.sun, u.uSunColor.value as THREE.Color);
    this.dirLight.color.copy(u.uSunColor.value as THREE.Color);
    this.dirLight.intensity = THREE.MathUtils.lerp(a.sunI, b.sunI, k);
    this.hemi.intensity = THREE.MathUtils.lerp(a.hemiI, b.hemiI, k);
    this.renderer.toneMappingExposure = THREE.MathUtils.lerp(a.exposure, b.exposure, k);

    this.nightFactor = THREE.MathUtils.lerp(a.night, b.night, k);
    u.uNight.value = this.nightFactor;

    // Sun rides east→west 6:00–18:00; the moon covers the night shift.
    const day = h >= 6 && h <= 18;
    const az = day ? (Math.PI * (h - 6)) / 12 : (Math.PI * ((h + 24 - 18) % 24)) / 12;
    const el = Math.sin(az);
    this.lightOffset.set(Math.cos(az) * 16, 3 + Math.max(0.12, el) * 13, 8);
    u.uSunDir.value.copy(this.lightOffset).normalize();
    if (!day) u.uMoonDir.value.copy(this.lightOffset).normalize();
  }

  private onKeyDown = (e: KeyboardEvent) => {
    if (e.code === 'KeyE' && !this.dialogOpen && !this.exhibitOpen && !this.boardOpen && !this.transition) {
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

      // Departure flyby: seaplane sweeps right→left across the view
      if (tr.flyGroup) {
        const kk = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2; // easeInOutQuad
        const halfW = 6 * Math.tan(THREE.MathUtils.degToRad(this.camera.fov / 2)) * this.irisAspect;
        tr.flyGroup.position.x = THREE.MathUtils.lerp(halfW + 3, -(halfW + 3), kk);
        tr.flyGroup.position.y = -0.55 + Math.sin(kk * Math.PI) * 0.55;
        tr.flyGroup.rotation.z = -0.1 - Math.sin(kk * Math.PI) * 0.12;
        const prop = tr.flyGroup.userData.prop as THREE.Group | undefined;
        if (prop) prop.rotation.z += dt * 28;
      }

      if (tr.phase === 'close') {
        this.irisMat.uniforms.uRadius.value = maxR * (1 - e);
        if (k >= 1) {
          tr.swap();
          tr.phase = 'open';
          tr.t = 0;
          if (tr.onClosed) tr.onClosed();
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
      this.updateDayNight();

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

      // Water shader time + night tint
      (this.island.sea.material as THREE.ShaderMaterial).uniforms.uTime.value = this.time;
      (this.island.sea.material as THREE.ShaderMaterial).uniforms.uNight.value = this.nightFactor;

      // Moored seaplane bobs on the water, prop idles
      this.island.seaplane.position.y = -0.82 + Math.sin(this.time * 0.85) * 0.05;
      this.island.seaplane.rotation.z = Math.sin(this.time * 0.6) * 0.03;
      const idleProp = this.island.seaplane.userData.prop as THREE.Group | undefined;
      if (idleProp) idleProp.rotation.z += dt * 3.5;

      // Bamboo / tall-grass sway (islands that provide sway groups).
      for (const g of this.island.sway ?? []) {
        g.rotation.z = Math.sin(this.time * 0.9 + (g.userData.phase ?? 0)) * 0.035;
      }

      // Unlit white accents dim to moonlit tones at night
      const dim = 1 - this.nightFactor * 0.72;
      this.island.foam.forEach((r) => (r.material as THREE.MeshBasicMaterial).color.setRGB(dim, dim, Math.min(1, dim * 1.1)));
      this.island.waves.forEach((w) => (w.material as THREE.MeshBasicMaterial).color.setRGB(dim, dim, Math.min(1, dim * 1.1)));
      this.petalMat.color.setScalar(dim);

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

      // Keep the shadow box centred on the villager (sun by day, moon by night)
      this.dirLight.position.set(this.villager.position.x + this.lightOffset.x, this.lightOffset.y, this.villager.position.z + this.lightOffset.z);
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
