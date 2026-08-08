import * as THREE from 'three';
import { Text } from 'troika-three-text';

/**
 * Minimal retained-mode UI kit for building panels entirely in WebGL —
 * rounded-rect meshes + troika SDF text. Zero DOM.
 */

export const FONT_BODY = '/fonts/baloo2-500.ttf';
export const FONT_BOLD = '/fonts/baloo2-700.ttf';
export const FONT_HEAVY = '/fonts/baloo2-800.ttf';

/** AC palette (mirrors the design tokens). */
export const C = {
  paper: 0xfffef7,
  paperWarm: 0xf7f3df,
  line: 0xd9cdb4,
  body: 0x725d42,
  heading: 0x794f27,
  teal: 0x19c8b9,
  pink: 0xf8a6b2,
  pinkEdge: 0xf07f96,
  green: 0x8ac68a,
  greenEdge: 0x6fb36f,
  blue: 0x889df0,
  blueEdge: 0x6b80d8,
  orange: 0xe59266,
  orangeEdge: 0xc97a4e,
  gold: 0xf7cd67,
  goldEdge: 0xe0b84e,
  white: 0xffffff,
};

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

// ── Drawn icons (Baloo 2 lacks most icon glyphs, so we draw geometry) ─────────

/**
 * Thick stroke (mitered) of a polyline as a filled THREE.Shape. Endpoints get
 * caps aligned to their single incident segment; closed loops wrap neighbours.
 */
export function strokeShape(points: number[][], width: number, closed = false): THREE.Shape {
  const n = points.length;
  const half = width / 2;
  const L: THREE.Vector2[] = [];
  const R: THREE.Vector2[] = [];
  for (let i = 0; i < n; i++) {
    const pi = closed ? (i - 1 + n) % n : Math.max(0, i - 1);
    const ni = closed ? (i + 1) % n : Math.min(n - 1, i + 1);
    let tx = points[ni][0] - points[pi][0];
    let ty = points[ni][1] - points[pi][1];
    const len = Math.hypot(tx, ty) || 1;
    tx /= len;
    ty /= len;
    const ox = -ty * half;
    const oy = tx * half;
    L.push(new THREE.Vector2(points[i][0] + ox, points[i][1] + oy));
    R.push(new THREE.Vector2(points[i][0] - ox, points[i][1] - oy));
  }
  const s = new THREE.Shape();
  s.moveTo(L[0].x, L[0].y);
  for (let i = 1; i < n; i++) s.lineTo(L[i].x, L[i].y);
  for (let i = n - 1; i >= 0; i--) s.lineTo(R[i].x, R[i].y);
  s.closePath();
  return s;
}

function iconMaterial(color: number): THREE.MeshBasicMaterial {
  return new THREE.MeshBasicMaterial({
    color,
    toneMapped: false,
    depthTest: false,
    depthWrite: false,
    transparent: true,
  });
}

function shapeMesh(shape: THREE.Shape, color: number): THREE.Mesh {
  return new THREE.Mesh(new THREE.ShapeGeometry(shape, 3), iconMaterial(color));
}

/** Envelope (line icon): rectangle outline + flap caret. ~1 unit tall. */
export function envelopeIcon(color = C.white): THREE.Group {
  const g = new THREE.Group();
  const w = 0.12;
  g.add(shapeMesh(strokeShape([[-0.5, -0.34], [0.5, -0.34], [0.5, 0.34], [-0.5, 0.34]], w, true), color));
  g.add(shapeMesh(strokeShape([[-0.5, 0.34], [0, -0.06], [0.5, 0.34]], w, false), color));
  return g;
}

/** GitHub-ish cat head: filled silhouette (head + ears) + tiny face. ~1 unit tall. */
export function githubCatIcon(color = C.white): THREE.Group {
  const g = new THREE.Group();
  const head = new THREE.Mesh(new THREE.CircleGeometry(0.4, 32), iconMaterial(color));
  head.position.set(0, -0.05, 0);
  g.add(head);
  const earL = new THREE.Shape();
  earL.moveTo(-0.3, 0.1);
  earL.lineTo(-0.46, 0.46);
  earL.lineTo(-0.02, 0.2);
  earL.closePath();
  const earR = new THREE.Shape();
  earR.moveTo(0.3, 0.1);
  earR.lineTo(0.46, 0.46);
  earR.lineTo(0.02, 0.2);
  earR.closePath();
  g.add(new THREE.Mesh(new THREE.ShapeGeometry(earL, 1), iconMaterial(color)));
  g.add(new THREE.Mesh(new THREE.ShapeGeometry(earR, 1), iconMaterial(color)));
  const eyeGeo = new THREE.CircleGeometry(0.045, 14);
  const eyeMat = iconMaterial(C.heading);
  const eyeL = new THREE.Mesh(eyeGeo, eyeMat);
  eyeL.position.set(-0.12, -0.04, 0.001);
  const eyeR = new THREE.Mesh(eyeGeo, eyeMat);
  eyeR.position.set(0.12, -0.04, 0.001);
  g.add(eyeL, eyeR);
  return g;
}

/** Pencil (filled silhouette + graphite tip). ~1 unit tall, tip down. */
export function pencilIcon(color = C.white): THREE.Group {
  const g = new THREE.Group();
  const s = new THREE.Shape();
  s.moveTo(0, -0.5);
  s.lineTo(0.12, -0.2);
  s.lineTo(0.12, 0.3);
  s.lineTo(0.1, 0.38);
  s.lineTo(0.1, 0.5);
  s.lineTo(-0.1, 0.5);
  s.lineTo(-0.1, 0.38);
  s.lineTo(-0.12, 0.3);
  s.lineTo(-0.12, -0.2);
  s.closePath();
  g.add(new THREE.Mesh(new THREE.ShapeGeometry(s, 2), iconMaterial(color)));
  const tip = new THREE.Shape();
  tip.moveTo(0, -0.5);
  tip.lineTo(0.05, -0.4);
  tip.lineTo(-0.05, -0.4);
  tip.closePath();
  g.add(new THREE.Mesh(new THREE.ShapeGeometry(tip, 1), iconMaterial(C.heading)));
  return g;
}
