import { readFile, readdir, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';

export async function prepareExtensionAssets(directory) {
  await rename(path.join(directory, '_expo'), path.join(directory, 'expo'));
  await rewriteAssetPaths(directory);
}

async function rewriteAssetPaths(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const file = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      await rewriteAssetPaths(file);
    } else if (/\.(html|js|css|json)$/.test(entry.name)) {
      const content = await readFile(file, 'utf8');
      await writeFile(file, content.replaceAll('/_expo/', '/expo/'));
    }
  }
}

export function prepareExtensionHtml(html) {
  const scripts = [];
  const document = html.replace(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi, (tag, attributes, content) => {
    if (/\bsrc\s*=/i.test(attributes)) {
      if (!/\bsrc\s*=\s*["']\/(?!\/)[^"']+["']/i.test(attributes)) {
        throw new Error('The extension can only load packaged scripts.');
      }
      return tag;
    }
    const name = `inline-${scripts.length}.js`;
    scripts.push({ name, content });
    return `<script${attributes} src="/${name}"></script>`;
  });
  return { html: document, scripts };
}
