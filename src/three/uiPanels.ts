import * as THREE from 'three';
import type { Text } from 'troika-three-text';
import { C, FONT_BOLD, FONT_HEAVY, makeIconMesh, makeLabel, makePanel, roundedRectShape, UiButton } from './uiKit';
import { profile, projects, type Project } from '../content';

const _spineA = new THREE.Color();
const _spineB = new THREE.Color();

interface Hot {
  group: THREE.Group;
  mesh: THREE.Mesh;
  onClick: () => void;
  hoverT: number;
}

/** Little 5-point star shape (Baloo 2 has no ★ glyph, so we draw it). */
function makeStarShape(r: number): THREE.Shape {
  const s = new THREE.Shape();
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2 - Math.PI / 2;
    const rr = i % 2 === 0 ? r : r * 0.45;
    const x = Math.cos(a) * rr;
    const y = Math.sin(a) * rr;
    if (i === 0) s.moveTo(x, y);
    else s.lineTo(x, y);
  }
  s.closePath();
  return s;
}

/** Soft drop shadow — a dark rounded shape behind/below a panel. */
function makeSoftShadow(w: number, h: number, r: number, opacity = 0.16): THREE.Mesh {
  return new THREE.Mesh(
    new THREE.ShapeGeometry(roundedRectShape(w, h, r), 8),
    new THREE.MeshBasicMaterial({
      color: 0x2a1f14,
      transparent: true,
      opacity,
      toneMapped: false,
      depthTest: false,
      depthWrite: false,
    }),
  );
}

/** Route titles shown in the HUD pill. */
const TITLES: Record<string, string> = {
  '/': 'Home Square',
  '/about': 'My House',
  '/projects': 'Museum',
  '/contact': 'Notice Board',
};

/**
 * All-screen-space UI built ENTIRELY in WebGL: troika SDF text + rounded
 * mesh panels on camera-anchored groups. No DOM anywhere — interaction is
 * raycast against button meshes, hover springs + cursor swap included.
 *
 * Panels:
 *  - hud    (top-left pill: title + hint/prompt)
 *  - clock  (bottom-left pill: live time + date)
 *  - dialog (bottom-centre bubble, content depends on route)
 */
export class UiPanels {
  private readonly root = new THREE.Group(); // camera child
  private readonly raycaster = new THREE.Raycaster();

  private hudGroup!: THREE.Group;
  private hudTitle!: Text;
  private hudSub!: Text;

  private clockGroup!: THREE.Group;
  private clockTime!: Text;
  private clockDate!: Text;
  private clockTimer = 0;

  private dialogGroup: THREE.Group | null = null;
  private dialogHots: Hot[] = [];
  private popT = 1;

  private hots: Hot[] = [];
  private hovered: Hot | null = null;

  private typeTarget: { label: Text; full: string; count: number } | null = null;

  private clock = 0;
  private typeArrow: THREE.Mesh | null = null;

  private readonly PANEL_DIST = 6;

  onNavigate: ((to: string) => void) | null = null;
  /** Exhibit mini-panel closed (engine uses it to restore walking). */
  onExhibitClose: (() => void) | null = null;

  constructor(
    private renderer: THREE.WebGLRenderer,
    private camera: THREE.PerspectiveCamera,
  ) {
    this.root.renderOrder = 900;
    camera.add(this.root);
    this.buildHud();
    this.buildClock();
    this.layout();

    renderer.domElement.addEventListener('pointermove', this.onPointerMove);
  }

  // ── HUD ──────────────────────────────────────────────────────────────────

