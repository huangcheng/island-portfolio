import * as THREE from 'three';

// ── Palette ────────────────────────────────────────────────────────────────
const SKIN = 0xf9d3a8; // warm light peach (official AC skin tone)
const HAIR_DARK = 0x6b4a2f; // rich brown base
const HAIR_LIGHT = 0x8a5f3d; // lighter highlight layer
const SWEATER = 0x4ea24b; // green knit
const COLLAR = 0xf2e7d2; // cream collar
const SHORTS = 0x3f4a63; // dark slate shorts
const SHOE = 0x7a4f2e; // brown leather
const EYE = 0x2a2024; // near-black eye outline
const IRIS = 0x4a2f1d; // warm dark brown iris
const HIGHLIGHT = 0xffffff; // eye highlight
const BLUSH = 0xf7c8b8; // soft pink cheeks (subtle)
const NOSE = 0xf0a05c; // orange-salmon nose
const MOUTH = 0x5a3d28; // dark brown smile

// ── Layout constants (group origin = feet at y=0) ──────────────────────────
const HIP_Y = 0.62; // body pivot (lean about hips)
const NECK_Y = 1.15; // head pivot
const HEAD_CY = 0.57; // head-centre offset within headGroup (global 1.72)
const HEAD_R = 0.6; // head radius

/**
 * Chibi Animal-Crossing-style villager built entirely from three.js
 * primitives — no external model or texture files. Oversized head, layered
 * brown bob, kawaii face, green sweater outfit, and springy procedural
 * walk/idle animation with eye blinks.
 */
export class Villager {
  readonly group = new THREE.Group();

  // Animated pivots
  private readonly bodyGroup = new THREE.Group();
  private readonly headGroup = new THREE.Group();
  private readonly leftArmPivot = new THREE.Group();
  private readonly rightArmPivot = new THREE.Group();
  private readonly leftLegPivot = new THREE.Group();
  private readonly rightLegPivot = new THREE.Group();
  private readonly eyeGroupL = new THREE.Group();
  private readonly eyeGroupR = new THREE.Group();

  private readonly matCache = new Map<number, THREE.MeshStandardMaterial>();

  /** Desired facing direction (radians, atan2 convention on XZ). */
  heading = Math.PI;
  /** Walk speed in world units / second. */
  speed = 4.4;

  // Animation state
  private walkT = Math.random() * Math.PI * 2;
  private idleT = 0;
  private moveBlend = 0; // 0 = idle, 1 = walking (smoothed)
  private blinkTimer = 2 + Math.random() * 2.5;
  private blinkT = 1; // 0..1 progress through a blink (1 = fully open)
  private blinking = false;
  private readonly blinkDur = 0.14;

