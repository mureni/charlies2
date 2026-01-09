# Brain Admin Plugin

Entrypoint
- `index.js`

Layout
- `index.js`: Bootstraps the panel, wires modules, and runs initial loads.
- `template.js`: HTML for the panel plus DOM ref helpers.
- `stats.js`: Snapshot, stats, and top tokens.
- `lexicon.js`: Lexicon explorer and word detail view.
- `ngram.js`: Ngram explorer, detail panel, and graph preview.
- `utils.js`: Small shared helpers.

Notes
- Keep DOM IDs stable because other modules query them via `getBrainRefs()`.
- Prefer adding new features as focused modules under this folder.