  private buildHud() {
    this.hudGroup = new THREE.Group();
    const shadow = makeSoftShadow(2.62, 0.5, 0.25, 0.12);
    shadow.position.set(0.035, -0.045, -0.002);
    this.hudGroup.add(shadow);
    const pill = makePanel(2.62, 0.5, 0.25, { bg: C.paper, border: C.line });
    this.hudGroup.add(pill);

    const leaf = this.makeIcon('/cursor-leaf.png', 0.3);
    leaf.position.set(-1.16, 0, 0.002);
    this.hudGroup.add(leaf);

    this.hudTitle = makeLabel(profile.name, { size: 0.115, color: C.heading, font: FONT_HEAVY, anchorX: 'left', letterSpacing: -0.002 });
    this.hudTitle.position.set(-0.98, 0.11, 0.002);
    this.hudGroup.add(this.hudTitle);

    this.hudSub = makeLabel('WASD / arrows / click to walk · E to interact', {
      size: 0.068,
      color: C.body,
      anchorX: 'left',
    });
    this.hudSub.position.set(-0.98, -0.1, 0.002);
    this.hudGroup.add(this.hudSub);

    this.root.add(this.hudGroup);
  }

  setPrompt(text: string | null) {
    this.hudSub.text = text ?? 'WASD / arrows / click to walk · E to interact';
    this.hudSub.color = text ? 0x3f8c2a : C.body;
    this.hudSub.sync();
  }

  // ── Clock ────────────────────────────────────────────────────────────────

  private buildClock() {
    this.clockGroup = new THREE.Group();
    const shadow = makeSoftShadow(1.32, 0.5, 0.25, 0.12);
    shadow.position.set(0.035, -0.045, -0.002);
    this.clockGroup.add(shadow);
    const pill = makePanel(1.32, 0.5, 0.25, { bg: C.paper, border: C.line });
    this.clockGroup.add(pill);

    const leaf = this.makeIcon('/cursor-leaf.png', 0.28);
    leaf.position.set(-0.5, 0, 0.002);
    this.clockGroup.add(leaf);

    this.clockTime = makeLabel('', { size: 0.15, color: C.heading, font: FONT_HEAVY, anchorX: 'left' });
    this.clockTime.position.set(-0.32, 0.09, 0.002);
    this.clockGroup.add(this.clockTime);

    this.clockDate = makeLabel('', { size: 0.068, color: C.body, anchorX: 'left' });
    this.clockDate.position.set(-0.32, -0.11, 0.002);
    this.clockGroup.add(this.clockDate);

    this.root.add(this.clockGroup);
    this.tickClock();
  }

  private tickClock() {
    const d = new Date();
    const pad = (n: number) => String(n).padStart(2, '0');
    this.clockTime.text = `${pad(d.getHours())}:${pad(d.getMinutes())}`;
    this.clockTime.sync();
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    this.clockDate.text = `${months[d.getMonth()]} ${d.getDate()} · ${days[d.getDay()]}`;
    this.clockDate.sync();
  }

  private makeIcon(url: string, size: number): THREE.Mesh {
    const tex = new THREE.TextureLoader().load(url);
    tex.colorSpace = THREE.SRGBColorSpace;
    const m = new THREE.Mesh(
      new THREE.PlaneGeometry(size, size),
      new THREE.MeshBasicMaterial({ map: tex, transparent: true, toneMapped: false, depthTest: false, depthWrite: false }),
    );
    return m;
  }

  // ── Dialog ───────────────────────────────────────────────────────────────

  showRoute(path: string) {
    this.clearDialog();
    this.hudTitle.text = `${profile.name} · ${TITLES[path] ?? 'Island'}`;
    this.hudTitle.sync();
    if (path === '/') return;

    const W = 4.5;
    let group: THREE.Group;
    let H: number;
    if (path === '/about') [group, H] = this.buildAbout(W);
    else if (path === '/projects') [group, H] = this.buildProjects(W);
    else [group, H] = this.buildContact(W);

    group.userData.W = W;
    group.userData.H = H;
    this.dialogGroup = group;
    this.root.add(group);
    this.popT = 0;
    this.layout();
  }

