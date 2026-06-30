'use strict';

const http = require('http');

// Đọc PORT công khai của Render TRƯỚC khi ghi đè
const PUBLIC_PORT = parseInt(process.env.PORT || '10000', 10);
const INTERNAL_PORT = 3001;
const INTERNAL_HOST = '127.0.0.1';

// Override PORT/HOSTNAME để Next.js bind vào cổng nội bộ có thể proxy được
process.env.PORT = String(INTERNAL_PORT);
process.env.HOSTNAME = '0.0.0.0';

// Khởi động Next.js standalone
require('./server.js');

// CORS – đọc origin được phép từ env var của Render
const ALLOWED_ORIGINS = (process.env.CORS_ALLOWED_ORIGINS || '')
  .split(',')
  .map(o => o.trim())
  .filter(Boolean);

function setCorsHeaders(req, res) {
  const origin = req.headers.origin || '';
  let allowedOrigin = '*';

  if (ALLOWED_ORIGINS.length > 0) {
    allowedOrigin = ALLOWED_ORIGINS.includes(origin)
      ? origin
      : ALLOWED_ORIGINS[0];
    res.setHeader('Vary', 'Origin');
  }

  res.setHeader('Access-Control-Allow-Origin', allowedOrigin);
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'X-Requested-With, Accept, Content-Type, Authorization');
}

// Poll cho đến khi Next.js thực sự sẵn sàng trả về HTTP response
function waitForNextJs(retries, callback) {
  const req = http.request(
    { hostname: INTERNAL_HOST, port: INTERNAL_PORT, path: '/', method: 'GET' },
    (res) => {
      res.resume(); // Drain body
      console.log(`>>> Next.js sẵn sàng trên :${INTERNAL_PORT} (HTTP ${res.statusCode})`);
      callback();
    }
  );

  req.setTimeout(3000, () => {
    req.destroy();
  });

  req.on('error', () => {
    if (retries > 0) {
      setTimeout(() => waitForNextJs(retries - 1, callback), 2000);
    } else {
      // Vẫn mở proxy sau khi hết thời gian chờ
      console.log('>>> Hết thời gian chờ Next.js, mở proxy...');
      callback();
    }
  });

  req.end();
}

// Chờ Next.js (tối đa 90 × 2s = 180s), sau đó mới mở CORS proxy
waitForNextJs(90, () => {
  const proxy = http.createServer((req, res) => {
    setCorsHeaders(req, res);

    // Phản hồi OPTIONS preflight ngay lập tức – không chuyển tiếp
    if (req.method === 'OPTIONS') {
      res.writeHead(204);
      res.end();
      return;
    }

    // Đọc toàn bộ body trước (để có thể log lỗi đầy đủ)
    const proxyReq = http.request(
      {
        hostname: INTERNAL_HOST,
        port: INTERNAL_PORT,
        path: req.url,
        method: req.method,
        headers: req.headers,
      },
      (proxyRes) => {
        res.writeHead(proxyRes.statusCode, proxyRes.headers);
        proxyRes.pipe(res, { end: true });
      }
    );

    proxyReq.on('error', (err) => {
      console.error('Proxy forward error:', err.message);
      if (!res.headersSent) {
        res.writeHead(502);
        res.end('Bad Gateway');
      }
    });

    req.pipe(proxyReq, { end: true });
  });

  proxy.listen(PUBLIC_PORT, () => {
    console.log(`>>> CORS Proxy đang lắng nghe trên :${PUBLIC_PORT} → Next.js :${INTERNAL_PORT}`);
  });
});
