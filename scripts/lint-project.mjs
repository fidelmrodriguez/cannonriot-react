import { readdir, readFile } from 'node:fs/promises';
import { extname, join, relative } from 'node:path';

const root = new URL('..', import.meta.url).pathname;
const allowed = new Set(['.ts', '.tsx', '.js', '.mjs', '.css', '.html', '.md', '.json']);
const ignored = new Set(['node_modules', 'dist', 'playwright-report', 'test-results']);
const problems = [];

async function walk(dir) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    if (ignored.has(entry.name)) continue;
    const path = join(dir, entry.name);
    if (entry.isDirectory()) await walk(path);
    else if (allowed.has(extname(entry.name))) {
      const text = await readFile(path, 'utf8');
      const rel = relative(root, path);
      if (/\bBUILD\s*\d+\b/i.test(text)) problems.push(`${rel}: contains internal build numbering`);
      if (/console\.log\(/.test(text) && rel.startsWith('src/')) problems.push(`${rel}: console.log left in production source`);
      if (rel.startsWith('src/') && text.split(/\r?\n/).some((line) => /(?:\/\/|\/\*|\*)[^\n]*\b(?:TODO|FIXME)\b/.test(line))) problems.push(`${rel}: unresolved TODO/FIXME comment`);
    }
  }
}

await walk(root);
if (problems.length) {
  console.error(problems.join('\n'));
  process.exit(1);
}
console.log('Project lint checks passed.');
