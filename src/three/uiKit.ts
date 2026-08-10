import * as THREE from 'three';
import { Text } from 'troika-three-text';

/**
 * Minimal retained-mode UI kit for building panels entirely in WebGL —
 * rounded-rect meshes + troika SDF text. Zero DOM.
 */

export const FONT_BODY = '/fonts/baloo2-500.ttf';
export const FONT_BOLD = '/fonts/baloo2-700.ttf';
export const FONT_HEAVY = '/fonts/baloo2-800.ttf';

export interface UiPalette {
  paper: number; paperWarm: number; line: number; body: number; heading: number;
  teal: number; pink: number; pinkEdge: number; green: number; greenEdge: number;
  blue: number; blueEdge: number; orange: number; orangeEdge: number;
  gold: number; goldEdge: number; white: number;
}

/** Live UI palette — island modules re-skin it via setUiTheme before UI is built. */
export const C: UiPalette = {
  paper: 0xfffef7, paperWarm: 0xf7f3df, line: 0xd9cdb4, body: 0x725d42, heading: 0x794f27,
  teal: 0x19c8b9, pink: 0xf8a6b2, pinkEdge: 0xf07f96, green: 0x8ac68a, greenEdge: 0x6fb36f,
  blue: 0x889df0, blueEdge: 0x6b80d8, orange: 0xe59266, orangeEdge: 0xc97a4e,
  gold: 0xf7cd67, goldEdge: 0xe0b84e, white: 0xffffff,
};

const C_DEFAULTS: UiPalette = { ...C };

/** Apply an island's UI skin. Omit keys to keep defaults. Call BEFORE building UI. */
export function setUiTheme(overrides: Partial<UiPalette> = {}): void {
  Object.assign(C, C_DEFAULTS, overrides);
}

/** Rounded-rectangle THREE.Shape centred on the origin. */
export function roundedRectShape(w: number, h: number, r: number): THREE.Shape {
  const s = new THREE.Shape();
  const x = -w / 2;
  const y = -h / 2;
  const rr = Math.min(r, w / 2, h / 2);
  s.moveTo(x + rr, y);
  s.lineTo(x + w - rr, y);
  s.absarc(x + w - rr, y + rr, rr, -Math.PI / 2, 0, false);
  s.lineTo(x + w, y + h - rr);
  s.absarc(x + w - rr, y + h - rr, rr, 0, Math.PI / 2, false);
  s.lineTo(x + rr, y + h);
  s.absarc(x + rr, y + h - rr, rr, Math.PI / 2, Math.PI, false);
  s.lineTo(x, y + rr);
  s.absarc(x + rr, y + rr, rr, Math.PI, Math.PI * 1.5, false);
  return s;
}

function uiMaterial(color: number): THREE.MeshBasicMaterial {
  return new THREE.MeshBasicMaterial({
    color,
    toneMapped: false,
    depthTest: false,
    depthWrite: false,
    transparent: true,
  });
}

export interface PanelOptions {
  bg?: number;
  border?: number;
  borderWidth?: number;
}

/** Rounded panel with an optional border (outer shape + inset inner shape). */
export function makePanel(w: number, h: number, r: number, opts: PanelOptions = {}): THREE.Group {
  const { bg = C.paper, border = C.line, borderWidth = 0.024 } = opts;
  const g = new THREE.Group();
  const outer = new THREE.Mesh(new THREE.ShapeGeometry(roundedRectShape(w, h, r), 8), uiMaterial(border));
  const inner = new THREE.Mesh(
    new THREE.ShapeGeometry(roundedRectShape(w - borderWidth * 2, h - borderWidth * 2, Math.max(0.01, r - borderWidth)), 8),
    uiMaterial(bg),
  );
  inner.position.z = 0.001;
  g.add(outer, inner);
  return g;
}

export interface LabelOptions {
  size?: number;
  color?: number;
  font?: string;
  anchorX?: 'left' | 'center' | 'right';
  anchorY?: 'top' | 'middle' | 'bottom';
  maxWidth?: number;
  align?: 'left' | 'center' | 'right';
  letterSpacing?: number;
}

