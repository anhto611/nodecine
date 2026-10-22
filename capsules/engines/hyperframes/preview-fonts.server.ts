/**
 * The web fonts a project's scenes ask for, as tags for the head of its preview page.
 *
 * A scene loads its faces with a `<link rel="stylesheet">` kept inside its `<template>`, and the
 * preview bundle does not carry those links into the page it writes: the scenes kept naming
 * "Be Vietnam Pro" and the page fell back to Arial, whose stacked Vietnamese accents collide. The
 * producer's render resolves the faces itself, so only the preview lost them. Collected from every
 * file and set in the page's head once each, they load before the first frame is drawn.
 */
export function stylesheetLinks(files: Record<string, string>): string {
  const hrefs = new Set<string>();
  for (const [file, html] of Object.entries(files)) {
    if (!file.endsWith('.html')) continue;
    for (const [tag] of html.matchAll(/<link\b[^>]*>/gi)) {
      if (!/\brel\s*=\s*["']?stylesheet\b/i.test(tag)) continue;
      const href = /\bhref\s*=\s*["']([^"']+)["']/i.exec(tag)?.[1];
      // Only a sheet served from elsewhere: a local one is a file the bundle already inlines.
      if (href && /^https:\/\//i.test(href)) hrefs.add(href);
    }
  }
  return [...hrefs].map((href) => `<link rel="stylesheet" href="${href.replace(/"/g, '&quot;')}" />`).join('');
}
