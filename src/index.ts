#!/usr/bin/env node

import { writeFileSync } from 'fs';
import { Command } from 'commander';
import { PerfettoClient } from './client/PerfettoClient.js';
import { RokuAnalyzer } from './analyzer/RokuAnalyzer.js';
import { comparePerfetto } from './analyzer/DiffAnalyzer.js';
import { JsonFormatter } from './formatter/JsonFormatter.js';
import { TextFormatter } from './formatter/TextFormatter.js';
import type { AnalysisMode, OutputFormat } from './types.js';

const program = new Command();

program
  .name('roku-perfetto')
  .description('Roku Perfetto tracing — record, analyze, and compare Roku app traces')
  .version('1.0.0');

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getFormatter(format: OutputFormat) {
  return format === 'json' ? new JsonFormatter() : new TextFormatter();
}

function writeOutput(content: string, outputPath?: string) {
  if (outputPath) {
    writeFileSync(outputPath, content, 'utf-8');
    process.stderr.write(`Written to ${outputPath}\n`);
  } else {
    console.log(content);
  }
}

// ---------------------------------------------------------------------------
// enable
// ---------------------------------------------------------------------------

program
  .command('enable')
  .description('Enable Perfetto tracing for a Roku channel via ECP')
  .argument('<host>', 'Roku device IP address')
  .argument('[channelId]', 'Channel ID (default: "dev")', 'dev')
  .action(async (host: string, channelId: string) => {
    try {
      const client = new PerfettoClient(host);
      const result = await client.enable(channelId);
      console.log(JSON.stringify(result, null, 2));
    } catch (err) {
      process.stderr.write(`Error: ${err instanceof Error ? err.message : err}\n`);
      process.exit(1);
    }
  });

// ---------------------------------------------------------------------------
// record
// ---------------------------------------------------------------------------

program
  .command('record')
  .description('Record a Perfetto trace from a Roku device')
  .requiredOption('--host <ip>', 'Roku device IP address')
  .option('--channel <id>', 'Channel ID to enable', 'dev')
  .option('--duration <seconds>', 'Recording duration in seconds', '30')
  .option('-o, --output <file>', 'Output file path', 'roku-perfetto.trace')
  .action(async (opts) => {
    try {
      const client = new PerfettoClient(opts.host);

      process.stderr.write(`Enabling Perfetto for channel "${opts.channel}"...\n`);
      await client.enable(opts.channel);

      process.stderr.write(`Recording to ${opts.output} for ${opts.duration}s...\n`);
      await client.startRecording(opts.output, opts.channel);

      const durationMs = parseInt(opts.duration, 10) * 1000;
      await new Promise((r) => setTimeout(r, durationMs));

      const result = await client.stopRecording();
      process.stderr.write(
        `Done. Recorded ${(result.bytesWritten / 1024).toFixed(1)}KB in ${(result.durationMs / 1000).toFixed(1)}s\n`,
      );
      process.stderr.write(`Trace saved to: ${result.filePath}\n`);
      process.stderr.write(`Open at: https://ui.perfetto.dev/\n`);
    } catch (err) {
      process.stderr.write(`Error: ${err instanceof Error ? err.message : err}\n`);
      process.exit(1);
    }
  });

// ---------------------------------------------------------------------------
// analyze
// ---------------------------------------------------------------------------

