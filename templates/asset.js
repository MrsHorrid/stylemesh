// stylemesh asset pack. Conventions: Y up, the model faces +X, 1 unit ~ 1 metre / Roblox stud.
// Every shape returns geometry already placed; a.add(material, geometry) puts it on the asset.
// Preview it:  stylemesh render __NAME__ --assets <this file> --out __NAME__.png
import { Asset } from '__LIB__/core.js';
import { rbox, rcyl, sphere, cylBetween, cone, at } from '__LIB__/shapes.js';
import { solid, woodPlanks } from '__LIB__/paint.js';

export function __FN__() {
  // outline = ink width in units (ink style); meta is free-form data stored in the GLB extras
  const a = new Asset('__NAME__', { outline: 0.02, meta: { kind: '__KIND__' } });
  a.material('Wood', { paint: woodPlanks('#a8683a', 5) });
  a.material('Metal', { paint: solid('#8a9099') });
  a.material('Glow', { color: '#ffd166' });

  a.add('Wood', rbox(0.6, 0.5, 0.6, 0.06, { p: [0, 0.25, 0] }));               // body
  a.add('Metal', rcyl(0.36, 0.08, 0.03, 20, { p: [0, 0.5, 0] }));              // lid
  a.add('Metal', cylBetween([0, 0.58, 0], [0, 0.78, 0], 0.03));               // handle post
  a.add('Glow', sphere(0.09, { p: [0.31, 0.3, 0] }), { outline: false });     // front light (+X)
  return a;
}

export default [__FN__];
