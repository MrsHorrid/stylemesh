# AGENTS.md: stylemesh for AI agents

stylemesh turns a short JavaScript file into a game-ready GLB model, in any of several art styles. You can't see a viewport, so the toolchain gives you eyes: `render` draws PNG contact sheets on the CPU, and `check` catches broken geometry. Everything returns JSON.

## The loop

1. `stylemesh new Prop_Thing --file assets/thing.js` (or edit an existing pack)
2. Edit the factory function.
3. `stylemesh render Prop_Thing --assets assets/thing.js --out thing.png`, then **open the PNG and look at it**.
4. Repeat steps 2 and 3 until the side, front, top and iso views all read right.
5. `stylemesh check Prop_Thing --assets assets/thing.js --style all --json` must report `"ok": true`.
6. `stylemesh build Prop_Thing --assets assets/thing.js --style all --out out`

Never report an asset done without rendering it. Ink outlines, floating parts, wrong facing and inside-out shapes are only visible in the render.

Over MCP the same loop is `guide`, `new_asset`, edit, `render_asset` (returns the image), `check_assets`, `build_assets`.

## Setup

```bash
npm install                                  # Node >= 20, no GPU or browser needed
node cli.js help
claude mcp add stylemesh -- node "$PWD/cli.js" mcp    # optional: MCP tools for Claude Code
```

Inside this repo, `.mcp.json` already registers the server.

## CLI contract

- Add `--json` and stdout is exactly one JSON object: `{"ok":true, ...}` or `{"ok":false,"error":{"code","message","hint"}}`.
- Exit codes: 0 ok, 1 failure, 2 bad arguments.
- Error codes: `UNKNOWN_ASSET`, `UNKNOWN_STYLE`, `UNKNOWN_COMMAND`, `BAD_ARGS`, `SOURCE_NOT_FOUND`, `DUPLICATE_ASSET`, `ASSET_ERROR`, `EXISTS`. Read `hint`: it says what to run next.
- `--assets <file|dir>` (repeatable) picks asset packs. Without it, stylemesh uses `$STYLEMESH_ASSETS` (path-list), then `stylemesh.config.json` `{"assets": [...], "out": "..."}` in the cwd, then the built-in examples.

| command | what it does |
|---|---|
| `list [assets\|styles]` | names, kinds, source files; or styles and their knobs |
| `inspect <Asset> [--style s]` | materials (colour, tint, painter, PBR hint), parts, tris, bounds |
| `render <Asset> [--style s] [--views side,front,back,top,iso] [--size 384] [--out f.png]` | PNG contact sheet |
| `check [Asset...] [--style s\|a,b\|all] [--verbose]` | NaN, missing UVs, degenerate tris, tri budget (20k), scale, unused materials, names |
| `build [Asset...] [--style ...] [--out dir] [--flat]` | `<out>/<style>/<Asset>.glb` + `index.json`, `<out>/catalog.json` |
| `new <Asset> [--file f] [--kind k]` | scaffold a pack from `templates/asset.js` |
| `view [--dir out]` | three.js viewer at http://localhost:5177 with a style switcher |
| `mcp` | MCP server on stdio |

`--style all` means every style except `roblox`, which is a target variant of `ink`.

## Writing an asset

An asset pack is an ES module. `export default [factoryA, factoryB]`. Each factory takes no arguments and returns an `Asset`.

```js
import { Asset } from 'stylemesh/core';          // in this repo: '../lib/core.js'
import { rbox, rcyl, sphere, cylBetween, cone, tube, body, lathe, smoothFin, at } from 'stylemesh/shapes';
import { solid, woodPlanks, stripes, fishBody, finRays, sandSpeckle, sign } from 'stylemesh/paint';

export function lantern() {
  const a = new Asset('Prop_Lantern', { outline: 0.02, meta: { kind: 'prop' } });
  a.material('Metal', { paint: solid('#8a9099') });
  a.material('Glass', { color: '#cfe8ff' });
  a.material('Glow', { color: '#ffd166' });
  a.add('Metal', rcyl(0.18, 0.05, 0.02, 20, { p: [0, 0, 0] }));
  a.add('Glass', rcyl(0.15, 0.3, 0.03, 20, { p: [0, 0.05, 0] }));
  a.add('Glow', sphere(0.07, { p: [0, 0.2, 0] }), { outline: false });
  return a;
}
export default [lantern];
```

### Conventions (check them in the render)

- **Y up. The model faces +X. Z is its side.** In the `side` view, front points right. In `top`, front points up.
- 1 unit is about 1 metre or 1 Roblox stud. Fish are about 1.2 units long; props are at real-world-ish size. Rest the model on y = 0.
- Asset names are `[A-Za-z][A-Za-z0-9_]*`, conventionally `Kind_Name` (`Fish_Guppling`, `Prop_Boat`). The name becomes the file name.
- Each material becomes one mesh part in the GLB, named after the material. Keep part counts low, at most about 6.
- Assets must be deterministic: same code, same mesh. Use the `seed` arguments, never `Math.random()`.

### Asset API (`lib/core.js`)

- `new Asset(name, { outline = 0.03, meta })`
  - `outline` is the ink hull width in units, scaled by the style (0 in non-ink styles).
  - `meta` is free-form and lands in GLB extras.
