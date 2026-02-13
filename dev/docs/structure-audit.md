# Structure Audit (Quick Pass)

## Snapshot Summary

- `src/core`: message processing, trigger processing, and shared types.
- `src/platform`: adapter contract + Discord implementation.
- `src/plugins`: plugin manager, plugin helpers, and plugin modules.
- `src/triggers` + `src/controllers`: legacy modules still in use.
- `resources/plugins/<pluginId>` and `data/plugins/<pluginId>` used for plugin-scoped assets/data.

## Sanity Check Notes

- Plugins currently depend on core/platform types via deep relative imports, which is workable but brittle.
- The quotes plugin is a good example of a modular plugin (core logic + per-source modules + resources).
- Legacy triggers/controllers remain active alongside plugins; migration is partial and mixed.
- Command registration is centralized in `Triggers.registerCommands`, which avoids per-plugin Discord coupling.
- Plugin watch exists but is opt-in (`PLUGINS_WATCH=true`), so production safety is preserved.

## Low-Risk Hygiene Improvements (No Behavior Change)

- Added TS path aliases in `tsconfig.json` for future use (no code changes yet).
- Consider a small “plugin API surface” module to avoid deep path traversal when ready.

## Areas to Keep an Eye On

- Keeping plugin imports limited to a stable surface to avoid fragile refactors.
- Clear separation between legacy triggers/controllers vs new plugin modules.
- Ensuring icon/resource paths are consistently plugin-scoped (now supported).