  /** Exhibit info placard (museum frames) — a flat museum wall-label, NOT a
   *  speech bubble. Independent of routes. */
  showExhibit(p: Project | null) {
    this.clearDialog();
    if (!p) return;

    const W = 4.0;
    const H = 1.56;
    const g = new THREE.Group();

    const shadow = makeSoftShadow(W, H, 0.1, 0.16);
    shadow.position.set(0.05, -0.08, -0.002);
    g.add(shadow);
    // Ivory plaque with a dark wood border (gallery wall-label style)
    const plaque = makePanel(W, H, 0.1, { bg: 0xfffdf2, border: 0x54331a, borderWidth: 0.035 });
    g.add(plaque);

    // Title top-left, heavy dark
    const title = makeLabel(p.title, { size: 0.115, color: C.heading, font: FONT_HEAVY, anchorX: 'left' });
    title.position.set(-W / 2 + 0.34, H / 2 - 0.26, 0.002);
    g.add(title);
    // Thin gold divider under the title (museum label rule)
    const rule = new THREE.Mesh(
      new THREE.PlaneGeometry(1.5, 0.016),
      new THREE.MeshBasicMaterial({ color: 0xc9a24a, toneMapped: false, depthTest: false, depthWrite: false, transparent: true }),
    );
    rule.position.set(-W / 2 + 0.34 + 0.75, H / 2 - 0.4, 0.002);
    g.add(rule);

    // Close ✕ — small dark-wood disc top-right
    const close = new UiButton({
      w: 0.28, h: 0.28, r: 0.14, bg: 0x54331a, edge: 0x3a2515, label: '×', size: 0.13, color: 0xfff2d0, font: FONT_HEAVY,
      onClick: () => this.closeExhibit(),
    });
    close.position.set(W / 2 - 0.26, H / 2 - 0.24, 0.002);
    g.add(close);
    this.dialogHots.push({ group: close, mesh: close.hitMesh, onClick: () => this.closeExhibit(), hoverT: 0 });

    const tagline = makeLabel(p.tagline, {
      size: 0.08, color: C.body, anchorX: 'left', anchorY: 'top', maxWidth: W - 0.7, align: 'left',
    });
    tagline.position.set(-W / 2 + 0.34, H / 2 - 0.52, 0.002);
    g.add(tagline);

    // Star pill (drawn star + count)
    const stars = new THREE.Group();
    const starPill = makePanel(0.56, 0.24, 0.12, { bg: C.gold, border: C.goldEdge, borderWidth: 0.014 });
    stars.add(starPill);
    const star = new THREE.Mesh(
      new THREE.ShapeGeometry(makeStarShape(0.07)),
      new THREE.MeshBasicMaterial({ color: C.goldEdge, toneMapped: false, depthTest: false, depthWrite: false, transparent: true }),
    );
    star.position.set(-0.14, 0, 0.002);
    stars.add(star);
    const starLabel = makeLabel(String(p.stars), { size: 0.08, color: C.heading, font: FONT_HEAVY, anchorX: 'left' });
    starLabel.position.set(-0.03, 0, 0.002);
    stars.add(starLabel);
    stars.position.set(-W / 2 + 0.55, -H / 2 + 0.32, 0.002);
    g.add(stars);

    // Stack chips next to the stars
    const chips = new THREE.Group();
    let cx = 0;
    for (const s of p.stack) {
      const cw = s.length * 0.042 + 0.22;
      const chip = makePanel(cw, 0.19, 0.095, { bg: C.paperWarm, border: C.line, borderWidth: 0.012 });
      const cl = makeLabel(s, { size: 0.058, color: C.body, font: FONT_BOLD });
      cl.position.z = 0.002;
      chip.add(cl);
      chip.position.set(cx + cw / 2, 0, 0.002);
      chips.add(chip);
      cx += cw + 0.08;
    }
    chips.position.set(-W / 2 + 1.0, -H / 2 + 0.32, 0.002);
    g.add(chips);

    const gh = new UiButton({
      w: 1.3, h: 0.38, bg: C.blue, edge: C.blueEdge, label: 'GitHub', size: 0.1,
      icon: makeIconMesh('/icons/github.svg'),
      onClick: () => window.open(p.repo, '_blank', 'noopener'),
    });
    gh.position.set(W / 2 - 0.85, -H / 2 + 0.32, 0.002);
    g.add(gh);
    this.dialogHots.push({ group: gh, mesh: gh.hitMesh, onClick: () => window.open(p.repo, '_blank', 'noopener'), hoverT: 0 });

    g.userData.W = W;
    g.userData.H = H;
    this.dialogGroup = g;
    this.root.add(g);
    this.popT = 0;
    this.layout();
  }