- `a.material(name, def)`, where `def` is one of:
  - `{ color: '#hex' }`: a solid colour.
  - `{ paint: painter, size: 512, tint: '#hex' }`: a canvas texture. The tint multiplies the texture when the style bakes tints (all styles except `roblox`).
  - Optional on either: `pbr: { rough, metal, kind, emissive, alpha }`, an override for the `pbr` style.
  - The `Ink` material (`#16131a`) always exists. Use it for pupils and dark details.
- `a.add(material, geometry, { outline: true, outlineScale: 1 })`
  - Pass `outline: false` for small inner details: pupils, glints, decals sitting on a surface.
  - `geometry` may be an array; `pineTiers` returns one.

### Shapes (`lib/shapes.js`)

Every shape returns geometry already placed. Positions are `[x, y, z]`, and `opts` is `{ p, r (degrees), s }` unless noted.

| shape | signature | notes |
|---|---|---|
| `sphere` | `(r, { p, s, seg, rings })` | `s` squashes it: `s: [1.3, 0.8, 1]` |
| `rbox` | `(w, h, d, radius, opts)` | rounded box, centred on `p` |
| `rcyl` | `(r, h, bevel, seg, opts)` | soft cylinder, axis Y, **base** at `p` |
| `cylBetween` | `(a, b, r, rTop = r, seg)` | rods, posts, limbs, between two points |
| `cone` | `(a, b, r, seg)` | spikes, horns, roofs |
| `lathe` | `([[radius, y], ...], seg, opts)` | bottles, buoys, lighthouses |
| `tube` | `(points, [[ry, rz], ...], { n, caps })` | lofted body along a path with elliptical rings |
| `body` | `([[x, ry, rz, y], ...], opts)` | fish or creature body along X |
| `fin` / `smoothFin` | `([[x, y], ...], depth, opts)` | flat extruded outline in XY, centred on Z (tails, fins, signs, leaves) |
| `pineTiers` | `(h, r, tiers, seg)` | returns an array of cones |
| `at` | `(geometry, { p, r, s })` | transform any geometry |

Segment counts and bevels scale with the style automatically: `flat` uses fewer segments, `pbr` and `clay` use more.

### Painters (`lib/paint.js`)

Each painter returns a canvas painter function, which is the material's `paint`.

| painter | signature | notes |
|---|---|---|
| `solid` | `(hex, seed, noise)` | soft colour with slight noise |
| `woodPlanks` | `(base, planks, seed)` | |
| `stripes` | `(c1, c2, n, vertical)` | |
| `sandSpeckle` | `(base)` | |
| `fishBody` | `(pattern, seed)` | `pattern` is `'scales' \| 'stripes' \| 'spots' \| 'bands'`. Greyscale: give it a `tint`. |
| `finRays` | `(rays)` | greyscale |
| `sign` | `(text, bg, fg)` | text plate; never filtered or averaged |

You can also write a custom painter: `(ctx, w, h) => { ... }` on a 2D canvas.

- UVs: `body` and `tube` wrap u around the body and run v along it.
- Fins map the XY bounds to 0..1.

### Styles (`lib/styles.js`)

`ink`, `flat`, `painted`, `voxel`, `clay`, `pbr` and `roblox`.

- `stylemesh list styles --json` lists their knobs.
- To add a style, add an entry to `STYLES`. The knobs are documented at the top of the file.
- Assets read the active style while they are built. Never cache geometry across styles.

### PBR (`lib/pbr.js`)

- Each material's painter gives it a height field: the painter's detail plus noise for its surface kind.
- From that, stylemesh writes a normal map and an ORM texture.
- Roughness, metal, emission and alpha come from the material name (`HINTS`: `Metal`, `Iron`, `Glass`, `Lamp`, `Glow`, `Rock`, `Wood`, ...) or from `def.pbr`.

## Repo map

| path | contents |
|---|---|
| `cli.js` | CLI (arg parsing, JSON envelope) |
| `mcp.js` | MCP server (hand-rolled JSON-RPC over stdio, no SDK) |
| `lib/api.js` | functions shared by the CLI and MCP. Never writes to stdout. |
| `lib/core.js` | `Asset`, outlines (inverted hull), voxelizer, vertex light, GLB writer |
| `lib/shapes.js`, `lib/paint.js`, `lib/styles.js`, `lib/pbr.js` | see above |
| `lib/render.js` | CPU rasterizer for previews (z-buffer, culling, textures, alpha) |
| `lib/registry.js` | loads asset packs. Cache-busts on mtime, so a long-lived MCP server sees edits. |
| `viewer/` | browser viewer (`stylemesh view`) |
| `templates/asset.js` | `stylemesh new` template |
| `examples/reelraiders/` | 15 fish and 15 props from the game Reel Raiders |
| `test/` | `node --test`: builds, renders and checks every example in every style |

## Contributing (agents and humans)

- Run `npm test` before you commit. It must pass.
- Visual changes to styles, the renderer or painters: render a before and after contact sheet and look at both.
- `lib/api.js` and everything it imports must never `console.log`. The MCP server's stdout is the protocol.
- Keep dependencies minimal: three, @gltf-transform/core and @napi-rs/canvas. No native GPU dependencies.
- Never commit `out/` or `*.png` renders. Both are gitignored.
