import { TraceProcessor, type TraceProcessorOptions } from '../processor/TraceProcessor.js';
import {
  FRAME_DROPS_QUERY,
  KEY_EVENTS_QUERY,
  OBSERVER_QUERY,
  RENDEZVOUS_QUERY,
  SET_FIELD_QUERY,
  THREAD_OVERVIEW_QUERY,
  TOP_SLICES_BY_THREAD_QUERY,
  TRACE_INFO_QUERY,
} from './queries.js';
import type {
  AnalysisOptions,
  FrameDropReport,
  KeyEventReport,
  ObserverReport,
  PerformanceSummary,
  QueryResult,
  RendezvousReport,
  SetFieldReport,
  SliceInfo,
  ThreadOverview,
  TraceInfo,
} from '../types.js';

const NS_PER_MS = 1_000_000;
const FRAME_BUDGET_NS = 16_666_667; // ~60 fps

function toSlice(row: Record<string, unknown>): SliceInfo {
  const dur = Number(row.dur ?? 0);
  return {
    name: String(row.name ?? ''),
    ts: Number(row.ts ?? 0),
    dur,
    durMs: dur / NS_PER_MS,
    threadName: String(row.thread_name ?? 'unknown'),
    trackId: Number(row.track_id ?? 0),
    depth: Number(row.depth ?? 0),
  };
}

function avg(slices: SliceInfo[]): number {
  if (slices.length === 0) return 0;
  const total = slices.reduce((sum, s) => sum + s.durMs, 0);
  return total / slices.length;
}

function topN(slices: SliceInfo[], opts: AnalysisOptions): SliceInfo[] {
  const threshold = opts.threshold ?? 0;
  const top = opts.top ?? 20;
  const filtered = threshold > 0 ? slices.filter((s) => s.durMs > threshold) : slices;
  return filtered.slice(0, top);
}

export class RokuAnalyzer {
  private constructor(private tp: TraceProcessor) {}

  static async open(
    tracePath: string,
    opts?: TraceProcessorOptions,
  ): Promise<RokuAnalyzer> {
    const tp = await TraceProcessor.open(tracePath, opts);
    return new RokuAnalyzer(tp);
  }

  static fromProcessor(tp: TraceProcessor): RokuAnalyzer {
    return new RokuAnalyzer(tp);
  }

  // ---------------------------------------------------------------------------
  // Full summary — the single-call tool for AI agents
  // ---------------------------------------------------------------------------

  async performanceSummary(opts: AnalysisOptions = {}): Promise<PerformanceSummary> {
    const [traceInfo, frameDrops, keyEvents, observers, rendezvous, setFields, threads] =
      await Promise.all([
        this.traceInfo(),
        this.analyzeFrameDrops(opts),
        this.analyzeKeyEvents(opts),
        this.analyzeObservers(opts),
        this.analyzeRendezvous(opts),
        this.analyzeSetFields(opts),
        this.analyzeThreads(opts),
      ]);

    const issues: string[] = [];
    if (frameDrops.dropRate > 5) issues.push(`high frame drop rate (${frameDrops.dropRate.toFixed(1)}%)`);
    if (keyEvents.averageDurMs > 16) issues.push(`slow key event handling (avg ${keyEvents.averageDurMs.toFixed(1)}ms)`);
    if (rendezvous.longRendezvous.length > 0) issues.push(`${rendezvous.longRendezvous.length} long rendezvous events`);
    if (observers.slowCallbacks.length > 0) issues.push(`${observers.slowCallbacks.length} slow observer callbacks`);

    const overallAssessment = issues.length === 0
      ? 'Trace looks healthy. No significant performance issues detected.'
      : `Found ${issues.length} performance concern(s): ${issues.join('; ')}. Review the individual reports for details and optimization suggestions.`;

    return {
      traceInfo,
      frameDrops,
      keyEvents,
      observers,
      rendezvous,
      setFields,
      threads,
      overallAssessment,
    };
  }

  // ---------------------------------------------------------------------------
  // Individual analysis methods
  // ---------------------------------------------------------------------------