  /** Hide the exhibit placard + notify (engine restores walking). */
  private closeExhibit() {
    this.clearDialog();
    this.onExhibitClose?.();
  }

  private dialogChrome(W: number, H: number, title: string, onClose?: () => void): THREE.Group {
    const g = new THREE.Group();
    const shadow = makeSoftShadow(W, H, 0.3, 0.16);
    shadow.position.set(0.05, -0.08, -0.002);
    g.add(shadow);
    const bubble = makePanel(W, H, 0.3, { bg: C.paper, border: C.line });
    g.add(bubble);

    // Tail — little triangle under the bubble (pure geometry, no clipping)
    const tailShape = new THREE.Shape();
    tailShape.moveTo(-0.14, 0);
    tailShape.lineTo(0.14, 0);
    tailShape.lineTo(0, -0.18);
    tailShape.closePath();
    const tail = new THREE.Mesh(new THREE.ShapeGeometry(tailShape), new THREE.MeshBasicMaterial({
      color: C.paper, toneMapped: false, depthTest: false, depthWrite: false, transparent: true,
    }));
    tail.position.set(0, -H / 2 + 0.02, -0.001);
    g.add(tail);

    // Pink name pill overlapping the top-left
    const pillW = Math.max(1.1, title.length * 0.085 + 0.5);
    const pill = makePanel(pillW, 0.34, 0.17, { bg: C.pink, border: C.pinkEdge, borderWidth: 0.02 });
    pill.position.set(-W / 2 + pillW / 2 + 0.22, H / 2 + 0.03, 0.002);
    pill.rotation.z = -0.03;
    g.add(pill);
    const pillLabel = makeLabel(title, { size: 0.125, color: C.white, font: FONT_HEAVY });
    pillLabel.position.set(pill.position.x, pill.position.y - 0.005, 0.004);
    g.add(pillLabel);

    // Close button
    const close = new UiButton({
      w: 0.3, h: 0.3, r: 0.15, bg: C.gold, edge: C.goldEdge, label: '×', size: 0.15, color: C.heading, font: FONT_HEAVY,
      onClick: () => (onClose ? onClose() : this.onNavigate?.('/')),
    });
    close.position.set(W / 2 - 0.22, H / 2 + 0.02, 0.002);
    g.add(close);
    this.dialogHots.push({
      group: close,
      mesh: close.hitMesh,
      onClick: () => (onClose ? onClose() : this.onNavigate?.('/')),
      hoverT: 0,
    });

    // Faint paper-pattern accents (AC dialogs have subtle detailing)
    const sparkle = (x: number, y: number, s: number, rot: number) => {
      const d = new THREE.Shape();
      d.moveTo(0, s);
      d.lineTo(s * 0.7, 0);
      d.lineTo(0, -s);
      d.lineTo(-s * 0.7, 0);
      d.closePath();
      const m = new THREE.Mesh(
        new THREE.ShapeGeometry(d, 1),
        new THREE.MeshBasicMaterial({ color: C.line, transparent: true, opacity: 0.13, toneMapped: false, depthTest: false, depthWrite: false }),
      );
      m.position.set(x, y, 0.0015);
      m.rotation.z = rot;
      g.add(m);
    };
    sparkle(W / 2 - 0.55, -H / 2 + 0.5, 0.05, 0.3);
    sparkle(W / 2 - 0.33, -H / 2 + 0.78, 0.04, -0.2);
    sparkle(W / 2 - 0.72, -H / 2 + 0.34, 0.045, 0.6);
    return g;
  }

