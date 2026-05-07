const ENDPOINTS = {
  dytt: 'https://dyttzy.tv/api.php/provide/vod/',
  maoyan: 'https://api.maoyanapi.top/api.php/provide/vod/',
  maotai: 'https://caiji.maotaizy.cc/api.php/provide/vod/',
  wangwang: 'https://ww.tyyszy5.com/api.php/provide/vod/',
  x: 'https://xingba111.com/api.php/provide/vod/',
};

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, HEAD, POST, OPTIONS",
  "Access-Control-Max-Age": "86400",
};

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    // API 代理接口
    if (url.pathname.startsWith('/api/proxy')) {
      if (request.method === "OPTIONS") {
        return new Response(null, { headers: corsHeaders });
      }

      try {
        const s = url.searchParams.get('s');
        if (!s || !ENDPOINTS[s]) {
          return new Response(JSON.stringify({ error: 'Unknown source: ' + s }), {
            status: 404,
            headers: { 'Content-Type': 'application/json', ...corsHeaders }
          });
        }

        const baseUrl = ENDPOINTS[s];
        const apiParams = new URLSearchParams(url.search);
        apiParams.delete('s');
        const qs = apiParams.toString();
        const targetUrl = baseUrl + (qs ? '?' + qs : '');

        const response = await fetch(targetUrl, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            'Accept': 'application/json, text/javascript, */*; q=0.01',
          },
        });

        const text = await response.text();
        try {
          const data = JSON.parse(text);
          return new Response(JSON.stringify(data), {
            status: 200,
            headers: {
              'Content-Type': 'application/json',
              'Cache-Control': 's-maxage=60, stale-while-revalidate=300',
              ...corsHeaders
            }
          });
        } catch (e) {
          return new Response(JSON.stringify({
            error: 'Upstream returned non-JSON',
            status: response.status,
            preview: text.substring(0, 500),
            targetUrl
          }), {
            status: 502,
            headers: { 'Content-Type': 'application/json', ...corsHeaders }
          });
        }
      } catch (error) {
        return new Response(JSON.stringify({ error: error.message }), {
          status: 500,
          headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
      }
    }

    // 对于所有其他请求，返回前端静态文件 (Vite 编译产物)
    return env.ASSETS.fetch(request);
  }
};
