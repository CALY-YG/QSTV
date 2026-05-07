import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

const ENDPOINTS = {
  dytt: 'https://dyttzy.tv/api.php/provide/vod/',
  maoyan: 'https://api.maoyanapi.top/api.php/provide/vod/',
  maotai: 'https://caiji.maotaizy.cc/api.php/provide/vod/',
  wangwang: 'https://ww.tyyszy5.com/api.php/provide/vod/',
  x: 'https://xingba111.com/api.php/provide/vod/',
};

// Handle API Proxy
app.get('/api/proxy', async (req, res) => {
  try {
    const { s, ...apiParams } = req.query;
    if (!s || !ENDPOINTS[s]) {
      return res.status(404).json({ error: 'Unknown source: ' + s });
    }

    const baseUrl = ENDPOINTS[s];
    const qs = new URLSearchParams(apiParams).toString();
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
      res.setHeader('Cache-Control', 'public, max-age=60'); // Simple caching
      res.status(200).json(data);
    } catch (e) {
      res.status(502).json({
        error: 'Upstream returned non-JSON',
        status: response.status,
        preview: text.substring(0, 500),
        targetUrl
      });
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Serve static files from the React app
app.use(express.static(path.join(__dirname, 'dist')));

// The "catchall" handler: for any request that doesn't
// match one above, send back React's index.html file.
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server is running on port ${PORT}`);
});