  private buildAbout(W: number): [THREE.Group, number] {
    const H = 2.04;
    const g = this.dialogChrome(W, H, profile.name);

    const typeLabel = makeLabel('', {
      size: 0.096, color: C.body, anchorX: 'left', anchorY: 'top', maxWidth: W - 0.8, align: 'left',
    });
    typeLabel.position.set(-(W / 2 - 0.42), H / 2 - 0.36, 0.002);
    g.add(typeLabel);
    this.typeTarget = { label: typeLabel, full: profile.greeting, count: 0 };

    const role = makeLabel(`${profile.role} · this island + UI are 100% WebGL`, {
      size: 0.075, color: C.teal, font: FONT_BOLD,
    });
    role.position.set(0, H / 2 - 1.2, 0.002);
    g.add(role);

    const blog = new UiButton({
      w: 1.2, h: 0.38, bg: C.green, edge: C.greenEdge, label: 'Blog', size: 0.105, icon: makeIconMesh('/icons/feather.svg'),
      onClick: () => window.open(profile.blog.url, '_blank', 'noopener'),
    });
    blog.position.set(-0.68, -H / 2 + 0.38, 0.002);
    const gh = new UiButton({
      w: 1.2, h: 0.38, bg: C.blue, edge: C.blueEdge, label: 'GitHub', size: 0.105, icon: makeIconMesh('/icons/github.svg'),
      onClick: () => window.open(profile.github.url, '_blank', 'noopener'),
    });
    gh.position.set(0.68, -H / 2 + 0.38, 0.002);
    g.add(blog, gh);
    this.dialogHots.push(
      { group: blog, mesh: blog.hitMesh, onClick: () => window.open(profile.blog.url, '_blank', 'noopener'), hoverT: 0 },
      { group: gh, mesh: gh.hitMesh, onClick: () => window.open(profile.github.url, '_blank', 'noopener'), hoverT: 0 },
    );

    // "Continue" caret, shown once the typewriter finishes — bobs each frame.
    const arrowShape = new THREE.Shape();
    arrowShape.moveTo(-0.05, 0.04);
    arrowShape.lineTo(0.05, 0.04);
    arrowShape.lineTo(0, -0.04);
    arrowShape.closePath();
    const arrow = new THREE.Mesh(
      new THREE.ShapeGeometry(arrowShape),
      new THREE.MeshBasicMaterial({ color: C.teal, toneMapped: false, depthTest: false, depthWrite: false, transparent: true }),
    );
    arrow.position.set(W / 2 - 0.62, 0.06, 0.003);
    arrow.userData.baseY = 0.06;
    arrow.visible = false;
    g.add(arrow);
    this.typeArrow = arrow;

    return [g, H];
  }

