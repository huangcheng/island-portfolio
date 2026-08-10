import * as THREE from 'three';
import type { IslandTheme } from '../theme';
import { std } from './core';
import { makeGrassTexture, makeSandTexture, makeDirtTexture } from './textures';

export interface BaseBuild {
  group: THREE.Group;
  walkSurface: THREE.Mesh;
  sea: THREE.Mesh;
  foam: THREE.Mesh[];
  waves: THREE.Mesh[];
}

/**
 * Stylized-realistic AC water shader: animated wave normals + banded sun
 * glints + twinkling horizon sparkles — realistic shading, cartoon palette.
 */
function makeSeaMaterial(): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uSunDir: { value: new THREE.Vector3(13, 15, 9).normalize() },
      uNight: { value: 0 },
    },
    vertexShader: /* glsl */ `
      varying vec3 vWorld;
      void main() {
        vec4 wp = modelMatrix * vec4(position, 1.0);
        vWorld = wp.xyz;
        gl_Position = projectionMatrix * viewMatrix * wp;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float uTime;
      uniform vec3 uSunDir;
      uniform float uNight;
      varying vec3 vWorld;

      float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      float noise(vec2 p) {
        vec2 i = floor(p), f = fract(p);
        f = f * f * (3.0 - 2.0 * f);
        return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x),
                   mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), f.x), f.y);
      }

      void main() {
        float r = length(vWorld.xz);
        vec2 p = vWorld.xz;
        float t = uTime;

        // Depth gradient: aqua shallows → rich blue deep water (quick falloff,
        // like the refs: it gets properly BLUE just past the shallow ring)
        vec3 col = mix(vec3(0.38, 0.76, 0.86), vec3(0.16, 0.5, 0.8), smoothstep(18.0, 33.0, r));
        col = mix(col, vec3(0.08, 0.32, 0.65), smoothstep(33.0, 85.0, r));

        // Animated wave normal (traveling sines + noise ripple)
        float nx = sin(p.x * 0.32 + t * 1.1) * 0.35 + sin(p.x * 0.13 - t * 0.7) * 0.5
                 + (noise(p * 0.22 + t * 0.25) - 0.5) * 0.8;
        float nz = sin(p.y * 0.29 - t * 0.9) * 0.35 + sin(p.y * 0.15 + t * 0.6) * 0.5
                 + (noise(p * 0.19 - t * 0.2) - 0.5) * 0.8;
        vec3 n = normalize(vec3(nx * 0.35, 1.0, nz * 0.35));

        // Banded sun glints — the "realistic but toon" highlight
        vec3 viewDir = normalize(cameraPosition - vWorld);
        vec3 h = normalize(uSunDir + viewDir);
        float spec = pow(max(dot(n, h), 0.0), 90.0);
        col += vec3(1.0, 0.96, 0.82) * smoothstep(0.25, 0.75, spec) * 0.65;

        // Moving light/shadow ripple bands so the surface lives even off-glint
        float shade = noise(p * 0.33 + t * 0.2) * 0.6 + noise(p * 0.11 - t * 0.08) * 0.4;
        col *= 0.93 + shade * 0.14;

        // Twinkling sparkles out toward the horizon (AC signature dots)
        float sparkle = step(0.988, hash(floor(p * 3.0) + floor(t * 3.0)))
                      * smoothstep(24.0, 40.0, r);
        col += vec3(0.9) * sparkle;

        // Subtle animated caustic web in the shallows
        float ca = noise(p * 0.5 + t * 0.15) * noise(p * 0.45 - t * 0.12);
        col += vec3(0.10, 0.18, 0.20) * smoothstep(0.24, 0.4, ca) * (1.0 - smoothstep(30.0, 60.0, r));

        // Moonlit tint at night
        col *= mix(vec3(1.0), vec3(0.16, 0.24, 0.46), uNight * 0.82);

        gl_FragColor = vec4(col, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }
    `,
    fog: false,
  });
}

/**
 * Organic wavy foam line hugging the shore — the real AC foam is a thin
 * hand-drawn wavy band that breathes in/out, NOT a chain of dots.
 */
