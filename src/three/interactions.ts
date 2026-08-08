import * as THREE from 'three';
import type { InteractPoint } from './island';

let markerTexture: THREE.CanvasTexture | null = null;

/** Draws the classic AC-style "!" attention bubble as a canvas texture. */
function getMarkerTexture(): THREE.CanvasTexture {
  if (markerTexture) return markerTexture;
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext('2d')!;
  ctx.clearRect(0, 0, 128, 128);
  ctx.fillStyle = '#ffd94d';
  ctx.strokeStyle = '#6b4f2a';
  ctx.lineWidth = 8;
  ctx.beginPath();
  ctx.arc(64, 60, 46, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(52, 96);
  ctx.lineTo(64, 120);
  ctx.lineTo(76, 96);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#4a3520';
  ctx.font = '800 64px "Baloo 2", sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('!', 64, 62);
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
 */
export class Interactions {
  private entries: MarkerEntry[] = [];
  private sprites: THREE.Sprite[] = [];
  private raycaster = new THREE.Raycaster();
  private _nearest: InteractPoint | null = null;

  onPrompt: ((text: string | null) => void) | null = null;
  onInteract: ((route: string) => void) | null = null;

  constructor(private scene: THREE.Scene, points: InteractPoint[]) {
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

  get nearest(): InteractPoint | null {
    return this._nearest;
  }

  /** True when `ndc` click hits a visible marker (and fires its interact). */
  pick(ndc: THREE.Vector2, camera: THREE.Camera): boolean {
    this.raycaster.setFromCamera(ndc, camera);
    const visible = this.sprites.filter((s) => s.visible);
    const hit = this.raycaster.intersectObjects(visible, false)[0];
    if (hit) {
      const id = hit.object.userData.pointId as InteractPoint['id'];
      this.interact(id);
      return true;
    }
    return false;
  }

  interact(id: InteractPoint['id']) {
    const entry = this.entries.find((e) => e.point.id === id);
    if (entry) this.onInteract?.(entry.point.route);
  }

  /** Interact with the nearest point (E key). */
  interactNearest(): boolean {
    if (!this._nearest) return false;
    this.onInteract?.(this._nearest.route);
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
