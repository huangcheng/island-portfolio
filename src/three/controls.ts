import * as THREE from 'three';
import type { Villager } from './villager';
import type { Collider } from './island';

const MOVE_KEYS = new Set(['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight']);

/** Walk-area bounds: island circle OR interior box. */
export type WalkBounds =
  | { type: 'circle'; r: number }
  | { type: 'box'; minX: number; maxX: number; minZ: number; maxZ: number };

export interface Environment {
  walkSurface: THREE.Mesh;
  colliders: Collider[];
  bounds: WalkBounds;
}

/**
 * Keyboard (WASD / arrows) + pointer (click / tap-to-move) controls,
 * plus an isometric follow camera.
 */
export class Controls {
  /** Set false while a dialog is open to freeze the villager. */
  inputEnabled = true;

  private keys = new Set<string>();
  private clickTarget: THREE.Vector3 | null = null;
  private raycaster = new THREE.Raycaster();
  private ndc = new THREE.Vector2();
  private camTarget = new THREE.Vector3();
  private lookAt = new THREE.Vector3();
  private lookAtInit = false;

  /** Called when the ground is clicked (after interactable checks). */
  onGroundClick: (() => void) | null = null;
  /** Return true when a click hits an interactable sprite instead of the ground. */
  pickInteractable: ((ndc: THREE.Vector2) => boolean) | null = null;
  /** UI raycast gets FIRST claim on every click (works even while walking is gated). */
  pickUi: ((ndc: THREE.Vector2) => boolean) | null = null;

  /** AC:NH-style low follow camera (~33° above horizon — sky stays visible). */
  private readonly camOffset = new THREE.Vector3(0, 8.6, 12.6);

  private walkSurface: THREE.Mesh;
  private colliders: Collider[];
  private bounds: WalkBounds = { type: 'circle', r: 16.8 };

  constructor(
    private canvas: HTMLCanvasElement,
    private camera: THREE.PerspectiveCamera,
    private villager: Villager,
    env: Environment,
  ) {
    this.walkSurface = env.walkSurface;
    this.colliders = env.colliders;
    this.bounds = env.bounds;
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
    window.addEventListener('blur', this.onBlur);
    canvas.addEventListener('pointerdown', this.onPointerDown);
  }

  /** Swap the active environment (island ↔ interior scene). */
  setEnvironment(env: Environment) {
    this.walkSurface = env.walkSurface;
    this.colliders = env.colliders;
    this.bounds = env.bounds;
    this.clickTarget = null;
  }

  dispose() {
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
    window.removeEventListener('blur', this.onBlur);
    this.canvas.removeEventListener('pointerdown', this.onPointerDown);
  }

  private onKeyDown = (e: KeyboardEvent) => {
    if (!MOVE_KEYS.has(e.code)) return;
    if ((e.target as HTMLElement | null)?.closest?.('input, textarea, [contenteditable]')) return;
    e.preventDefault();
    this.keys.add(e.code);
  };

  private onKeyUp = (e: KeyboardEvent) => {
    this.keys.delete(e.code);
  };

  private onBlur = () => {
    this.keys.clear();
  };

  private onPointerDown = (e: PointerEvent) => {
    // Clicks that originate on in-canvas HTML UI must not move the villager.
    if (e.target !== this.canvas) return;

    const rect = this.canvas.getBoundingClientRect();
    this.ndc.set(((e.clientX - rect.left) / rect.width) * 2 - 1, -((e.clientY - rect.top) / rect.height) * 2 + 1);

    // 3D UI (dialog buttons etc.) always claims first
    if (this.pickUi?.(this.ndc)) return;
    if (!this.inputEnabled) return;
    if (this.pickInteractable?.(this.ndc)) return;

    this.raycaster.setFromCamera(this.ndc, this.camera);
    const hit = this.raycaster.intersectObject(this.walkSurface, false)[0];
    if (hit) {
      this.clickTarget = hit.point.clone();
      this.clickTarget.y = 0;
      this.onGroundClick?.();
    }
  };

  private keyVector(): { x: number; z: number } | null {
    let x = 0;
    let z = 0;
    if (this.keys.has('KeyW') || this.keys.has('ArrowUp')) z -= 1;
    if (this.keys.has('KeyS') || this.keys.has('ArrowDown')) z += 1;
    if (this.keys.has('KeyA') || this.keys.has('ArrowLeft')) x -= 1;
    if (this.keys.has('KeyD') || this.keys.has('ArrowRight')) x += 1;
    if (x === 0 && z === 0) return null;
    const len = Math.hypot(x, z);
    return { x: x / len, z: z / len };
  }

  /** Returns true while the villager is moving. */
  update(dt: number, cameraLocked: boolean): boolean {
    let moving = false;

    if (this.inputEnabled) {
      const kv = this.keyVector();
      if (kv) {
        this.clickTarget = null;
        this.villager.moveDirection(kv.x, kv.z, dt);
        moving = true;
      } else if (this.clickTarget) {
        if (this.villager.moveToward(this.clickTarget, dt)) {
          this.clickTarget = null;
        } else {
          moving = true;
        }
      }
    }

    // Resolve collisions + walk bounds
    const p = this.villager.position;
    for (const c of this.colliders) {
      const dx = p.x - c.x;
      const dz = p.z - c.z;
      const d = Math.hypot(dx, dz);
      const min = c.r + 0.42;
      if (d > 0.0001 && d < min) {
        p.x = c.x + (dx / d) * min;
        p.z = c.z + (dz / d) * min;
      }
    }
    if (this.bounds.type === 'circle') {
      const dist = Math.hypot(p.x, p.z);
      if (dist > this.bounds.r) {
        p.x = (p.x / dist) * this.bounds.r;
        p.z = (p.z / dist) * this.bounds.r;
      }
    } else {
      const b = this.bounds;
      p.x = Math.min(b.maxX, Math.max(b.minX, p.x));
      p.z = Math.min(b.maxZ, Math.max(b.minZ, p.z));
    }

    // Follow camera
    if (!cameraLocked) {
      this.camTarget.set(p.x + this.camOffset.x, this.camOffset.y, p.z + this.camOffset.z);
      const k = 1 - Math.exp(-3.4 * dt);
      this.camera.position.lerp(this.camTarget, k);
      // Indoors (box bounds) keep the camera INSIDE the room
      if (this.bounds.type === 'box') {
        const b = this.bounds;
        this.camera.position.x = Math.min(b.maxX - 0.8, Math.max(b.minX + 0.8, this.camera.position.x));
        this.camera.position.z = Math.min(b.maxZ - 0.6, Math.max(b.minZ + 0.8, this.camera.position.z));
      }
      if (!this.lookAtInit) {
        this.lookAt.copy(p);
        this.lookAtInit = true;
      } else {
        this.lookAt.lerp(new THREE.Vector3(p.x, 1.15, p.z), k);
      }
      this.camera.lookAt(this.lookAt);
    }

    return moving;
  }

  /** Snap the camera behind the villager immediately (used on boot). */
  snapCamera() {
    const p = this.villager.position;
    this.camera.position.set(p.x + this.camOffset.x, this.camOffset.y, p.z + this.camOffset.z);
    this.lookAt.set(p.x, 1.15, p.z);
    this.lookAtInit = true;
    this.camera.lookAt(this.lookAt);
  }
}
