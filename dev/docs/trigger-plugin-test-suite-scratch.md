# Trigger/Plugin Test Suite Scratch Notes

This is a scratch outline for building a test suite after the plugin refactor settles.

## Goals

- Validate plugin matching and execution without Discord dependencies.
- Ensure platform adapter command hooks are exercised via mocks.
- Keep tests fast and independent of real network or file IO.

## Suggested Test Harness

- Use `tests/pluginHarness.ts` as the starting helper that provides:
  - A mock `PlatformAdapter` with configurable behavior.
  - A factory for `CoreMessage` fixtures (guild, channel, author, content).
  - Helpers for asserting `TriggerResult` and outgoing messages.
- Use Vitest for all unit tests; keep sqlite tests running as-is.

## Test Categories

- PluginManager
  - Register, dedupe, and load-from-dist behavior.
  - Legacy trigger conversion and ordering.
- Trigger matching
  - Regex matching paths with message fixtures.
  - Permission gating with mock admin/owner flags.
- Command handling
  - Command schema validation (options, permissions).
  - Fallback matcher opt-in behavior.
- Error isolation
  - Failing plugin modules are skipped but logged.
  - A bad plugin does not prevent others from loading.

## Integration Tests (Optional Later)

- End-to-end message processing with a fake adapter.
- Command interaction flow for one platform adapter (Discord).

## Tooling

- Add fixtures under `tests/fixtures/`.
- If needed, add a `tests/helpers/mockAdapter.ts` for adapter fakes.