  async analyzeFrameDrops(opts: AnalysisOptions = {}): Promise<FrameDropReport> {
    const result = await this.tp.query(FRAME_DROPS_QUERY);
    const slices = result.rows.map(toSlice);
    const thresholdNs = (opts.threshold ?? 16) * NS_PER_MS;
    const slow = slices.filter((s) => s.dur > thresholdNs);
    const dropRate = slices.length > 0 ? (slow.length / slices.length) * 100 : 0;
    const top = opts.top ?? 20;

    let suggestion: string;
    if (slices.length === 0) {
      suggestion = 'No swapBuffers events found in the trace. The app may not have rendered any frames during recording.';
    } else if (dropRate > 10) {
      suggestion =
        `Critical: ${dropRate.toFixed(1)}% of frames exceeded the ${(thresholdNs / NS_PER_MS).toFixed(0)}ms budget. ` +
        `The longest swapBuffers took ${slices[0]?.durMs.toFixed(1)}ms. ` +
        'Check the render thread for heavy observer callbacks, expensive setField calls, or large node tree updates. ' +
        'Consider offloading work to Task nodes and batching field updates.';
    } else if (dropRate > 2) {
      suggestion =
        `${dropRate.toFixed(1)}% of frames were slow. ` +
        'Review the slowest swapBuffers timestamps in the Perfetto timeline to identify the render-thread activity causing delays.';
    } else {
      suggestion = `Frame rendering looks healthy — only ${dropRate.toFixed(1)}% of frames exceeded the threshold.`;
    }

    return {
      totalFrames: slices.length,
      droppedFrames: slow.length,
      dropRate,
      longestSwapBuffer: slices[0] ?? null,
      slowSwapBuffers: slow.slice(0, top),
      suggestion,
    };
  }

  async analyzeKeyEvents(opts: AnalysisOptions = {}): Promise<KeyEventReport> {
    const result = await this.tp.query(KEY_EVENTS_QUERY);
    const slices = result.rows.map(toSlice);
    const averageDurMs = avg(slices);
    const slow = topN(slices, { ...opts, threshold: opts.threshold ?? 16 });

    let suggestion: string;
    if (slices.length === 0) {
      suggestion = 'No keyEvent slices found. Either no key presses occurred during recording or the app does not use OnKeyEvent.';
    } else if (averageDurMs > 50) {
      suggestion =
        `Key event handling is very slow (avg ${averageDurMs.toFixed(1)}ms). ` +
        'Users will perceive input lag. Reduce work in OnKeyEvent handlers — avoid field reads/writes, network calls, or complex logic on the render thread.';
    } else if (averageDurMs > 16) {
      suggestion =
        `Key event handling averages ${averageDurMs.toFixed(1)}ms, which can cause occasional dropped frames. ` +
        'Profile the slowest events and consider deferring non-critical work.';
    } else {
      suggestion = `Key event handling is responsive (avg ${averageDurMs.toFixed(1)}ms).`;
    }

    return { totalKeyEvents: slices.length, averageDurMs, slowKeyEvents: slow, suggestion };
  }

  async analyzeObservers(opts: AnalysisOptions = {}): Promise<ObserverReport> {
    const result = await this.tp.query(OBSERVER_QUERY);
    const slices = result.rows.map(toSlice);
    const averageDurMs = avg(slices);
    const uniqueThreads = new Set(slices.map((s) => s.threadName));
    const slow = topN(slices, { ...opts, threshold: opts.threshold ?? 8 });

    let suggestion: string;
    if (slices.length === 0) {
      suggestion = 'No observer.callback slices found in the trace.';
    } else if (slow.length > 10) {
      suggestion =
        `${slow.length} observer callbacks exceeded the threshold. ` +
        'Frequent or expensive observers are a common cause of dropped frames. ' +
        'Consider debouncing observers, reducing the number of observed fields, or moving heavy logic to Task nodes.';
    } else if (averageDurMs > 5) {
      suggestion =
        `Observer callbacks average ${averageDurMs.toFixed(1)}ms. ` +
        'While individual calls are moderate, cumulative cost during rapid updates can be significant.';
    } else {
      suggestion = `Observer callbacks are efficient (avg ${averageDurMs.toFixed(1)}ms, ${slices.length} total).`;
    }

    return {
      totalCallbacks: slices.length,
      uniqueObservers: uniqueThreads.size,
      averageDurMs,
      slowCallbacks: slow,
      suggestion,
    };
  }

