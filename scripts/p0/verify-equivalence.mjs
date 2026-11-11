import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const git = (...args) => execFileSync('git', args, { cwd: root, encoding: 'utf8', maxBuffer: 10 * 1024 * 1024 });
// Pin the pre-P0 revision; using HEAD could silently accept later rule changes.
const baseline = '8ef96ff';
const allowed = new Set([
  'src/analytics/features/pipeline.js', 'src/analytics/features/taskSpecificFeatures.js', 'src/analytics/features/version.js',
  'src/analytics/trials/constants.js', 'src/analytics/trials/taskFieldMappers.js', 'src/analytics/trials/validation.js',
  'src/lib/database.js', 'src/lib/behavioralSync.js', 'src/utils/resultSync.js',
]);
const testFile = (file) => /\.(test|testSupport)\.[cm]?[jt]sx?$|\/__tests__\/|\/__snapshots__\//.test(file);
const protectedFile = (file) => !testFile(file) && !allowed.has(file);
const scope = ['src', 'package.json', 'package-lock.json', 'supabase'];
const changed = git('diff', '--name-only', baseline, '--', ...scope).trim().split(/\r?\n/).filter(Boolean);
const untracked = git('ls-files', '--others', '--exclude-standard', '--', ...scope).trim().split(/\r?\n/).filter(Boolean);
const unexpected = [...new Set([...changed, ...untracked])].filter(protectedFile);
const tree = git('ls-tree', '-r', baseline, '--', ...scope).trim().split(/\r?\n/).map((line) => {
  const [metadata, file] = line.split('\t'); return { file, blob: metadata?.split(' ')[2] };
}).filter((row) => row.file);
const assessmentEvidence = tree.filter(({ file }) => /^src\/pages\/TestPage_(CBT|PM|SRT|ARI|LB|DCCS)\.jsx$/.test(file)
  || /^src\/utils\/.*(Protocol|Scoring)\.js$/.test(file) || file === 'src/utils/resultManager.js');
const report = { generatedAt: new Date().toISOString(), baseline: git('rev-parse', baseline).trim(),
  verification: 'Git source equivalence, excluding only the declared P0 research/sync changes and tests',
  protectedFileCount: tree.filter(({ file }) => protectedFile(file)).length,
  unexpectedChangedFiles: unexpected, assessmentSourceEvidence: assessmentEvidence,
  runtimeLimit: 'Does not prove physical timing, browser/device behavior or formal environment acceptance.' };
const outputIndex = process.argv.indexOf('--out');
if (outputIndex >= 0) {
  const output = process.argv[outputIndex + 1];
  if (!output) throw new Error('--out needs a path');
  fs.writeFileSync(path.resolve(root, output), JSON.stringify(report, null, 2) + '\n', { flag: 'wx' });
}
console.log(JSON.stringify(report, null, 2));
if (unexpected.length) process.exitCode = 1;
