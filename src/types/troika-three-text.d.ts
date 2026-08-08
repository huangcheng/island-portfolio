/**
 * Accurate minimal typings for troika-three-text — the package's bundled
 * Text.d.ts forgets `extends Mesh`, so we declare what we use ourselves.
 */
declare module 'troika-three-text' {
  import type { Mesh, MeshBasicMaterial } from 'three';

  export class Text extends Mesh {
    text: string;
    fontSize: number;
    font: string | null;
    color: string | number;
    anchorX: 'left' | 'center' | 'right' | number;
    anchorY:
      | 'top'
      | 'top-baseline'
      | 'top-cap'
      | 'top-ex'
      | 'middle'
      | 'bottom-baseline'
      | 'bottom'
      | number;
    textAlign: 'left' | 'center' | 'right' | 'justify';
    maxWidth: number;
    letterSpacing: number;
    lineHeight: number | string;
    material: MeshBasicMaterial;
    sync(callback?: () => void): void;
    dispose(): void;
  }
}