/** troika SDF text, preconfigured for screen-space UI. */
export function makeLabel(str: string, opts: LabelOptions = {}): Text {
  const t = new Text();
  t.text = str;
  t.fontSize = opts.size ?? 0.1;
  t.color = opts.color ?? C.body;
  t.font = opts.font ?? FONT_BODY;
  t.anchorX = opts.anchorX ?? 'center';
  t.anchorY = opts.anchorY ?? 'middle';
  t.textAlign = opts.align ?? 'center';
  if (opts.maxWidth !== undefined) t.maxWidth = opts.maxWidth;
  if (opts.letterSpacing !== undefined) t.letterSpacing = opts.letterSpacing;
  t.material.depthTest = false;
  t.material.depthWrite = false;
  t.sync();
  return t;
}

export interface ButtonOptions {
  w: number;
  h: number;
  r?: number;
  bg?: number;
  edge?: number;
  label: string;
  size?: number;
  color?: number;
  font?: string;
  onClick: () => void;
  /** Optional drawn icon placed left of the label (Shape/Group of meshes). */
  icon?: THREE.Object3D;
  /** Icon scale in world units (defaults to half the button height). */
  iconSize?: number;
}

/** Clickable rounded button with inset bottom lip + hover scale. */
export class UiButton extends THREE.Group {
  readonly hitMesh: THREE.Mesh;
  private readonly baseScale = new THREE.Vector3(1, 1, 1);
  private hoverT = 0;
  hovered = false;

  constructor(opts: ButtonOptions) {
    super();
    const { w, h } = opts;
    const r = opts.r ?? h / 2;
    const bg = opts.bg ?? C.green;
    const edge = opts.edge ?? C.greenEdge;

    // Bottom lip (deeper edge color peeking below) + face
    const lip = new THREE.Mesh(new THREE.ShapeGeometry(roundedRectShape(w, h, r), 8), uiMaterial(edge));
    lip.position.y = -0.028;
    const face = new THREE.Mesh(new THREE.ShapeGeometry(roundedRectShape(w, h, r), 8), uiMaterial(bg));
    face.position.z = 0.001;
    this.add(lip, face);

    const fontSize = opts.size ?? 0.1;
    const labelOpts: LabelOptions = {
      size: fontSize,
      color: opts.color ?? C.white,
      font: opts.font ?? FONT_BOLD,
    };
    // When an icon is supplied, lay it out as [icon · label] and centre the pair.
    let iconSize = 0;
    let pairLeft = 0;
    if (opts.icon) {
      iconSize = opts.iconSize ?? h * 0.5;
      const gap = 0.05;
      const estLabelW = opts.label.length * fontSize * 0.5;
      pairLeft = -(iconSize + gap + estLabelW) / 2;
      opts.icon.scale.setScalar(iconSize);
      opts.icon.position.set(pairLeft + iconSize / 2, 0, 0.002);
      this.add(opts.icon);
      labelOpts.anchorX = 'left';
    }
    const label = makeLabel(opts.label, labelOpts);
    label.position.z = 0.002;
    if (opts.icon) label.position.x = pairLeft + iconSize + 0.05;
    this.add(label);

    this.hitMesh = face;
    face.userData.onClick = opts.onClick;
    face.userData.button = this;
  }

  /** Per-frame hover spring (scale 1 ↔ 1.07). */
  update(dt: number) {
    const target = this.hovered ? 1 : 0;
    this.hoverT += (target - this.hoverT) * Math.min(1, dt * 14);
    const k = 1 + this.hoverT * 0.07;
    this.scale.set(this.baseScale.x * k, this.baseScale.y * k, 1);
  }
}
// ── SVG icons (Lucide, baked white) — Baloo 2 has no icon glyphs ───────────

/** Plane mesh with an SVG icon texture (unit size; UiButton scales it). */
export function makeIconMesh(url: string): THREE.Mesh {
  const tex = new THREE.TextureLoader().load(url);
  tex.colorSpace = THREE.SRGBColorSpace;
  return new THREE.Mesh(
    new THREE.PlaneGeometry(1, 1),
    new THREE.MeshBasicMaterial({ map: tex, transparent: true, toneMapped: false, depthTest: false, depthWrite: false }),
  );
}
