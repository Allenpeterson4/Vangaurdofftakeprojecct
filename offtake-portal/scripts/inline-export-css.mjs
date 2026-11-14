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
const javascriptFiles = files.filter((file) => file.endsWith('.js') && file.includes(`${path.sep}_next${path.sep}static${path.sep}chunks${path.sep}`));
const javascriptByPath = new Map(await Promise.all(javascriptFiles.map(async (file) => [file, await readFile(file, 'utf8')])));

const css = (await Promise.all(stylesheets.map((file) => readFile(file, 'utf8'))))
  .join('\n')
  .replace(/<\/style/gi, '<\\/style');
const styleTag = `<style data-offtake-inline="true">${css}</style>`;
const pages = files.filter((file) => file.endsWith('.html'));
let updatedPages = 0;
let inlinedScripts = 0;

for (const page of pages) {
  let html = await readFile(page, 'utf8');
  let cssInlined = false;
  html = html.replace(/<link\b[^>]*>/gi, (tag) => {
    const isStylesheet = /\brel=["']stylesheet["']/i.test(tag)
      && /\bhref=["'][^"']*\/_next\/static\/chunks\/[^"']+\.css["']/i.test(tag);
    const isScriptPreload = /\brel=["']preload["']/i.test(tag)
      && /\bas=["']script["']/i.test(tag)
      && /\bhref=["'][^"']*\/_next\/static\/chunks\/[^"']+\.js(?:\?[^"']*)?["']/i.test(tag);
    if (isStylesheet) cssInlined = true;
    return isStylesheet ? styleTag : isScriptPreload ? '' : tag;
  });

  const updated = html.replace(/<script\b[^>]*\bsrc=(["'])([^"']+\.js(?:\?[^"']*)?)\1[^>]*>\s*<\/script>/gi, (tag, _quote, src) => {
    if (!src.includes('/_next/static/chunks/')) return tag;
    const assetUrl = new URL(src, 'https://offtake.invalid');
    const assetPath = path.resolve(exportRoot, `.${decodeURIComponent(assetUrl.pathname)}`);
    const source = javascriptByPath.get(assetPath);
    if (source === undefined) throw new Error(`Missing JavaScript asset ${src} referenced by ${path.relative(exportRoot, page)}.`);

    const filename = path.basename(assetPath);
    const javascript = source.replace(
      /(\.push\()\["object"==typeof document\?document\.currentScript:void 0,/,
      (_match, push) => `${push}["/_next/static/chunks/${filename}",`,
    ).replace(/<\/script/gi, '<\\/script');

    const openingTag = tag.slice(0, tag.indexOf('>'));
    const attributes = openingTag
      .replace(/\s+src=(["'])[^"']*\1/i, '')
      .replace(/\s+(?:async|defer)(?:=(?:"[^"]*"|'[^']*'))?/gi, '');
    inlinedScripts++;
    return `${attributes} data-offtake-inline-script="true">${javascript}</script>`;
  });
  if (!cssInlined) throw new Error(`No compiled stylesheet reference found in ${path.relative(exportRoot, page)}.`);
  if (/<script\b[^>]*\bsrc=["'][^"']*\/_next\/static\/chunks\/[^"']+\.js/i.test(updated)) {
    throw new Error(`A compiled JavaScript asset remains external in ${path.relative(exportRoot, page)}.`);
  }
  await writeFile(page, updated);
  updatedPages++;
}

if (updatedPages === 0) throw new Error('No exported HTML pages were found to style.');
if (inlinedScripts === 0) throw new Error('No compiled JavaScript chunks were embedded.');
console.log(`Embedded compiled CSS and ${inlinedScripts} JavaScript chunks in ${updatedPages} exported HTML pages.`);
