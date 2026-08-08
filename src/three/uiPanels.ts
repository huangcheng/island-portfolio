import * as THREE from 'three';
import { ThreeHTMLRenderer } from 'three-html-render/renderer';

interface Panel {
  el: HTMLElement;
  mesh: THREE.Mesh;
  /** Manual texture (polyfill mode only). */
  tex: THREE.CanvasTexture | null;
  /** Last captured innerHTML signature. */
  sig: string;
}

/**
 * Screen-space UI rendered INSIDE WebGL: HTML elements (children of the
 * `<canvas layoutsubtree>`) are captured into textures by three-html-render
 * (native HTML-in-Canvas fast-path where available, SVG foreignObject
 * polyfill everywhere else) and drawn on camera-anchored planes.
 * The real DOM elements are repositioned over the planes with matrix3d so
 * the browser handles hover / click / focus natively.
 *
 * Panels:
 *  - dialog (bottom-centre, pop-in animated)
 *  - hud    (top-left)
 *  - clock  (bottom-left) — discovered via `#clock` in the DOM so the
 *            Engine constructor signature stays unchanged.
 *
 * POLYFILL TEXTURE PATH (important — see AGENTS.md gotcha #7):
 * three.js's native HTMLTexture handling re-appends the element into the
 * canvas whenever it uploads, which fights the polyfill's host adoption and
 * breaks its MutationObserver → textures freeze at their first frame.
 * So under the polyfill we swap each panel's HTMLTexture for a plain
 * CanvasTexture and feed it ourselves via `canvas.captureElementImage(el)`
 * whenever the element's innerHTML changes (+ a slow heartbeat). The element
 * then stays in the polyfill host forever and everything updates live.
 * Under the NATIVE HTML-in-Canvas API we keep three.js's own path.
 */
export class UiPanels {
  private readonly html = new ThreeHTMLRenderer();
  private readonly dialogMesh: THREE.Mesh;
  private readonly hudMesh: THREE.Mesh;
  private readonly planeGeo = new THREE.PlaneGeometry(1, 1);
  private readonly dialogBaseScale = new THREE.Vector3(1, 1, 1);
  /** 0..1 progress of the AC-style dialog pop-in; 1 = settled. */
  private popT = 1;

  private readonly panels: Panel[] = [];
  private readonly dialogPanel: Panel;
  private readonly hudPanel: Panel;
  private clockPanel: Panel | null = null;

  private readonly useManualTextures: boolean;
  private frame = 0;

  private readonly PANEL_DIST = 6;
  /** Force a re-capture at most once per this many frames. */
  private readonly HEARTBEAT_FRAMES = 120;

  constructor(
    private renderer: THREE.WebGLRenderer,
    private camera: THREE.PerspectiveCamera,
    dialogEl: HTMLElement,
    hudEl: HTMLElement,
  ) {
    this.useManualTextures = !!(window as unknown as Record<string, unknown>).__HTML_IN_CANVAS_POLYFILL__;

    const makeMat = () =>
      new THREE.MeshBasicMaterial({
        transparent: true,
        toneMapped: false,
        depthTest: false,
        depthWrite: false,
      });

    this.hudMesh = new THREE.Mesh(this.planeGeo, makeMat());
    this.hudMesh.renderOrder = 998;
    this.hudMesh.frustumCulled = false;

    this.dialogMesh = new THREE.Mesh(this.planeGeo, makeMat());
    this.dialogMesh.renderOrder = 999;
    this.dialogMesh.frustumCulled = false;
    this.dialogMesh.visible = false;

    camera.add(this.hudMesh, this.dialogMesh);

    this.html.connect(renderer.domElement, camera, renderer);
    this.html.addObject(hudEl, this.hudMesh);
    this.html.addObject(dialogEl, this.dialogMesh);

    this.hudPanel = { el: hudEl, mesh: this.hudMesh, tex: null, sig: '' };
    this.dialogPanel = { el: dialogEl, mesh: this.dialogMesh, tex: null, sig: '' };
    this.panels.push(this.hudPanel, this.dialogPanel);

    // Clock panel: self-discovered so engine.ts need not change. React
    // renders `#clock` as a sibling of #hud / #dialog-panel in the same
    // commit, so it already exists (possibly reparented by the polyfill
    // into its host overlay) by the time Engine is constructed here.
    const clockEl = document.getElementById('clock');
    if (clockEl) {
      const clockMesh = new THREE.Mesh(this.planeGeo, makeMat());
      clockMesh.renderOrder = 998;
      clockMesh.frustumCulled = false;
      camera.add(clockMesh);
      this.html.addObject(clockEl, clockMesh);
      this.clockPanel = { el: clockEl, mesh: clockMesh, tex: null, sig: '' };
      this.panels.push(this.clockPanel);
    }

    // Under the polyfill, take over texture feeding entirely (see header).
    if (this.useManualTextures) {
      for (const p of this.panels) this.initManualTexture(p);
    }

    this.layout();

    // Re-fit the planes whenever the HTML content changes size
    const ro = new ResizeObserver(() => this.layout());
    for (const p of this.panels) ro.observe(p.el);
  }

