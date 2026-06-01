import { readFile } from 'node:fs/promises';
const src = await readFile(new URL('./src/lib/dataService.js', import.meta.url), 'utf8');
const fnMatch = src.match(/function parseDateValue\([\s\S]*?\n\}/);
const formatMatch = src.match(/function formatLocalDate\([\s\S]*?\n\}/);
if (!fnMatch || !formatMatch) throw new Error('missing parser code');
const code = formatMatch[0] + '\n' + fnMatch[0] + '\nexports.parseDateValue = parseDateValue;';
const tmp = new Function('exports', code);
const exports = {};
tmp(exports);
const parseDateValue = exports.parseDateValue;
for (const val of ['2026-05-27T16:00:00.000Z', '2026-05-28T00:00:00.000Z', '2026-05-28']) {
  console.log(val, '=>', parseDateValue(val));
}
