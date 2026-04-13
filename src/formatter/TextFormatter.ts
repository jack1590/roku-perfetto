import chalk from 'chalk';
import { fmtDuration, fmtPercent, fmtNum, padEnd } from './helpers.js';
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
  SliceInfo,
  QueryResult,
} from '../types.js';

function sliceTable(slices: SliceInfo[], label: string): string {
  if (slices.length === 0) return `  (no ${label})\n`;
  const lines: string[] = [];
  lines.push(
    `  ${padEnd('Duration', 14)} ${padEnd('Thread', 24)} ${padEnd('Name', 30)} Timestamp`,
  );
  lines.push(`  ${'─'.repeat(14)} ${'─'.repeat(24)} ${'─'.repeat(30)} ${'─'.repeat(18)}`);
  for (const s of slices) {
    lines.push(
      `  ${padEnd(fmtDuration(s.durMs), 14)} ${padEnd(s.threadName, 24)} ${padEnd(s.name, 30)} ${s.ts}`,
    );
  }
  return lines.join('\n') + '\n';
}

export class TextFormatter {
  formatSummary(report: PerformanceSummary): string {
    const parts: string[] = [];
    parts.push(chalk.bold.underline('Roku Perfetto Performance Summary'));
    parts.push('');
    parts.push(this.formatTraceInfo(report.traceInfo));
    parts.push('');
    parts.push(this.formatFrameDrops(report.frameDrops));
    parts.push(this.formatKeyEvents(report.keyEvents));
    parts.push(this.formatObservers(report.observers));
    parts.push(this.formatRendezvous(report.rendezvous));
    parts.push(this.formatSetFields(report.setFields));
    parts.push(chalk.bold('Overall Assessment'));
    parts.push(`  ${report.overallAssessment}`);
    return parts.join('\n');
  }

  formatFrameDrops(report: FrameDropReport): string {
    const lines: string[] = [];
    const rateColor = report.dropRate > 5 ? chalk.red : report.dropRate > 2 ? chalk.yellow : chalk.green;
    lines.push(chalk.bold('Frame Drops (swapBuffers)'));
    lines.push(`  Total frames: ${fmtNum(report.totalFrames)}`);
    lines.push(`  Dropped: ${fmtNum(report.droppedFrames)} (${rateColor(fmtPercent(report.dropRate))})`);
    if (report.longestSwapBuffer) {
      lines.push(`  Longest: ${fmtDuration(report.longestSwapBuffer.durMs)} on ${report.longestSwapBuffer.threadName}`);
    }
    lines.push(`  ${chalk.dim(report.suggestion)}`);
    if (report.slowSwapBuffers.length > 0) {
      lines.push('');
      lines.push(`  ${chalk.bold('Slow frames:')}`);
      lines.push(sliceTable(report.slowSwapBuffers, 'slow frames'));
    }
    return lines.join('\n');
  }

  formatKeyEvents(report: KeyEventReport): string {
    const lines: string[] = [];
    lines.push(chalk.bold('Key Events'));
    lines.push(`  Total: ${fmtNum(report.totalKeyEvents)}  Avg: ${fmtDuration(report.averageDurMs)}`);
    lines.push(`  ${chalk.dim(report.suggestion)}`);
    if (report.slowKeyEvents.length > 0) {
      lines.push(sliceTable(report.slowKeyEvents, 'slow key events'));
    }
    return lines.join('\n');
  }

  formatObservers(report: ObserverReport): string {
    const lines: string[] = [];
    lines.push(chalk.bold('Observer Callbacks'));
    lines.push(`  Total: ${fmtNum(report.totalCallbacks)}  Unique threads: ${report.uniqueObservers}  Avg: ${fmtDuration(report.averageDurMs)}`);
    lines.push(`  ${chalk.dim(report.suggestion)}`);
    if (report.slowCallbacks.length > 0) {
      lines.push(sliceTable(report.slowCallbacks, 'slow callbacks'));
    }
    return lines.join('\n');
  }

  formatRendezvous(report: RendezvousReport): string {
    const lines: string[] = [];
    lines.push(chalk.bold('Rendezvous'));
    lines.push(`  Total: ${fmtNum(report.totalRendezvous)}  Avg: ${fmtDuration(report.averageDurMs)}`);
    lines.push(`  ${chalk.dim(report.suggestion)}`);
    if (report.longRendezvous.length > 0) {
      lines.push(sliceTable(report.longRendezvous, 'long rendezvous'));
    }
    return lines.join('\n');
  }

  formatSetFields(report: SetFieldReport): string {
    const lines: string[] = [];
    lines.push(chalk.bold('setField Calls'));
    lines.push(`  Total: ${fmtNum(report.totalSetFields)}  Avg: ${fmtDuration(report.averageDurMs)}`);
    lines.push(`  ${chalk.dim(report.suggestion)}`);
    if (report.slowSetFields.length > 0) {
      lines.push(sliceTable(report.slowSetFields, 'slow setField calls'));
    }
    return lines.join('\n');
  }

  formatThreads(threads: ThreadOverview[]): string {
    const lines: string[] = [];
    lines.push(chalk.bold('Thread Overview'));
    for (const t of threads) {
      lines.push(`  ${chalk.cyan(t.threadName)} — ${fmtNum(t.totalSlices)} slices, ${fmtDuration(t.totalDurMs)} total`);
      if (t.topSlicesByDuration.length > 0) {
        lines.push(sliceTable(t.topSlicesByDuration, 'slices'));
      }
    }
    return lines.join('\n');
  }

  formatComparison(report: ComparisonReport): string {
    const lines: string[] = [];
    lines.push(chalk.bold.underline('Trace Comparison'));
    lines.push(`  Before: ${report.beforePath}`);
    lines.push(`  After:  ${report.afterPath}`);
    lines.push('');

    for (const m of report.metrics) {
      const arrow =
        m.direction === 'regression' ? chalk.red('▲') :
        m.direction === 'improvement' ? chalk.green('▼') :
        chalk.dim('─');
      const pct = m.deltaPercent !== 0 ? ` (${m.deltaPercent > 0 ? '+' : ''}${fmtPercent(m.deltaPercent)})` : '';
      lines.push(`  ${arrow} ${padEnd(m.metric, 35)} ${m.before.toFixed(1)} → ${m.after.toFixed(1)}${pct}`);
    }
    lines.push('');
    lines.push(`  ${report.summary}`);
    return lines.join('\n');
  }

  formatTraceInfo(info: TraceInfo): string {
    const lines: string[] = [];
    lines.push(chalk.bold('Trace Info'));
    lines.push(`  Duration: ${fmtDuration(info.durationMs)}`);
    lines.push(`  Total slices: ${fmtNum(info.totalSlices)}`);
    lines.push(`  Threads: ${info.threadCount}`);
    return lines.join('\n');
  }

  formatQueryResult(result: QueryResult): string {
    if (result.rows.length === 0) return '(no results)';

    const widths: Record<string, number> = {};
    for (const col of result.columns) {
      widths[col] = col.length;
    }
    for (const row of result.rows) {
      for (const col of result.columns) {
        const len = String(row[col] ?? 'NULL').length;
        if (len > widths[col]) widths[col] = len;
      }
    }

    const header = result.columns.map((c) => padEnd(c, widths[c])).join('  ');
    const separator = result.columns.map((c) => '─'.repeat(widths[c])).join('  ');
    const rows = result.rows.map((row) =>
      result.columns.map((c) => padEnd(String(row[c] ?? 'NULL'), widths[c])).join('  '),
    );

    return [header, separator, ...rows].join('\n');
  }
}