function makeFoamRibbon(radius: number, width: number, waves: number, amp: number, phase: number): THREE.BufferGeometry {
  const segs = 240;
  const positions: number[] = [];
  const indices: number[] = [];
  for (let i = 0; i <= segs; i++) {
    const t = (i / segs) * Math.PI * 2;
    const wob = Math.sin(t * waves + phase) * amp + Math.sin(t * waves * 2.3 + phase * 1.7) * amp * 0.35;
    const r = radius + wob;
    positions.push(Math.cos(t) * (r + width / 2), 0, Math.sin(t) * (r + width / 2));
    positions.push(Math.cos(t) * (r - width / 2), 0, Math.sin(t) * (r - width / 2));
    if (i < segs) {
      const a = i * 2;
      indices.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}

/** Small white "mustache" wave-crest mark (flat partial torus arc). */
function makeWaveCrest(rng: () => number): THREE.Mesh {
  const r = 0.26 + rng() * 0.22;
  const arc = 1.0 + rng() * 0.5;
  const geo = new THREE.TorusGeometry(r, 0.034, 6, 14, arc);
  geo.rotateX(-Math.PI / 2); // bake flat onto XZ
  const crest = new THREE.Mesh(
    geo,
    new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.4 }),
  );
  crest.rotation.y = rng() * Math.PI * 2;
  return crest;
}

/**
 * Parameterized base world: terrain/sand/cliff/sea/foam/waves/walk surface.
 * `rng` is the island module's shared stream — the 44 wave crests consume it
 * here, exactly where the monolithic buildIsland() did, so downstream flora
 * placement stays identical.
 */
