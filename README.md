# mindstr-maps

Ready-made mind maps for common topics, so [mindstr](https://mindstr.org) can open a good map at once, with no AI call and no API key, when someone searches for something popular.

Served from GitHub Pages, so anyone can fetch them:

- `index.json`: every map, and a `lookup` from each way of asking (the topic and its aliases, as slugs) to the map's file
- `maps/<slug>.json`: a map in the mindstr format (JSON-LD, version 0.2)
- `outlines/<slug>.md`: the source of each map, a Markdown list you can edit

## Finding a map

Turn the search into a slug: lower case, accents dropped, anything between words becomes one hyphen. `Plan a Trip to Japan!` becomes `plan-a-trip-to-japan`. Then look it up in `index.json`'s `lookup`, or fetch `maps/<slug>.json` directly (a 404 is a miss).

Open one in mindstr, growing from its root:

`https://mindstr.org/?uri=https://melvincarvalho.github.io/mindstr-maps/maps/climate-change.json&replay=1s`

## Adding or changing a map

1. Write or edit `outlines/<slug>.md`: one root line, two-space indents, labels of at most 7 words, at most one link per label (the whole label). An optional first line `aliases: a, b` adds other ways to ask.
2. `npm run check` reports problems; `npm run build` writes `maps/` and `index.json`.
3. Commit the outline, the map and the index together.

Rebuilding keeps each map's node ids, so links into a map stay stable.

## Licence

The maps and outlines are [CC0](LICENSE): no rights reserved. Copy, change and mirror them freely.
