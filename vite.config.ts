import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig, loadEnv} from 'vite';

export default defineConfig(({mode}) => {
  const env = loadEnv(mode, '.', '');
  return {
    plugins: [
      react(),
      tailwindcss(),
      {
        name: 'local-news-api',
        configureServer(server) {
          server.middlewares.use('/api/news', async (req, res, next) => {
            if (!req.url) {
              next();
              return;
            }

            if (req.method === 'OPTIONS') {
              res.statusCode = 200;
              res.end();
              return;
            }

            if (req.method !== 'GET') {
              next();
              return;
            }

            try {
              const requestUrl = new URL(req.url, 'http://localhost');
              const query = requestUrl.searchParams.get('query')?.trim() || 'Technology Career';
              const apiKey = env.NEWS_API_KEY;

              res.setHeader('Access-Control-Allow-Credentials', 'true');
              res.setHeader('Access-Control-Allow-Origin', '*');
              res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
              res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
              res.setHeader('Content-Type', 'application/json');

              if (!apiKey) {
                res.statusCode = 500;
                res.end(JSON.stringify({ error: 'NEWS_API_KEY environment variable is missing.' }));
                return;
              }

              const fromDate = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
              const upstreamUrl = `https://newsapi.org/v2/everything?q=${encodeURIComponent(query)}&from=${fromDate}&sortBy=popularity&apiKey=${apiKey}`;
              const response = await fetch(upstreamUrl);

              if (!response.ok) {
                res.statusCode = response.status;
                res.end(JSON.stringify({ error: `NewsAPI responded with status: ${response.status}` }));
                return;
              }

              const data = await response.json();
              res.statusCode = 200;
              res.end(JSON.stringify(data));
            } catch (error) {
              res.statusCode = 500;
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({
                error: error instanceof Error ? error.message : 'Failed to fetch news data.'
              }));
            }
          });
        },
      },
    ],
    define: {
      'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY),
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      headers: {
        'Cross-Origin-Opener-Policy': 'same-origin-allow-popups',
      },
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modifyâfile watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
    },
  };
});
