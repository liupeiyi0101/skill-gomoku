import { createServer } from 'node:http';
import { createReadStream, existsSync } from 'node:fs';
import { stat } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve, extname, sep } from 'node:path';
import { attachRooms, lanAddresses } from './rooms.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../dist/client');
const port = Number(process.env.PORT || 4173);
const mime = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.json': 'application/json',
  '.txt': 'text/plain; charset=utf-8',
  '.rsc': 'text/x-component',
  '.woff2': 'font/woff2',
};
if (!existsSync(resolve(root, 'index.html'))) {
  console.error('请先运行 pnpm build 生成网页。');
  process.exit(1);
}
const server = createServer(async (req, res) => {
  try {
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      res.writeHead(405);
      res.end();
      return;
    }
    const url = new URL(req.url, 'http://localhost');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'same-origin');
    if (url.pathname === '/api/lan-info') {
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ addresses: lanAddresses(port) }));
      return;
    }
    const pathname = decodeURIComponent(url.pathname);
    const target = resolve(
      root,
      '.' + (pathname === '/' ? '/index.html' : pathname),
    );
    if (!target.startsWith(root + sep)) {
      res.writeHead(403);
      res.end();
      return;
    }
    const info = await stat(target);
    if (!info.isFile()) {
      res.writeHead(404);
      res.end();
      return;
    }
    res.setHeader(
      'Content-Type',
      mime[extname(target)] || 'application/octet-stream',
    );
    res.setHeader(
      'Cache-Control',
      pathname.startsWith('/_next/static/')
        ? 'public,max-age=31536000,immutable'
        : 'no-cache',
    );
    if (req.method === 'HEAD') {
      res.end();
      return;
    }
    createReadStream(target)
      .on('error', () => res.destroy())
      .pipe(res);
  } catch {
    if (!res.headersSent) res.writeHead(404);
    res.end('Not found');
  }
});
attachRooms(server);
server.on('error', (error) => {
  console.error(
    error.code === 'EADDRINUSE'
      ? `端口 ${port} 已被使用。请关闭先前的游戏，或设置其他 PORT。`
      : error.message,
  );
  process.exitCode = 1;
});
server.listen(port, '0.0.0.0', () => {
  console.log(`弈间已启动\n本机：http://localhost:${port}/`);
  for (const address of lanAddresses(port)) console.log(`局域网：${address}/`);
  console.log('同一 Wi-Fi 下的朋友可用局域网地址打开。按 Ctrl+C 停止。');
});
