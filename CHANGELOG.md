# Changelog

## [1.0.2] - 2026-04-13

### Fixed
- **Binary download**: Download the actual `trace_processor_shell` Mach-O/ELF binary directly from Google Cloud Storage instead of the Python wrapper script from `get.perfetto.dev`. The Python wrapper required `python3` in PATH which is unavailable in IDE-hosted MCP server processes (e.g. Cursor), causing all queries to fail silently.
- Auto-detects and replaces the old Python wrapper script if present (size < 1MB check).
- Pinned to Perfetto v54.0 with platform-specific URLs (macOS arm64/amd64, Linux amd64/arm64/arm).

## [1.0.1] - 2026-04-13

### Fixed
- **TraceProcessor**: Replaced broken HTTP RPC (protobuf) transport with CLI-based `-Q` flag approach that reliably parses CSV output from `trace_processor`.
- **Rendezvous query**: Match both `Rendezvous` (actual Roku OS name) and `rendezvous` (documented name).
- Removed `axios` dependency from TraceProcessor (only used by PerfettoClient now).

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
