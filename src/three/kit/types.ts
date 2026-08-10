import * as THREE from 'three';
import { type Exhibit } from '../../content';

export interface Collider {
  x: number;
  z: number;
  r: number;
}

export interface InteractPoint {
  id: string;
  label: string;
  hint: string;
  /** Navigate to a route (opens a route dialog). */
  route?: string;
  /** Enter an interior scene. */
  enterTo?: 'house' | 'museum';
  /** Exit the current interior back to the island. */
  exit?: boolean;
  /** Show the exhibit mini-panel for this exhibit. */
  exhibit?: Exhibit;
  /** Open the Dodo Airlines flight board. */
  airport?: boolean;
  position: THREE.Vector3;
  markerY: number;
  radius: number;
}

export interface IslandBuild {
  group: THREE.Group;
  /** Invisible disc used for click-to-walk raycasts. */
  walkSurface: THREE.Mesh;
  colliders: Collider[];
  points: InteractPoint[];
  clouds: THREE.Group[];
  foam: THREE.Mesh[];
  /** Campfire/torch flames — the engine flickers them. */
  flames: THREE.Mesh[];
  /** Wave-crest marks on the water — the engine bobs/shimmers them. */
  waves: THREE.Mesh[];
  /** The sea mesh (ShaderMaterial) — the engine feeds uTime. */
  sea: THREE.Mesh;
  /** Butterflies fluttering over flower beds — the engine flies them. */
  butterflies: Butterfly[];
  /** Distant gulls circling over the sea — the engine orbits + flaps them. */
  gulls: THREE.Group[];
  /** The moored seaplane at the pier — the engine bobs it + spins the prop. */
  seaplane: THREE.Group;
  /** Extra invisible raycast planes for click-to-move (pier deck). */
  extraWalkSurfaces: THREE.Mesh[];
  /** Raised walkable zones (bounds-exempt, set ground height). */
  walkZones: { minX: number; maxX: number; minZ: number; maxZ: number; y: number }[];
  /** Groups the engine gently rocks (bamboo sway). phase in userData.phase. */
  sway?: THREE.Group[];
}

// ── Butterfly: shaped bezier wings + white spots, wanders a flower bed ─────
export interface Butterfly {
  group: THREE.Group;
  wingL: THREE.Group;
  wingR: THREE.Group;
  anchor: THREE.Vector3;
  phase: number;
}
