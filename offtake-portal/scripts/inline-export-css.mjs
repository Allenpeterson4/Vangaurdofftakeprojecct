import { readdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const exportRoot = process.argv[2];
if (!exportRoot) throw new Error('Provide the exported site directory.');

async function listFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(entries.map(async (entry) => {
    const fullPath = path.join(directory, entry.name);
    return entry.isDirectory() ? listFiles(fullPath) : [fullPath];
  }));
  return nested.flat();
}

const files = await listFiles(exportRoot);
const stylesheets = files.filter((file) => file.endsWith('.css') && file.includes(`${path.sep}_next${path.sep}static${path.sep}chunks${path.sep}`));
if (stylesheets.length === 0) throw new Error('The static export has no compiled Next.js stylesheets.');

const css = (await Promise.all(stylesheets.map((file) => readFile(file, 'utf8'))))
  .join('\n')
  .replace(/<\/style/gi, '<\\/style');
const styleTag = `<style data-offtake-inline="true">${css}</style>`;
const pages = files.filter((file) => file.endsWith('.html'));
let updatedPages = 0;

for (const page of pages) {
  let html = await readFile(page, 'utf8');
  let cssInlined = false;
  html = html.replace(/<link\b[^>]*>/gi, (tag) => {
    const isStylesheet = /\brel=["']stylesheet["']/i.test(tag)
      && /\bhref=["'][^"']*\/_next\/static\/chunks\/[^"']+\.css["']/i.test(tag);
    if (isStylesheet) cssInlined = true;
    return isStylesheet ? styleTag : tag;
  });
  if (!cssInlined) throw new Error(`No compiled stylesheet reference found in ${path.relative(exportRoot, page)}.`);
  if (!/<script\b[^>]*\bsrc=["'][^"']*\/_next\/static\/chunks\/[^"']+\.js/i.test(html)) {
    throw new Error(`No external Next.js JavaScript chunks found in ${path.relative(exportRoot, page)}.`);
  }
  await writeFile(page, html);
  updatedPages++;
}

if (updatedPages === 0) throw new Error('No exported HTML pages were found to style.');
console.log(`Embedded compiled CSS in ${updatedPages} exported HTML pages; left JavaScript chunks external.`);