  private buildProjects(W: number): [THREE.Group, number] {
    const cardH = 0.7;
    const gap = 0.1;
    const H = 0.62 + projects.length * (cardH + gap) + 0.35;
    const g = this.dialogChrome(W, H, 'Museum Exhibits');

    const sub = makeLabel(`Curated exhibits from ${profile.github.label}`, {
      size: 0.08, color: C.teal, font: FONT_BOLD,
    });
    sub.position.set(0, H / 2 - 0.36, 0.002);
    g.add(sub);

    projects.forEach((p, i) => {
      const card = new THREE.Group();
      const y = H / 2 - 0.62 - cardH / 2 - i * (cardH + gap);
      const cardW = W - 0.6;

      const body = makePanel(cardW, cardH, 0.14, { bg: C.white, border: C.line });
      card.add(body);
      // green spine
      const spine = new THREE.Mesh(
        new THREE.ShapeGeometry(roundedRectShape(0.09, cardH - 0.14, 0.045), 6),
        new THREE.MeshBasicMaterial({ color: C.green, toneMapped: false, depthTest: false, depthWrite: false, transparent: true }),
      );
      spine.position.set(-cardW / 2 + 0.12, 0, 0.002);
      card.add(spine);
      card.userData.spine = spine;

      const title = makeLabel(p.title, { size: 0.1, color: C.heading, font: FONT_BOLD, anchorX: 'left' });
      title.position.set(-cardW / 2 + 0.28, cardH / 2 - 0.17, 0.002);
      card.add(title);

      // Star pill: drawn star + count
      const stars = new THREE.Group();
      const starPill = makePanel(0.56, 0.24, 0.12, { bg: C.gold, border: C.goldEdge, borderWidth: 0.014 });
      stars.add(starPill);
      const star = new THREE.Mesh(
        new THREE.ShapeGeometry(makeStarShape(0.07)),
        new THREE.MeshBasicMaterial({ color: C.goldEdge, toneMapped: false, depthTest: false, depthWrite: false, transparent: true }),
      );
      star.position.set(-0.14, 0, 0.002);
      stars.add(star);
      const starLabel = makeLabel(String(p.stars), { size: 0.08, color: C.heading, font: FONT_HEAVY, anchorX: 'left' });
      starLabel.position.set(-0.03, 0, 0.002);
      stars.add(starLabel);
      stars.position.set(cardW / 2 - 0.42, cardH / 2 - 0.17, 0.002);
      card.add(stars);

      const tagline = makeLabel(p.tagline, {
        size: 0.066, color: C.body, anchorX: 'left', anchorY: 'top', maxWidth: cardW - 1.35, align: 'left',
      });
      tagline.position.set(-cardW / 2 + 0.28, 0.06, 0.002);
      card.add(tagline);

      const chips = new THREE.Group();
      let cx = 0;
      for (const s of p.stack) {
        const cw = s.length * 0.042 + 0.22;
        const chip = makePanel(cw, 0.19, 0.095, { bg: C.paperWarm, border: C.line, borderWidth: 0.012 });
        const cl = makeLabel(s, { size: 0.058, color: C.body, font: FONT_BOLD });
        cl.position.z = 0.002;
        chip.add(cl);
        chip.position.set(cx + cw / 2, 0, 0.002);
        chips.add(chip);
        cx += cw + 0.08;
      }
      chips.position.set(-cardW / 2 + 0.28, -cardH / 2 + 0.115, 0.002);
      card.add(chips);

      card.position.set(0, y, 0.002);
      g.add(card);

      // Whole card is the hit target (inner face of its panel)
      const hit = body.children[1] as THREE.Mesh;
      hit.userData.onClick = () => window.open(p.repo, '_blank', 'noopener');
      this.dialogHots.push({ group: card, mesh: hit, onClick: hit.userData.onClick as () => void, hoverT: 0 });
    });

    const note = makeLabel('Donations of bells happily accepted', { size: 0.068, color: C.body });
    note.position.set(0, -H / 2 + 0.2, 0.002);
    g.add(note);
    return [g, H];
  }