program
  .command('analyze')
  .description('Analyze a Roku Perfetto trace file')
  .argument('<mode>', 'Analysis mode: summary, frame-drops, key-events, observers, rendezvous, set-fields, threads')
  .argument('<file>', 'Path to .trace file')
  .option('--top <n>', 'Number of entries in ranked lists', '20')
  .option('--threshold <ms>', 'Only show entries exceeding this value in ms')
  .option('-f, --format <fmt>', 'Output format: text, json', 'text')
  .option('-o, --output <file>', 'Write output to file instead of stdout')
  .action(async (mode: string, file: string, opts) => {
    try {
      const analysisOpts = {
        top: parseInt(opts.top, 10),
        threshold: opts.threshold ? parseFloat(opts.threshold) : undefined,
      };
      const format = opts.format as OutputFormat;
      const fmt = getFormatter(format);
      const analyzer = await RokuAnalyzer.open(file);

      let output: string;
      try {
        switch (mode as AnalysisMode) {
          case 'summary':
            output = fmt.formatSummary(await analyzer.performanceSummary(analysisOpts));
            break;
          case 'frame-drops':
            output = fmt.formatFrameDrops(await analyzer.analyzeFrameDrops(analysisOpts));
            break;
          case 'key-events':
            output = fmt.formatKeyEvents(await analyzer.analyzeKeyEvents(analysisOpts));
            break;
          case 'observers':
            output = fmt.formatObservers(await analyzer.analyzeObservers(analysisOpts));
            break;
          case 'rendezvous':
            output = fmt.formatRendezvous(await analyzer.analyzeRendezvous(analysisOpts));
            break;
          case 'set-fields':
            output = fmt.formatSetFields(await analyzer.analyzeSetFields(analysisOpts));
            break;
          case 'threads':
            output = fmt.formatThreads(await analyzer.analyzeThreads(analysisOpts));
            break;
          default:
            process.stderr.write(`Unknown mode: ${mode}\n`);
            process.exit(1);
        }
        writeOutput(output, opts.output);
      } finally {
        await analyzer.close();
      }
    } catch (err) {
      process.stderr.write(`Error: ${err instanceof Error ? err.message : err}\n`);
      process.exit(1);
    }
  });

// ---------------------------------------------------------------------------
// query
// ---------------------------------------------------------------------------

program
  .command('query')
  .description('Run a raw PerfettoSQL query against a trace file')
  .argument('<file>', 'Path to .trace file')
  .argument('<sql>', 'PerfettoSQL query')
  .option('-f, --format <fmt>', 'Output format: text, json', 'text')
  .option('-o, --output <file>', 'Write output to file instead of stdout')
  .action(async (file: string, sql: string, opts) => {
    try {
      const format = opts.format as OutputFormat;
      const fmt = getFormatter(format);
      const analyzer = await RokuAnalyzer.open(file);
      try {
        const result = await analyzer.query(sql);
        writeOutput(fmt.formatQueryResult(result), opts.output);
      } finally {
        await analyzer.close();
      }
    } catch (err) {
      process.stderr.write(`Error: ${err instanceof Error ? err.message : err}\n`);
      process.exit(1);
    }
  });

// ---------------------------------------------------------------------------
// compare
// ---------------------------------------------------------------------------

program
  .command('compare')
  .description('Compare two Roku Perfetto trace files')
  .argument('<before>', 'Path to "before" .trace file')
  .argument('<after>', 'Path to "after" .trace file')
  .option('--top <n>', 'Number of entries in ranked lists', '20')
  .option('-f, --format <fmt>', 'Output format: text, json', 'text')
  .option('-o, --output <file>', 'Write output to file instead of stdout')
  .action(async (before: string, after: string, opts) => {
    try {
      const format = opts.format as OutputFormat;
      const fmt = getFormatter(format);
      const analysisOpts = { top: parseInt(opts.top, 10) };
      const report = await comparePerfetto(before, after, analysisOpts);
      writeOutput(fmt.formatComparison(report), opts.output);
    } catch (err) {
      process.stderr.write(`Error: ${err instanceof Error ? err.message : err}\n`);
      process.exit(1);
    }
  });

// ---------------------------------------------------------------------------
// info
// ---------------------------------------------------------------------------

program
  .command('info')
  .description('Show metadata about a Perfetto trace file')
  .argument('<file>', 'Path to .trace file')
  .action(async (file: string) => {
    try {
      const analyzer = await RokuAnalyzer.open(file);
      try {
        const info = await analyzer.traceInfo();
        const fmt = new TextFormatter();
        console.log(fmt.formatTraceInfo(info));
      } finally {
        await analyzer.close();
      }
    } catch (err) {
      process.stderr.write(`Error: ${err instanceof Error ? err.message : err}\n`);
      process.exit(1);
    }
  });

program.parse();
