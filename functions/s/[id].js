import { buildDetail } from '../_render.js';

export async function onRequest(context) {
  const { env, params } = context;
  const id = params.id;
  try {
    const html = await buildDetail(env, id);
    const status = html.indexOf('未找到该软件') !== -1 ? 404 : 200;
    return new Response(html, {
      status,
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'public, max-age=60',
      },
    });
  } catch (e) {
    return new Response('Server Error', { status: 500 });
  }
}
