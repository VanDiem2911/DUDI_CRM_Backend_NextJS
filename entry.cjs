'use strict';

const http = require('http');

// Đọc PORT công khai của Render TRƯỚC khi ghi đè
const PUBLIC_PORT = parseInt(process.env.PORT || '10000', 10);

// Next.js standalone chạy trên port nội bộ (không expose ra ngoài)
const INTERNAL_PORT = 3001;
process.env.PORT = String(INTERNAL_PORT);

// Khởi động Next.js standalone server trên port nội bộ
require('./server.js');

// Origin được phép (đọc từ env var của Render)
const ALLOWED_ORIGINS = (process.env.CORS_ALLOWED_ORIGINS || '')
  .split(',')
  .map(o => o.trim())
  .filter(Boolean);

function addCorsHeaders(req, res) {
  const origin = req.headers.origin || '';
  const allowedOrigin =
    ALLOWED_ORIGINS.length === 0
      ? '*'
      : ALLOWED_ORIGINS.includes(origin)
      ? origin
      : ALLOWED_ORIGINS[0];

  res.setHeader('Access-Control-Allow-Origin', allowedOrigin);
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'X-Requested-With, Accept, Content-Type, Authorization');
  if (ALLOWED_ORIGINS.length > 0) {
    res.setHeader('Vary', 'Origin');
  }
}

// Chờ Next.js sẵn sàng trước khi mở proxy
function waitForNextJs(retries, callback) {
  const req = http.request({ hostname: '127.0.0.1', port: INTERNAL_PORT, path: '/api/health' }, () => callback());
  req.on('error', () => {
    if (retries > 0) {
      setTimeout(() => waitForNextJs(retries - 1, callback), 1000);
    } else {
      // Nếu không có /api/health thì Next.js vẫn đang chạy, cứ mở proxy
      callback();
    }
  });
  req.end();
}

setTimeout(() => {
  const proxy = http.createServer((req, res) => {
    addCorsHeaders(req, res);

    // Phản hồi OPTIONS preflight ngay lập tức
    if (req.method === 'OPTIONS') {
      res.writeHead(204);
      res.end();
      return;
    }

    // Chuyển tiếp request sang Next.js
    const proxyReq = http.request(
      {
        hostname: '127.0.0.1',
        port: INTERNAL_PORT,
        path: req.url,
        method: req.method,
        headers: req.headers,
      },
      (proxyRes) => {
        // Giữ lại response headers từ Next.js nhưng đảm bảo CORS headers luôn có
        res.writeHead(proxyRes.statusCode, proxyRes.headers);
        proxyRes.pipe(res, { end: true });
      }
    );

    proxyReq.on('error', (err) => {
      console.error('Proxy request error:', err.message);
      if (!res.headersSent) {
        res.writeHead(502);
        res.end('Bad Gateway');
      }
    });

    req.pipe(proxyReq, { end: true });
  });

  proxy.listen(PUBLIC_PORT, () => {
    console.log(`>>> CORS Proxy đang lắng nghe trên :${PUBLIC_PORT}`);
    console.log(`>>> Next.js đang chạy nội bộ trên :${INTERNAL_PORT}`);
  });
}, 8000); // Chờ 8 giây để Next.js khởi động xong
