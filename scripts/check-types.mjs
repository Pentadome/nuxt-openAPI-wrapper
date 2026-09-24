import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const vueTscCli = require.resolve('vue-tsc/bin/vue-tsc.js');
const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const nodeModulesPath = /(?:^|[\\/])node_modules(?:[\\/]|$)/i;
const typeError = /\berror TS\d+\b/i;
const checks = [
  { name: 'root', cwd: repositoryRoot },
  { name: 'playground', cwd: path.join(repositoryRoot, 'playground') },
];

let failed = false;
for (const check of checks) {
  const result = spawnSync(
    process.execPath,
    [vueTscCli, '--noEmit', '--pretty', 'false'],
    {
      cwd: check.cwd,
      encoding: 'utf8',
      maxBuffer: 10 * 1024 * 1024,
      windowsHide: true,
    },
  );
  const output = `${result.stdout ?? ''}${result.stderr ?? ''}`;
  const lines = output.split(/\r?\n/);
  const filteredLines = [];
  let suppressedErrors = 0;
  let remainingErrors = 0;
  let diagnosticBlock = [];
  let suppressCurrentBlock = false;

  const flushDiagnosticBlock = () => {
    if (diagnosticBlock.length === 0) return;
    if (suppressCurrentBlock) {
      suppressedErrors++;
    } else {
      filteredLines.push(...diagnosticBlock);
    }
    diagnosticBlock = [];
    suppressCurrentBlock = false;
  };

  for (const line of lines) {
    if (typeError.test(line)) {
      flushDiagnosticBlock();
      diagnosticBlock = [line];
      suppressCurrentBlock = nodeModulesPath.test(line);
      if (!suppressCurrentBlock) remainingErrors++;
    } else if (diagnosticBlock.length > 0) {
      diagnosticBlock.push(line);
    } else {
      filteredLines.push(line);
    }
  }
  flushDiagnosticBlock();

  const visibleOutput = filteredLines.join('\n').trim();
  if (visibleOutput) console.log(`[${check.name}]\n${visibleOutput}`);
  if (suppressedErrors) {
    console.log(
      `[${check.name}] ignored ${suppressedErrors} TypeScript error(s) under node_modules`,
    );
  }

  if (result.error) {
    console.error(`[${check.name}] failed to start vue-tsc: ${result.error.message}`);
    failed = true;
  } else if (remainingErrors > 0 || (result.status !== 0 && suppressedErrors === 0)) {
    console.error(`[${check.name}] vue-tsc failed with exit code ${result.status}`);
    failed = true;
  }
}

if (failed) process.exitCode = 1;