  /** Contact panel styled as the actual wooden NOTICE BOARD — frame + cream
   *  board + pinned notes; deliberately NOT a speech bubble. */
  private buildContact(W: number): [THREE.Group, number] {
    const H = 1.86;
    const g = new THREE.Group();

    // Soft shadow + thick wooden frame + cream board
    const shadow = makeSoftShadow(W, H, 0.14, 0.16);
    shadow.position.set(0.05, -0.08, -0.002);
    g.add(shadow);
    const frame = makePanel(W, H, 0.14, { bg: 0x9a6a3f, border: 0x6e4424, borderWidth: 0.05 });
    g.add(frame);
    const board = makePanel(W - 0.26, H - 0.26, 0.08, { bg: 0xf5ead2, border: 0xd9cdb4, borderWidth: 0.012 });
    board.position.z = 0.001;
    g.add(board);

    // Wooden title plaque overlapping the frame's top edge
    const plaque = makePanel(1.85, 0.36, 0.12, { bg: 0x7a5a36, border: 0x54331a, borderWidth: 0.018 });
    plaque.position.set(0, H / 2 + 0.02, 0.003);
    plaque.rotation.z = -0.012;
    g.add(plaque);
    const plaqueLabel = makeLabel('Notice Board', { size: 0.125, color: 0xfff2d0, font: FONT_HEAVY });
    plaqueLabel.position.set(0, H / 2 + 0.01, 0.005);
    g.add(plaqueLabel);

    // Close button on the frame's top-right
    const close = new UiButton({
      w: 0.3, h: 0.3, r: 0.15, bg: C.gold, edge: C.goldEdge, label: '×', size: 0.15, color: C.heading, font: FONT_HEAVY,
      onClick: () => this.onNavigate?.('/'),
    });
    close.position.set(W / 2 - 0.24, H / 2 + 0.03, 0.004);
    g.add(close);
    this.dialogHots.push({ group: close, mesh: close.hitMesh, onClick: () => this.onNavigate?.('/'), hoverT: 0 });

    // Pinned note with the message (slightly tilted, red pins)
    const note = new THREE.Group();
    const noteCard = makePanel(3.3, 0.68, 0.06, { bg: 0xfffdf2, border: 0xe0d6bc, borderWidth: 0.012 });
    note.add(noteCard);
    const msg = makeLabel('Want to chat about a project, a job, or island life?\nSend word my way!', {
      size: 0.085, color: C.body, maxWidth: 3.0,
    });
    msg.position.set(0, 0, 0.002);
    note.add(msg);
    const pinGeo = new THREE.CircleGeometry(0.04, 12);
    for (const px of [-1.45, 1.45]) {
      const pin = new THREE.Mesh(pinGeo, new THREE.MeshBasicMaterial({ color: 0xe05a5a, toneMapped: false, depthTest: false, depthWrite: false, transparent: true }));
      pin.position.set(px, 0.26, 0.003);
      note.add(pin);
    }
    note.rotation.z = -0.016;
    note.position.set(0, H / 2 - 0.66, 0.002);
    g.add(note);

    // Link buttons row
    const mk = (label: string, x: number, bg: number, edge: number, url: string, icon: THREE.Object3D) => {
      const b = new UiButton({
        w: 1.3, h: 0.4, bg, edge, label, size: 0.095, icon,
        onClick: () => window.open(url, '_blank', 'noopener'),
      });
      b.position.set(x, -H / 2 + 0.62, 0.002);
      g.add(b);
      this.dialogHots.push({ group: b, mesh: b.hitMesh, onClick: () => window.open(url, '_blank', 'noopener'), hoverT: 0 });
    };
    mk(profile.email.label, -1.5, C.orange, C.orangeEdge, profile.email.url, makeIconMesh('/icons/mail.svg'));
    mk('GitHub', 0, C.blue, C.blueEdge, profile.github.url, makeIconMesh('/icons/github.svg'));
    mk(profile.blog.label, 1.5, C.green, C.greenEdge, profile.blog.url, makeIconMesh('/icons/feather.svg'));

    const foot = makeLabel('Carrier pigeon also accepted', { size: 0.066, color: C.body });
    foot.position.set(0, -H / 2 + 0.26, 0.002);
    g.add(foot);
    return [g, H];
  }

  private clearDialog() {
    if (!this.dialogGroup) return;
    this.root.remove(this.dialogGroup);
    this.dialogGroup.traverse((o) => {
      const anyO = o as unknown as { isText?: boolean; dispose?: () => void };
      if (anyO.isText && anyO.dispose) anyO.dispose();
      else if (o instanceof THREE.Mesh) {
        o.geometry.dispose();
        const m = o.material as THREE.Material | THREE.Material[];
        if (Array.isArray(m)) m.forEach((x) => x.dispose());
        else m.dispose();
      }
    });
    this.dialogGroup = null;
    this.dialogHots = [];
    this.typeTarget = null;
    this.typeArrow = null;
    this.hots = this.hots.filter((h) => !this.dialogHots.includes(h));
  }

  // ── Interaction (raycast, no DOM) ────────────────────────────────────────

  /** Claim a pointerdown: true when a UI element was hit (and fired). */
  tryClick(ndc: THREE.Vector2): boolean {
    this.raycaster.setFromCamera(ndc, this.camera);
    const meshes = this.allHotMeshes();
    const hit = this.raycaster.intersectObjects(meshes, false)[0];
    if (hit) {
      const fn = hit.object.userData.onClick as (() => void) | undefined;
      fn?.();
      return true;
    }
    return false;
  }

  private allHotMeshes(): THREE.Mesh[] {
    return this.dialogGroup && this.dialogGroup.visible ? this.dialogHots.map((h) => h.mesh) : [];
  }