  setDialogVisible(v: boolean) {
    this.dialogMesh.visible = v;
    this.dialogPanel.el.style.pointerEvents = v ? 'auto' : 'none';
    if (v) {
      this.popT = 0;
      this.dialogPanel.sig = ''; // force a fresh capture for the new content
    }
  }

  /**
   * Give the panel a CanvasTexture we drive ourselves, and pre-seed
   * three-html-render's texture registry with it. Without the pre-seed, its
   * paint-driven `_uploadTextures` would create a native THREE.HTMLTexture,
   * assign it as the mesh's map, and three.js's upload path would then
   * re-append the element into the <canvas> — out of the polyfill's observed
   * host, freezing all future texture updates.
   */
  private initManualTexture(p: Panel) {
    const placeholder = document.createElement('canvas');
    placeholder.width = placeholder.height = 2;
    const tex = new THREE.CanvasTexture(placeholder);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.generateMipmaps = false;
    tex.minFilter = THREE.LinearFilter;
    p.tex = tex;
    const mat = p.mesh.material as THREE.MeshBasicMaterial;
    mat.map = tex;
    mat.needsUpdate = true;
    const registry = (this.html as unknown as { _textures: WeakMap<HTMLElement, THREE.Texture> })._textures;
    registry.set(p.el, tex);
  }

  /** Re-capture a panel's element into its CanvasTexture when it changed. */
  private refreshPanel(p: Panel, force: boolean) {
    if (!p.tex) return;
    if (!p.mesh.visible) return;
    const sig = p.el.innerHTML;
    if (!force && sig === p.sig) return;
    const capture = (this.renderer.domElement as HTMLCanvasElement & {
      captureElementImage?: (el: HTMLElement) => HTMLCanvasElement;
    }).captureElementImage;
    if (!capture) return;
    try {
      const snap = capture.call(this.renderer.domElement, p.el);
      if (snap && snap.width > 1 && snap.height > 1) {
        p.tex.image = snap;
        p.tex.needsUpdate = true;
        p.sig = sig;
      }
    } catch {
      // No snapshot recorded yet — retry next frame (sig intentionally stale).
    }
  }

  /** Per-frame: sync DOM overlays + upload changed textures. */
  update(dt: number) {
    this.frame++;
    if (this.popT < 1 && this.dialogMesh.visible) {
      this.popT = Math.min(1, this.popT + dt * 3.4);
      // easeOutBack — the classic AC dialog boing
      const c1 = 1.70158;
      const c3 = c1 + 1;
      const t = this.popT - 1;
      const k = 1 + c3 * t * t * t + c1 * t * t;
      this.dialogMesh.scale.copy(this.dialogBaseScale).multiplyScalar(Math.max(0.0001, k));
    }

    if (this.useManualTextures) {
      const heartbeat = this.frame % this.HEARTBEAT_FRAMES === 0;
      for (const p of this.panels) {
        this.refreshPanel(p, heartbeat);
      }
    }

    this.html.update();
  }

  /** Recompute plane sizes/positions from camera frustum + element px size. */
  layout() {
    const canvas = this.renderer.domElement;
    const aspect = canvas.clientWidth / Math.max(1, canvas.clientHeight);
    const visibleH = 2 * this.PANEL_DIST * Math.tan(THREE.MathUtils.degToRad(this.camera.fov / 2));
    const visibleW = visibleH * aspect;
    const z = -this.PANEL_DIST;

    // Dialog: bottom-centre sheet, capped to fit the viewport
    const dw = this.dialogPanel.el.offsetWidth || 1000;
    const dh = this.dialogPanel.el.offsetHeight || 300;
    let dialogW = Math.min(visibleW * 0.74, 4.9);
    let dialogH = (dialogW * dh) / dw;
    const maxH = visibleH * 0.78;
    if (dialogH > maxH) {
      dialogH = maxH;
      dialogW = (dialogH * dw) / dh;
    }
    this.dialogBaseScale.set(dialogW, dialogH, 1);
    if (this.popT >= 1) this.dialogMesh.scale.copy(this.dialogBaseScale);
    this.dialogMesh.position.set(0, -visibleH / 2 + dialogH / 2 + 0.22, z);

    // HUD: top-left pill
    const hw = this.hudPanel.el.offsetWidth || 700;
    const hh = this.hudPanel.el.offsetHeight || 90;
    const hudW = Math.min(visibleW * 0.46, 3.3);
    const hudH = (hudW * hh) / hw;
    this.hudMesh.scale.set(hudW, hudH, 1);
    this.hudMesh.position.set(-visibleW / 2 + hudW / 2 + 0.18, visibleH / 2 - hudH / 2 - 0.18, z);

    // Clock: bottom-left pill (mirrors the HUD math on the opposite edge)
    if (this.clockPanel) {
      const cw = this.clockPanel.el.offsetWidth || 300;
      const ch = this.clockPanel.el.offsetHeight || 70;
      const clockW = Math.min(visibleW * 0.22, 1.7);
      const clockH = (clockW * ch) / cw;
      this.clockPanel.mesh.scale.set(clockW, clockH, 1);
      this.clockPanel.mesh.position.set(
        -visibleW / 2 + clockW / 2 + 0.18,
        -visibleH / 2 + clockH / 2 + 0.18,
        z,
      );
    }
  }
}
