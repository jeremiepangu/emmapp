import { createServer } from 'node:http';
import { defineConfig, type Plugin, type ViteDevServer } from 'vite';
import react from '@vitejs/plugin-react';

/** Chromium resolves localhost to ::1 first; Vite's host 0.0.0.0 is IPv4-only. */
function listenIpv6Localhost(): Plugin {
  let ipv6: ReturnType<typeof createServer> | undefined;

  return {
    name: 'listen-ipv6-localhost',
    configureServer(server: ViteDevServer) {
      const httpServer = server.httpServer;
      if (!httpServer) {
        return;
      }
      httpServer.once('listening', () => {
        const address = httpServer.address();
        const port = typeof address === 'object' && address ? address.port : 5173;
        ipv6 = createServer(server.middlewares);
        ipv6.on('upgrade', (req, socket, head) => {
          httpServer.emit('upgrade', req, socket, head);
        });
        ipv6.on('error', (err) => {
          server.config.logger.warn(`IPv6 ::1:${port} unavailable: ${err.message}`);
        });
        ipv6.listen(port, '::1');
      });
    },
    closeBundle() {
      ipv6?.close();
    },
  };
}

export default defineConfig({
  plugins: [react(), listenIpv6Localhost()],
  base: process.env.GITHUB_PAGES === 'true' ? '/emmapp/' : '/',
  server: {
    host: '0.0.0.0',
    port: 5173,
    strictPort: true,
    // Cloud / Cursor preview Host headers are not always "localhost".
    allowedHosts: true,
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:3000',
        changeOrigin: true,
      },
    },
  },
});
