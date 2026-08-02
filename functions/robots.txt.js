export function onRequest() {
  const body = `User-agent: *\nAllow: /\n\nSitemap: https://soft-share.pages.dev/sitemap.xml\n`;
  return new Response(body, {
    status: 200,
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  });
}