export function buildBase(theme: IslandTheme, rng: () => number): BaseBuild {
  const group = new THREE.Group();
  const foam: THREE.Mesh[] = [];

  // ── Terrain: ORGANIC wavy grass edge over beach sand, layered dirt cliff ──
  // A perfect circle edge reads as a hard "cutting line" — AC shorelines wobble.
  const grassMat = new THREE.MeshStandardMaterial({
    map: makeGrassTexture(theme.turf.base, theme.turf.shades),
    roughness: 0.92,
  });
  const grassShape = new THREE.Shape();
  const EDGE_N = 128;
  for (let i = 0; i <= EDGE_N; i++) {
    const t = (i / EDGE_N) * Math.PI * 2;
    const r =
      15 +
      Math.sin(t * theme.outline.f1 + theme.outline.p1) * 0.3 +
      Math.sin(t * theme.outline.f2 + theme.outline.p2) * 0.16;
    const x = Math.cos(t) * r;
    const y = Math.sin(t) * r;
    if (i === 0) grassShape.moveTo(x, y);
    else grassShape.lineTo(x, y);
  }
  const grassGeo = new THREE.ShapeGeometry(grassShape, 4);
  // ShapeGeometry UVs are raw XY coords — normalise to 0..1 so the grass
  // texture tiles exactly like the old CircleGeometry (repeat 2×)
  {
    const pos = grassGeo.attributes.position;
    const uvs = grassGeo.attributes.uv;
    for (let i = 0; i < pos.count; i++) {
      uvs.setXY(i, pos.getX(i) / 32 + 0.5, pos.getY(i) / 32 + 0.5);
    }
    uvs.needsUpdate = true;
  }
  const grass = new THREE.Mesh(grassGeo, grassMat);
  grass.rotation.x = -Math.PI / 2;
  grass.position.y = 0.02;
  grass.receiveShadow = true;

  // Beach sand ring (full disc, grass sits on top revealing the ring 15→18)
  const sand = new THREE.Mesh(
    new THREE.CircleGeometry(18, 96),
    new THREE.MeshStandardMaterial({ map: makeSandTexture(theme.sand.base), roughness: 0.95 }),
  );
  sand.rotation.x = -Math.PI / 2;
  sand.position.y = -0.04;
  sand.receiveShadow = true;
  // Wet-sand band near the water line
  const wet = new THREE.Mesh(new THREE.RingGeometry(17.0, 17.85, 96), std(theme.sand.wet, 0.7));
  wet.rotation.x = -Math.PI / 2;
  wet.position.y = -0.03;

  // Layered dirt cliff (3 graduated-brown tiers) — the island wall into the sea
  const cliffA = new THREE.Mesh(
    new THREE.CylinderGeometry(18.0, 18.35, 0.5, 96),
    new THREE.MeshStandardMaterial({ map: makeDirtTexture('#a06a3f', '#8a5a33'), roughness: 0.95 }),
  );
  cliffA.position.y = -0.3;
  cliffA.receiveShadow = true;
  cliffA.castShadow = true;
  const cliffB = new THREE.Mesh(
    new THREE.CylinderGeometry(18.35, 18.75, 0.52, 96),
    new THREE.MeshStandardMaterial({ map: makeDirtTexture('#8a5a33', '#6e4424'), roughness: 0.95 }),
  );
  cliffB.position.y = -0.82;
  cliffB.receiveShadow = true;
  cliffB.castShadow = true;
  const cliffC = new THREE.Mesh(
    new THREE.CylinderGeometry(18.75, 19.4, 0.62, 96),
    new THREE.MeshStandardMaterial({ map: makeDirtTexture('#6e4424', '#54331a'), roughness: 0.95 }),
  );
  cliffC.position.y = -1.38;
  cliffC.receiveShadow = true;

  // Sea disc with the stylized-realistic water shader (engine feeds uTime)
  const sea = new THREE.Mesh(new THREE.CircleGeometry(110, 96), makeSeaMaterial());
  sea.rotation.x = -Math.PI / 2;
  sea.position.y = -1.15;

  // Translucent shallow-water zone right off the cliff (clear aqua over sand)
  const shallow = new THREE.Mesh(
    new THREE.RingGeometry(18.8, 21.6, 96),
    new THREE.MeshStandardMaterial({ color: 0x9fe4f2, transparent: true, opacity: 0.5, roughness: 0.12 }),
  );
  shallow.rotation.x = -Math.PI / 2;
  shallow.position.y = -1.13;

  // Organic wavy foam lines (engine pulses them in/out — the AC foam breath)
  const foamMatBase = () =>
    new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.88, side: THREE.DoubleSide });
  // Crisp white waterline right at the cliff/water junction
  const waterline = new THREE.Mesh(new THREE.TorusGeometry(19.05, 0.055, 6, 140), foamMatBase());
  waterline.rotation.x = -Math.PI / 2;
  waterline.position.y = -1.12;
  // Main foam line hugging the shore — long slow waves
  const foamIn = new THREE.Mesh(makeFoamRibbon(19.55, 0.3, 5, 0.32, 0), foamMatBase());
  foamIn.position.y = -1.05;
  (foamIn.material as THREE.MeshBasicMaterial).opacity = 0.95;
  // Second fainter wavy line further out, different rhythm
  const foamOut = new THREE.Mesh(makeFoamRibbon(21.3, 0.17, 7, 0.48, 2.1), foamMatBase());
  foamOut.position.y = -1.08;
  (foamOut.material as THREE.MeshBasicMaterial).opacity = 0.4;
  foam.push(waterline, foamIn, foamOut);
  group.add(shallow, waterline, foamIn, foamOut);

  // Wave-crest marks scattered on the water (engine bobs + shimmers them)
  const waves: THREE.Mesh[] = [];
  for (let i = 0; i < 44; i++) {
    const ang = rng() * Math.PI * 2;
    const wr = 21.5 + rng() * 36;
    const crest = makeWaveCrest(rng);
    crest.position.set(Math.cos(ang) * wr, -1.06, Math.sin(ang) * wr);
    waves.push(crest);
    group.add(crest);
  }

  // Invisible walk raycast surface
  const walkSurface = new THREE.Mesh(
    new THREE.CircleGeometry(17.6, 48),
    new THREE.MeshBasicMaterial({ visible: false }),
  );
  walkSurface.rotation.x = -Math.PI / 2;
  walkSurface.position.y = 0.02;

  // ── Subtle darker-green tonal patches for grass variation ──────────────────
  // Large, very transparent dark circles laid just above the grass,
  // placed away from the plaza/paths so they read as gentle meadow variation.
  const patchMat = new THREE.MeshBasicMaterial({
    color: theme.turf.dark,
    transparent: true,
    opacity: 0.25,
    depthWrite: false,
  });
  const grassPatches: [number, number, number][] = [
    [-7.5, 6.5, 3.2],
    [9.0, 4.5, 2.6],
    [4.5, -8.5, 3.6],
  ];
  for (const [px, pz, pr] of grassPatches) {
    const patch = new THREE.Mesh(new THREE.CircleGeometry(pr, 32), patchMat);
    patch.rotation.x = -Math.PI / 2;
    patch.position.set(px, 0.021, pz);
    group.add(patch);
  }

  group.add(cliffC, cliffB, cliffA, sand, wet, sea, grass, walkSurface);

  return { group, walkSurface, sea, foam, waves };
}
