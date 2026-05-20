import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

import { cloudflare } from "@cloudflare/vite-plugin";

const ENDPOINTS: Record<string, string> = {
  dytt: 'https://dyttzy.tv/api.php/provide/vod/',
  maoyan: 'https://api.maoyanapi.top/api.php/provide/vod/',
  maotai: 'https://caiji.maotaizy.cc/api.php/provide/vod/',
};

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), {
    name: 'api-proxy',
    configureServer(server) {
      server.middlewares.use('/api/proxy', async (req, res) => {
        try {
          const url = new URL(req.url!, 'http://localhost');
          const source = url.searchParams.get('s') || '';
          url.searchParams.delete('s');
          const baseUrl = ENDPOINTS[source];
          if (!baseUrl) {
            res.statusCode = 404;
            res.end(JSON.stringify({ error: 'Unknown source: ' + source }));
            return;
          }
          const targetUrl = baseUrl + '?' + url.searchParams.toString();
          const r = await fetch(targetUrl, {
            headers: { 'User-Agent': 'Mozilla/5.0', 'Accept': 'application/json' },
          });
          const data = await r.json();
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify(data));
        } catch (e: any) {
          res.statusCode = 500;
          res.end(JSON.stringify({ error: e.message }));
        }
      });
    },
  }, cloudflare()],
})