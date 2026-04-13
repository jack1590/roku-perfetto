// Client — ECP enable + WebSocket recording
export { PerfettoClient } from './client/PerfettoClient.js';

// Processor — trace_processor binary management and SQL queries
export { TraceProcessor } from './processor/TraceProcessor.js';
export type { TraceProcessorOptions } from './processor/TraceProcessor.js';
export { ensureBinary, downloadBinary, defaultBinaryPath } from './processor/binary.js';

// Analyzer — Roku-specific canned analysis
export { RokuAnalyzer } from './analyzer/RokuAnalyzer.js';
export { comparePerfetto } from './analyzer/DiffAnalyzer.js';
export {
  FRAME_DROPS_QUERY,
  KEY_EVENTS_QUERY,
  OBSERVER_QUERY,
  RENDEZVOUS_QUERY,
  SET_FIELD_QUERY,
  THREAD_OVERVIEW_QUERY,
  TRACE_INFO_QUERY,
} from './analyzer/queries.js';

// Formatters
export { JsonFormatter } from './formatter/JsonFormatter.js';
export { TextFormatter } from './formatter/TextFormatter.js';
export { fmtDuration, fmtBytes, fmtPercent, fmtNum } from './formatter/helpers.js';

// Types
export type {
  EnableResult,
  RecordingSession,
  RecordingResult,
  QueryResult,
  QueryRow,
  StatusResult,
  AnalysisOptions,
  SliceInfo,
  FrameDropReport,
  KeyEventReport,
  ObserverReport,
  RendezvousReport,
  SetFieldReport,
  ThreadOverview,
  TraceInfo,
  PerformanceSummary,
  MetricDelta,
  ComparisonReport,
  OutputFormat,
  AnalysisMode,
} from './types.js';

/**
 * Convenience: open a trace file and return a ready-to-use RokuAnalyzer.
 *
 * @example
 * ```ts
 * import { openTrace } from 'roku-perfetto';
 *
 * const analyzer = await openTrace('recording.trace');
 * const summary = await analyzer.performanceSummary();
 * console.log(summary.overallAssessment);
 * await analyzer.close();
 * ```
 */
export async function openTrace(
  tracePath: string,
  opts?: { binPath?: string; port?: number },
): Promise<import('./analyzer/RokuAnalyzer.js').RokuAnalyzer> {
  const { RokuAnalyzer: Analyzer } = await import('./analyzer/RokuAnalyzer.js');
  return Analyzer.open(tracePath, opts);
}
