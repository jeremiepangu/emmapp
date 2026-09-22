import { existsSync } from 'fs';
import * as http from 'http';
import * as net from 'net';
import { join, resolve } from 'path';
import type { NestExpressApplication } from '@nestjs/platform-express';
import type { Request, Response, NextFunction } from 'express';

const VITE_HOST = '127.0.0.1';
const VITE_PORT = Number(process.env.VITE_PORT) || 5173;

function webDistDir() {
  return resolve(join(__dirname, '..', '..', '..', 'backoffice', 'dist'));
}

function sendDistFile(req: Request, res: Response, dist: string): boolean {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    return false;
  }
  const rel = req.path === '/' ? '/index.html' : req.path;
  const file = resolve(dist, `.${rel}`);
  if (!file.startsWith(dist) || !existsSync(file)) {
    const index = join(dist, 'index.html');
    if (existsSync(index)) {
      res.sendFile(index);
      return true;
    }
    return false;
  }
  res.sendFile(file);
  return true;
}

/** Proxy non-API GETs to Vite so the UI is reachable on the API port (8443). */
export function attachWebUi(app: NestExpressApplication) {
  const dist = webDistDir();

  app.use((req: Request, res: Response, next: NextFunction) => {
    if (req.path.startsWith('/api')) {
      return next();
    }

    const proxyReq = http.request(
      {
        hostname: VITE_HOST,
        port: VITE_PORT,
        path: req.originalUrl,
        method: req.method,
        headers: { ...req.headers, host: `${VITE_HOST}:${VITE_PORT}` },
      },
      (proxyRes) => {
        res.writeHead(proxyRes.statusCode || 502, proxyRes.headers);
        proxyRes.pipe(res);
      },
    );

    proxyReq.on('error', () => {
      if (sendDistFile(req, res, dist)) {
        return;
      }
      res
        .status(503)
        .type('text/plain')
        .send('Interface indisponible. Démarrez le back-office : cd backoffice && npm run dev');
    });

    req.pipe(proxyReq);
  });
}

export function attachViteHmr(httpServer: http.Server) {
  httpServer.on('upgrade', (req, socket, head) => {
    if (req.url?.startsWith('/api')) {
      return;
    }
    const target = net.connect(VITE_PORT, VITE_HOST, () => {
      const headerLines = Object.entries(req.headers)
        .map(([key, value]) => `${key}: ${Array.isArray(value) ? value.join(', ') : value ?? ''}`)
        .join('\r\n');
      target.write(`${req.method} ${req.url} HTTP/1.1\r\n${headerLines}\r\n\r\n`);
      if (head.length) {
        target.write(head);
      }
      target.pipe(socket);
      socket.pipe(target);
    });
    target.on('error', () => socket.destroy());
  });
}
