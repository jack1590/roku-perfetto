import { RokuAnalyzer } from './RokuAnalyzer.js';
import type { TraceProcessorOptions } from '../processor/TraceProcessor.js';
import type {
  AnalysisOptions,
  ComparisonReport,
  MetricDelta,
} from '../types.js';

function delta(metric: string, before: number, after: number, lowerIsBetter = true): MetricDelta {
  const d = after - before;
  const deltaPercent = before !== 0 ? (d / before) * 100 : after !== 0 ? 100 : 0;

  let direction: MetricDelta['direction'];
  if (Math.abs(deltaPercent) < 1) {
    direction = 'unchanged';
  } else if (lowerIsBetter) {
    direction = d > 0 ? 'regression' : 'improvement';
  } else {
    direction = d > 0 ? 'improvement' : 'regression';
  }

  return { metric, before, after, delta: d, deltaPercent, direction };
}

export async function comparePerfetto(
  beforePath: string,
  afterPath: string,
  opts: AnalysisOptions & TraceProcessorOptions = {},
): Promise<ComparisonReport> {
  const portBefore = opts.port ?? 9001;
  const portAfter = portBefore + 1;

  const beforeAnalyzer = await RokuAnalyzer.open(beforePath, { ...opts, port: portBefore });
  const afterAnalyzer = await RokuAnalyzer.open(afterPath, { ...opts, port: portAfter });

  try {
    const [beforeSummary, afterSummary] = await Promise.all([
      beforeAnalyzer.performanceSummary(opts),
      afterAnalyzer.performanceSummary(opts),
    ]);

    const metrics: MetricDelta[] = [
      delta('Frame drop rate (%)', beforeSummary.frameDrops.dropRate, afterSummary.frameDrops.dropRate),
      delta('Total frames', beforeSummary.frameDrops.totalFrames, afterSummary.frameDrops.totalFrames, false),
      delta('Dropped frames', beforeSummary.frameDrops.droppedFrames, afterSummary.frameDrops.droppedFrames),
      delta('Avg key event duration (ms)', beforeSummary.keyEvents.averageDurMs, afterSummary.keyEvents.averageDurMs),
      delta('Slow key events', beforeSummary.keyEvents.slowKeyEvents.length, afterSummary.keyEvents.slowKeyEvents.length),
      delta('Avg observer callback (ms)', beforeSummary.observers.averageDurMs, afterSummary.observers.averageDurMs),
      delta('Slow observer callbacks', beforeSummary.observers.slowCallbacks.length, afterSummary.observers.slowCallbacks.length),
      delta('Avg rendezvous (ms)', beforeSummary.rendezvous.averageDurMs, afterSummary.rendezvous.averageDurMs),
      delta('Long rendezvous', beforeSummary.rendezvous.longRendezvous.length, afterSummary.rendezvous.longRendezvous.length),
      delta('Avg setField (ms)', beforeSummary.setFields.averageDurMs, afterSummary.setFields.averageDurMs),
    ];

    const regressions = metrics.filter((m) => m.direction === 'regression');
    const improvements = metrics.filter((m) => m.direction === 'improvement');

    const parts: string[] = [];
    if (regressions.length > 0) {
      parts.push(
        `${regressions.length} regression(s): ${regressions.map((r) => `${r.metric} worsened by ${Math.abs(r.deltaPercent).toFixed(1)}%`).join('; ')}`,
      );
    }
    if (improvements.length > 0) {
      parts.push(
        `${improvements.length} improvement(s): ${improvements.map((i) => `${i.metric} improved by ${Math.abs(i.deltaPercent).toFixed(1)}%`).join('; ')}`,
      );
    }
    if (parts.length === 0) {
      parts.push('No significant changes detected between the two traces.');
    }

    return {
      beforePath,
      afterPath,
      metrics,
      regressions,
      improvements,
      summary: parts.join(' | '),
    };
  } finally {
    await Promise.all([beforeAnalyzer.close(), afterAnalyzer.close()]);
  }
}
