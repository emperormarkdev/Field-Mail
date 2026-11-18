import { defineConfig, loadEnv, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';
import { fileURLToPath, URL } from 'node:url';
import type { IncomingMessage, ServerResponse } from 'node:http';

function localApiSendPlugin(mode: string): Plugin {
  return {
    name: 'fieldmail-local-api-send',
    configureServer(server) {
      server.middlewares.use('/api/send', async (req: IncomingMessage, res: ServerResponse) => {
        // Reload .env / .env.local on each request so edits take effect without restarting Vite
        const env = loadEnv(mode, process.cwd(), '');
        for (const [k, v] of Object.entries(env)) {
          if (process.env[k] === undefined || v !== '') {
            process.env[k] = v;
          }
        }

        const chunks: Buffer[] = [];
        for await (const chunk of req) {
          chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
        }
        const rawText = Buffer.concat(chunks).toString('utf8');
        let parsedBody: unknown = undefined;
        if (rawText) {
          try {
            parsedBody = JSON.parse(rawText);
          } catch {
            parsedBody = undefined;
          }
        }

        const vercelReq = Object.assign(req, { body: parsedBody });
        const vercelRes = Object.assign(res, {
          status(code: number) {
            res.statusCode = code;
            return vercelRes;
          },
          json(payload: unknown) {
            if (!res.headersSent) {
              res.setHeader('Content-Type', 'application/json; charset=utf-8');
            }
            res.end(JSON.stringify(payload));
            return vercelRes;
          },
        });

        const mod = await server.ssrLoadModule('/api/send.ts');
        await mod.default(vercelReq, vercelRes);
      });
    },
  };
}

export default defineConfig(({ mode }) => ({
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  plugins: [
    react(),
    tailwindcss(),
    localApiSendPlugin(mode),
    VitePWA({
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'sw.ts',
      registerType: 'prompt',
      injectRegister: null,
      includeAssets: ['favicon.svg', 'apple-touch-icon.png'],
      manifest: {
        id: '/',
        name: 'Fieldmail',
        short_name: 'Fieldmail',
        description: 'Write field reports offline and send them as email text and printable PDF.',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        orientation: 'any',
        background_color: '#1d4ed8',
        theme_color: '#1d4ed8',
        lang: 'en',
        categories: ['productivity', 'business'],
        icons: [
          { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: '/icons/maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      injectManifest: {
        globPatterns: ['**/*.{js,css,html,svg,png,ico,woff2}'],
        maximumFileSizeToCacheInBytes: 6 * 1024 * 1024,
      },
      devOptions: { enabled: false },
    }),
  ],
  server: { host: true },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules/jspdf')) return 'jspdf';
          if (id.includes('node_modules/react')) return 'vendor';
          return undefined;
        },
      },
    },
  },
}));
