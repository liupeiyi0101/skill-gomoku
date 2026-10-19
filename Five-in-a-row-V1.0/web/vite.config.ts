import tailwindcss from '@tailwindcss/postcss';
import vinext from 'vinext';
import { defineConfig } from 'vite';
import { attachRooms, lanAddresses } from './server/rooms.mjs';
export default defineConfig({
  resolve: { dedupe: ['react', 'react-dom'] },
  optimizeDeps: {
    include: [
      'react',
      'react-dom',
      'react-dom/client',
      '@base-ui/react/button',
      '@base-ui/react/dialog',
      '@base-ui/react/input',
    ],
  },
  css: { postcss: { plugins: [tailwindcss()] } },
  server: { host: '0.0.0.0', port: 4173, strictPort: true },
  plugins: [
    vinext(),
    {
      name: 'gomoku-lan',
      configureServer(server) {
        if (server.httpServer) attachRooms(server.httpServer);
        server.middlewares.use('/api/lan-info', (_req, res) => {
          res.setHeader('Content-Type', 'application/json');
          res.end(
            JSON.stringify({
              addresses: lanAddresses(server.config.server.port || 4173),
            }),
          );
        });
      },
    },
  ],
});