  async analyzeRendezvous(opts: AnalysisOptions = {}): Promise<RendezvousReport> {
    const result = await this.tp.query(RENDEZVOUS_QUERY);
    const slices = result.rows.map(toSlice);
    const averageDurMs = avg(slices);
    const slow = topN(slices, { ...opts, threshold: opts.threshold ?? 16 });

    let suggestion: string;
    if (slices.length === 0) {
      suggestion = 'No rendezvous events found in the trace.';
    } else if (slow.length > 5) {
      suggestion =
        `${slow.length} rendezvous events exceeded the threshold. ` +
        'Long rendezvous often cause dropped frames because the render thread is blocked waiting for the BrightScript thread (or vice versa). ' +
        'Look for expensive observer functions or Task node field access patterns that trigger cross-thread synchronization.';
    } else if (averageDurMs > 8) {
      suggestion =
        `Rendezvous events average ${averageDurMs.toFixed(1)}ms. Consider reducing cross-thread field access.`;
    } else {
      suggestion = `Rendezvous events are short (avg ${averageDurMs.toFixed(1)}ms, ${slices.length} total).`;
    }

    return { totalRendezvous: slices.length, averageDurMs, longRendezvous: slow, suggestion };
  }

  async analyzeSetFields(opts: AnalysisOptions = {}): Promise<SetFieldReport> {
    const result = await this.tp.query(SET_FIELD_QUERY);
    const slices = result.rows.map(toSlice);
    const averageDurMs = avg(slices);
    const slow = topN(slices, { ...opts, threshold: opts.threshold ?? 5 });

    let suggestion: string;
    if (slices.length === 0) {
      suggestion = 'No roSGNode.setField events found in the trace.';
    } else if (slow.length > 20) {
      suggestion =
        `${slow.length} setField calls exceeded the threshold. ` +
        'Batching multiple field updates with update() or reducing the frequency of setField calls can improve performance.';
    } else {
      suggestion = `setField calls look reasonable (avg ${averageDurMs.toFixed(1)}ms, ${slices.length} total).`;
    }

    return { totalSetFields: slices.length, averageDurMs, slowSetFields: slow, suggestion };
  }

  async analyzeThreads(opts: AnalysisOptions = {}): Promise<ThreadOverview[]> {
    const result = await this.tp.query(THREAD_OVERVIEW_QUERY);
    const top = opts.top ?? 10;
    const sliceTop = opts.top ?? 5;
    const threads = result.rows.slice(0, top);

    const overviews: ThreadOverview[] = [];
    for (const row of threads) {
      const threadName = String(row.thread_name ?? 'unknown');
      const topSlicesResult = await this.tp.query(
        TOP_SLICES_BY_THREAD_QUERY(threadName, sliceTop),
      );

      overviews.push({
        threadName,
        totalSlices: Number(row.total_slices ?? 0),
        totalDurMs: Number(row.total_dur ?? 0) / NS_PER_MS,
        topSlicesByDuration: topSlicesResult.rows.map(toSlice),
      });
    }

    return overviews;
  }

  // ---------------------------------------------------------------------------
  // Trace metadata
  // ---------------------------------------------------------------------------

  async traceInfo(): Promise<TraceInfo> {
    const result = await this.tp.query(TRACE_INFO_QUERY);
    const row = result.rows[0] ?? {};
    return {
      durationMs: Number(row.duration ?? 0) / NS_PER_MS,
      totalSlices: Number(row.total_slices ?? 0),
      threadCount: Number(row.thread_count ?? 0),
    };
  }

  // ---------------------------------------------------------------------------
  // Raw SQL passthrough
  // ---------------------------------------------------------------------------

  async query(sql: string): Promise<QueryResult> {
    return this.tp.query(sql);
  }

  // ---------------------------------------------------------------------------
  // Lifecycle
  // ---------------------------------------------------------------------------

  async close(): Promise<void> {
    await this.tp.close();
  }
}
