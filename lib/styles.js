// Art-style presets. An asset is written once; the style decides how it is meshed, painted, outlined and lit.
//
//   outline      multiplier on the asset's inverted-hull ink width (0 = no outline)
//   shading      'smooth' | 'flat'   (flat = faceted normals, the low-poly look)
//   seg          multiplier on every primitive's segment count (lower = chunkier)
//   bevel        multiplier on rounded-box radii (chunkier, softer forms)
//   paint        'texture' (painter as-is) | 'solid' (average colour, no texture)
//              | 'painted' (hand-painted brush strokes) | 'clay' (matte solid + fine grain)
//              | 'pbr' (painter + generated normal map and ORM map, see lib/pbr.js)
//   vertexLight  bake a soft top-light + height AO into vertex colours (COLOR_0)
//   faceJitter   random brightness per face/voxel (0..1), stored in COLOR_0
//   voxel        voxel resolution along the longest side (0/undefined = off)
//   bakeTint     multiply the default tint into the export (off for Roblox, which tints at runtime)
//   mergeFace    fold Eye + Ink into one textured 'Face' mesh (Roblox: avoids lone eye-ball meshes in moderation)
//   viewer       shading mode the viewer uses to preview this style

export const STYLES = {
  ink: {
    label: 'Ink Toon', outline: 1, shading: 'smooth', seg: 1, bevel: 1, paint: 'texture', viewer: 'toon', bakeTint: true,
    blurb: 'Bold ink outlines and soft toon shading (Exquisite Minds look).',
  },
  flat: {
    label: 'Flat Low-Poly', outline: 0, shading: 'flat', seg: 0.42, bevel: 0.5, paint: 'solid', faceJitter: 0.08, viewer: 'flat', bakeTint: true,
    blurb: 'Faceted, few polygons, flat colours with subtle per-face variation.',
  },
  painted: {
    label: 'Hand-Painted', outline: 0, shading: 'smooth', seg: 1, bevel: 1.6, paint: 'painted', vertexLight: true, viewer: 'painted', bakeTint: true,
    blurb: 'Stylised MMO look: painted brush strokes, baked top light and soft shadow.',
  },
  voxel: {
    label: 'Voxel', outline: 0, shading: 'flat', seg: 0.8, bevel: 1, paint: 'solid', voxel: 28, faceJitter: 0.06, viewer: 'flat', bakeTint: true,
    blurb: 'Every asset rebuilt from cubes, block-game style.',
  },
  clay: {
    label: 'Clay', outline: 0, shading: 'smooth', seg: 1.25, bevel: 1.3, paint: 'clay', viewer: 'clay', bakeTint: true,
    blurb: 'Matte plasticine with fine fingerprint grain.',
  },
  pbr: {
    label: 'PBR', outline: 0, shading: 'smooth', seg: 1.4, bevel: 1, paint: 'pbr', viewer: 'pbr', bakeTint: true,
    blurb: 'Physically based: generated normal + roughness/metal/AO maps, for lit engines (Unity, Unreal, Godot, three.js).',
  },
};

// Roblox export used by Reel Raiders: ink style, untinted (the game tints fish per variant).
STYLES.roblox = { ...STYLES.ink, label: 'Ink Toon (Roblox, untinted)', bakeTint: false, mergeFace: true,
  blurb: 'Ink Toon for Roblox: tints left to the game (SurfaceAppearance.Color), eyes merged into a Face mesh.' };

let current = 'ink';
export function setStyle(name) {
  if (!STYLES[name]) throw new Error(`unknown style "${name}" (have: ${Object.keys(STYLES).join(', ')})`);
  current = name;
}
export function getStyle() { return { name: current, ...STYLES[current] }; }
