import type {
  PerformanceSummary,
  FrameDropReport,
  KeyEventReport,
  ObserverReport,
  RendezvousReport,
  SetFieldReport,
  ThreadOverview,
  ComparisonReport,
  TraceInfo,
  QueryResult,
} from '../types.js';

function jsonify(value: unknown): string {
  return JSON.stringify(
    value,
    (_k, v) => (typeof v === 'bigint' ? Number(v) : v),
    2,
  );
}

export class JsonFormatter {
  formatSummary(report: PerformanceSummary): string {
    return jsonify(report);
  }

  formatFrameDrops(report: FrameDropReport): string {
    return jsonify(report);
  }

  formatKeyEvents(report: KeyEventReport): string {
    return jsonify(report);
  }

  formatObservers(report: ObserverReport): string {
    return jsonify(report);
  }

  formatRendezvous(report: RendezvousReport): string {
    return jsonify(report);
  }

  formatSetFields(report: SetFieldReport): string {
    return jsonify(report);
  }

  formatThreads(report: ThreadOverview[]): string {
    return jsonify(report);
  }

  formatComparison(report: ComparisonReport): string {
    return jsonify(report);
  }

  formatTraceInfo(info: TraceInfo): string {
    return jsonify(info);
  }

  formatQueryResult(result: QueryResult): string {
    return jsonify(result);
  }
}
