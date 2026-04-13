// ---------------------------------------------------------------------------
// Client types (ECP + WebSocket recording)
// ---------------------------------------------------------------------------

export interface EnableResult {
  enabledChannels: string[];
  timestamp: number;
  timestampEnd: number;
  status: string;
}

export interface RecordingSession {
  host: string;
  channelId: string;
  filePath: string;
  bytesWritten: number;
  startedAt: number;
  recording: boolean;
}

export interface RecordingResult {
  filePath: string;
  bytesWritten: number;
  durationMs: number;
}

// ---------------------------------------------------------------------------
// Trace Processor types (SQL query engine)
// ---------------------------------------------------------------------------

export interface QueryRow {
  [column: string]: string | number | bigint | null;
}

export interface QueryResult {
  columns: string[];
  rows: QueryRow[];
  rowCount: number;
}

export interface StatusResult {
  loaded: boolean;
  apiVersion: number;
  tracePath?: string;
}

// ---------------------------------------------------------------------------
// Analysis types
// ---------------------------------------------------------------------------

export interface AnalysisOptions {
  top?: number;
  threshold?: number;
}

export interface SliceInfo {
  name: string;
  ts: number;
  dur: number;
  durMs: number;
  threadName: string;
  trackId: number;
  depth: number;
}

export interface FrameDropReport {
  totalFrames: number;
  droppedFrames: number;
  dropRate: number;
  longestSwapBuffer: SliceInfo | null;
  slowSwapBuffers: SliceInfo[];
  suggestion: string;
}

export interface KeyEventReport {
  totalKeyEvents: number;
  averageDurMs: number;
  slowKeyEvents: SliceInfo[];
  suggestion: string;
}

export interface ObserverReport {
  totalCallbacks: number;
  uniqueObservers: number;
  averageDurMs: number;
  slowCallbacks: SliceInfo[];
  suggestion: string;
}

export interface RendezvousReport {
  totalRendezvous: number;
  averageDurMs: number;
  longRendezvous: SliceInfo[];
  suggestion: string;
}

export interface SetFieldReport {
  totalSetFields: number;
  averageDurMs: number;
  slowSetFields: SliceInfo[];
  suggestion: string;
}

export interface ThreadOverview {
  threadName: string;
  totalSlices: number;
  totalDurMs: number;
  topSlicesByDuration: SliceInfo[];
}

export interface TraceInfo {
  durationMs: number;
  totalSlices: number;
  threadCount: number;
}

export interface PerformanceSummary {
  traceInfo: TraceInfo;
  frameDrops: FrameDropReport;
  keyEvents: KeyEventReport;
  observers: ObserverReport;
  rendezvous: RendezvousReport;
  setFields: SetFieldReport;
  threads: ThreadOverview[];
  overallAssessment: string;
}

// ---------------------------------------------------------------------------
// Comparison types
// ---------------------------------------------------------------------------

export interface MetricDelta {
  metric: string;
  before: number;
  after: number;
  delta: number;
  deltaPercent: number;
  direction: 'regression' | 'improvement' | 'unchanged';
}

export interface ComparisonReport {
  beforePath: string;
  afterPath: string;
  metrics: MetricDelta[];
  regressions: MetricDelta[];
  improvements: MetricDelta[];
  summary: string;
}

// ---------------------------------------------------------------------------
// Formatter types
// ---------------------------------------------------------------------------

export type OutputFormat = 'json' | 'text';

export type AnalysisMode =
  | 'summary'
  | 'frame-drops'
  | 'key-events'
  | 'observers'
  | 'rendezvous'
  | 'set-fields'
  | 'threads';
