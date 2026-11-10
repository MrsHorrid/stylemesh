# Reel Raiders examples

15 fish and 15 props from the Roblox fishing game Reel Raiders.

- Fish are greyscale where the game tints them per variant; `tint` is the default look.
- Props are full colour.

Exports the game uses (run from the stylemesh folder, with the game repo one level up):

```bash
node cli.js build --style roblox --flat --out ../models   # meshes uploaded to Roblox
node cli.js build --style all --out ../models/styles      # every style, for the viewer
```