  constructor() {
    const mat = (c: number) => {
      let m = this.matCache.get(c);
      if (!m) {
        m = new THREE.MeshStandardMaterial({ color: c, roughness: 0.92, metalness: 0 });
        this.matCache.set(c, m);
      }
      return m;
    };
    const addBall = (
      parent: THREE.Object3D,
      geo: THREE.SphereGeometry,
      color: number,
      pos: [number, number, number],
      scale: [number, number, number] = [1, 1, 1],
      cast = false,
    ) => {
      const m = new THREE.Mesh(geo, mat(color));
      m.position.set(pos[0], pos[1], pos[2]);
      m.scale.set(scale[0], scale[1], scale[2]);
      m.castShadow = cast;
      parent.add(m);
      return m;
    };

    // ── Legs (children of root so they don't lean with the torso) ──────────
    const legGeo = new THREE.CylinderGeometry(0.125, 0.115, 0.34, 14);
    legGeo.translate(0, -0.17, 0);
    const shoeGeo = new THREE.SphereGeometry(0.16, 16, 12);
    for (const [pivot, sx] of [[this.leftLegPivot, -0.17], [this.rightLegPivot, 0.17]] as const) {
      pivot.position.set(sx, 0.52, 0);
      const leg = new THREE.Mesh(legGeo, mat(SHORTS));
      leg.castShadow = true;
      pivot.add(leg);
      const shoe = new THREE.Mesh(shoeGeo, mat(SHOE));
      shoe.position.set(0, -0.42, 0.03);
      shoe.scale.set(1, 0.6, 1.25);
      shoe.rotation.x = -0.12;
      shoe.castShadow = true;
      pivot.add(shoe);
      this.group.add(pivot);
    }

    // ── Body (torso + collar + stripe), pivots at the hips ────────────────
    this.bodyGroup.position.set(0, HIP_Y, 0);

    const torso = new THREE.Mesh(new THREE.SphereGeometry(0.4, 24, 18), mat(SWEATER));
    torso.position.set(0, 0.27, 0);
    torso.scale.set(1.0, 1.04, 0.92);
    torso.castShadow = true;
    this.bodyGroup.add(torso);

    // Cream collar — thin flat ring, a subtle tee neckline
    const collar = new THREE.Mesh(new THREE.TorusGeometry(0.28, 0.032, 10, 24), mat(COLLAR));
    collar.position.set(0, 0.57, 0);
    collar.rotation.x = Math.PI / 2;
    collar.scale.set(1.04, 1, 0.98);
    this.bodyGroup.add(collar);

    // ── Arms (pivot at shoulder) — green sleeve + skin mitten ────────────
    const sleeveGeo = new THREE.CapsuleGeometry(0.105, 0.3, 6, 12);
    sleeveGeo.translate(0, -0.22, 0);
    const mittenGeo = new THREE.SphereGeometry(0.12, 14, 10);
    const armConf = [
      [this.leftArmPivot, -0.41, -0.14],
      [this.rightArmPivot, 0.41, 0.14],
    ] as const;
    for (const [pivot, sx, zRot] of armConf) {
      pivot.position.set(sx, 0.44, 0);
      pivot.rotation.z = zRot;
      const sleeve = new THREE.Mesh(sleeveGeo, mat(SWEATER));
      sleeve.castShadow = true;
      pivot.add(sleeve);
      const mitten = new THREE.Mesh(mittenGeo, mat(SKIN));
      mitten.position.set(0, -0.46, 0);
      pivot.add(mitten);
      this.bodyGroup.add(pivot);
    }

    // ── Head group (pivot at neck so tilts read naturally) ───────────────
    this.headGroup.position.set(0, NECK_Y - HIP_Y, 0);
    this.bodyGroup.add(this.headGroup);

    // Head — the official AC "potato": clearly wider than tall, broad face plane
    const head = new THREE.Mesh(new THREE.SphereGeometry(HEAD_R, 32, 26), mat(SKIN));
    head.position.set(0, HEAD_CY, 0);
    head.scale.set(1.14, 0.9, 1.04);
    head.castShadow = true;
    this.headGroup.add(head);

    this.buildHair(mat, addBall);
    this.buildFace(mat);

    this.group.add(this.bodyGroup);
  }

  /** Layered brown bob: scalp cap, highlight crown, bangs, side strands, back. */
  private buildHair(
    mat: (c: number) => THREE.MeshStandardMaterial,
    addBall: (
      p: THREE.Object3D,
      g: THREE.SphereGeometry,
      c: number,
      pos: [number, number, number],
      s?: [number, number, number],
      cast?: boolean,
    ) => THREE.Mesh,
  ) {
    const hg = this.headGroup;

    // Main scalp cap — smooth AC helmet covering the top ~45% of the head
    const scalp = new THREE.Mesh(
      new THREE.SphereGeometry(HEAD_R + 0.04, 36, 24, 0, Math.PI * 2, 0, 1.3),
      mat(HAIR_DARK),
    );
    scalp.position.set(0, HEAD_CY + 0.05, -0.03);
    scalp.scale.set(1.09, 0.98, 1.06);
    scalp.castShadow = true;
    hg.add(scalp);

    // Lighter highlight crown — a smaller cap sitting on top
    const crown = new THREE.Mesh(
      new THREE.SphereGeometry(HEAD_R + 0.05, 28, 18, 0, Math.PI * 2, 0, 0.92),
      mat(HAIR_LIGHT),
    );
    crown.position.set(0, HEAD_CY + 0.08, -0.05);
    crown.scale.set(1.02, 0.68, 1.02);
    hg.add(crown);

    // Deep fringe — ONE wide band from the crown down to just above the
    // brows (the official AC look: bangs cover the whole upper face)
    const fringe = new THREE.Mesh(new THREE.SphereGeometry(0.34, 24, 16), mat(HAIR_DARK));
    fringe.position.set(0, HEAD_CY + 0.3, 0.395);
    fringe.scale.set(1.62, 0.56, 0.72);
    fringe.rotation.x = -0.06;
    fringe.castShadow = true;
    hg.add(fringe);

    // Side swoops hugging the cheeks, reaching down toward the jaw (AC bob)
    const sideGeo = new THREE.SphereGeometry(0.14, 14, 12);
    for (const sx of [-0.5, 0.5]) {
      const s = addBall(hg, sideGeo, HAIR_DARK, [sx, HEAD_CY - 0.1, 0.26], [0.72, 1.6, 0.72]);
      s.rotation.z = sx < 0 ? 0.08 : -0.08;
    }

    // Small round ears peeking out at the sides
    const earGeo = new THREE.SphereGeometry(0.095, 12, 10);
    for (const sx of [-0.68, 0.68]) {
      addBall(hg, earGeo, SKIN, [sx, HEAD_CY - 0.04, 0.06], [0.55, 1, 0.7]);
    }

    // Back volume — rounded clump behind/below for the bob silhouette
    const back = new THREE.Mesh(new THREE.SphereGeometry(0.23, 18, 14), mat(HAIR_DARK));
    back.position.set(0, HEAD_CY - 0.02, -0.36);
    back.scale.set(1.15, 1.0, 1.0);
    back.castShadow = true;
    hg.add(back);
  }

