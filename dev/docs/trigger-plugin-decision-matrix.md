# Trigger/Plugin Refactor Decision Matrix

This document frames the key decisions, options, and tradeoffs for moving from the current trigger/controller layout to a hot-loadable plugin system with optional structured commands (e.g., slash commands).

## Goals

- Unify `/controllers` and `/triggers` under a single plugin concept.
- Keep message-based triggers working as-is during migration.
- Add structured commands as a platform-agnostic capability (not Discord-only).
- Enable safe hot-reload in development without production instability.

## Current State (Brief)

- Triggers are loaded from `src/triggers` and executed in `src/core/triggerProcessor.ts`.
- Controllers are separate modules under `src/controllers`.
- Discord adapter attaches platform utilities to `CoreMessage`.
- Tests exist (Vitest + sqlite test), but no plugin harness yet.

## Decision Matrix

| Decision Area | Option A | Option B | Considerations | Open Questions |
| --- | --- | --- | --- | --- |
| Plugin Location | Local modules in repo (`src/plugins`) | External plugin directory (`plugins/` with its own package.json) | External plugins are flexible but add security and versioning risk. | Do we ever want third-party plugins? |
| Plugin Contract | Single interface with optional handlers | Separate interfaces for message vs command plugins | Single contract is simpler; split contracts reduce optional fields. | Do we want strict validation at load time? |
| Command System | Platform-agnostic command schema | Platform-specific commands with adapters | Agnostic schema reduces duplication; platform-specific can be richer. | How much Discord-specific richness is worth losing? |
| Command Fallback | Auto fallback to text triggers | Opt-in fallback per command | Auto fallback improves reach; opt-in avoids surprises. | Should fallback be enabled by default? |
| Permissions | Centralized permission map | Platform-native permission checks only | Central map is consistent; platform-native may be richer. | Which permissions are core vs platform-specific? |
| Data Ownership | Plugin-managed storage | Shared core storage API | Shared API enables tooling; plugin-managed is flexible but messy. | Do we need per-guild/per-user storage in v1? |
| Hot Reload | Dev-only file watch | Manual reload command | Watcher is convenient; manual is safer. | Do we allow reload in production at all? |
| Error Isolation | Fail whole load on plugin error | Partial load; skip failed plugins | Partial load keeps app alive but can hide issues. | Should a failure block startup? |
| Logging | Centralized plugin logger | Each plugin logs directly | Centralized logging enables consistent formatting. | Do we want per-plugin log levels? |
| Migration | Wrap existing triggers in plugin adapter | Rewrite triggers into new format | Wrapping is low risk; rewrite is cleaner. | Which triggers are the first candidates? |
| Testing | Plugin harness in tests | End-to-end tests only | Harness gives fast feedback; E2E is more realistic but slower. | Which minimal fixtures are required? |

## Decision Outcomes (Agreed)

- Plugin location: keep plugins in-repo under `src/plugins` for now.
- Plugin contract: single interface with optional handlers.
- Command system: platform-agnostic command schema.
- Command fallback: opt-in per command.
- Permissions: hybrid core permission map with platform-native checks when available.
- Data ownership: shared core storage API.
- Hot reload: dev-only watch plus optional manual reload in production.
- Implementation note: add a manual reload helper now; defer file watching until more plugins are migrated.
- Error isolation: partial load with explicit error reporting.
- Logging: centralized plugin logger with plugin id tagging.
- Migration: wrap existing triggers first, refactor later.
- Testing: add a plugin harness for fast, isolated tests.

## Proposed Plugin Contract (Draft Shape)

This is only a sketch to guide discussion:

```ts
type PluginContext = {
  platform?: PlatformAdapter;
  message?: CoreMessage;
  command?: PlatformCommandInteraction;
};

type TriggerPlugin = {
  id: string;
  name: string;
  description?: string;
  version?: string;
  permissions?: { ownerOnly?: boolean; adminOnly?: boolean };
  matcher?: RegExp;
  execute?: (context: PluginContext, match?: RegExpMatchArray) => Promise<TriggerResult>;
  commands?: PlatformCommand[];
  onCommand?: (interaction: PlatformCommandInteraction) => Promise<void>;
  onLoad?: () => Promise<void> | void;
  onUnload?: () => Promise<void> | void;
};
```

## Platform Adapter Extensions (Draft)

```ts
type PlatformCommandOption = {
  name: string;
  description: string;
  type: "string" | "number" | "boolean" | "user" | "channel";
  required?: boolean;
};

type PlatformCommand = {
  name: string;
  description: string;
  options?: PlatformCommandOption[];
  permissions?: PlatformPermission[];
};

type PlatformCommandInteraction = {
  command: string;
  options: Record<string, unknown>;
  userId: string;
  channelId: string;
  guildId?: string;
  reply: (message: OutgoingMessage) => Promise<void>;
};
```

## Command Schema Details (Draft v0)

- Command names: lowercase, `a-z0-9_` only, 1-32 chars.
- Option names: lowercase, `a-z0-9_` only, 1-32 chars.
- Option types: `string`, `number`, `boolean`, `user`, `channel`.
- Permissions: `PlatformPermission[]` on the command (plugin-level permissions still apply).
- Fallback: opt-in with `fallbackMatcher` on a command; no fallback unless explicitly set.
- Collisions: duplicate command names are rejected at registration time.
- Description: short, user-facing; treat as required for slash-command platforms.

## Plugin Storage Recommendation (Draft)

- Namespaced plugin storage in shared roots:
  - `resources/plugins/<pluginId>/` for static assets.
  - `data/plugins/<pluginId>/` for persisted runtime data.
- Optional shared roots for cross-plugin assets:
  - `resources/shared/` and `data/shared/`.
- Provide a helper resolver (e.g., `resolvePluginPaths`) so plugins do not hardcode paths.
- Optional: load external source modules from `data/plugins/<pluginId>/sources/*.js` to allow drop-in extensions without rebuilding.

## Risks to Validate

- Legacy triggers relying on Discord-specific fields in `CoreMessage`.
- Command schemas diverging across platforms (Discord option types vs others).
- Reload behavior leaving stale timeouts or intervals in memory.
- Data migration if triggers are reorganized by plugin.

## Short-Term Recommendations (No Code Changes Yet)

- Decide on Option A vs B for plugin location.
- Define the minimal command schema and whether fallback is default.
- Decide reload strategy for development vs production.

## Future Consolidation Idea (Oracle/Divination)

- Consider a shared "oracle" abstraction for triggers like lotto, tarot, roll/dnd, gcp, and pray.
- Common shape: sampler (random draw), interpreter (meaning), renderer (text/embeds/assets).
- Keep out of current refactor; revisit after plugin migration stabilizes.

## Next Step

Capture decisions for the first three rows of the matrix and turn the draft contract into a small RFC for review before implementation.
