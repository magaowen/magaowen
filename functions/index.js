import { buildHome } from './_render.js';

export async function onRequest(context) {
  const { env } = context;
  try {
    const html = await buildHome(env);
    return new Response(html, {
      status: 200,
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'public, max-age=60',
      },
    });
  } catch (e) {
    return new Response('Server Error', { status: 500 });
  }
}
