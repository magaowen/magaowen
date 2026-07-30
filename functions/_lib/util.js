// 公共工具：CORS、JSON 响应、请求体解析
export const CORS = {
  "access-control-allow-origin": "*",
  "access-control-allow-headers": "*",
  "access-control-allow-methods": "GET,POST,PUT,DELETE,OPTIONS"
};

export function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json", ...CORS }
  });
}

export async function readBody(request) {
  try {
    const t = await request.text();
    return t ? JSON.parse(t) : {};
  } catch (e) {
    return {};
  }
}

export function todayStr() {
  return new Date().toISOString().slice(0, 10);
}
