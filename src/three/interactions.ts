import * as THREE from 'three';
import type { InteractPoint } from './island';

let markerTexture: THREE.CanvasTexture | null = null;

/** Draws the AC-style "!" emote bubble: cream speech bubble, soft curved
 *  tail, chunky rounded red "!" (shapes only — no font dependency). */
function getMarkerTexture(): THREE.CanvasTexture {
  if (markerTexture) return markerTexture;
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext('2d')!;
  ctx.clearRect(0, 0, 128, 128);

  const cream = '#fffef7';
  const edge = '#6b4f2a';
  const pop = '#e85a4a';

  // Soft drop shadow under the bubble
  ctx.fillStyle = 'rgba(60, 40, 20, 0.18)';
  ctx.beginPath();
  ctx.ellipse(66, 68, 42, 40, 0, 0, Math.PI * 2);
  ctx.fill();

  // Curved tail: two overlapping circles tapering to a point at bottom-left
  ctx.fillStyle = cream;
  ctx.strokeStyle = edge;
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.moveTo(46, 92);
  ctx.quadraticCurveTo(40, 110, 30, 118);
  ctx.quadraticCurveTo(48, 116, 58, 100);
  ctx.closePath();
  ctx.fill();

  // Main bubble (circle), stroked
  ctx.beginPath();
  ctx.arc(64, 58, 42, 0, Math.PI * 2);
  ctx.fillStyle = cream;
  ctx.fill();
  ctx.stroke();

  // Chunky rounded "!" — rounded bar + dot
  ctx.fillStyle = pop;
  ctx.beginPath();
  ctx.roundRect(56, 28, 16, 36, 8);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(64, 78, 9, 0, Math.PI * 2);
  ctx.fill();

  markerTexture = new THREE.CanvasTexture(canvas);
  markerTexture.colorSpace = THREE.SRGBColorSpace;
  return markerTexture;
}

interface MarkerEntry {
  point: InteractPoint;
  sprite: THREE.Sprite;
}

/**
 * Tracks proximity to interactable spots, shows floating "!" markers,
 * and emits interact intents (E key, or clicking the marker).
 * The active scene + points can be swapped (island ↔ interiors).
 */
export class Interactions {
  private entries: MarkerEntry[] = [];
  private sprites: THREE.Sprite[] = [];
  private raycaster = new THREE.Raycaster();
  private _nearest: InteractPoint | null = null;

  onPrompt: ((text: string | null) => void) | null = null;
  onInteract: ((point: InteractPoint) => void) | null = null;

  constructor(private scene: THREE.Scene, points: InteractPoint[]) {
    this.build(points);
  }

  private build(points: InteractPoint[]) {
    const tex = getMarkerTexture();
    for (const point of points) {
      const sprite = new THREE.Sprite(
        new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false }),
      );
      sprite.scale.set(0.85, 0.85, 1);
      sprite.position.set(point.position.x, point.markerY, point.position.z);
      sprite.visible = false;
      sprite.userData.pointId = point.id;
      this.scene.add(sprite);
      this.entries.push({ point, sprite });
      this.sprites.push(sprite);
    }
  }

  /** Swap to a different scene + point set (island ↔ interior). */
  setScene(scene: THREE.Scene, points: InteractPoint[]) {
    this.dispose();
    this.scene = scene;
    this.entries = [];
    this.sprites = [];
    this._nearest = null;
    this.onPrompt?.(null);
    this.build(points);
  }

  get nearest(): InteractPoint | null {
    return this._nearest;
  }

  /** True when `ndc` click hits a visible marker (and fires its interact). */
  pick(ndc: THREE.Vector2, camera: THREE.Camera): boolean {
    this.raycaster.setFromCamera(ndc, camera);
    const visible = this.sprites.filter((s) => s.visible);
    const hit = this.raycaster.intersectObjects(visible, false)[0];
    if (hit) {
      const id = hit.object.userData.pointId as string;
      this.interact(id);
      return true;
    }
    return false;
  }

  interact(id: string) {
    const entry = this.entries.find((e) => e.point.id === id);
    if (entry) this.onInteract?.(entry.point);
  }

  /** Interact with the nearest point (E key). */
  interactNearest(): boolean {
    if (!this._nearest) return false;
    this.onInteract?.(this._nearest);
    return true;
  }

  update(playerPos: THREE.Vector3, time: number) {
    let nearest: InteractPoint | null = null;
    let nearestDist = Infinity;

    const entries = this.entries;
    for (let i = 0; i < entries.length; i++) {
      const entry = entries[i];
      const d = Math.hypot(playerPos.x - entry.point.position.x, playerPos.z - entry.point.position.z);
      const inRange = d < entry.point.radius;
      entry.sprite.visible = inRange;
      if (inRange) {
        entry.sprite.position.y = entry.point.markerY + Math.sin(time * 3 + i * 2.1) * 0.13;
        if (d < nearestDist) {
          nearestDist = d;
          nearest = entry.point;
        }
      }
    }

    if (nearest !== this._nearest) {
      this._nearest = nearest;
      this.onPrompt?.(nearest ? `Press E — ${(nearest as InteractPoint).hint}` : null);
    }
  }

  dispose() {
    for (const s of this.sprites) this.scene.remove(s);
  }
}
