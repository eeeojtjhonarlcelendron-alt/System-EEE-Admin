import { readFile, writeFile } from 'node:fs/promises';
const src = await readFile(new URL('./src/lib/dataService.js', import.meta.url), 'utf8');
const match = src.match(/function parseDateValue\([^\)]*\)[\s\S]*?\n\}/);
if (!match) throw new Error('parseDateValue not found');
const code = match[0] + '\nexport { parseDateValue };';
await writeFile(new URL('./temp-parse.mjs', import.meta.url), code, 'utf8');