  /** Medium AC: outlined oval eyes with iris + highlight, orange-salmon
   *  nose, soft blush, and a thin dark-brown smile. */
  private buildFace(mat: (c: number) => THREE.MeshStandardMaterial) {
    const hg = this.headGroup;

    // Eyes — big AC ovals at mid-face (dark rim + warm brown iris + single
    // highlight), grouped so blinks squash the whole eye on y.
    const outlineGeo = new THREE.SphereGeometry(0.11, 16, 14);
    const irisGeo = new THREE.SphereGeometry(0.08, 14, 12);
    const highlightGeo = new THREE.SphereGeometry(0.03, 10, 8);
    for (const [grp, sx] of [[this.eyeGroupL, -0.24], [this.eyeGroupR, 0.24]] as const) {
      grp.position.set(sx, HEAD_CY - 0.04, 0.545); // mid-face, wide apart, proud of surface
      const outline = new THREE.Mesh(outlineGeo, mat(EYE));
      outline.scale.set(0.88, 1.1, 0.45);
      grp.add(outline);
      const iris = new THREE.Mesh(irisGeo, mat(IRIS));
      iris.position.set(0, 0, 0.03); // sits just ahead of the rim centre
      iris.scale.set(0.95, 1.05, 0.5);
      grp.add(iris);
      const hi = new THREE.Mesh(highlightGeo, mat(HIGHLIGHT));
      hi.position.set(sx < 0 ? 0.026 : -0.026, 0.038, 0.05); // upper-inner
      grp.add(hi);
      hg.add(grp);
    }

    // Thin arc eyebrows — clearly BELOW the fringe, right above the eyes
    const browGeo = new THREE.TorusGeometry(0.06, 0.016, 6, 14, Math.PI * 0.85);
    for (const sx of [-0.24, 0.24]) {
      const brow = new THREE.Mesh(browGeo, mat(HAIR_DARK));
      brow.position.set(sx, HEAD_CY + 0.1, 0.54);
      brow.rotation.set(-0.1, 0, sx < 0 ? 0.15 : -0.15);
      hg.add(brow);
    }

    // Signature AC nose — tiny flat orange triangle decal (rounded corners)
    const noseShape = new THREE.Shape();
    noseShape.moveTo(0, -0.052);
    noseShape.quadraticCurveTo(0.052, -0.01, 0.048, 0.022);
    noseShape.quadraticCurveTo(0.048, 0.034, 0.02, 0.034);
    noseShape.lineTo(-0.02, 0.034);
    noseShape.quadraticCurveTo(-0.048, 0.034, -0.048, 0.022);
    noseShape.quadraticCurveTo(-0.052, -0.01, 0, -0.052);
    const nose = new THREE.Mesh(new THREE.ShapeGeometry(noseShape), mat(NOSE));
    nose.position.set(0, HEAD_CY - 0.14, 0.605);
    hg.add(nose);

    // Soft blush cheeks — subtle, low and outer
    const blushGeo = new THREE.SphereGeometry(0.06, 12, 10);
    for (const sx of [-0.38, 0.38]) {
      const bl = new THREE.Mesh(blushGeo, mat(BLUSH));
      bl.position.set(sx, HEAD_CY - 0.14, 0.495);
      bl.scale.set(1, 0.5, 0.35);
      hg.add(bl);
    }

    // Gentle smile — thin dark-brown half-torus arc
    const smile = new THREE.Mesh(new THREE.TorusGeometry(0.095, 0.018, 8, 18, Math.PI), mat(MOUTH));
    smile.position.set(0, HEAD_CY - 0.24, 0.565);
    smile.rotation.set(-0.12, 0, Math.PI);
    hg.add(smile);
  }

  get position() {
    return this.group.position;
  }

