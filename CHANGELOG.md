# Changelog

## [1.0.0] - 2026-04-13

### Added
- `PerfettoClient` — ECP enable and WebSocket trace recording for Roku devices.
- `TraceProcessor` — wrapper around Perfetto `trace_processor` binary with HTTP RPC queries.
- `RokuAnalyzer` — high-level Roku-specific trace analysis with AI-friendly `suggestion` fields.
- Canned analysis modes: `frame-drops`, `key-events`, `observers`, `rendezvous`, `set-fields`, `threads`, `summary`.
- `comparePerfetto()` — diff two traces with metric deltas, regressions, and improvements.
- `openTrace()` — convenience function for quick analysis.
- Built-in PerfettoSQL query constants for Roku OS instrumentation slices.
- Raw SQL passthrough via `RokuAnalyzer.query()` and `TraceProcessor.query()`.
- Auto-download of `trace_processor` binary from `get.perfetto.dev`.
- CLI with `enable`, `record`, `analyze`, `query`, `compare`, and `info` commands.
- Text and JSON output formatters.
