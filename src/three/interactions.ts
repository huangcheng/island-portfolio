import * as THREE from 'three';
import type { InteractPoint } from './island';

/**
 * Proximity tracker for interactable spots. No floating markers — the HUD
 * prompt ("Press E — …") is the single affordance. Triggered by the E key.
 */
export class Interactions {
  private points: InteractPoint[] = [];
  private _nearest: InteractPoint | null = null;

  onPrompt: ((text: string | null) => void) | null = null;
  onInteract: ((point: InteractPoint) => void) | null = null;

  constructor(points: InteractPoint[]) {
    this.points = points;
  }

  /** Swap to a different point set (island ↔ interior). */
  setPoints(points: InteractPoint[]) {
    this.points = points;
    this._nearest = null;
    this.onPrompt?.(null);
  }

  get nearest(): InteractPoint | null {
    return this._nearest;
  }

  /** Interact with the nearest point (E key). */
  interactNearest(): boolean {
    if (!this._nearest) return false;
    this.onInteract?.(this._nearest);
    return true;
  }

  update(playerPos: THREE.Vector3, _time: number) {
    let nearest: InteractPoint | null = null;
    let nearestDist = Infinity;

    for (const point of this.points) {
      const d = Math.hypot(playerPos.x - point.position.x, playerPos.z - point.position.z);
      if (d < point.radius && d < nearestDist) {
        nearestDist = d;
        nearest = point;
      }
    }

    if (nearest !== this._nearest) {
      this._nearest = nearest;
      this.onPrompt?.(nearest ? `Press E — ${nearest.hint}` : null);
    }
  }

  dispose() {
    this.points = [];
    this._nearest = null;
  }
}
