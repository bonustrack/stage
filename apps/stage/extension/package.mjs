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
