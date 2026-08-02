import { allSoftwareIds } from './_render.js';
import { ensureSeed } from './_db.js';

export async function onRequest(context) {
  const { env } = context;
  await ensureSeed(env);
  const ids = await allSoftwareIds(env);
  const base = 'https://soft-share.pages.dev';
  const urls = [`<url><loc>${base}/</loc><changefreq>daily</changefreq><priority>1.0</priority></url>`];
  ids.forEach(id => {
    urls.push(`<url><loc>${base}/s/${id}</loc><changefreq>weekly</changefreq><priority>0.8</priority></url>`);
  });
  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join('\n')}\n</urlset>`;
  return new Response(xml, {
    status: 200,
    headers: { 'Content-Type': 'application/xml; charset=utf-8' },
  });
}
