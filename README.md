# roku-perfetto

Library for Roku Perfetto tracing — ECP control, WebSocket recording, trace analysis with PerfettoSQL, and AI-friendly performance reports.

Requires **Roku OS 15.1+** with [Perfetto tracing](https://developer.roku.com/docs/developer-program/dev-tools/app-tracing.md) support.

## Install

```bash
npm install roku-perfetto
```

## Quick Start

### Record a trace

```ts
import { PerfettoClient } from 'roku-perfetto';

const client = new PerfettoClient('192.168.1.86');
await client.enable('dev');
await client.startRecording('trace.perfetto');
// ... interact with the app ...
const result = await client.stopRecording();
console.log(`Saved ${result.bytesWritten} bytes to ${result.filePath}`);
```

### Analyze a trace

```ts
import { openTrace } from 'roku-perfetto';

const analyzer = await openTrace('trace.perfetto');
const summary = await analyzer.performanceSummary();
console.log(summary.overallAssessment);
console.log(summary.frameDrops.suggestion);
await analyzer.close();
```

### Run a custom PerfettoSQL query

```ts
import { openTrace } from 'roku-perfetto';

const analyzer = await openTrace('trace.perfetto');
const result = await analyzer.query(
  "SELECT * FROM slice WHERE name = 'swapBuffers' ORDER BY dur DESC LIMIT 10"
);
console.log(result.rows);
await analyzer.close();
```

### Compare two traces

```ts
import { comparePerfetto } from 'roku-perfetto';

const report = await comparePerfetto('before.trace', 'after.trace');
console.log(report.summary);
console.log(`Regressions: ${report.regressions.length}`);
console.log(`Improvements: ${report.improvements.length}`);
```

## CLI

```bash
# Enable tracing on a device
roku-perfetto enable 192.168.1.86 dev

# Record a 30-second trace
roku-perfetto record --host 192.168.1.86 --channel dev --duration 30 -o trace.perfetto

# Full performance summary
roku-perfetto analyze summary trace.perfetto

# Specific analysis
roku-perfetto analyze frame-drops trace.perfetto --threshold 16
roku-perfetto analyze key-events trace.perfetto
roku-perfetto analyze observers trace.perfetto
roku-perfetto analyze rendezvous trace.perfetto
roku-perfetto analyze set-fields trace.perfetto
roku-perfetto analyze threads trace.perfetto

# JSON output (for programmatic consumption)
roku-perfetto analyze summary trace.perfetto -f json

# Raw PerfettoSQL query
roku-perfetto query trace.perfetto "SELECT * FROM slice WHERE name = 'keyEvent' ORDER BY dur DESC"

# Compare two traces
roku-perfetto compare before.trace after.trace

# Trace metadata
roku-perfetto info trace.perfetto
```

## API Reference

### `PerfettoClient`

Handles ECP communication and WebSocket trace recording with a Roku device.

| Method | Description |
|--------|-------------|
| `enable(channelId?)` | Enable Perfetto tracing for a channel via ECP POST |
| `startRecording(filePath, channelId?)` | Open WebSocket and stream binary trace data to a file |
| `stopRecording()` | Close WebSocket, finalize file, return recording stats |
| `isRecording()` | Check if a recording session is active |
| `getSession()` | Get current session info (host, bytes, duration) |

### `RokuAnalyzer`

High-level Roku-specific trace analysis with AI-friendly `suggestion` fields.

| Method | Description |
|--------|-------------|
| `RokuAnalyzer.open(tracePath, opts?)` | Open a trace file and return an analyzer |
| `performanceSummary(opts?)` | Full report: frame drops + key events + observers + rendezvous + threads |
| `analyzeFrameDrops(opts?)` | swapBuffers duration analysis with drop rate |
| `analyzeKeyEvents(opts?)` | OnKeyEvent duration analysis |
| `analyzeObservers(opts?)` | observer.callback analysis |
| `analyzeRendezvous(opts?)` | Cross-thread synchronization analysis |
| `analyzeSetFields(opts?)` | roSGNode.setField call analysis |
| `analyzeThreads(opts?)` | Per-thread overview with top slices |
| `traceInfo()` | Trace duration, slice count, thread count |
| `query(sql)` | Run a raw PerfettoSQL query |
| `close()` | Shut down the trace processor |

### `TraceProcessor`

Low-level wrapper around the Perfetto `trace_processor` binary.

| Method | Description |
|--------|-------------|
| `TraceProcessor.open(tracePath, opts?)` | Spawn trace_processor with --httpd, wait for ready |
| `query(sql)` | Execute PerfettoSQL, return structured rows |
| `status()` | Check trace processor status |
| `close()` | Kill the trace processor process |

### `comparePerfetto(beforePath, afterPath, opts?)`

Compare two trace files and return a `ComparisonReport` with metric deltas, regressions, and improvements.

### `openTrace(tracePath, opts?)`

Convenience function that opens a trace and returns a ready-to-use `RokuAnalyzer`.

## Analysis Modes

| Mode | What it checks | Key metric |
|------|---------------|------------|
| `summary` | Everything below combined | `overallAssessment` |
| `frame-drops` | swapBuffers durations | Frame drop rate % |
| `key-events` | keyEvent handler durations | Avg response time |
| `observers` | observer.callback durations | Slow callback count |
| `rendezvous` | Cross-thread sync points | Long rendezvous count |
| `set-fields` | roSGNode.setField calls | Avg setField duration |
| `threads` | Per-thread activity overview | Top slices by duration |

## Built-in PerfettoSQL Queries

The library exports the Roku-specific queries as constants for custom use:

```ts
import { FRAME_DROPS_QUERY, KEY_EVENTS_QUERY, OBSERVER_QUERY } from 'roku-perfetto';
```

## trace_processor Binary

The library automatically downloads the Perfetto `trace_processor` prebuilt binary from `https://get.perfetto.dev/trace_processor` on first use. The binary is cached at `~/.roku-perfetto/bin/trace_processor`.

Supported platforms: **macOS** and **Linux**.

You can provide a custom binary path:

```ts
const analyzer = await RokuAnalyzer.open('trace.perfetto', {
  binPath: '/usr/local/bin/trace_processor',
});
```

## Prerequisites

- **Node.js 18+**
- **Roku OS 15.1+** on the target device
- For sideloaded apps: `run_as_process=1` in the manifest
- For production/beta apps: device must be keyed with the app signing key

## License

MIT