  /** Move toward a point on the XZ plane. Returns true when arrived. */
  moveToward(target: THREE.Vector3, dt: number): boolean {
    const dx = target.x - this.group.position.x;
    const dz = target.z - this.group.position.z;
    const dist = Math.hypot(dx, dz);
    if (dist < 0.1) return true;
    const step = Math.min(dist, this.speed * dt);
    const dir = Math.atan2(dx, dz);
    this.heading = dir;
    this.group.position.x += Math.sin(dir) * step;
    this.group.position.z += Math.cos(dir) * step;
    return dist - step < 0.1;
  }

  /** Move along a normalised direction for this frame. */
  moveDirection(dirX: number, dirZ: number, dt: number) {
    this.heading = Math.atan2(dirX, dirZ);
    this.group.position.x += dirX * this.speed * dt;
    this.group.position.z += dirZ * this.speed * dt;
  }

  update(dt: number, moving: boolean) {
    // Smoothly turn toward heading (exponential, unchanged behaviour)
    let diff = this.heading - this.group.rotation.y;
    diff = Math.atan2(Math.sin(diff), Math.cos(diff));
    this.group.rotation.y += diff * Math.min(1, dt * 11);

    // Blend between idle (0) and walking (1) over ~0.13 s
    const target = moving ? 1 : 0;
    this.moveBlend += (target - this.moveBlend) * (1 - Math.exp(-dt / 0.08));
    const b = this.moveBlend;

    this.walkT += dt * 9.5;
    this.idleT += dt;
    this.updateBlink(dt);

    const s = Math.sin(this.walkT); // leg phase

    // ── Legs: pendulum swing from the hips ────────────────────────────────
    const legAmp = 0.72;
    this.leftLegPivot.rotation.x = s * legAmp * b;
    this.rightLegPivot.rotation.x = -s * legAmp * b;

    // ── Arms: opposite to legs, lagging slightly ─────────────────────────
    const ap = Math.sin(this.walkT - 0.45);
    const armAmp = 0.62;
    const armIdle = Math.sin(this.idleT * 1.6) * 0.06;
    this.leftArmPivot.rotation.x = -ap * armAmp * b + armIdle * (1 - b);
    this.rightArmPivot.rotation.x = ap * armAmp * b + armIdle * (1 - b);

    // ── Body: forward lean + roll + squash & stretch ─────────────────────
    const lean = 0.07 * b;
    const idleLean = Math.sin(this.idleT * 1.3) * 0.014 * (1 - b);
    this.bodyGroup.rotation.x = lean + idleLean;
    this.bodyGroup.rotation.z = Math.sin(this.walkT) * 0.04 * b;

    const squash = Math.sin(this.walkT * 2) * 0.035 * b; // 2× leg freq bounce
    const breathe = Math.sin(this.idleT * 2.1) * 0.02 * (1 - b);
    const sy = squash + breathe;
    this.bodyGroup.scale.set(1 - sy * 0.5, 1 + sy, 1 - sy * 0.5);

    // ── Head: counter-bob while walking, gentle sway/tilt when idle ──────
    this.headGroup.rotation.x = -Math.sin(this.walkT * 2) * 0.03 * b - lean * 0.25;
    this.headGroup.rotation.z = Math.sin(this.idleT * 0.8) * 0.05 * (1 - b);
    this.headGroup.rotation.y = Math.sin(this.idleT * 0.6) * 0.04 * (1 - b);

    // ── Vertical hop (walk) + soft breathing bob (idle) ──────────────────
    const hop = Math.abs(Math.sin(this.walkT)) * 0.05 * b;
    const idleBob = Math.sin(this.idleT * 2.1) * 0.012 * (1 - b);
    this.group.position.y = hop + idleBob;
  }

  /** Randomised eye blink on its own timer, independent of motion state. */
  private updateBlink(dt: number) {
    if (this.blinking) {
      this.blinkT += dt / this.blinkDur;
      if (this.blinkT >= 1) {
        this.blinking = false;
        this.blinkT = 1;
        this.blinkTimer = 2.5 + Math.random() * 2.5;
      }
    } else {
      this.blinkTimer -= dt;
      if (this.blinkTimer <= 0) {
        this.blinking = true;
        this.blinkT = 0;
      }
    }
    // 1 → open, dips to ~0.1 mid-blink (cos curve), symmetric open/close
    const k = this.blinking ? 0.1 + 0.9 * Math.abs(Math.cos(this.blinkT * Math.PI)) : 1;
    this.eyeGroupL.scale.y = k;
    this.eyeGroupR.scale.y = k;
  }
}