  private onPointerMove = (e: PointerEvent) => {
    const canvas = this.renderer.domElement;
    const rect = canvas.getBoundingClientRect();
    const ndc = new THREE.Vector2(
      ((e.clientX - rect.left) / rect.width) * 2 - 1,
      -((e.clientY - rect.top) / rect.height) * 2 + 1,
    );
    this.raycaster.setFromCamera(ndc, this.camera);
    const hit = this.raycaster.intersectObjects(this.allHotMeshes(), false)[0];
    const hot = hit ? this.dialogHots.find((h) => h.mesh === hit.object) ?? null : null;
    if (hot !== this.hovered) {
      if (this.hovered) this.setHover(this.hovered, false);
      this.hovered = hot;
      if (hot) this.setHover(hot, true);
      // Cursor swap: leaf (default, via CSS) ↔ pointing glove over UI
      canvas.style.cursor = hot ? "url('/cursor-hand.png') 15 20, pointer" : '';
    }
  };

  private setHover(h: Hot, v: boolean) {
    void v;
    h.group.userData.hovered = v;
  }

  // ── Frame update + layout ────────────────────────────────────────────────

  update(dt: number) {
    this.clock += dt;

    // Clock tick (cheap interval via accumulated time)
    this.clockTimer += dt;
    if (this.clockTimer > 15) {
      this.clockTimer = 0;
      this.tickClock();
    }

    // Dialog pop-in (easeOutBack)
    if (this.dialogGroup && this.popT < 1) {
      this.popT = Math.min(1, this.popT + dt * 3.4);
      const c1 = 1.70158;
      const t = this.popT - 1;
      const k = 1 + (c1 + 1) * t * t * t + c1 * t * t;
      const base = this.dialogGroup.userData.baseScale ?? 1;
      this.dialogGroup.scale.setScalar(Math.max(0.0001, base * k));
    }

    // Hover springs
    for (const h of this.dialogHots) {
      const target = h.group.userData.hovered ? 1 : 0;
      h.hoverT += (target - h.hoverT) * Math.min(1, dt * 14);
      const k = 1 + h.hoverT * 0.06;
      h.group.scale.set(k, k, 1);
      // Project cards: lift the green spine toward teal as the hover spring grows
      const spine = h.group.userData.spine as THREE.Mesh | undefined;
      if (spine) {
        (spine.material as THREE.MeshBasicMaterial)
          .color.copy(_spineA.setHex(C.green))
          .lerp(_spineB.setHex(C.teal), h.hoverT);
      }
    }

    // Typewriter
    const tt = this.typeTarget;
    if (tt && tt.count < tt.full.length) {
      tt.count = Math.min(tt.full.length, tt.count + dt * 34);
      tt.label.text = tt.full.slice(0, Math.floor(tt.count));
      tt.label.sync();
    }

    // "Continue" caret — reveal once typing is done, then gently bob
    if (this.typeArrow) {
      const done = !tt || tt.count >= tt.full.length;
      this.typeArrow.visible = done;
      if (done) this.typeArrow.position.y = (this.typeArrow.userData.baseY as number) + Math.sin(this.clock * 3) * 0.025;
    }
  }

  layout() {
    const canvas = this.renderer.domElement;
    const aspect = canvas.clientWidth / Math.max(1, canvas.clientHeight);
    const visibleH = 2 * this.PANEL_DIST * Math.tan(THREE.MathUtils.degToRad(this.camera.fov / 2));
    const visibleW = visibleH * aspect;
    const z = -this.PANEL_DIST;

    // HUD top-left
    this.hudGroup.position.set(-visibleW / 2 + 1.31 + 0.14, visibleH / 2 - 0.25 - 0.12, z);
    // Clock bottom-left
    this.clockGroup.position.set(-visibleW / 2 + 0.66 + 0.14, -visibleH / 2 + 0.25 + 0.12, z);

    // Dialog bottom-centre, responsively scaled to fit width
    if (this.dialogGroup) {
      const W = this.dialogGroup.userData.W as number;
      const H = this.dialogGroup.userData.H as number;
      const s = Math.min(1, (visibleW * 0.94) / W, (visibleH * 0.8) / H);
      this.dialogGroup.userData.baseScale = s;
      if (this.popT >= 1) this.dialogGroup.scale.setScalar(s);
      this.dialogGroup.position.set(0, -visibleH / 2 + (H * s) / 2 + 0.14, z);
    }
  }

  dispose() {
    this.renderer.domElement.removeEventListener('pointermove', this.onPointerMove);
    this.clearDialog();
  }
}
